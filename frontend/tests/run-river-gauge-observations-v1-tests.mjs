import assert from "node:assert/strict";

import {
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  joinRiverGaugeObservations,
  loadRiverGaugeOperationalSnapshot,
  normaliseRiverStationName,
  riverGaugeDisplayState
} from "../src/context-layers/river-gauge-observations-v1.js";

function gauge({
  id,
  bom,
  awrc,
  name,
  types =
    "water level gauge;"
}) {
  return {
    type:
      "Feature",

    id,

    properties: {
      bom_stn_num:
        bom,

      awrc_stateid:
        awrc,

      name,

      lat:
        -27.5,

      long:
        153.0,

      state:
        "QLD",

      location_types:
        types,

      forecast_site_classification:
        "Data location",

      basin:
        "Example Basin",

      agency:
        "BoM",

      featreal:
        "Real"
    },

    geometry: {
      type:
        "Point",

      coordinates: [
        153.0,
        -27.5
      ]
    }
  };
}

const gauges = {
  type:
    "FeatureCollection",

  features: [
    gauge({
      id:
        "bom:040123",
      bom:
        "040123",
      awrc:
        "QLD-1",
      name:
        "Nerang River at Carrara"
    }),

    gauge({
      id:
        "bom:540071",
      bom:
        "540071",
      awrc:
        "QLD-2",
      name:
        "Brisbane River at Example Tide",
      types:
        "water level gauge;tide gauge;"
    }),

    gauge({
      id:
        "awrc:QLD-3",
      bom:
        "",
      awrc:
        "QLD-3",
      name:
        "Unique Name Gauge"
    }),

    gauge({
      id:
        "bom:111111",
      bom:
        "111111",
      awrc:
        "QLD-4",
      name:
        "Duplicate Name"
    }),

    gauge({
      id:
        "bom:222222",
      bom:
        "222222",
      awrc:
        "QLD-5",
      name:
        "Duplicate Name"
    })
  ]
};

const bulletins = {
  partial:
    true,

  failed: [
    {
      product:
        "IDQ60296",
      message:
        "test failure"
    }
  ],

  products: [
    {
      product:
        "IDQ60285",

      observations: [
        {
          stationName:
            "Different bulletin label",
          stationId:
            "40123",
          heightMetres:
            0.58,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:16 am Tue",
          recentDataHref:
            "/recent?id=040123",
          sourceProduct:
            "IDQ60285"
        },

        {
          stationName:
            "Brisbane River at Example Tide",
          stationId:
            "540071",
          heightMetres:
            1.2,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:17 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60286"
        },

        {
          stationName:
            "Unique Name Gauge",
          stationId:
            "",
          heightMetres:
            2.1,
          tendency:
            "steady",
          floodClass:
            "minor",
          observedText:
            "10:18 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60290"
        },

        {
          stationName:
            "Duplicate Name",
          stationId:
            "",
          heightMetres:
            3.0,
          tendency:
            "rising",
          floodClass:
            "",
          observedText:
            "10:19 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60290"
        },

        {
          stationName:
            "No Matching Gauge",
          stationId:
            "",
          heightMetres:
            0.4,
          tendency:
            "falling",
          floodClass:
            "",
          observedText:
            "10:20 am Tue",
          recentDataHref:
            "",
          sourceProduct:
            "IDQ60291"
        }
      ]
    }
  ]
};

assert.equal(
  normaliseRiverStationName(
    " Nerang-River & Carrara "
  ),
  "nerang river and carrara"
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      false,
    tendency:
      "rising"
  }),
  "rising"
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      true,
    tendency:
      "rising"
  }),
  "tidal-rise",
  "A tidal rise alone must not be treated as a flood signal."
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      true,
    tendency:
      "rising",
    floodClass:
      "minor"
  }),
  "minor",
  "A BoM flood class takes precedence even at a tidal gauge."
);

assert.equal(
  riverGaugeDisplayState({
    tidal:
      false,
    tendency:
      "falling",
    floodClass:
      "major"
  }),
  "major"
);

const joined =
  joinRiverGaugeObservations({
    gauges,
    bulletins
  });

assert.equal(
  joined.totalGaugeLocations,
  5
);

assert.equal(
  joined.totalObservations,
  5
);

assert.equal(
  joined.matchedCount,
  3
);

assert.equal(
  joined.payload
    .features
    .length,
  3
);

assert.equal(
  joined.unmatchedObservations
    .length,
  2,
  "Ambiguous duplicate names and unknown stations must remain unmatched rather than guessed."
);

assert.equal(
  joined.partialBulletins,
  true
);

assert.equal(
  joined.failedProducts[0]
    .product,
  "IDQ60296"
);

const carrara =
  joined.payload
    .features
    .find(
      feature =>
        feature.id
        === "bom:040123"
    );

assert.equal(
  carrara.properties
    .STORMTRACKER_DISPLAY_STATE,
  "rising"
);

assert.equal(
  carrara.properties
    .STORMTRACKER_HEIGHT_METRES,
  0.58
);

const tidal =
  joined.payload
    .features
    .find(
      feature =>
        feature.id
        === "bom:540071"
    );

assert.equal(
  tidal.properties
    .STORMTRACKER_DISPLAY_STATE,
  "tidal-rise"
);

assert.equal(
  tidal.properties
    .STORMTRACKER_TIDAL_CONTEXT,
  "Tidal site · rising may reflect normal tide"
);

const minor =
  joined.payload
    .features
    .find(
      feature =>
        feature.id
        === "awrc:QLD-3"
    );

assert.equal(
  minor.properties
    .STORMTRACKER_DISPLAY_STATE,
  "minor"
);

assert.match(
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  /river-height-bulletins$/
);

let gaugeRequested = false;
let relayRequested = false;

const loaded =
  await loadRiverGaugeOperationalSnapshot({
    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
            "National_Flood_Gauge_Network"
          )
        ) {
          gaugeRequested =
            true;

          return {
            ok:
              true,
            status:
              200,
            async json() {
              return gauges;
            }
          };
        }

        if (
          target.includes(
            "river-height-bulletins"
          )
        ) {
          relayRequested =
            true;

          return {
            ok:
              true,
            status:
              200,
            async json() {
              return bulletins;
            }
          };
        }

        throw new Error(
          `Unexpected request ${target}`
        );
      }
  });

assert.equal(
  gaugeRequested,
  true
);

assert.equal(
  relayRequested,
  true
);

assert.equal(
  loaded.matchedCount,
  3
);

assert.equal(
  loaded.transport,
  "BoM ArcGIS metadata + StormTracker river-height relay"
);

console.log(
  "River gauge operational checks passed: ID-first matching, unique-name fallback, ambiguous-name rejection, BoM flood-class precedence and tidal-rise suppression."
);
