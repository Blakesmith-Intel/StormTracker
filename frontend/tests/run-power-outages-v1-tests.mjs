import assert from "node:assert/strict";

import {
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  filterCurrentPowerOutages,
  isCurrentPowerOutage,
  powerOutageSummary
} from "../src/context-layers/power-outages-v1.js";

const now =
  Date.parse(
    "2026-10-08T05:00:00+10:00"
  );

const active = {
  type:
    "Feature",
  properties: {
    EVENT_ID:
      "INC-100",
    TYPE:
      "UNPLANNED",
    STATUS:
      "In Progress",
    CUSTOMERS_AFFECTED:
      125,
    SUBURBS:
      "ORMEAU",
    STREETS:
      "Example Rd",
    START:
      now - 30 * 60 * 1000,
    FINISH:
      null,
    EST_FIX_TIME:
      now + 45 * 60 * 1000,
    REASON:
      "Emergency Repairs",
    EXTRACTED:
      now - 2 * 60 * 1000
  },
  geometry: {
    type:
      "Polygon",
    coordinates: [[
      [153.20, -27.80],
      [153.21, -27.80],
      [153.21, -27.81],
      [153.20, -27.80]
    ]]
  }
};

const future = {
  ...active,
  properties: {
    ...active.properties,
    EVENT_ID:
      "PLAN-200",
    TYPE:
      "PLANNED",
    STATUS:
      "Scheduled",
    START:
      now + 60 * 60 * 1000
  }
};

const finished = {
  ...active,
  properties: {
    ...active.properties,
    EVENT_ID:
      "INC-300",
    FINISH:
      now - 60 * 1000
  }
};

const cancelled = {
  ...active,
  properties: {
    ...active.properties,
    EVENT_ID:
      "PLAN-400",
    STATUS:
      "Cancelled"
  }
};

assert.equal(
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  15 * 60 * 1000
);

assert.match(
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  /VwEnergexOutages\/FeatureServer\/0\/query/
);

assert.match(
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  /outSR=4326/
);

assert.match(
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  /f=geojson/
);

assert.equal(
  isCurrentPowerOutage(
    active,
    now
  ),
  true
);

assert.equal(
  isCurrentPowerOutage(
    future,
    now
  ),
  false
);

assert.equal(
  isCurrentPowerOutage(
    finished,
    now
  ),
  false
);

assert.equal(
  isCurrentPowerOutage(
    cancelled,
    now
  ),
  false
);

const filtered =
  filterCurrentPowerOutages(
    {
      type:
        "FeatureCollection",
      features: [
        active,
        future,
        finished,
        cancelled,
        {
          type:
            "Feature",
          properties: {
            EVENT_ID:
              "NO-GEOMETRY"
          },
          geometry:
            null
        }
      ]
    },
    now
  );

assert.equal(
  filtered.features.length,
  1
);

assert.equal(
  filtered.features[0].id,
  "INC-100"
);

assert.deepEqual(
  powerOutageSummary(
    active
  ),
  {
    id:
      "INC-100",
    provider:
      "Energex",
    type:
      "UNPLANNED",
    status:
      "In Progress",
    customersAffected:
      125,
    suburbs:
      "ORMEAU",
    streets:
      "Example Rd",
    start:
      now - 30 * 60 * 1000,
    finish:
      "",
    estimatedFix:
      now + 45 * 60 * 1000,
    reason:
      "Emergency Repairs",
    extracted:
      now - 2 * 60 * 1000
  }
);

assert.equal(
  powerOutageSummary({
    properties: {
      TYPE:
        "planned",
      CUSTOMERS_AFFECTED:
        "42"
    }
  }).type,
  "PLANNED"
);

console.log(
  "Power outage checks passed: Energex GeoJSON contract, active filtering, planned/unplanned classification and 15-minute refresh cadence."
);
