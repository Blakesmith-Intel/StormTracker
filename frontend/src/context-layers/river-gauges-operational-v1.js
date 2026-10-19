import {addOfficialSourceRow,bomGaugePlotUrl,OFFICIAL_SOURCE_LINKS} from "./official-source-links-v1.js?v=9.13.2";
import {
  createRiverGaugeLayer,
  createRiverGaugeMarkerImage,
  riverGaugeOperationalSummary
} from "./river-gauge-layer-v1.js?v=9.18.11-flood-colour-20261015";

import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
} from "./river-gauges-v1.js?v=9.12.0";

const $ = id =>
  document.getElementById(
    id
  );

// The compact Layers button reuses the same snapshot refresh as the 10-minute
// poll. Prevent duplicate taps, retain status/error reporting from the layer,
// and restore the control even if BoM is temporarily unavailable.
export function bindRiverGaugeManualRefresh(button, refresh) {
  if(!button)return false;
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    button.disabled=true;
    button.setAttribute("aria-busy","true");
    const originalText=button.textContent;
    button.textContent="Refreshing…";
    try{await refresh();}
    catch{/* createRiverGaugeLayer.refresh already publishes the error status */}
    finally{
      button.textContent=originalText;
      button.setAttribute("aria-busy","false");
      button.disabled=false;
    }
  });
  return true;
}

function setRiverGaugeStatus({
  kind =
    "normal",
  message =
    ""
} = {}) {
  const target =
    $("riverGaugeStatus");

  if (!target) {
    return;
  }

  target.textContent =
    message
    || "BoM · live river heights";

  target.dataset.kind =
    kind;
}

function labelFloodClass(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return "";
  }

  if (
    text === "below-minor"
  ) {
    return "Below minor";
  }

  return (
    text.charAt(0)
      .toUpperCase()
    + text.slice(1)
  );
}

function labelTendency(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text
    ? (
        text.charAt(0)
          .toUpperCase()
        + text.slice(1)
      )
    : "";
}

function addDetailRow(
  container,
  label,
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return;
  }

  const labelNode =
    document.createElement(
      "span"
    );

  labelNode.textContent =
    label;

  const valueNode =
    document.createElement(
      "strong"
    );

  valueNode.textContent =
    text;
  if(label==="Flood class")valueNode.classList.add("river-gauge-classification-value");
  if(label==="Rapid rise / flash-flood potential")
    valueNode.classList.add("river-gauge-rise-value");

  container.append(
    labelNode,
    valueNode
  );
}

// The selected gauge panel uses the EXACT marker renderer and current BoM
// flood category from the map. Its blue arrow is never a separate warning
// colour; rate-only tidal change does not qualify for that modifier.
export function riverGaugePanelAppearance(summary) {
  const state=["minor","moderate","major","unverified"].includes(summary?.displayState)
    ? summary.displayState:"rapid-rise";
  const rise=Boolean(summary?.rapidRise) || state==="rapid-rise";
  const category=state==="rapid-rise"
    ? "RAPID RISE BELOW MINOR · SCREENING"
    : state==="unverified"
      ? "LATEST HEIGHT · FLOOD CLASS UNVERIFIED"
    : summary?.classificationUnverified
      ? "LAST CONFIRMED BOM "+state.toUpperCase()+
        " · CURRENT FLOOD CLASS UNVERIFIED"
      : "BOM "+state.toUpperCase()+" FLOOD"+(rise?" · RAPID RISE":"");
  return {
    state,
    rapidRise:rise,
    category:category+(summary?.observationStale?" · LAST CONFIRMED, STALE":""),
    image:createRiverGaugeMarkerImage(state,rise)
  };
}

function showRiverGaugeInfo(
  feature
) {
  const panel =
    $("riverGaugeInfo");

  const rows =
    $("riverGaugeInfoRows");

  const title =
    $("riverGaugeInfoTitle");

  const kicker =
    $("riverGaugeInfoKicker");

  if (
    !panel
    || !rows
    || !title
  ) {
    return;
  }

  if (!feature) {
    panel.hidden =
      true;

    panel.dataset
      .gaugeId =
      "";
    panel.dataset.gaugeState = "";
    panel.dataset.rapidRise = "false";
    return;
  }

  const summary =
    riverGaugeOperationalSummary(
      feature
    );

  $("floodRoadClosureInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("powerOutageInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("qfdTechnicalRescueInfo")?.setAttribute("hidden","");

  panel.dataset
    .gaugeId =
    summary.id;

  const appearance=riverGaugePanelAppearance(summary);
  panel.dataset.gaugeState=appearance.state;
  panel.dataset.rapidRise=String(appearance.rapidRise);

  title.textContent=summary.name;
  if(kicker)kicker.textContent=appearance.category;
  const pin=panel.querySelector(".river-gauge-key");
  if(pin){
    // Replace obsolete generic circle with the same SVG used on Cesium.
    const icon=document.createElement("img");
    icon.src=appearance.image;
    icon.alt="";
    icon.setAttribute("aria-hidden","true");
    pin.replaceChildren(icon);
  }

  rows.replaceChildren();

  addDetailRow(
    rows,
    "Height",
    summary.heightMetres
      === null
      ? ""
      : `${summary.heightMetres.toFixed(2)} m`
  );

  addDetailRow(rows, "Signal", summary.alertReason);
  if(summary.alertPersisted){
    addDetailRow(rows,"Event state",
      `Monitoring · ${summary.recoveryReadings}/2 recovery observations confirmed`);
  }

  addDetailRow(rows, "Measured rise",
    summary.riseRateMetresPerHour === null ? "" :
      `${summary.riseRateMetresPerHour.toFixed(2)} m/hour`);

  addDetailRow(rows, "Rise interval",
    summary.rateIntervalMinutes === null ? "" :
      `${Math.round(summary.rateIntervalMinutes)} min`);

  addDetailRow(rows, "Historic tidal rise P90",
    summary.tidalBaselineMetresPerHour === null ? "" :
      `${summary.tidalBaselineMetresPerHour.toFixed(2)} m/hour`);

  addDetailRow(rows, "Tendency",
    labelTendency(
      summary.tendency
    )
  );

  if(summary.floodThresholds?.minor!==null &&
      summary.floodThresholds?.minor!==undefined){
    const f=summary.floodThresholds;
    const fmt=n=>typeof n==="number"?n.toFixed(2)+" m":"not defined";
    addDetailRow(rows,"BoM flood thresholds",
      "Minor "+fmt(f.minor)+" · Moderate "+fmt(f.moderate)+
      " · Major "+fmt(f.major));
  }
  addDetailRow(
    rows,
    "Flood class",
    summary.alertSource==="bom-station-threshold"?
      labelFloodClass(summary.displayState)+" (measured height)":
    summary.classificationUnverified
      ? "Not supplied with latest measured height"
      : labelFloodClass(summary.floodClass)
  );
  if(summary.classificationUnverified){
    const confirmed=summary.lastConfirmedFloodAt
      ? new Date(summary.lastConfirmedFloodAt).toLocaleString("en-AU",{
          timeZone:"Australia/Brisbane",day:"2-digit",month:"short",
          hour:"2-digit",minute:"2-digit",hour12:false})+" AEST" : "time unavailable";
    addDetailRow(rows,"Last confirmed flood class",
      summary.lastConfirmedFloodClass.toUpperCase()+" · "+confirmed+
      " · NOT reconfirmed by current BoM bulletin");
  }
  addDetailRow(rows,"Rapid rise / flash-flood potential",
    appearance.rapidRise
      ? "Measured rapid rise · screening indicator, not a BoM flash-flood warning"
      : summary.tidalScreened
        ? "Tidal influence · rate-only alerts excluded"
        : "Not indicated by current measured observations");

  if(summary.observationStale)
    addDetailRow(rows,"Observation freshness",
      "STALE measured height — current water level unverified; await a newer observation.");
  addDetailRow(
    rows,
    "Tidal context",
    summary.tidalContext
  );

  addDetailRow(
    rows,
    "Observed",
    summary.observedText
  );

  addDetailRow(
    rows,
    "Basin",
    summary.basin
  );

  addDetailRow(
    rows,
    "Forecast site",
    summary
      .forecastSiteClassification
  );

  addDetailRow(
    rows,
    "Agency",
    summary.agency
  );

  addDetailRow(
    rows,
    "BoM station",
    summary.bomStationNumber
  );

  addDetailRow(
    rows,
    "AWRC station",
    summary.awrcStationId
  );

  addDetailRow(
    rows,
    "Product",
    summary.sourceProduct
  );

  addOfficialSourceRow(
    rows,"Source",BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
    OFFICIAL_SOURCE_LINKS.bom
  );
  const directPlot=bomGaugePlotUrl(summary.recentDataHref);
  addOfficialSourceRow(rows,"BoM gauge",
    directPlot?"View recent observations and river-height plot":"View BoM river-height station data",
    directPlot||OFFICIAL_SOURCE_LINKS.bom);

  addDetailRow(rows,"Interpretation",
    appearance.state==="rapid-rise"
      ? "Measured rapid-rise screening only. Potential flash flooding is not an official BoM warning."
      : summary.classificationUnverified
        ? "Height and time refer to the newest verified reading. Marker colour is the LAST confirmed flood classification, not a current BoM classification; consult official warnings."
        : "Current BoM flood classification controls colour. The blue arrow only appears for independent qualifying measured rapid rise; consult BoM warnings.");

  panel.hidden =
    false;
}

export function riverGaugeEntityFromPick(
  picked
) {
  return (
    picked?.id
    ?? picked?.primitive?.id
    ?? null
  );
}

export function riverGaugeIdFromPick(
  picked
) {
  const entity =
    riverGaugeEntityFromPick(
      picked
    );

  const id =
    entity
      ?.stormTrackerRiverGaugeId;

  return id
    ? String(id)
    : "";
}

function gaugeIdNearPosition({
  viewer,
  position,
  width =
    28,
  height =
    28
}) {
  if (
    !viewer
    || !position
  ) {
    return "";
  }

  const picks =
    typeof viewer.scene
      .drillPick
      === "function"
      ? viewer.scene
          .drillPick(
            position,
            24,
            width,
            height
          )
      : [];

  for (
    const picked
    of picks
  ) {
    const id =
      riverGaugeIdFromPick(
        picked
      );

    if (id) {
      return id;
    }
  }

  return riverGaugeIdFromPick(
    viewer.scene.pick(
      position,
      width,
      height
    )
  );
}

export function initialiseOperationalRiverGauges({
  viewer,
  CesiumRef =
    globalThis.Cesium
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Operational river-gauge UI requires Cesium and a viewer."
    );
  }

  const checkbox =
    $("showRiverGauges");

  const panel =
    $("riverGaugeInfo");

  const canvas =
    viewer.scene.canvas;

  const mapContainer =
    $("cesiumContainer")
    ?? canvas.parentElement;

  const layer =
    createRiverGaugeLayer({
      viewer,
      CesiumRef,

      visible:
        Boolean(
          checkbox?.checked
        ),

      onStatus:
        setRiverGaugeStatus,

      onUpdate:
        features => {
          if (
            !panel
            || panel.hidden
          ) {
            return;
          }

          const selectedId =
            panel.dataset
              .gaugeId
            || "";

          const latest=features.find(feature=>String(feature.id)===selectedId);
          if(selectedId){
            // Refresh the already-open panel whenever new levels or the
            // persisted event state change; never require a second tap.
            showRiverGaugeInfo(latest??null);
          }
        }
    });

  // Opt-in browser QA: verify only qualifying BoM flood signals are rendered.
  if (
    typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("qaFloodSignals")
  ) {
    window.__stormtrackerFloodDiagnostics = () => ({
      visible: Boolean(layer.dataSource.show),
      alertCount: layer.features.length,
      states: layer.features.map(feature =>
        feature.properties?.STORMTRACKER_DISPLAY_STATE ?? "unknown"
      ),
      matched: layer.diagnostics?.matchedCount ?? 0,
      counts: layer.diagnostics?.floodSignalCounts ?? null,
      historyStationCount: layer.historyStationCount,
      recentHistoryRequestCount: layer.recentHistoryRequestCount,
      recentHistory: layer.diagnostics?.recentHistory??null,
      loadedAt: layer.lastLoadedAt
    });
  }

  function showById(
    gaugeId
  ) {
    if (!gaugeId) {
      return false;
    }

    const feature =
      layer.featureById(
        gaugeId
      );

    if (!feature) {
      return false;
    }

    showRiverGaugeInfo(
      feature
    );

    return true;
  }

  function canvasPositionFromPointer(
    event
  ) {
    const rect =
      canvas
        .getBoundingClientRect();

    return new CesiumRef
      .Cartesian2(
        event.clientX
          - rect.left,
        event.clientY
          - rect.top
      );
  }

  function selectNearPosition(
    position,
    {
      width =
        30,
      height =
        30
    } = {}
  ) {
    return showById(
      gaugeIdNearPosition({
        viewer,
        position,
        width,
        height
      })
    );
  }

  const pointerTap = {
    id:
      null,
    x:
      0,
    y:
      0,
    startedAt:
      0,
    moved:
      false
  };

  const onPointerDown =
    event => {
      if (
        event.button
          !== undefined
        && event.button
          !== 0
      ) {
        return;
      }

      if (
        !mapContainer
        || !mapContainer
          .contains(
            event.target
          )
      ) {
        return;
      }

      const blockedControl =
        event.target
          ?.closest?.(
            "#nav,#riverGaugeInfo,#floodRoadClosureInfo,#powerOutageInfo,#qfdTechnicalRescueInfo"
          );

      if (blockedControl) {
        return;
      }

      pointerTap.id =
        event.pointerId;

      pointerTap.x =
        event.clientX;

      pointerTap.y =
        event.clientY;

      pointerTap.startedAt =
        performance.now();

      pointerTap.moved =
        false;
    };

  const onPointerMove =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      if (
        Math.hypot(
          event.clientX
            - pointerTap.x,
          event.clientY
            - pointerTap.y
        ) > 12
      ) {
        pointerTap.moved =
          true;
      }
    };

  const clearPointerTap =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      pointerTap.id =
        null;
    };

  const onPointerUp =
    event => {
      if (
        pointerTap.id
        !== event.pointerId
      ) {
        return;
      }

      const duration =
        performance.now()
        - pointerTap.startedAt;

      const isTap =
        !pointerTap.moved
        && duration <= 700;

      pointerTap.id =
        null;

      if (!isTap) {
        return;
      }

      selectNearPosition(
        canvasPositionFromPointer(
          event
        ),
        {
          width:
            event.pointerType
            === "touch"
              ? 42
              : 28,

          height:
            event.pointerType
            === "touch"
              ? 42
              : 28
        }
      );
    };

  window.addEventListener(
    "pointerdown",
    onPointerDown,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointermove",
    onPointerMove,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointerup",
    onPointerUp,
    {
      capture:
        true,
      passive:
        true
    }
  );

  window.addEventListener(
    "pointercancel",
    clearPointerTap,
    {
      capture:
        true,
      passive:
        true
    }
  );

  const clickFallback =
    typeof PointerEvent
      === "undefined"
      ? new CesiumRef
          .ScreenSpaceEventHandler(
            canvas
          )
      : null;

  clickFallback
    ?.setInputAction(
      movement => {
        selectNearPosition(
          movement.position,
          {
            width:
              32,
            height:
              32
          }
        );
      },
      CesiumRef
        .ScreenSpaceEventType
        .LEFT_CLICK
    );

  const hoverHandler =
    new CesiumRef
      .ScreenSpaceEventHandler(
        canvas
      );

  // No synchronous Cesium GPU picking on every pointer movement in the
  // isolated WebGL diagnostic preview. Gauge click inspection remains enabled.
  const suppressHoverGpuPicking =
    ["/preview/radar-history-fix/", "/preview/next-baseline/", "/preview/incremental-3d/"].some(
      path=>globalThis.location?.pathname?.includes(path)===true) ||
      (/\/live3d-operational-v9\.html$/.test(
        String(globalThis.location?.pathname??"")) &&
        !String(globalThis.location?.pathname??"").includes("/preview/"));
  if (!suppressHoverGpuPicking) {
    let lastHoverPickAt = 0;
    hoverHandler.setInputAction(movement => {
      const now = performance.now();
      if (now - lastHoverPickAt < 160) return;
      lastHoverPickAt = now;
      const gaugeId = gaugeIdNearPosition({
        viewer, position: movement.endPosition, width: 18, height: 18
      });
      canvas.style.cursor = gaugeId ? "pointer" : "";
    }, CesiumRef.ScreenSpaceEventType.MOUSE_MOVE);
  }

  checkbox
    ?.addEventListener(
      "change",
      event => {
        layer.setVisible(
          event.target.checked
        );

        if (
          !event.target
            .checked
        ) {
          showRiverGaugeInfo(
            null
          );

          setRiverGaugeStatus({
            message:
              "Flood-signal markers hidden · observations continue while this page is open"
          });
        }
      }
    );

  bindRiverGaugeManualRefresh(
    $("refreshRiverGaugesButton"),
    () => layer.refresh({force:true})
  );

  $("closeRiverGaugeInfo")
    ?.addEventListener(
      "click",
      () => {
        showRiverGaugeInfo(
          null
        );
      }
    );

  window.addEventListener(
    "pagehide",
    () => {
      layer.stop();

      window.removeEventListener(
        "pointerdown",
        onPointerDown,
        true
      );

      window.removeEventListener(
        "pointermove",
        onPointerMove,
        true
      );

      window.removeEventListener(
        "pointerup",
        onPointerUp,
        true
      );

      window.removeEventListener(
        "pointercancel",
        clearPointerTap,
        true
      );

      if (
        clickFallback
        && !clickFallback
          .isDestroyed()
      ) {
        clickFallback
          .destroy();
      }

      if (
        !hoverHandler
          .isDestroyed()
      ) {
        hoverHandler
          .destroy();
      }
    },
    {
      once:
        true
    }
  );

  layer.start();

  return layer;
}
