import {
  filterQueenslandRiverGauges,
  riverGaugeSummary
} from "./river-gauges-v1.js?v=9.12.0-dev1";

export const DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-gauge-metadata";

export const DEFAULT_RIVER_HEIGHT_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-height-bulletins";

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function stationIdKey(
  value
) {
  const raw =
    text(
      value
    ).toUpperCase();

  if (!raw) {
    return "";
  }

  if (
    /^\d+$/.test(
      raw
    )
  ) {
    return String(
      Number(raw)
    );
  }

  return raw.replace(
    /[^A-Z0-9]/g,
    ""
  );
}

export function normaliseRiverStationName(
  value
) {
  return text(
    value
  )
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function uniqueNameIndex(
  features
) {
  const index =
    new Map();

  for (
    const feature
    of features
  ) {
    const summary =
      riverGaugeSummary(
        feature
      );

    const key =
      normaliseRiverStationName(
        summary.name
      );

    if (!key) {
      continue;
    }

    if (
      index.has(
        key
      )
    ) {
      index.set(
        key,
        null
      );
    } else {
      index.set(
        key,
        feature
      );
    }
  }

  return index;
}

function stationIdIndex(
  features
) {
  const index =
    new Map();

  for (
    const feature
    of features
  ) {
    const summary =
      riverGaugeSummary(
        feature
      );

    for (
      const value
      of [
        summary.bomStationNumber,
        summary.awrcStationId
      ]
    ) {
      const key =
        stationIdKey(
          value
        );

      if (
        key
        && !index.has(
          key
        )
      ) {
        index.set(
          key,
          feature
        );
      }
    }
  }

  return index;
}

function observationsFromPayload(
  payload
) {
  const products =
    Array.isArray(
      payload?.products
    )
      ? payload.products
      : [];

  return products.flatMap(
    product =>
      Array.isArray(
        product?.observations
      )
        ? product.observations
        : []
  );
}

export function riverGaugeDisplayState({
  tidal = false,
  tendency = "unknown",
  floodClass = ""
} = {}) {
  const flood =
    text(
      floodClass
    ).toLowerCase();

  if (
    flood === "major"
  ) {
    return "major";
  }

  if (
    flood === "moderate"
  ) {
    return "moderate";
  }

  if (
    flood === "minor"
  ) {
    return "minor";
  }

  const trend =
    text(
      tendency
    ).toLowerCase();

  if (
    trend === "rising"
  ) {
    return tidal
      ? "tidal-rise"
      : "rising";
  }

  if (
    trend === "falling"
  ) {
    return "falling";
  }

  if (
    trend === "steady"
  ) {
    return "steady";
  }

  return "unknown";
}

function featureWithObservation(
  feature,
  observation
) {
  const summary =
    riverGaugeSummary(
      feature
    );

  const state =
    riverGaugeDisplayState({
      tidal:
        summary.tidal,
      tendency:
        observation.tendency,
      floodClass:
        observation.floodClass
    });

  return {
    ...feature,

    properties: {
      ...(
        feature.properties
        ?? {}
      ),

      STORMTRACKER_HEIGHT_METRES:
        observation.heightMetres,

      STORMTRACKER_TENDENCY:
        observation.tendency,

      STORMTRACKER_FLOOD_CLASS:
        observation.floodClass,

      STORMTRACKER_OBSERVED_TEXT:
        observation.observedText,

      STORMTRACKER_SOURCE_PRODUCT:
        observation.sourceProduct,

      STORMTRACKER_RECENT_DATA_HREF:
        observation.recentDataHref,

      STORMTRACKER_DISPLAY_STATE:
        state,

      STORMTRACKER_TIDAL_CONTEXT:
        summary.tidal
          ? (
              state
              === "tidal-rise"
                ? "Tidal site · rising may reflect normal tide"
                : "Tidal site"
            )
          : ""
    }
  };
}

export function joinRiverGaugeObservations({
  gauges,
  bulletins
} = {}) {
  const gaugePayload =
    filterQueenslandRiverGauges(
      gauges
    );

  const gaugeFeatures =
    gaugePayload.features;

  const observations =
    observationsFromPayload(
      bulletins
    );

  const byId =
    stationIdIndex(
      gaugeFeatures
    );

  const byName =
    uniqueNameIndex(
      gaugeFeatures
    );

  const matched =
    new Map();

  const unmatchedObservations =
    [];

  for (
    const observation
    of observations
  ) {
    const idKey =
      stationIdKey(
        observation.stationId
      );

    const nameKey =
      normaliseRiverStationName(
        observation.stationName
      );

    const feature =
      (
        idKey
          ? byId.get(
              idKey
            )
          : null
      )
      || (
        nameKey
          ? byName.get(
              nameKey
            )
          : null
      );

    if (!feature) {
      unmatchedObservations.push(
        observation
      );

      continue;
    }

    const featureId =
      String(
        feature.id
      );

    if (
      matched.has(
        featureId
      )
    ) {
      continue;
    }

    matched.set(
      featureId,
      featureWithObservation(
        feature,
        observation
      )
    );
  }

  return {
    payload: {
      type:
        "FeatureCollection",

      features:
        [
          ...matched
            .values()
        ]
    },

    totalGaugeLocations:
      gaugeFeatures.length,

    totalObservations:
      observations.length,

    matchedCount:
      matched.size,

    unmatchedObservations,

    partialBulletins:
      Boolean(
        bulletins?.partial
      ),

    failedProducts:
      Array.isArray(
        bulletins?.failed
      )
        ? bulletins.failed
        : []
  };
}

async function fetchJson(
  fetchImpl,
  url,
  label,
  timeoutMs = 15000
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
              "application/json,application/geo+json"
          },

          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `${label} HTTP ${response.status}`
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

export async function loadRiverGaugeOperationalSnapshot({
  fetchImpl =
    globalThis.fetch,

  gaugeUrl =
    DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,

  relayUrl =
    DEFAULT_RIVER_HEIGHT_RELAY_URL
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "River-gauge operational fetch is unavailable."
    );
  }

  const [
    gauges,
    bulletins
  ] =
    await Promise.all([
      fetchJson(
        fetchImpl,
        gaugeUrl,
        "BoM river-gauge metadata"
      ),

      fetchJson(
        fetchImpl,
        relayUrl,
        "BoM river-height relay"
      )
    ]);

  const joined =
    joinRiverGaugeObservations({
      gauges,
      bulletins
    });

  return {
    ...joined,

    source:
      "Bureau of Meteorology",

    transport:
      "BoM ArcGIS metadata + StormTracker river-height relay"
  };
}
