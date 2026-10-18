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
    recoveryReadings:Number(properties.STORMTRACKER_RECOVERY_READINGS??0)
  };
}

const STATE_STYLE =
  Object.freeze({
    major:
      Object.freeze({
        fill:
          "#e53935",
        symbol:
          "flood"
      }),

    moderate:
      Object.freeze({
        fill:
          "#ffd43b",
        symbol:
          "flood"
      }),

    minor:
      Object.freeze({
        fill:
          "#2db76f",
        symbol:
          "flood"
      }),

    "rapid-rise": Object.freeze({fill:"#2db76f",symbol:"up"}),
    "tidal-anomaly": Object.freeze({fill:"#45c7e8",symbol:"tidal-up"}),

    rising:
      Object.freeze({
        fill:
          "#2db76f",
        symbol:
          "up"
      }),

    "tidal-rise":
      Object.freeze({
        fill:
          "#45c7e8",
        symbol:
          "tidal-up"
      }),

    falling:
      Object.freeze({
        fill:
          "#56c596",
        symbol:
          "down"
      }),

    steady:
      Object.freeze({
        fill:
          "#4ca6ff",
        symbol:
          "steady"
      }),

    unknown:
      Object.freeze({
        fill:
          "#8d99a6",
        symbol:
          "steady"
      })
  });

function svgSymbol(
  symbol,
  contrast = "#111111"
) {
  if (
    symbol === "up"
  ) {
    return `
      <path d="M32 16 L21 30 H27 V47 H37 V30 H43 Z" fill="#111111"/>
    `;
  }

  if (
    symbol === "down"
  ) {
    return `
      <path d="M32 48 L21 34 H27 V17 H37 V34 H43 Z" fill="#111111"/>
    `;
  }

  if (
    symbol === "tidal-up"
  ) {
    return `
      <path d="M15 38 C20 33 24 43 30 38 C36 33 40 43 49 37" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round"/>
      <path d="M32 13 L24 24 H29 V34 H35 V24 H40 Z" fill="#111111"/>
    `;
  }

  if (
    symbol === "flood"
  ) {
    return `
      <path d="M17 37 C22 31 26 43 32 37 C38 31 42 43 48 37" fill="none" stroke="${contrast}" stroke-width="4" stroke-linecap="round"/>
      <path d="M17 46 C22 40 26 52 32 46 C38 40 42 52 48 46" fill="none" stroke="${contrast}" stroke-width="4" stroke-linecap="round"/>
    `;
  }

  return `
    <path d="M20 32 H44" fill="none" stroke="#111111" stroke-width="6" stroke-linecap="round"/>
  `;
}

export function createRiverGaugeMarkerImage(
  state
) {
  const style =
    STATE_STYLE[
      state
    ]
    ?? STATE_STYLE.unknown;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="28" fill="#ffffff"/>
      <circle cx="32" cy="32" r="24" fill="#111111"/>
      <circle cx="32" cy="32" r="20" fill="${style.fill}"/>
      ${svgSymbol(style.symbol,state==="major"?"#ffffff":"#111111")}
    </svg>`;

  return (
    "data:image/svg+xml;charset=utf-8,"
    + encodeURIComponent(
        svg
      )
  );
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


  function markerImage(
    state
  ) {
    if (
      !markerImages.has(
        state
      )
    ) {
      markerImages.set(
        state,
        createRiverGaugeMarkerImage(
          state
        )
      );
    }

    return markerImages.get(
      state
    );
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
                  summary.displayState
                ),

              width:
                summary.floodClass
                  ? 34
                  : 29,

              height:
                summary.floodClass
                  ? 34
                  : 29,

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

        const {major,moderate,rapidRise,tidalAnomaly} = alerts.counts;

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
            `${summaries.length} qualifying flood signal${summaries.length === 1 ? "" : "s"} · ${major} major · ${moderate} moderate · ${rapidRise} rapid above minor · ${tidalAnomaly} unusual tidal rise${partialText}${screening.incomplete ? ` · rapid-rise screening incomplete for ${screening.incomplete} rising gauge(s)` : ""}${screening.missingSource ? ` · ${screening.missingSource} without a valid history link` : ""} · screening only; follow BoM warnings`,

          count:
            summaries.length,

          major,
          moderate,
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
