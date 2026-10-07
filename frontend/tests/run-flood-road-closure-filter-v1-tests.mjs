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
  description = ""
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
});

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
  "Flood road-closure checks passed: only published TMR flood-classified closures survive; restrictions, rain-only events and free-text false positives are rejected."
);
