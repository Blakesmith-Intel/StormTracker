import {addOfficialSourceRow,bomGaugePlotUrl,OFFICIAL_SOURCE_LINKS} from "./official-source-links-v1.js?v=9.13.2";
import {
  createRiverGaugeLayer,
  riverGaugeOperationalSummary
} from "./river-gauge-layer-v1.js?v=9.13.2";

import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
} from "./river-gauges-v1.js?v=9.12.0";

const $ = id =>
  document.getElementById(
    id
  );

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

  container.append(
    labelNode,
    valueNode
  );
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

    $("qfdTechnicalRescueInfo")?.setAttribute("hidden","");

  panel.dataset
      .gaugeId =
      "";

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

  panel.dataset
    .gaugeId =
    summary.id;

  panel.dataset
    .gaugeState =
    summary.displayState;

  title.textContent =
    summary.name;

  if (kicker) {
    kicker.textContent =
      summary.displayState === "tidal-anomaly"
        ? "UNUSUAL TIDAL RISE · SCREENING"
        : summary.displayState === "rapid-rise"
          ? "RAPID RIVER RISE · SCREENING"
          : "BOM RIVER FLOOD CLASSIFICATION";
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

  addDetailRow(
    rows,
    "Flood class",
    labelFloodClass(
      summary.floodClass
    )
  );

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

  addDetailRow(rows, "Interpretation",
    summary.displayState === "rapid-rise" || summary.displayState === "tidal-anomaly"
      ? "Screening indicator only; check BoM warnings and local conditions. Not a confirmed flash flood."
      : "Observed BoM flood classification; follow current official warnings and emergency advice.");

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

  let lastHoverPickAt =
    0;

  hoverHandler
    .setInputAction(
      movement => {
        const now =
          performance.now();

        if (
          now
          - lastHoverPickAt
          < 80
        ) {
          return;
        }

        lastHoverPickAt =
          now;

        const gaugeId =
          gaugeIdNearPosition({
            viewer,
            position:
              movement
                .endPosition,
            width:
              18,
            height:
              18
          });

        if (gaugeId) {
          canvas.style.cursor =
            "pointer";
        }
      },
      CesiumRef
        .ScreenSpaceEventType
        .MOUSE_MOVE
    );

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

  $("refreshRiverGaugesButton")
    ?.addEventListener(
      "click",
      () => {
        layer.refresh({
          force:
            true
        }).catch(
          () => {}
        );
      }
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
