import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
  DEFAULT_RIVER_GAUGE_REFRESH_MS,
  riverGaugeSummary
} from "./river-gauges-v1.js?v=9.12.0";

import {
  loadRiverGaugeOperationalSnapshot
} from "./river-gauge-observations-v1.js?v=9.12.0";

import {
  FLOOD_SIGNAL_STORAGE_KEY,
  FLOOD_SIGNAL_MAX_AGE_MS,
  appendGaugeObservation,
  cleanFloodSignalHistory,
  compactFloodHistory,
  filterOperationalFloodGauges
} from "./river-flood-signals-v1.js?v=9.13.2";

import {
  FLOOD_EVENTS_STORAGE_KEY,cleanFloodEvents,reconcileFloodEvents
} from "./river-flood-events-v1.js?v=9.13.2";

import {
  recentFloodHistoryCandidate,
  recentFloodHistoryGap,
  classifyBoMRecentHistoryFailure,
  fetchBoMRecentHistory
} from "./bom-recent-river-history-v1.js?v=9.13.1";

export function riverGaugeOperationalSummary(
  feature
) {
  const base =
    riverGaugeSummary(
      feature
    );

  const properties =
    feature?.properties
    ?? {};

  const height =
    Number(
      properties
        .STORMTRACKER_HEIGHT_METRES
    );

  return {
    ...base,

    heightMetres:
      Number.isFinite(
        height
      )
        ? height
        : null,

    tendency:
      String(
        properties
          .STORMTRACKER_TENDENCY
        ?? "unknown"
      ),

    floodClass:
      String(
        properties
          .STORMTRACKER_FLOOD_CLASS
        ?? ""
      ),

    observedText:
      String(
        properties
          .STORMTRACKER_OBSERVED_TEXT
        ?? ""
      ),

    sourceProduct:
      String(
        properties
          .STORMTRACKER_SOURCE_PRODUCT
        ?? ""
      ),

    recentDataHref:
      String(
        properties
          .STORMTRACKER_RECENT_DATA_HREF
        ?? ""
      ),

    displayState:
      String(
        properties
          .STORMTRACKER_DISPLAY_STATE
        ?? "unknown"
      ),

    tidalContext:
      String(
        properties
          .STORMTRACKER_TIDAL_CONTEXT
        ?? ""
      ),

    alertReason:
      String(properties.STORMTRACKER_ALERT_REASON ?? ""),

    riseRateMetresPerHour:
      typeof properties.STORMTRACKER_RISE_RATE_M_PER_H === "number"
        ? properties.STORMTRACKER_RISE_RATE_M_PER_H : null,

    rateIntervalMinutes:
      typeof properties.STORMTRACKER_RATE_INTERVAL_MINUTES === "number"
        ? properties.STORMTRACKER_RATE_INTERVAL_MINUTES : null,

    tidalBaselineMetresPerHour:
      typeof properties.STORMTRACKER_TIDAL_BASELINE_M_PER_H === "number"
        ? properties.STORMTRACKER_TIDAL_BASELINE_M_PER_H : null,

    alertPersisted:Boolean(properties.STORMTRACKER_ALERT_PERSISTED),
    recoveryReadings:Number(properties.STORMTRACKER_RECOVERY_READINGS??0),
    rapidRise:Boolean(properties.STORMTRACKER_RAPID_RISE)
  };
}

// Same water marker at every stage; only BoM flood severity changes colour.
// ONE blue arrow badge is used for measured rapid rise / possible flash flooding.
// A below-minor candidate is the blue icon with the same blue arrow.
const FLOOD_MARKER_COLORS=Object.freeze({
  "rapid-rise":"#1269e8",minor:"#1ca958",
  moderate:"#f4bf17",major:"#dc343e"
});
export function createRiverGaugeMarkerImage(state,rapidRise=false){
  const level=Object.hasOwn(FLOOD_MARKER_COLORS,state)?state:"rapid-rise";
  const colour=FLOOD_MARKER_COLORS[level];
  const arrow=rapidRise || level==="rapid-rise";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 88">
    <path d="M35 5 C16 5 6 19 6 35 C6 54 19 65 35 80 C51 65 64 54 64 35 C64 19 54 5 35 5Z"
      fill="${colour}" stroke="#132337" stroke-width="2.6" stroke-linejoin="round"/>
    <circle cx="35" cy="34" r="21" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M20 30 Q25 35 30 30 T40 30 T50 30
             M20 39 Q25 44 30 39 T40 39 T50 39"
      fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round"/>
    ${arrow?`<circle cx="61" cy="16" r="14" fill="#1269e8"
       stroke="#ffffff" stroke-width="3"/>
      <path d="M61 6 L52.5 17 H57.5 V25 H64.5 V17 H69.5Z"
        fill="#fff"/>`:""}
  </svg>`;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}

export function createRiverGaugeLayer({
  viewer,

  CesiumRef =
    globalThis.Cesium,

  fetchImpl =
    globalThis.fetch,

  refreshMs =
    DEFAULT_RIVER_GAUGE_REFRESH_MS,

  visible =
    false,

  onStatus =
    () => {},

  onUpdate =
    () => {},

  storage = globalThis.localStorage,
  now = () => Date.now()
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "River-gauge layer requires Cesium and a viewer."
    );
  }

  const dataSource =
    new CesiumRef
      .CustomDataSource(
        "river-gauges"
      );

  dataSource.show =
    Boolean(
      visible
    );

  viewer.dataSources.add(
    dataSource
  );

  const markerImages =
    new Map();

  let currentFeatures = [];
  let history = {};
  let floodEvents={};
  try {
    floodEvents=cleanFloodEvents(
      JSON.parse(storage?.getItem(FLOOD_EVENTS_STORAGE_KEY)??"{}"),now()
    );
  }catch{floodEvents={};}
  const persistEventState=()=>{
    try{storage?.setItem(FLOOD_EVENTS_STORAGE_KEY,JSON.stringify(floodEvents));}
    catch{/* storage disabled/full: preserve active in-memory state */}
  };
  try {
    history = cleanFloodSignalHistory(
      JSON.parse(storage?.getItem(FLOOD_SIGNAL_STORAGE_KEY) ?? "{}"), now()
    );
  } catch {
    history = {};
  }
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;
  let diagnostics = null;
  // Per-session bounded requests. The existing worker handles CORS, while
  // observations and flood classification remain entirely in the browser.
  // Record attempted stations for diagnostics, not as a permanent retry ban.
  const recentAttempted = new Set();
  const recentNextAttemptAt = new Map();
  let recentLoading = null;
  // Optional historical station pages must never flood the relay or hold up
  // the core radar map when an upstream 403/429/502/503/504 occurs.
  let recentRelayBlockedUntil = 0;
  let latestSourceFeatures = [];
  let lastBulletinsPartial = false;

  function persistHistory(){
    try {storage?.setItem(FLOOD_SIGNAL_STORAGE_KEY,JSON.stringify(history));}
    catch {/* storage quotas/private mode must not break the map */}
  }

  function recentHistoryCoverage(features=latestSourceFeatures,at=now()){
    const gaps=features.map(feature=>recentFloodHistoryGap(feature,history,at))
      .filter(Boolean);
    return {
      incomplete:gaps.length,
      missingSource:gaps.filter(gap=>!gap.target).length
    };
  }

  async function backfillRecentBoMHistory(features){
    if(recentLoading)return recentLoading;
    const nowMs=now();
    if(nowMs<recentRelayBlockedUntil)return null;
    const list=features.map(f=>recentFloodHistoryCandidate(f,history,nowMs))
      .filter(Boolean).sort((a,b)=>Number(a.tidal)-Number(b.tidal));
    // A previously failed or insufficient station becomes eligible again
    // after its own cooldown. Cap each pass and fetch serially to protect BoM.
    const candidates=list.filter(item=>nowMs >= (recentNextAttemptAt.get(item.id)??0))
      .slice(0,12);
    if(!candidates.length)return null;
    recentLoading=(async()=>{
      let success=0,failures=0,noData=0,lastFailureScope=null;
      for(const target of candidates){
        if(now()<recentRelayBlockedUntil)break;
        recentAttempted.add(target.id);
        // A successful but still insufficient table may gain observations
        // later; never permanently blacklist this station.
        recentNextAttemptAt.set(target.id,now()+15*60*1000);
        try{
          const observations=await fetchBoMRecentHistory(target,{
            fetchImpl,timeoutMs:10000
          });
          if(!observations.length){
            // BoM explicitly has no recent usable measurements for this
            // station. Not a gateway failure, warning log, or false "safe".
            noData++;
            recentNextAttemptAt.set(target.id,now()+15*60*1000);
            continue;
          }
          const existing=new Map((history[target.id]??[])
            .map(x=>[x.time,x.height]));
          for(const obs of observations){
            if(!existing.has(obs.time))existing.set(obs.time,obs.height);
          }
          history[target.id]=[...existing].sort((a,b)=>a[0]-b[0])
            .map(([time,height])=>({time,height}));
          success++;
        }catch(error){
          failures++;
          const scope=classifyBoMRecentHistoryFailure(error);
          lastFailureScope=scope;
          if(scope==="station"){
            // Missing/expired tables are station-specific. Other stations
            // can still be checked on the same pass.
            recentNextAttemptAt.set(target.id,now()+60*60*1000);
          }else{
            // Upstream denial, timeout or transport failure affects the
            // whole optional service; one failure ends this request burst.
            recentRelayBlockedUntil=now()+15*60*1000;
          }
          if(failures===1 && scope==="service" &&
              error?.code!=="source_timeout" &&
              error?.name!=="AbortError")console.warn(
            "Optional BoM station history service unavailable; current flood bulletins retained:",
            String(error?.message??error)
          );
          if(scope==="service")break;
        }
      }
      if(success){
        history=compactFloodHistory(history,latestSourceFeatures,now());
        persistHistory();
        // Only re-render when genuine new observations arrived. A failed
        // optional history fetch must not rebuild the Cesium map.
        const signals=reconcileFloodEvents(
          latestSourceFeatures,history,floodEvents,now()
        );
        floodEvents=signals.events;
        persistEventState();
        render({type:"FeatureCollection",features:signals.features});
        diagnostics={...(diagnostics??{}),floodSignalCounts:signals.counts};
      }
      const coverage=recentHistoryCoverage();
      diagnostics={...(diagnostics??{}),
        historyScreeningIncomplete:coverage.incomplete,
        historySourceMissing:coverage.missingSource,
        recentHistory:{loaded:success,failed:failures,noData,
          attempted:recentAttempted.size,screeningIncomplete:coverage.incomplete,
          missingSource:coverage.missingSource,blockedUntil:recentRelayBlockedUntil}};
      if(failures||success||noData){
        const counts=diagnostics.floodSignalCounts??{};
        const count=currentFeatures.length;
        const incompleteText=coverage.incomplete
          ? ` · rapid-rise screening incomplete for ${coverage.incomplete} rising gauge(s)`
          : "";
        const missingText=coverage.missingSource
          ? ` · ${coverage.missingSource} without a valid history link`
          : "";
        onStatus({kind:coverage.incomplete||lastBulletinsPartial?"warning":"ok",
          message:`${count} qualifying flood signals · ${success} station histories loaded`+
            (failures?` · ${failures} source failures (${lastFailureScope??"unknown"})`:"")+
            (noData?` · ${noData} station(s) without recent history`:"")+
            incompleteText+missingText+
            " · screening only; follow BoM warnings",
          count,...counts,partial:lastBulletinsPartial,
          screeningIncomplete:coverage.incomplete,
          historySourceMissing:coverage.missingSource,
          historyLoaded:success,historyFailed:failures,historyNoData:noData});
      }
    })();
    try{return await recentLoading;}
    finally{recentLoading=null;}
  }


  function markerImage(state,rapidRise=false){
    const key=state+":"+(rapidRise?"rising":"normal");
    if(!markerImages.has(key))
      markerImages.set(key,createRiverGaugeMarkerImage(state,rapidRise));
    return markerImages.get(key);
  }

  function render(
    payload
  ) {
    currentFeatures =
      payload?.features
      ?? [];

    dataSource.entities
      .suspendEvents();

    dataSource.entities
      .removeAll();

    for (
      const feature
      of currentFeatures
    ) {
      const summary =
        riverGaugeOperationalSummary(
          feature
        );

      if (
        !Number.isFinite(
          summary.longitude
        )
        || !Number.isFinite(
          summary.latitude
        )
      ) {
        continue;
      }

      const entity =
        dataSource.entities
          .add({
            id:
              summary.id,

            name:
              summary.name,

            position:
              CesiumRef.Cartesian3
                .fromDegrees(
                  summary.longitude,
                  summary.latitude,
                  0
                ),

            billboard: {
              image:
                markerImage(
                  summary.displayState,summary.rapidRise
                ),

              width: 38,
              height: 42,

              verticalOrigin:
                CesiumRef
                  .VerticalOrigin
                  ?.CENTER,

              heightReference:
                CesiumRef
                  .HeightReference
                  ?.CLAMP_TO_GROUND,

              disableDepthTestDistance:
                Number
                  .POSITIVE_INFINITY
            }
          });

      entity
        .stormTrackerRiverGaugeId =
        summary.id;
    }

    dataSource.entities
      .resumeEvents();

    viewer.scene
      .requestRender();

    onUpdate(
      currentFeatures
        .slice(),
      diagnostics
    );
  }

  async function refresh({
    force =
      false
  } = {}) {
    if (loading) {
      return loading;
    }

    loading =
      (async () => {
        onStatus({
          kind:
            "loading",

          message:
            "Checking BoM river gauges..."
        });

        const result =
          await loadRiverGaugeOperationalSnapshot({
            fetchImpl
          });

        const observedAt = now();
        history = cleanFloodSignalHistory(history, observedAt);
        for (const feature of result.payload.features) {
          appendGaugeObservation(history, feature, observedAt);
        }
        history = compactFloodHistory(
          history, result.payload.features, observedAt
        );
        try {
          storage?.setItem(FLOOD_SIGNAL_STORAGE_KEY, JSON.stringify(history));
        } catch {
          // Browser storage may be disabled or full; fresh evidence still works.
        }

        latestSourceFeatures = result.payload.features;
        lastBulletinsPartial = Boolean(result.partialBulletins);
        const alerts = reconcileFloodEvents(
          result.payload.features,history,floodEvents,observedAt
        );
        floodEvents=alerts.events;
        persistEventState();
        diagnostics = {...result, floodSignalCounts:alerts.counts};
        render({type:"FeatureCollection",features:alerts.features});

        lastLoadedAt =
          observedAt;

        const summaries =
          currentFeatures.map(
            riverGaugeOperationalSummary
          );

        const {minor,major,moderate,rapidRise,tidalAnomaly} = alerts.counts;

        const screening=recentHistoryCoverage(latestSourceFeatures,observedAt);
        diagnostics.historyScreeningIncomplete=screening.incomplete;
        diagnostics.historySourceMissing=screening.missingSource;

        const partialText =
          result.partialBulletins
            ? ` · partial (${result.failedProducts.length} product${result.failedProducts.length === 1 ? "" : "s"} unavailable)`
            : "";

        onStatus({
          kind:
            (result.partialBulletins || screening.incomplete)
              ? "warning"
              : "ok",

          message:
            `${summaries.length} qualifying flood signal${summaries.length === 1 ? "" : "s"} · ${major} major · ${moderate} moderate · ${minor} minor · ${rapidRise} rapid above minor · ${tidalAnomaly} unusual tidal rise${partialText}${screening.incomplete ? ` · rapid-rise screening incomplete for ${screening.incomplete} rising gauge(s)` : ""}${screening.missingSource ? ` · ${screening.missingSource} without a valid history link` : ""} · screening only; follow BoM warnings`,

          count:
            summaries.length,

          major,
          moderate,
          minor,
          rapidRise,
          tidalAnomaly,

          partial:
            result.partialBulletins,

          screeningIncomplete:
            screening.incomplete,

          historySourceMissing:
            screening.missingSource,

          failedProducts:
            result.failedProducts,

          loadedAt:
            lastLoadedAt
        });

        // Bootstrap only plausible rising stations asynchronously. Severe
        // BoM classifications render immediately without waiting for history.
        void backfillRecentBoMHistory(latestSourceFeatures).catch(error=>{
          console.warn("BoM history bootstrap skipped:",error);
        });
        return currentFeatures;
      })();

    try {
      return await loading;
    } catch (error) {
      // Never leave old warning-looking markers in place after a prolonged
      // upstream outage: an old reading is not a current flood signal.
      const expired = lastLoadedAt && now()-lastLoadedAt > FLOOD_SIGNAL_MAX_AGE_MS;
      if (expired) {
        render({type:"FeatureCollection",features:[]});
      }
      onStatus({
        kind:
          "error",

        message:
          `${error?.message ?? String(error)}${expired ? " · old flood markers cleared" : ""}`
      });

      throw error;
    } finally {
      loading =
        null;
    }
  }

  function setVisible(
    nextVisible
  ) {
    dataSource.show =
      Boolean(
        nextVisible
      );

    viewer.scene
      .requestRender();

    if (
      dataSource.show
    ) {
      const stale =
        !lastLoadedAt
        || (
          Date.now()
          - lastLoadedAt
        ) >= refreshMs;

      if (stale) {
        refresh()
          .catch(
            () => {}
          );
      }
    }
  }

  function start() {
    if (timer) {
      return;
    }

    // Keep collecting observed water heights even when the visual layer is
    // toggled off, otherwise a first-time alert has no measured rise history.
    // This only works while the browser tab is open; no backend is required.
    refresh().catch(() => {});

    timer =
      setInterval(
        () => {
          if (
            typeof document
              !== "undefined"
            && document.hidden
          ) {
            return;
          }

          refresh()
            .catch(
              () => {}
            );
        },
        refreshMs
      );
  }

  function stop() {
    if (!timer) {
      return;
    }

    clearInterval(
      timer
    );

    timer =
      null;
  }

  function featureById(
    id
  ) {
    const wanted =
      String(
        id ?? ""
      );

    return (
      currentFeatures
        .find(
          feature =>
            String(
              feature.id
            )
            === wanted
        )
      ?? null
    );
  }

  return {
    dataSource,
    refresh,
    setVisible,
    start,
    stop,
    featureById,

    get features() {
      return currentFeatures
        .slice();
    },

    get lastLoadedAt() {
      return lastLoadedAt;
    },

    get diagnostics() {
      return diagnostics;
    },

    get historyStationCount() {
      return Object.keys(history).length;
    },

    get activeScreeningEvents(){return Object.keys(floodEvents).length;},

    get recentHistoryRequestCount() {
      return recentAttempted.size;
    },

    attribution:
      BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
  };
}
