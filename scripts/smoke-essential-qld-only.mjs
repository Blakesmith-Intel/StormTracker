import assert from "node:assert/strict";

import {
  parseEssentialEnergyKml
} from "../frontend/src/context-layers/essential-energy-kml-v1.js";

import {
  QUEENSLAND_MAINLAND_QUERY_URL,
  filterFeaturesToQueensland,
  pointInGeoJsonBoundary,
  representativePointForFeature
} from "../frontend/src/context-layers/queensland-mainland-filter-v1.js";

const ESSENTIAL_RELAY =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/essential-energy-outages";

async function fetchJson(
  url
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/geo+json,application/json"
        }
      }
    );

  assert.equal(
    response.ok,
    true,
    `${url} returned HTTP ${response.status}`
  );

  return response.json();
}

async function fetchText(
  url
) {
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/vnd.google-earth.kml+xml,application/xml,text/xml,text/plain"
        }
      }
    );

  assert.equal(
    response.ok,
    true,
    `${url} returned HTTP ${response.status}`
  );

  return response.text();
}

const boundary =
  await fetchJson(
    QUEENSLAND_MAINLAND_QUERY_URL
  );

assert.ok(
  Array.isArray(
    boundary.features
  )
  && boundary.features.length > 0,
  "Queensland mainland service returned no polygon features."
);

assert.equal(
  pointInGeoJsonBoundary(
    [
      150.307,
      -28.547
    ],
    boundary
  ),
  true,
  "Goondiwindi must be inside the live Queensland mainland polygon."
);

assert.equal(
  pointInGeoJsonBoundary(
    [
      153.28,
      -28.81
    ],
    boundary
  ),
  false,
  "Lismore must be outside the live Queensland mainland polygon."
);

const kml =
  await fetchText(
    ESSENTIAL_RELAY
  );

assert.match(
  kml,
  /<kml\b/i,
  "Essential Energy relay did not return KML."
);

const parsed =
  parseEssentialEnergyKml(
    kml
  );

const qldOnly =
  filterFeaturesToQueensland(
    parsed,
    boundary
  );

for (
  const feature
  of qldOnly.features
) {
  const point =
    representativePointForFeature(
      feature
    );

  assert.ok(
    point,
    `Retained Essential incident ${feature.id} has no representative point.`
  );

  assert.equal(
    pointInGeoJsonBoundary(
      point,
      boundary
    ),
    true,
    `Retained Essential incident ${feature.id} falls outside Queensland.`
  );
}

console.log(
  `Essential Queensland-only live smoke passed: ${parsed.features.length} current KML placemark(s) parsed, ${qldOnly.features.length} Queensland incident(s) retained. Goondiwindi=in, Lismore=out.`
);
