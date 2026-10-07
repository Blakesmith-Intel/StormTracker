import {
  createFloodRoadClosureLayer,
  QLD_TRAFFIC_ATTRIBUTION
} from "./flood-road-closures-v1.js?v=9.10.1";

import {
  floodRoadClosureSummary
} from "./flood-road-closure-filter-v1.js?v=9.10.1";

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

  addDetailRow(
    rows,
    "Source",
    summary.source
    || QLD_TRAFFIC_ATTRIBUTION
  );

  if (link) {
    const webLink =
      safeWebLink(
        summary.webLink
      );

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

  const checkbox =
    $("showFloodRoadClosures");

  const panel =
    $("floodRoadClosureInfo");

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

  const clickHandler =
    new CesiumRef.ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

  clickHandler.setInputAction(
    movement => {
      const picked =
        viewer.scene.pick(
          movement.position
        );

      const closureId =
        picked?.id
          ?.stormTrackerFloodClosureId;

      if (!closureId) {
        return;
      }

      const feature =
        layer.featureById(
          closureId
        );

      if (!feature) {
        return;
      }

      showClosureInfo(
        feature
      );
    },
    CesiumRef.ScreenSpaceEventType
      .LEFT_CLICK
  );

  const hoverHandler =
    new CesiumRef.ScreenSpaceEventHandler(
      viewer.scene.canvas
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

      const picked =
        viewer.scene.pick(
          movement.endPosition
        );

      viewer.scene.canvas
        .style.cursor =
          picked?.id
            ?.stormTrackerFloodClosureId
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

      if (
        !clickHandler
          .isDestroyed()
      ) {
        clickHandler.destroy();
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
