import {
  DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
  loadRiverGaugeOperationalSnapshot
} from "../frontend/src/context-layers/river-gauge-observations-v1.js";

const metadataResponse =
  await fetch(
    DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
    {
      headers: {
        Origin:
          "https://blakesmith-intel.github.io"
      }
    }
  );

if (!metadataResponse.ok) {
  throw new Error(
    `River-gauge metadata relay HTTP ${metadataResponse.status}`
  );
}

const metadataCors =
  metadataResponse.headers.get(
    "access-control-allow-origin"
  );

if (
  metadataCors
  !== "https://blakesmith-intel.github.io"
) {
  throw new Error(
    `River-gauge metadata relay CORS unsuitable for GitHub Pages: ${metadataCors}`
  );
}

const result =
  await loadRiverGaugeOperationalSnapshot();

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
