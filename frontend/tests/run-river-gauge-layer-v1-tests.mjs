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

// Flood-risk palette is severity-based, not a claim that a steady/falling
// major-level river is safe. Tidal anomalies remain a separate screening type.
const decoded=state=>decodeURIComponent(createRiverGaugeMarkerImage(state));
for(const [state,color]of Object.entries({
  "rapid-rise":"#2db76f",minor:"#2db76f",
  moderate:"#ffd43b",major:"#e53935",
  "tidal-anomaly":"#45c7e8"
})){
  assert.ok(decoded(state).includes('fill="'+color+'"'),
    state+" must render the agreed severity/screening colour");
}
assert.match(decoded("major"),/stroke="#ffffff"/,
  "Red major-flood waves must remain high-contrast white");
assert.match(decoded("moderate"),/stroke="#111111"/,
  "Yellow moderate-flood waves must be dark enough to read");
console.log(
  "River gauge layer checks passed: operational summaries preserve live context and all display states produce self-contained marker images."
);
