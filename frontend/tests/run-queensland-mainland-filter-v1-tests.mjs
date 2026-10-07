import assert from "node:assert/strict";

import {
  QUEENSLAND_MAINLAND_QUERY_URL,
  filterFeaturesToQueensland,
  pointInGeoJsonBoundary,
  representativePointForFeature,
  representativePointForGeometry
} from "../src/context-layers/queensland-mainland-filter-v1.js";

assert.match(
  QUEENSLAND_MAINLAND_QUERY_URL,
  /Locality\/FeatureServer\/5\/query/
);

assert.match(
  QUEENSLAND_MAINLAND_QUERY_URL,
  /outSR=4326/
);

assert.match(
  QUEENSLAND_MAINLAND_QUERY_URL,
  /f=geojson/
);

const boundary = {
  type:
    "FeatureCollection",

  features: [
    {
      type:
        "Feature",

      properties: {},

      geometry: {
        type:
          "Polygon",

        coordinates: [[
          [140, -29],
          [152, -29],
          [153.6, -28.1],
          [153.6, -10],
          [140, -10],
          [140, -29]
        ]]
      }
    }
  ]
};

assert.equal(
  pointInGeoJsonBoundary(
    [
      150.31,
      -28.55
    ],
    boundary
  ),
  true,
  "Goondiwindi-area points must remain inside the Queensland gate."
);

assert.equal(
  pointInGeoJsonBoundary(
    [
      153.27,
      -28.81
    ],
    boundary
  ),
  false,
  "Northern NSW points such as the Lismore area must not pass merely because they are north of 29°S."
);

const qldPolygon = {
  type:
    "Polygon",

  coordinates: [[
    [150.30, -28.56],
    [150.32, -28.56],
    [150.32, -28.54],
    [150.30, -28.54],
    [150.30, -28.56]
  ]]
};

const nswPolygon = {
  type:
    "Polygon",

  coordinates: [[
    [153.26, -28.82],
    [153.28, -28.82],
    [153.28, -28.80],
    [153.26, -28.80],
    [153.26, -28.82]
  ]]
};

const qldPoint =
  representativePointForGeometry(
    qldPolygon
  );

assert.deepEqual(
  representativePointForFeature({
    properties: {
      STORMTRACKER_SOURCE_LONGITUDE:
        150.31,
      STORMTRACKER_SOURCE_LATITUDE:
        -28.55
    },
    geometry:
      nswPolygon
  }),
  [
    150.31,
    -28.55
  ],
  "Essential's provider-supplied incident point must take precedence over polygon centroid near the state border."
);

assert.ok(
  qldPoint
);

assert.equal(
  pointInGeoJsonBoundary(
    qldPoint,
    boundary
  ),
  true
);

const filtered =
  filterFeaturesToQueensland(
    {
      type:
        "FeatureCollection",

      features: [
        {
          type:
            "Feature",
          id:
            "essential:QLD",
          properties: {},
          geometry:
            qldPolygon
        },
        {
          type:
            "Feature",
          id:
            "essential:NSW",
          properties: {},
          geometry:
            nswPolygon
        }
      ]
    },
    boundary
  );

assert.deepEqual(
  filtered.features
    .map(
      feature =>
        feature.id
    ),
  [
    "essential:QLD"
  ]
);

assert.throws(
  () =>
    filterFeaturesToQueensland(
      {
        type:
          "FeatureCollection",
        features: []
      },
      {
        type:
          "FeatureCollection",
        features: []
      }
    ),
  /boundary returned no polygon features/
);

console.log(
  "Queensland boundary checks passed: Essential Energy incidents are gated by an official Queensland polygon rather than latitude alone."
);
