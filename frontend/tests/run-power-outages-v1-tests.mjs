import assert from "node:assert/strict";

import {
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  ERGON_OUTAGE_AREA_QUERY_URL,
  filterCurrentPowerOutages,
  isCurrentPowerOutage,
  loadPowerOutages,
  powerOutageSummary
} from "../src/context-layers/power-outages-v1.js";

const now =
  Date.parse(
    "2026-10-08T05:00:00+10:00"
  );

function polygon() {
  return {
    type:
      "Polygon",
    coordinates: [[
      [153.20, -27.80],
      [153.21, -27.80],
      [153.21, -27.81],
      [153.20, -27.80]
    ]]
  };
}

function outage({
  eventId,
  type = "UNPLANNED",
  status = "In Progress",
  customers = 125,
  suburbs = "ORMEAU",
  start = now - 30 * 60 * 1000,
  finish = null,
  provider
}) {
  return {
    type:
      "Feature",

    properties: {
      EVENT_ID:
        eventId,

      TYPE:
        type,

      STATUS:
        status,

      CUSTOMERS_AFFECTED:
        customers,

      SUBURBS:
        suburbs,

      STREETS:
        "Example Rd",

      START:
        start,

      FINISH:
        finish,

      EST_FIX_TIME:
        now + 45 * 60 * 1000,

      REASON:
        "Emergency Repairs",

      EXTRACTED:
        now - 2 * 60 * 1000,

      ...(
        provider
          ? {
              STORMTRACKER_PROVIDER:
                provider
            }
          : {}
      )
    },

    geometry:
      polygon()
  };
}

const active =
  outage({
    eventId:
      "INC-100"
  });

const future =
  outage({
    eventId:
      "PLAN-200",
    type:
      "PLANNED",
    status:
      "Scheduled",
    start:
      now + 60 * 60 * 1000
  });

const finished =
  outage({
    eventId:
      "INC-300",
    finish:
      now - 60 * 1000
  });

const cancelled =
  outage({
    eventId:
      "PLAN-400",
    status:
      "Cancelled"
  });

assert.equal(
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  15 * 60 * 1000
);

assert.match(
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  /VwEnergexOutages\/FeatureServer\/0\/query/
);

assert.match(
  ERGON_OUTAGE_AREA_QUERY_URL,
  /VwErgonOutages\/FeatureServer\/0\/query/
);

for (
  const url
  of [
    ENERGEX_OUTAGE_AREA_QUERY_URL,
    ERGON_OUTAGE_AREA_QUERY_URL
  ]
) {
  assert.match(
    url,
    /outSR=4326/
  );

  assert.match(
    url,
    /f=geojson/
  );
}

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

const energexSummary =
  powerOutageSummary({
    ...active,
    id:
      "energex:INC-100",

    properties: {
      ...active.properties,
      STORMTRACKER_PROVIDER:
        "Energex"
    }
  });

assert.deepEqual(
  energexSummary,
  {
    id:
      "energex:INC-100",

    eventId:
      "INC-100",

    provider:
      "Energex",

    attribution:
      "Energex | Energy Queensland",

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

const ergonSummary =
  powerOutageSummary({
    ...active,
    id:
      "ergon:INC-100",

    properties: {
      ...active.properties,
      STORMTRACKER_PROVIDER:
        "Ergon"
    }
  });

assert.equal(
  ergonSummary.provider,
  "Ergon"
);

assert.equal(
  ergonSummary.attribution,
  "Ergon Energy | Energy Queensland"
);

assert.equal(
  ergonSummary.id,
  "ergon:INC-100"
);

const energexPayload = {
  type:
    "FeatureCollection",

  features: [
    outage({
      eventId:
        "SAME-ID",
      customers:
        10,
      suburbs:
        "BRISBANE"
    })
  ]
};

const ergonPayload = {
  type:
    "FeatureCollection",

  features: [
    outage({
      eventId:
        "SAME-ID",
      customers:
        20,
      suburbs:
        "TOOWOOMBA"
    })
  ]
};

function okResponse(
  payload
) {
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

const merged =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        if (
          String(url)
            .includes(
              "VwErgonOutages"
            )
        ) {
          return okResponse(
            ergonPayload
          );
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  merged.providers,
  [
    "Energex",
    "Ergon"
  ]
);

assert.equal(
  merged.partial,
  false
);

assert.equal(
  merged.payload
    .features
    .length,
  2
);

assert.deepEqual(
  merged.payload
    .features
    .map(
      feature =>
        feature.id
    )
    .sort(),
  [
    "energex:SAME-ID",
    "ergon:SAME-ID"
  ]
);

assert.deepEqual(
  merged.payload
    .features
    .map(
      powerOutageSummary
    )
    .map(
      summary =>
        summary.provider
    )
    .sort(),
  [
    "Energex",
    "Ergon"
  ]
);

const partial =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        if (
          String(url)
            .includes(
              "VwErgonOutages"
            )
        ) {
          return {
            ok:
              false,
            status:
              503
          };
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  partial.providers,
  [
    "Energex"
  ]
);

assert.equal(
  partial.partial,
  true
);

assert.equal(
  partial.failedProviders
    .length,
  1
);

assert.equal(
  partial.failedProviders[0]
    .provider,
  "Ergon"
);

assert.equal(
  partial.payload
    .features
    .length,
  1
);

await assert.rejects(
  () =>
    loadPowerOutages({
      nowMs:
        now,

      fetchImpl:
        async () => ({
          ok:
            false,
          status:
            503
        })
    }),
  /Energex outage feed HTTP 503.*Ergon outage feed HTTP 503/
);

console.log(
  "Power outage checks passed: Energex + Ergon first-party GeoJSON, provider-qualified IDs, current filtering, partial-feed survival and 15-minute refresh cadence."
);
