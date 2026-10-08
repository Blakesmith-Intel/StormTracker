import {QLD_TRAFFIC_OFFICIAL_CLOSED_ALL,qldTrafficRoadImpactIcon} from "./qldtraffic-official-closure-icons-v1.js?v=9.15.0";
import {addOfficialSourceRow,roadOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {
  createFloodRoadClosureLayer,
  QLD_TRAFFIC_ATTRIBUTION
} from "./flood-road-closures-v1.js?v=9.10.3";

import {
  floodRoadClosureSummary
} from "./flood-road-closure-filter-v1.js?v=9.10.3";

import {
  floodRoadClosureMarkerCoordinate
} from "./flood-road-closures-v1.js?v=9.10.3";

const $ = id =>
  document.getElementById(id);

function setRoadStatus({
  kind = "normal",
  message = ""
} = {}) {
  const target =
    $("floodRoadClosureStatus");

  if (!target) {
    return;
  }

  target.textContent =
    message
    || "QLDTraffic · flood closures only";

  target.dataset.kind =
    kind;
}

function formatQldTime(value) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return "";
  }

  const parsed =
    Date.parse(
      text
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return text;
  }

  return new Intl.DateTimeFormat(
    "en-AU",
    {
      timeZone:
        "Australia/Brisbane",
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
      hour12:
        false,
      timeZoneName:
        "short"
    }
  ).format(
    new Date(parsed)
  );
}

function safeWebLink(value) {
  const text =
    String(
      value ?? ""
    ).trim();

  return /^https:\/\//i.test(
    text
  )
    ? text
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

function detailCause(summary) {
  if (
    summary.eventType === "Flooding"
    && summary.eventSubtype
  ) {
    return summary.eventSubtype;
  }

  if (
    summary.eventDueTo
  ) {
    return summary.eventDueTo;
  }

  return (
    summary.eventSubtype
    || summary.eventType
    || "Flood related"
  );
}

function showClosureInfo(
  feature
) {
  const panel =
    $("floodRoadClosureInfo");

  const rows =
    $("floodRoadClosureInfoRows");

  const title =
    $("floodRoadClosureInfoTitle");

  const link =
    $("floodRoadClosureInfoLink");

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

    panel.dataset.closureId =
      "";

    return;
  }

  const summary =
    floodRoadClosureSummary(
      feature
    );
  const panelIcon=$("floodRoadClosureInfoIcon");
  if(panelIcon)panelIcon.src=qldTrafficRoadImpactIcon(summary.impactSubtype);


  $("powerOutageInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("riverGaugeInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  $("qfdTechnicalRescueInfo")?.setAttribute("hidden","");

  panel.dataset.closureId =
    String(
      summary.id
      ?? ""
    );

  title.textContent =
    summary.roadName;

  rows.replaceChildren();

  addDetailRow(
    rows,
    "Location",
    [
      summary.locality,
      summary.postcode
    ]
      .filter(Boolean)
      .join(" ")
  );

  addDetailRow(
    rows,
    "Council",
    summary.localGovernmentArea
  );

  addDetailRow(
    rows,
    "Closure",
    summary.impactSubtype
    || summary.impactType
    || "Road closed"
  );

  addDetailRow(
    rows,
    "Flood cause",
    detailCause(
      summary
    )
  );

  addDetailRow(
    rows,
    "Direction",
    summary.direction
  );

  addDetailRow(
    rows,
    "Delay",
    summary.delay
  );

  addDetailRow(
    rows,
    "Started",
    formatQldTime(
      summary.startTime
    )
  );

  addDetailRow(
    rows,
    "Expected end",
    formatQldTime(
      summary.endTime
    )
  );

  addDetailRow(
    rows,
    "Last updated",
    formatQldTime(
      summary.lastUpdated
    )
  );

  addDetailRow(
    rows,
    "Next inspection",
    formatQldTime(
      summary.nextInspection
    )
  );

  addDetailRow(
    rows,
    "Advice",
    summary.advice
    || summary.information
    || summary.description
  );

  addOfficialSourceRow(
    rows,"Source",
    summary.source||QLD_TRAFFIC_ATTRIBUTION,
    roadOfficialUrl(summary.webLink)
  );

  if (link) {
    const webLink =
      roadOfficialUrl(summary.webLink);

    link.hidden =
      !webLink;

    if (webLink) {
      link.href =
        webLink;
    } else {
      link.removeAttribute(
        "href"
      );
    }
  }

  panel.hidden =
    false;
}

export function floodRoadClosureEntityFromPick(
  picked
) {
  return (
    picked?.id
    ?? picked?.primitive?.id
    ?? null
  );
}

export function floodRoadClosureIdFromPick(
  picked
) {
  const entity =
    floodRoadClosureEntityFromPick(
      picked
    );

  const id =
    entity
      ?.stormTrackerFloodClosureId;

  return id
    ? String(id)
    : "";
}

function closureIdNearPosition({
  viewer,
  CesiumRef,
  position,
  width = 28,
  height = 28
}) {
  if (
    !viewer
    || !position
  ) {
    return "";
  }

  const picks =
    typeof viewer.scene
      .drillPick === "function"
      ? viewer.scene.drillPick(
          position,
          24,
          width,
          height
        )
      : [];

  for (const picked of picks) {
    const closureId =
      floodRoadClosureIdFromPick(
        picked
      );

    if (closureId) {
      return closureId;
    }
  }

  const picked =
    viewer.scene.pick(
      position,
      width,
      height
    );

  return floodRoadClosureIdFromPick(
    picked
  );
}

function nearestClosureIdByMarker({
  viewer,
  CesiumRef,
  features,
  position,
  maximumDistance = 44
}) {
  let bestId = "";
  let bestDistance =
    Number.POSITIVE_INFINITY;

  for (const feature of features ?? []) {
    const coordinate =
      floodRoadClosureMarkerCoordinate(
        feature
      );

    if (!coordinate) {
      continue;
    }

    const worldPosition =
      CesiumRef.Cartesian3
        .fromDegrees(
          coordinate[0],
          coordinate[1],
          0
        );

    const screenPosition =
      viewer.scene
        .cartesianToCanvasCoordinates(
          worldPosition
        );

    if (!screenPosition) {
      continue;
    }

    const distance =
      Math.hypot(
        screenPosition.x
          - position.x,
        screenPosition.y
          - position.y
      );

    if (
      distance <= maximumDistance
      && distance < bestDistance
    ) {
      bestDistance =
        distance;

      bestId =
        String(
          feature?.properties?.id
          ?? ""
        );
    }
  }

  return bestId;
}

export function initialiseOperationalFloodRoadClosures({
  viewer,
  CesiumRef = globalThis.Cesium
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Operational flood-road closure UI requires Cesium and a viewer."
    );
  }

  // QLDTraffic's public map marker and our legend share the exact PNG.
  const legendIcon=$("floodRoadClosureLegendIcon");
  if(legendIcon)legendIcon.src=QLD_TRAFFIC_OFFICIAL_CLOSED_ALL;

  const checkbox =
    $("showFloodRoadClosures");

  const panel =
    $("floodRoadClosureInfo");

  const canvas =
    viewer.scene.canvas;

  const mapContainer =
    $("cesiumContainer")
    ?? canvas.parentElement;

  const layer =
    createFloodRoadClosureLayer({
      viewer,
      CesiumRef,
      visible:
        Boolean(
          checkbox?.checked
        ),
      onStatus:
        setRoadStatus,
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
              .closureId
            || "";

          if (
            selectedId
            && !features.some(
              feature =>
                String(
                  feature?.properties?.id
                  ?? ""
                )
                === selectedId
            )
          ) {
            showClosureInfo(
              null
            );
          }
        }
    });

  function showClosureById(
    closureId
  ) {
    if (!closureId) {
      return false;
    }

    const feature =
      layer.featureById(
        closureId
      );

    if (!feature) {
      return false;
    }

    showClosureInfo(
      feature
    );

    return true;
  }

  function canvasPositionFromPointer(
    event
  ) {
    const rect =
      canvas.getBoundingClientRect();

    return new CesiumRef.Cartesian2(
      event.clientX
        - rect.left,
      event.clientY
        - rect.top
    );
  }

  function selectNearPosition(
    position,
    {
      width = 30,
      height = 30
    } = {}
  ) {
    let closureId =
      closureIdNearPosition({
        viewer,
        CesiumRef,
        position,
        width,
        height
      });

    if (!closureId) {
      closureId =
        nearestClosureIdByMarker({
          viewer,
          CesiumRef,
          features:
            layer.features,
          position,
          maximumDistance:
            Math.max(
              width,
              height
            )
        });
    }

    return showClosureById(
      closureId
    );
  }

  const pointerTap =
    {
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
        event.button !== undefined
        && event.button !== 0
      ) {
        return;
      }

      if (
        !mapContainer
        || !mapContainer.contains(
          event.target
        )
      ) {
        return;
      }

      const blockedControl =
        event.target
          ?.closest?.(
            "#nav,#floodRoadClosureInfo,#powerOutageInfo,#riverGaugeInfo,#qfdTechnicalRescueInfo"
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
            event.pointerType === "touch"
              ? 42
              : 28,
          height:
            event.pointerType === "touch"
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
    new CesiumRef.ScreenSpaceEventHandler(
      canvas
    );

  let lastHoverPickAt =
    0;

  hoverHandler.setInputAction(
    movement => {
      const now =
        performance.now();

      if (
        now - lastHoverPickAt
        < 80
      ) {
        return;
      }

      lastHoverPickAt =
        now;

      const closureId =
        closureIdNearPosition({
          viewer,
          CesiumRef,
          position:
            movement.endPosition,
          width:
            18,
          height:
            18
        });

      canvas.style.cursor =
        closureId
          ? "pointer"
          : "";
    },
    CesiumRef.ScreenSpaceEventType
      .MOUSE_MOVE
  );

  checkbox?.addEventListener(
    "change",
    event => {
      layer.setVisible(
        event.target.checked
      );

      if (
        !event.target.checked
      ) {
        showClosureInfo(
          null
        );

        setRoadStatus({
          kind:
            "normal",
          message:
            "QLDTraffic flood closures hidden"
        });
      }
    }
  );

  $("refreshFloodRoadClosuresButton")
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

  $("closeFloodRoadClosureInfo")
    ?.addEventListener(
      "click",
      () => {
        showClosureInfo(
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
        clickFallback.destroy();
      }

      if (
        !hoverHandler
          .isDestroyed()
      ) {
        hoverHandler.destroy();
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
