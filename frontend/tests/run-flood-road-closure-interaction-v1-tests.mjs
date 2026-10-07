import assert from "node:assert/strict";

import {
  floodRoadClosureEntityFromPick,
  floodRoadClosureIdFromPick
} from "../src/context-layers/flood-road-closures-operational-v1.js?v=9.10.3";

const directEntity = {
  stormTrackerFloodClosureId:
    "direct-123"
};

const primitiveEntity = {
  stormTrackerFloodClosureId:
    "primitive-456"
};

assert.equal(
  floodRoadClosureEntityFromPick({
    id:
      directEntity
  }),
  directEntity,
  "Direct Cesium pick.id should resolve to the picked closure entity."
);

assert.equal(
  floodRoadClosureEntityFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  primitiveEntity,
  "Ground/primitive Cesium picks must resolve through picked.primitive.id."
);

assert.equal(
  floodRoadClosureIdFromPick({
    id:
      directEntity
  }),
  "direct-123"
);

assert.equal(
  floodRoadClosureIdFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  "primitive-456"
);

assert.equal(
  floodRoadClosureIdFromPick({
    id: {
      someOtherEntity:
        true
    }
  }),
  ""
);

assert.equal(
  floodRoadClosureIdFromPick(
    null
  ),
  ""
);

console.log(
  "Flood road-closure interaction checks passed: direct entity picks and primitive-backed Cesium picks resolve to closure IDs."
);
