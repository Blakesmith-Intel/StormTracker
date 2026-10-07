import assert from "node:assert/strict";

import {
  DEFAULT_POWER_OUTAGE_REFRESH_MS,
  ENERGEX_OUTAGE_AREA_QUERY_URL,
  ERGON_OUTAGE_AREA_QUERY_URL,
  DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,
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

assert.match(
  DEFAULT_ESSENTIAL_ENERGY_RELAY_URL,
  /essential-energy-outages$/
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
  2
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


const essentialKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark>
    <name>Lismore</name>
    <styleUrl>#unplanned-outage</styleUrl>
    <description><![CDATA[
      <span>Time Off:</span>08/10/2026 04:30:00
      <span>Est. Time On:</span>08/10/2026 07:30:00
      <span>No. of Customers affected:</span>30
      <span>Reason:</span>We are investigating
      <span>Last Updated:</span>08/10/2026 04:45:00
      <span>Incident ID:</span>INCD-ESS-1
    ]]></description>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>
        153.20,-28.80,0 153.21,-28.80,0 153.21,-28.81,0 153.20,-28.80,0
      </coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>
</Document>
</kml>`;

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
    },

    async text() {
      return String(
        payload
      );
    }
  };
}

function textResponse(
  text
) {
  return {
    ok:
      true,

    status:
      200,

    async text() {
      return text;
    }
  };
}

const merged =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
            "VwErgonOutages"
          )
        ) {
          return okResponse(
            ergonPayload
          );
        }

        if (
          target.includes(
            "essential-energy-outages"
          )
        ) {
          return textResponse(
            essentialKml
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
    "Ergon",
    "Essential Energy"
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
  3
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
    "ergon:SAME-ID",
    "essential:INCD-ESS-1"
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
    "Ergon",
    "Essential Energy"
  ]
);

const partial =
  await loadPowerOutages({
    nowMs:
      now,

    fetchImpl:
      async url => {
        const target =
          String(url);

        if (
          target.includes(
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

        if (
          target.includes(
            "essential-energy-outages"
          )
        ) {
          return textResponse(
            essentialKml
          );
        }

        return okResponse(
          energexPayload
        );
      }
  });

assert.deepEqual(
  partial.providers,
  [
    "Energex",
    "Essential Energy"
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
  /Energex outage feed HTTP 503.*Ergon outage feed HTTP 503.*Essential Energy outage feed HTTP 503/
);

console.log(
  "Power outage checks passed: Energex + Ergon GeoJSON plus Essential Energy KML, provider-qualified IDs, current filtering, partial-feed survival and 15-minute refresh cadence."
);
