import assert from "node:assert/strict";

import {
  filterFloodRoadClosures,
  isActiveFloodRoadClosure,
  isFloodRelatedRoadEvent,
  isRoadClosureEvent
} from "../src/context-layers/flood-road-closure-filter-v1.js";

function event({
  id,
  status = "Published",
  event_type = "Flooding",
  event_subtype = "",
  event_due_to = "",
  impact_type = "Closures",
  description = "",
  duration = null
}) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [153, -27]
    },
    properties: {
      id,
      status,
      event_type,
      event_subtype,
      event_due_to,
      description,
      ...(duration ? { duration } : {}),
      impact: {
        impact_type
      },
      road_summary: {
        road_name: "Test Road"
      }
    }
  };
}

const floodClosure = event({
  id: "flood-closure"
});

assert.equal(
  isFloodRelatedRoadEvent(floodClosure),
  true
);
assert.equal(
  isRoadClosureEvent(floodClosure),
  true
);
assert.equal(
  isActiveFloodRoadClosure(floodClosure),
  true
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "flood-restriction",
      impact_type: "Restrictions"
    })
  ),
  false,
  "Flood restrictions must not be displayed as closures."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "rain-closure",
      event_type: "Hazard",
      event_due_to: "Heavy rain",
      impact_type: "Closures"
    })
  ),
  false,
  "Heavy rain alone is not a flood classification."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "water-over-road",
      event_type: "Hazard",
      event_due_to: "Water over road",
      impact_type: "Closures"
    })
  ),
  true,
  "TMR water-over-road cause is explicitly flood related."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "description-only",
      event_type: "Crash",
      event_due_to: "Other",
      impact_type: "Closures",
      description: "Flooding mentioned only in free text."
    })
  ),
  false,
  "Free-text keyword matches must never promote an unrelated event."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "not-published",
      status: "Draft"
    })
  ),
  false
);

const fixedNow =
  Date.parse("2026-10-08T00:00:00+10:00");

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "future-flood-closure",
      duration: {
        start: "2026-10-09T00:00:00+10:00"
      }
    }),
    fixedNow
  ),
  false,
  "Published future flood closures must not be shown yet."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "expired-flood-closure",
      duration: {
        end: "2026-10-07T23:00:00+10:00"
      }
    }),
    fixedNow
  ),
  false,
  "Published expired flood closures must not remain on the map."
);

assert.equal(
  isActiveFloodRoadClosure(
    event({
      id: "current-naive-qld-time",
      duration: {
        start: "2026-10-07T23:30:00",
        end: "2026-10-08T00:30:00"
      }
    }),
    fixedNow
  ),
  true,
  "Timezone-less QLDTraffic times must be interpreted as Queensland local time."
);

const filtered = filterFloodRoadClosures({
  type: "FeatureCollection",
  features: [
    floodClosure,
    event({
      id: "flood-restriction",
      impact_type: "Restrictions"
    }),
    event({
      id: "water-over-road",
      event_type: "Hazard",
      event_due_to: "Water over road"
    }),
    event({
      id: "crash",
      event_type: "Crash",
      event_due_to: "Other"
    })
  ]
}, fixedNow);

assert.deepEqual(
  filtered.features.map(
    feature => feature.properties.id
  ),
  [
    "flood-closure",
    "water-over-road"
  ]
);

console.log(
  "Flood road-closure checks passed: only current, published TMR flood-classified closures survive; future, expired, restricted, rain-only and free-text false positives are rejected."
);
