import {
  createPowerOutageLayer,
  ENERGEX_ATTRIBUTION,
  powerOutageSummary
} from "./power-outages-v1.js?v=9.11.0-dev1";

const $ = id =>
  document.getElementById(id);

function setPowerStatus({
  kind = "normal",
  message = ""
} = {}) {
  const target =
    $("powerOutageStatus");

  if (!target) {
    return;
  }

  target.textContent =
    message
    || "Energex | current outages";

  target.dataset.kind =
    kind;
}

function formatQldTime(
  value
) {
  const numeric =
    Number(value);

  const parsed =
    Number.isFinite(numeric)
    && String(value ?? "")
      .trim() !== ""
      ? numeric
      : Date.parse(
          String(
            value ?? ""
          )
        );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return String(
      value ?? ""
    ).trim();
  }

  return new Intl
    .DateTimeFormat(
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
    )
    .format(
      new Date(
        parsed
      )
    );
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

function showPowerOutageInfo(
  feature
) {
  const panel =
    $("powerOutageInfo");

  const rows =
    $("powerOutageInfoRows");

  const title =
    $("powerOutageInfoTitle");

  const kicker =
    $("powerOutageInfoKicker");

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
      .outageId =
      "";

    return;
  }

  const summary =
    powerOutageSummary(
      feature
    );

  $("floodRoadClosureInfo")
    ?.setAttribute(
      "hidden",
      ""
    );

  panel.dataset
    .outageId =
    String(
      summary.id
      ?? ""
    );

  panel.dataset
    .outageType =
    summary.type
      .toLowerCase();

  title.textContent =
    summary.suburbs
    || `Event ${summary.id}`;

  if (kicker) {
    kicker.textContent =
      `${summary.type} POWER OUTAGE`;
  }

  rows.replaceChildren();

  addDetailRow(
    rows,
    "Provider",
    summary.provider
  );

  addDetailRow(
    rows,
    "Customers affected",
    summary.customersAffected
      .toLocaleString(
        "en-AU"
      )
  );

  addDetailRow(
    rows,
    "Status",
    summary.status
  );

  addDetailRow(
    rows,
    "Suburbs",
    summary.suburbs
  );

  addDetailRow(
    rows,
    "Streets",
    summary.streets
  );

  addDetailRow(
    rows,
    "Reason",
    summary.reason
  );

  addDetailRow(
    rows,
    "Started",
    formatQldTime(
      summary.start
    )
  );

  addDetailRow(
    rows,
    "Estimated restoration",
    formatQldTime(
      summary.estimatedFix
    )
  );

  addDetailRow(
    rows,
    "Scheduled finish",
    formatQldTime(
      summary.finish
    )
  );

  addDetailRow(
    rows,
    "Feed updated",
    formatQldTime(
      summary.extracted
    )
  );

  addDetailRow(
    rows,
    "Source",
    ENERGEX_ATTRIBUTION
  );

  panel.hidden =
    false;
}

export function powerOutageIdFromPick(
  picked
) {
  const entity =
    picked?.id
    ?? picked?.primitive?.id
    ?? null;

  const id =
    entity
      ?.stormTrackerPowerOutageId;

  return id
    ? String(id)
    : "";
}

function outageIdNearPosition({
  viewer,
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
    const outageId =
      powerOutageIdFromPick(
        picked
      );

    if (outageId) {
      return outageId;
    }
  }

  return powerOutageIdFromPick(
    viewer.scene.pick(
      position,
      width,
      height
    )
  );
}

export function initialiseOperationalPowerOutages({
  viewer,
  CesiumRef =
    globalThis.Cesium
} = {}) {
  if (
    !viewer
    || !CesiumRef
  ) {
    throw new Error(
      "Operational power-outage UI requires Cesium and a viewer."
    );
  }

  const checkbox =
    $("showPowerOutages");

  const panel =
    $("powerOutageInfo");

  const canvas =
    viewer.scene.canvas;

  const layer =
    createPowerOutageLayer({
      viewer,
      CesiumRef,
      visible:
        Boolean(
          checkbox?.checked
        ),
      onStatus:
        setPowerStatus,
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
              .outageId
            || "";

          if (
            selectedId
            && !features.some(
              feature =>
                String(
                  powerOutageSummary(
                    feature
                  ).id
                )
                === selectedId
            )
          ) {
            showPowerOutageInfo(
              null
            );
          }
        }
    });

  function showById(
    outageId
  ) {
    if (!outageId) {
      return false;
    }

    const feature =
      layer.featureById(
        outageId
      );

    if (!feature) {
      return false;
    }

    showPowerOutageInfo(
      feature
    );

    return true;
  }

  const clickHandler =
    new CesiumRef
      .ScreenSpaceEventHandler(
        canvas
      );

  clickHandler
    .setInputAction(
      movement => {
        showById(
          outageIdNearPosition({
            viewer,
            position:
              movement.position,
            width:
              32,
            height:
              32
          })
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

  let lastHoverAt =
    0;

  hoverHandler
    .setInputAction(
      movement => {
        const now =
          performance.now();

        if (
          now - lastHoverAt
          < 80
        ) {
          return;
        }

        lastHoverAt =
          now;

        const outageId =
          outageIdNearPosition({
            viewer,
            position:
              movement
                .endPosition,
            width:
              12,
            height:
              12
          });

        if (outageId) {
          canvas.style.cursor =
            "pointer";
        } else if (
          canvas.style.cursor
          === "pointer"
        ) {
          canvas.style.cursor =
            "";
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
          showPowerOutageInfo(
            null
          );

          setPowerStatus({
            kind:
              "normal",
            message:
              "Energex power outages hidden"
          });
        }
      }
    );

  $("refreshPowerOutagesButton")
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

  $("closePowerOutageInfo")
    ?.addEventListener(
      "click",
      () => {
        showPowerOutageInfo(
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
        clickHandler
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
