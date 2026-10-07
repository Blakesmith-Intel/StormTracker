import {
  DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  joinRiverGaugeObservations
} from "../frontend/src/context-layers/river-gauge-observations-v1.js";

async function timedJson(
  label,
  url,
  {
    origin = false,
    timeoutMs = 40000
  } = {}
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  const started =
    Date.now();

  try {
    const response =
      await fetch(
        url,
        {
          headers:
            origin
              ? {
                  Origin:
                    "https://blakesmith-intel.github.io"
                }
              : {
                  Accept:
                    "application/json"
                },

          signal:
            controller.signal
        }
      );

    const elapsedMs =
      Date.now()
      - started;

    console.log(
      `${label}_status`,
      response.status
    );

    console.log(
      `${label}_elapsed_ms`,
      elapsedMs
    );

    if (origin) {
      console.log(
        `${label}_cors`,
        response.headers.get(
          "access-control-allow-origin"
        )
      );
    }

    if (!response.ok) {
      throw new Error(
        `${label} HTTP ${response.status}`
      );
    }

    return {
      payload:
        await response.json(),
      elapsedMs,
      cors:
        response.headers.get(
          "access-control-allow-origin"
        )
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

const [
  metadataResult,
  bulletinResult
] =
  await Promise.all([
    timedJson(
      "metadata",
      DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
      {
        origin:
          true
      }
    ),

    timedJson(
      "bulletins",
      DEFAULT_RIVER_HEIGHT_RELAY_URL,
      {
        origin:
          true
      }
    )
  ]);

if (
  metadataResult.cors
  !== "https://blakesmith-intel.github.io"
) {
  throw new Error(
    `River-gauge metadata relay CORS unsuitable for GitHub Pages: ${metadataResult.cors}`
  );
}

if (
  bulletinResult.cors
  !== "https://blakesmith-intel.github.io"
) {
  throw new Error(
    `River-height relay CORS unsuitable for GitHub Pages: ${bulletinResult.cors}`
  );
}

const result =
  joinRiverGaugeObservations({
    gauges:
      metadataResult.payload,
    bulletins:
      bulletinResult.payload
  });

const features =
  result.payload?.features
  ?? [];

const states =
  features.reduce(
    (
      counts,
      feature
    ) => {
      const state =
        String(
          feature?.properties
            ?.STORMTRACKER_DISPLAY_STATE
          ?? "unknown"
        );

      counts[state] =
        (
          counts[state]
          ?? 0
        )
        + 1;

      return counts;
    },
    {}
  );

const tidal =
  features.filter(
    feature =>
      String(
        feature?.properties
          ?.location_types
        ?? ""
      )
        .toLowerCase()
        .includes(
          "tide gauge"
        )
  ).length;

const summary = {
  metadataElapsedMs:
    metadataResult.elapsedMs,

  bulletinElapsedMs:
    bulletinResult.elapsedMs,

  totalGaugeLocations:
    result.totalGaugeLocations,

  totalObservations:
    result.totalObservations,

  matchedCount:
    result.matchedCount,

  unmatchedCount:
    result.unmatchedObservations
      ?.length
    ?? 0,

  partialBulletins:
    result.partialBulletins,

  failedProducts:
    result.failedProducts
      ?.map(
        item =>
          item.product
      )
    ?? [],

  renderedFeatures:
    features.length,

  tidalMatched:
    tidal,

  displayStates:
    states,

  unmatchedSample:
    (
      result.unmatchedObservations
      ?? []
    )
      .slice(
        0,
        20
      )
      .map(
        item => ({
          stationName:
            item.stationName,
          stationId:
            item.stationId,
          sourceProduct:
            item.sourceProduct
        })
      )
};

console.log(
  JSON.stringify(
    summary,
    null,
    2
  )
);

if (
  !Number.isFinite(
    summary.totalGaugeLocations
  )
  || summary.totalGaugeLocations <= 0
) {
  throw new Error(
    "Live BoM gauge metadata returned no Queensland gauge locations."
  );
}

if (
  !Number.isFinite(
    summary.totalObservations
  )
  || summary.totalObservations <= 0
) {
  throw new Error(
    "Live BoM river-height relay returned no observations."
  );
}

if (
  !Number.isFinite(
    summary.matchedCount
  )
  || summary.matchedCount < 25
) {
  throw new Error(
    `Live BoM gauge/observation join produced too few matched gauges: ${summary.matchedCount}`
  );
}

if (
  summary.renderedFeatures
  !== summary.matchedCount
) {
  throw new Error(
    "Rendered river-gauge feature count does not match joined gauge count."
  );
}
