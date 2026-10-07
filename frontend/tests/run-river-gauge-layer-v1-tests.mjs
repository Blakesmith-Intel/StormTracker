import assert from "node:assert/strict";

import {
  createRiverGaugeMarkerImage,
  riverGaugeOperationalSummary
} from "../src/context-layers/river-gauge-layer-v1.js";

const feature = {
  id:
    "bom:040123",

  type:
    "Feature",

  properties: {
    bom_stn_num:
      "040123",

    awrc_stateid:
      "QLD-123",

    name:
      "Example Tide Gauge",

    lat:
      -27.5,

    long:
      153.1,

    state:
      "QLD",

    location_types:
      "water level gauge;tide gauge;",

    forecast_site_classification:
      "Forecast location",

    basin:
      "Example Basin",

    agency:
      "BoM",

    featreal:
      "Real",

    STORMTRACKER_HEIGHT_METRES:
      1.37,

    STORMTRACKER_TENDENCY:
      "rising",

    STORMTRACKER_FLOOD_CLASS:
      "",

    STORMTRACKER_OBSERVED_TEXT:
      "2.30pm Wed",

    STORMTRACKER_SOURCE_PRODUCT:
      "IDQ60285",

    STORMTRACKER_RECENT_DATA_HREF:
      "/recent?id=040123",

    STORMTRACKER_DISPLAY_STATE:
      "tidal-rise",

    STORMTRACKER_TIDAL_CONTEXT:
      "Tidal site · rising may reflect normal tide"
  },

  geometry: {
    type:
      "Point",

    coordinates: [
      153.1,
      -27.5
    ]
  }
};

const summary =
  riverGaugeOperationalSummary(
    feature
  );

assert.equal(
  summary.id,
  "bom:040123"
);

assert.equal(
  summary.heightMetres,
  1.37
);

assert.equal(
  summary.tidal,
  true
);

assert.equal(
  summary.displayState,
  "tidal-rise"
);

assert.equal(
  summary.sourceProduct,
  "IDQ60285"
);

for (
  const state
  of [
    "major",
    "moderate",
    "minor",
    "rising",
    "tidal-rise",
    "falling",
    "steady",
    "unknown"
  ]
) {
  assert.match(
    createRiverGaugeMarkerImage(
      state
    ),
    /^data:image\/svg\+xml;charset=utf-8,/
  );
}

console.log(
  "River gauge layer checks passed: operational summaries preserve live context and all display states produce self-contained marker images."
);
