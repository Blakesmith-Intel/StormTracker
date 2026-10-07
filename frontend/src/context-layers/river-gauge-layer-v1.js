import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
  DEFAULT_RIVER_GAUGE_REFRESH_MS,
  riverGaugeSummary
} from "./river-gauges-v1.js?v=9.12.0-dev1";

import {
  loadRiverGaugeOperationalSnapshot
} from "./river-gauge-observations-v1.js?v=9.12.0-dev1";

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
      )
  };
}

const STATE_STYLE =
  Object.freeze({
    major:
      Object.freeze({
        fill:
          "#bd2fff",
        symbol:
          "flood"
      }),

    moderate:
      Object.freeze({
        fill:
          "#ff4d4d",
        symbol:
          "flood"
      }),

    minor:
      Object.freeze({
        fill:
          "#ff8c1a",
        symbol:
          "flood"
      }),

    rising:
      Object.freeze({
        fill:
          "#ffd43b",
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
  symbol
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
      <path d="M17 37 C22 31 26 43 32 37 C38 31 42 43 48 37" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <path d="M17 46 C22 40 26 52 32 46 C38 40 42 52 48 46" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
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
      ${svgSymbol(style.symbol)}
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
    () => {}
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
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;
  let diagnostics = null;

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
    if (
      !dataSource.show
      && !force
    ) {
      return currentFeatures;
    }

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

        diagnostics =
          result;

        render(
          result.payload
        );

        lastLoadedAt =
          Date.now();

        const summaries =
          currentFeatures.map(
            riverGaugeOperationalSummary
          );

        const rising =
          summaries.filter(
            item =>
              item.displayState
              === "rising"
          ).length;

        const tidalRising =
          summaries.filter(
            item =>
              item.displayState
              === "tidal-rise"
          ).length;

        const flood =
          summaries.filter(
            item =>
              [
                "minor",
                "moderate",
                "major"
              ].includes(
                item.displayState
              )
          ).length;

        const partialText =
          result.partialBulletins
            ? ` · partial (${result.failedProducts.length} product${result.failedProducts.length === 1 ? "" : "s"} unavailable)`
            : "";

        onStatus({
          kind:
            result.partialBulletins
              ? "warning"
              : "ok",

          message:
            `${summaries.length} live gauge${summaries.length === 1 ? "" : "s"} · ${rising} rising · ${tidalRising} tidal rise · ${flood} flood class${partialText}`,

          count:
            summaries.length,

          rising,

          tidalRising,

          flood,

          partial:
            result.partialBulletins,

          failedProducts:
            result.failedProducts,

          loadedAt:
            lastLoadedAt
        });

        return currentFeatures;
      })();

    try {
      return await loading;
    } catch (error) {
      onStatus({
        kind:
          "error",

        message:
          error?.message
          ?? String(error)
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

    if (
      dataSource.show
    ) {
      refresh()
        .catch(
          () => {}
        );
    }

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

    attribution:
      BOM_RIVER_TIDE_GAUGE_ATTRIBUTION
  };
}
