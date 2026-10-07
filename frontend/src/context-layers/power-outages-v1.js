import {
  parseEssentialEnergyKml
} from "./essential-energy-kml-v1.js?v=9.11.2";

import {
  QUEENSLAND_MAINLAND_QUERY_URL,
  filterFeaturesToQueensland
} from "./queensland-mainland-filter-v1.js?v=9.11.2";

export const ENERGEX_ATTRIBUTION =
  "Energex | Energy Queensland";

export const ERGON_ATTRIBUTION =
  "Ergon Energy | Energy Queensland";

export const ESSENTIAL_ENERGY_ATTRIBUTION =
  "Essential Energy";

const OUTAGE_QUERY_SUFFIX =
  "?where=1%3D1"
  + "&outFields=EVENT_ID%2CTYPE%2CSTATUS%2CCUSTOMERS_AFFECTED%2CSUBURBS%2CSTREETS%2CSTART%2CFINISH%2CEST_FIX_TIME%2CREASON%2CEXTRACTED"
  + "&returnGeometry=true"
  + "&outSR=4326"
  + "&f=geojson";

export const ENERGEX_OUTAGE_AREA_QUERY_URL =
  "https://services.arcgis.com/bfVzktoY0OhzQCDj/arcgis/rest/services/VwEnergexOutages/FeatureServer/0/query"
  + OUTAGE_QUERY_SUFFIX;

export const ERGON_OUTAGE_AREA_QUERY_URL =
  "https://services.arcgis.com/33eHbTVqo7gtiCE8/ArcGIS/rest/services/VwErgonOutages/FeatureServer/0/query"
  + OUTAGE_QUERY_SUFFIX;

export const DEFAULT_ESSENTIAL_ENERGY_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/essential-energy-outages";

export const DEFAULT_POWER_OUTAGE_REFRESH_MS =
  15 * 60 * 1000;

const PROVIDER_META =
  Object.freeze({
    Energex:
      Object.freeze({
        idPrefix:
          "energex",
        attribution:
          ENERGEX_ATTRIBUTION
      }),

    Ergon:
      Object.freeze({
        idPrefix:
          "ergon",
        attribution:
          ERGON_ATTRIBUTION
      }),

    "Essential Energy":
      Object.freeze({
        idPrefix:
          "essential",
        attribution:
          ESSENTIAL_ENERGY_ATTRIBUTION
      })
  });

function normalise(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function propertiesOf(
  featureOrProperties
) {
  return (
    featureOrProperties
      ?.properties
    ?? featureOrProperties
    ?? {}
  );
}

function parsedTime(value) {
  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value > 0
      ? value
      : null;
  }

  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return null;
  }

  const numeric =
    Number(text);

  if (
    Number.isFinite(numeric)
    && /^\d{10,}$/.test(text)
  ) {
    return numeric > 0
      ? numeric
      : null;
  }

  const parsed =
    Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function providerOf(
  featureOrProperties
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  const provider =
    String(
      properties
        .STORMTRACKER_PROVIDER
      ?? featureOrProperties
        ?.stormTrackerProvider
      ?? "Energex"
    ).trim();

  return PROVIDER_META[
    provider
  ]
    ? provider
    : "Energex";
}

function eventIdOf(
  feature
) {
  const properties =
    propertiesOf(
      feature
    );

  return String(
    properties.EVENT_ID
    ?? feature?.id
    ?? ""
  );
}

function qualifiedFeatureId(
  feature,
  provider
) {
  const meta =
    PROVIDER_META[
      provider
    ];

  return `${meta.idPrefix}:${eventIdOf(feature)}`;
}

function annotateProvider(
  payload,
  provider
) {
  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
      : [];

  return {
    ...(
      payload
      && typeof payload
        === "object"
        ? payload
        : {}
    ),

    type:
      "FeatureCollection",

    features:
      features.map(
        feature => ({
          ...feature,

          id:
            qualifiedFeatureId(
              feature,
              provider
            ),

          properties: {
            ...(
              feature?.properties
              ?? {}
            ),

            STORMTRACKER_PROVIDER:
              provider
          }
        })
      )
  };
}

export function isCurrentPowerOutage(
  featureOrProperties,
  nowMs = Date.now()
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  const status =
    normalise(
      properties.STATUS
    );

  if (
    status === "cancelled"
    || status === "completed"
    || status === "complete"
  ) {
    return false;
  }

  const start =
    parsedTime(
      properties.START
    );

  const finish =
    parsedTime(
      properties.FINISH
    );

  if (
    start !== null
    && start > nowMs
  ) {
    return false;
  }

  if (
    finish !== null
    && finish < nowMs
  ) {
    return false;
  }

  return true;
}

export function powerOutageSummary(
  feature
) {
  const properties =
    propertiesOf(
      feature
    );

  const provider =
    providerOf(
      feature
    );

  const customers =
    Number(
      properties.CUSTOMERS_AFFECTED
      ?? 0
    );

  return {
    id:
      feature?.id
      ?? qualifiedFeatureId(
        feature,
        provider
      ),

    eventId:
      properties.EVENT_ID
      ?? "",

    provider,

    attribution:
      PROVIDER_META[
        provider
      ].attribution,

    type:
      normalise(
        properties.TYPE
      ) === "planned"
        ? "PLANNED"
        : "UNPLANNED",

    status:
      properties.STATUS
      ?? "",

    customersAffected:
      Number.isFinite(
        customers
      )
        ? Math.max(
            0,
            customers
          )
        : 0,

    suburbs:
      properties.SUBURBS
      ?? "",

    streets:
      properties.STREETS
      ?? "",

    start:
      properties.START
      ?? "",

    finish:
      properties.FINISH
      ?? "",

    estimatedFix:
      properties.EST_FIX_TIME
      ?? "",

    reason:
      properties.REASON
      ?? "",

    extracted:
      properties.EXTRACTED
      ?? ""
  };
}

export function filterCurrentPowerOutages(
  payload,
  nowMs = Date.now()
) {
  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
          .filter(
            feature =>
              feature?.geometry
              && isCurrentPowerOutage(
                feature,
                nowMs
              )
          )
      : [];

  return {
    ...(
      payload
      && typeof payload
        === "object"
        ? payload
        : {}
    ),

    type:
      "FeatureCollection",

    features
  };
}

async function fetchJson(
  fetchImpl,
  url,
  provider,
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController
      === "function"
      ? new AbortController()
      : null;

  const timeout =
    controller
      ? setTimeout(
          () =>
            controller.abort(),
          timeoutMs
        )
      : null;

  try {
    const response =
      await fetchImpl(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/geo+json,application/json"
          },

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `${provider} outage feed HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

async function fetchText(
  fetchImpl,
  url,
  provider,
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController
      === "function"
      ? new AbortController()
      : null;

  const timeout =
    controller
      ? setTimeout(
          () =>
            controller.abort(),
          timeoutMs
        )
      : null;

  try {
    const response =
      await fetchImpl(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/vnd.google-earth.kml+xml,application/xml,text/xml,text/plain"
          },

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `${provider} outage feed HTTP ${response.status}`
      );
    }

    return await response.text();
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

async function loadProvider({
  fetchImpl,
  provider,
  url,
  nowMs
}) {
  const payload =
    await fetchJson(
      fetchImpl,
      url,
      provider
    );

  return {
    provider,

    payload:
      filterCurrentPowerOutages(
        annotateProvider(
          payload,
          provider
        ),
        nowMs
      )
  };
}

async function loadEssentialProvider({
  fetchImpl,
  url,
  boundaryUrl,
  nowMs
}) {
  const [
    kml,
    queenslandBoundary
  ] =
    await Promise.all([
      fetchText(
        fetchImpl,
        url,
        "Essential Energy"
      ),

      fetchJson(
        fetchImpl,
        boundaryUrl,
        "Queensland boundary"
      )
    ]);

  const parsed =
    parseEssentialEnergyKml(
      kml
    );

  const queenslandOnly =
    filterFeaturesToQueensland(
      parsed,
      queenslandBoundary
    );

  return {
    provider:
      "Essential Energy",

    payload:
      filterCurrentPowerOutages(
        queenslandOnly,
        nowMs
      )
  };
}

export async function loadPowerOutages({
  fetchImpl =
    globalThis.fetch,

  energexUrl =
    ENERGEX_OUTAGE_AREA_QUERY_URL,

  ergonUrl =
    ERGON_OUTAGE_AREA_QUERY_URL,

  essentialUrl =
    DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,

  queenslandBoundaryUrl =
    QUEENSLAND_MAINLAND_QUERY_URL,

  nowMs =
    Date.now()
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "Power-outage fetch is unavailable."
    );
  }

  const requests =
    [
      {
        provider:
          "Energex",
        url:
          energexUrl
      },
      {
        provider:
          "Ergon",
        url:
          ergonUrl,
        kind:
          "geojson"
      },
      {
        provider:
          "Essential Energy",
        url:
          essentialUrl,
        kind:
          "kml"
      }
    ];

  const settled =
    await Promise.allSettled(
      requests.map(
        request =>
          request.kind
          === "kml"
            ? loadEssentialProvider({
                fetchImpl,
                url:
                  request.url,
                boundaryUrl:
                  queenslandBoundaryUrl,
                nowMs
              })
            : loadProvider({
                fetchImpl,
                provider:
                  request.provider,
                url:
                  request.url,
                nowMs
              })
      )
    );

  const available = [];
  const failed = [];
  const features = [];

  settled.forEach(
    (
      result,
      index
    ) => {
      const provider =
        requests[index]
          .provider;

      if (
        result.status
        === "fulfilled"
      ) {
        available.push(
          provider
        );

        features.push(
          ...(
            result.value
              .payload
              .features
            ?? []
          )
        );
      } else {
        failed.push({
          provider,
          message:
            result.reason
              ?.message
            ?? String(
              result.reason
            )
        });
      }
    }
  );

  if (!available.length) {
    throw new Error(
      failed
        .map(
          item =>
            item.message
        )
        .join(" | ")
      || "All power-outage feeds failed."
    );
  }

  return {
    payload: {
      type:
        "FeatureCollection",
      features
    },

    providers:
      available,

    failedProviders:
      failed,

    partial:
      failed.length > 0,

    transport:
      "Queensland-only Energex/Ergon ArcGIS GeoJSON + Essential Energy KML clipped by Queensland Government mainland boundary"
  };
}

export function createPowerOutageLayer({
  viewer,

  CesiumRef =
    globalThis.Cesium,

  fetchImpl =
    globalThis.fetch,

  energexUrl =
    ENERGEX_OUTAGE_AREA_QUERY_URL,

  ergonUrl =
    ERGON_OUTAGE_AREA_QUERY_URL,

  essentialUrl =
    DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,

  queenslandBoundaryUrl =
    QUEENSLAND_MAINLAND_QUERY_URL,

  refreshMs =
    DEFAULT_POWER_OUTAGE_REFRESH_MS,

  visible = true,

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
      "Power-outage layer requires Cesium and a viewer."
    );
  }

  const dataSource =
    new CesiumRef
      .GeoJsonDataSource(
        "power-outages"
      );

  dataSource.show =
    Boolean(
      visible
    );

  viewer.dataSources.add(
    dataSource
  );

  const unplannedColour =
    CesiumRef.Color
      .fromCssColorString(
        "#ff5252"
      );

  const plannedColour =
    CesiumRef.Color
      .fromCssColorString(
        "#ffb300"
      );

  const outlineColour =
    CesiumRef.Color
      .fromCssColorString(
        "#1b1b1b"
      );

  let currentFeatures = [];
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;

  async function render(
    payload
  ) {
    currentFeatures =
      payload.features
      ?? [];

    const wasVisible =
      dataSource.show;

    await dataSource.load(
      payload,
      {
        clampToGround:
          true
      }
    );

    dataSource.show =
      wasVisible;

    for (
      const entity
      of dataSource
        .entities
        .values
    ) {
      const feature =
        currentFeatures
          .find(
            item =>
              String(
                item.id
              )
              === String(
                entity.id
              )
          );

      if (!feature) {
        continue;
      }

      const summary =
        powerOutageSummary(
          feature
        );

      entity
        .stormTrackerPowerOutageId =
        String(
          summary.id
        );

      entity
        .stormTrackerPowerOutageProvider =
        summary.provider;

      if (
        entity.polygon
      ) {
        const colour =
          summary.type
          === "PLANNED"
            ? plannedColour
            : unplannedColour;

        entity.polygon
          .material =
          colour.withAlpha(
            summary.type
            === "PLANNED"
              ? 0.26
              : 0.34
          );

        entity.polygon
          .outline =
          true;

        entity.polygon
          .outlineColor =
          outlineColour
            .withAlpha(
              0.92
            );
      }
    }

    viewer.scene
      .requestRender();

    onUpdate(
      currentFeatures
        .slice()
    );
  }

  async function refresh({
    force = false
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
            "Checking power outages..."
        });

        const result =
          await loadPowerOutages({
            fetchImpl,
            energexUrl,
            ergonUrl,
            essentialUrl,
            queenslandBoundaryUrl
          });

        await render(
          result.payload
        );

        lastLoadedAt =
          Date.now();

        const summaries =
          currentFeatures
            .map(
              powerOutageSummary
            );

        const unplanned =
          summaries.filter(
            item =>
              item.type
              === "UNPLANNED"
          ).length;

        const planned =
          summaries.length
          - unplanned;

        const customers =
          summaries.reduce(
            (
              sum,
              item
            ) =>
              sum
              + item
                .customersAffected,
            0
          );

        const providerText =
          result.providers
            .join(" + ");

        const partialText =
          result.partial
            ? ` | PARTIAL: ${result.failedProviders.map(item => item.provider).join(", ")} unavailable`
            : "";

        onStatus({
          kind:
            result.partial
              ? "warning"
              : "ok",

          message:
            `${summaries.length} current outage${summaries.length === 1 ? "" : "s"} | ${unplanned} unplanned | ${planned} planned | ${customers.toLocaleString("en-AU")} customers | ${providerText}${partialText}`,

          count:
            summaries.length,

          customers,

          providers:
            result.providers
              .slice(),

          failedProviders:
            result.failedProviders
              .slice(),

          partial:
            result.partial,

          transport:
            result.transport,

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
            ) === wanted
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
    }
  };
}
