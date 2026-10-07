import assert from "node:assert/strict";

import {
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
  BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  DEFAULT_RIVER_GAUGE_REFRESH_MS,
  filterQueenslandRiverGauges,
  isTidalRiverGauge,
  loadRiverGaugeLocations,
  riverGaugeId,
  riverGaugeSummary
} from "../src/context-layers/river-gauges-v1.js";

assert.equal(
  DEFAULT_RIVER_GAUGE_REFRESH_MS,
  15 * 60 * 1000
);

assert.match(
  BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  /National_Flood_Gauge_Network\/FeatureServer\/5\/query/
);

assert.match(
  BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  /state%3D%27QLD%27/
);

assert.match(
  BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  /outSR=4326/
);

assert.match(
  BOM_RIVER_TIDE_GAUGE_QUERY_URL,
  /f=geojson/
);

assert.match(
  BOM_RIVER_TIDE_GAUGE_ATTRIBUTION,
  /Bureau of Meteorology/
);

const tidal = {
  type:
    "Feature",
  properties: {
    bom_stn_num:
      "040001",
    awrc_stateid:
      "QLD-001",
    name:
      "Example Estuary",
    lat:
      -27.50,
    long:
      153.10,
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
      "Real"
  },
  geometry: {
    type:
      "Point",
    coordinates: [
      153.10,
      -27.50
    ]
  }
};

const inland = {
  type:
    "Feature",
  properties: {
    bom_stn_num:
      "",
    awrc_stateid:
      "QLD-002",
    name:
      "Example River",
    lat:
      -27.70,
    long:
      152.80,
    state:
      "QLD",
    location_types:
      "rain gauge;water level gauge;",
    forecast_site_classification:
      "Data location",
    basin:
      "Example Basin",
    agency:
      "Council",
    featreal:
      "Real"
  },
  geometry: {
    type:
      "Point",
    coordinates: [
      152.80,
      -27.70
    ]
  }
};

assert.equal(
  isTidalRiverGauge(
    tidal
  ),
  true
);

assert.equal(
  isTidalRiverGauge(
    inland
  ),
  false
);

assert.equal(
  riverGaugeId(
    tidal
  ),
  "bom:040001"
);

assert.equal(
  riverGaugeId(
    inland
  ),
  "awrc:QLD-002"
);

assert.deepEqual(
  riverGaugeSummary(
    tidal
  ),
  {
    id:
      "bom:040001",
    bomStationNumber:
      "040001",
    awrcStationId:
      "QLD-001",
    name:
      "Example Estuary",
    state:
      "QLD",
    latitude:
      -27.50,
    longitude:
      153.10,
    locationTypes:
      "water level gauge;tide gauge;",
    tidal:
      true,
    forecastSiteClassification:
      "Forecast location",
    basin:
      "Example Basin",
    agency:
      "BoM",
    featureReality:
      "Real"
  }
);

const payload = {
  type:
    "FeatureCollection",
  features: [
    tidal,
    inland,
    {
      ...inland,
      properties: {
        ...inland.properties,
        state:
          "NSW",
        bom_stn_num:
          "NSW001"
      }
    },
    {
      ...inland,
      properties: {
        ...inland.properties,
        bom_stn_num:
          "",
        awrc_stateid:
          ""
      }
    },
    {
      ...inland,
      properties: {
        ...inland.properties,
        bom_stn_num:
          "LINE001"
      },
      geometry: {
        type:
          "LineString",
        coordinates: [
          [152.8, -27.7],
          [152.9, -27.8]
        ]
      }
    }
  ]
};

const filtered =
  filterQueenslandRiverGauges(
    payload
  );

assert.equal(
  filtered.features.length,
  2
);

assert.deepEqual(
  filtered.features
    .map(
      feature =>
        feature.id
    ),
  [
    "bom:040001",
    "awrc:QLD-002"
  ]
);

let requestedUrl = "";

const loaded =
  await loadRiverGaugeLocations({
    fetchImpl:
      async url => {
        requestedUrl =
          String(url);

        return {
          ok:
            true,
          status:
            200,
          async json() {
            return payload;
          }
        };
      }
  });

assert.equal(
  requestedUrl,
  BOM_RIVER_TIDE_GAUGE_QUERY_URL
);

assert.equal(
  loaded.payload
    .features
    .length,
  2
);

assert.equal(
  loaded.transport,
  "Direct first-party ArcGIS GeoJSON"
);

await assert.rejects(
  () =>
    loadRiverGaugeLocations({
      fetchImpl:
        async () => ({
          ok:
            false,
          status:
            503
        })
    }),
  /BoM river-gauge metadata HTTP 503/
);

console.log(
  "River gauge metadata checks passed: first-party BoM GeoJSON, stable IDs, Queensland filtering and explicit tide-gauge classification."
);
