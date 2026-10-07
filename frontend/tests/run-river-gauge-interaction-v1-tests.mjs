import assert from "node:assert/strict";

import {
  riverGaugeEntityFromPick,
  riverGaugeIdFromPick
} from "../src/context-layers/river-gauges-operational-v1.js?v=9.12.0-dev1";

const directEntity = {
  stormTrackerRiverGaugeId:
    "bom:040123"
};

const primitiveEntity = {
  stormTrackerRiverGaugeId:
    "awrc:QLD-456"
};

assert.equal(
  riverGaugeEntityFromPick({
    id:
      directEntity
  }),
  directEntity
);

assert.equal(
  riverGaugeEntityFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  primitiveEntity
);

assert.equal(
  riverGaugeIdFromPick({
    id:
      directEntity
  }),
  "bom:040123"
);

assert.equal(
  riverGaugeIdFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  "awrc:QLD-456"
);

assert.equal(
  riverGaugeIdFromPick({
    id: {
      unrelated:
        true
    }
  }),
  ""
);

assert.equal(
  riverGaugeIdFromPick(
    null
  ),
  ""
);

console.log(
  "River gauge interaction checks passed: direct and primitive-backed Cesium picks resolve to stable gauge IDs."
);
