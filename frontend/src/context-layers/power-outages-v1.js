export const ENERGEX_ATTRIBUTION =
  "Energex | Energy Queensland";

export const ENERGEX_OUTAGE_AREA_QUERY_URL =
  "https://services.arcgis.com/bfVzktoY0OhzQCDj/arcgis/rest/services/VwEnergexOutages/FeatureServer/0/query"
  + "?where=1%3D1"
  + "&outFields=EVENT_ID%2CTYPE%2CSTATUS%2CCUSTOMERS_AFFECTED%2CSUBURBS%2CSTREETS%2CSTART%2CFINISH%2CEST_FIX_TIME%2CREASON%2CEXTRACTED"
  + "&returnGeometry=true"
  + "&outSR=4326"
  + "&f=geojson";

export const DEFAULT_POWER_OUTAGE_REFRESH_MS =
  15 * 60 * 1000;

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

  const customers =
    Number(
      properties.CUSTOMERS_AFFECTED
      ?? 0
    );

  return {
    id:
      properties.EVENT_ID
      ?? feature?.id
      ?? "",

    provider:
      "Energex",

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
          .map(
            feature => ({
              ...feature,
              id:
                String(
                  powerOutageSummary(
                    feature
                  ).id
                )
            })
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
        `Energex outage feed HTTP ${response.status}`
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

export async function loadPowerOutages({
  fetchImpl =
    globalThis.fetch,
  energexUrl =
    ENERGEX_OUTAGE_AREA_QUERY_URL,
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

  const payload =
    await fetchJson(
      fetchImpl,
      energexUrl
    );

  return {
    payload:
      filterCurrentPowerOutages(
        payload,
        nowMs
      ),
    provider:
      "Energex",
    transport:
      "Direct first-party ArcGIS GeoJSON"
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
            "Checking Energex power outages..."
        });

        const result =
          await loadPowerOutages({
            fetchImpl,
            energexUrl
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

        onStatus({
          kind:
            "ok",
          message:
            `${summaries.length} current Energex outage${summaries.length === 1 ? "" : "s"} | ${unplanned} unplanned | ${planned} planned | ${customers.toLocaleString("en-AU")} customers`,
          count:
            summaries.length,
          customers,
          provider:
            result.provider,
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
              powerOutageSummary(
                feature
              ).id
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
