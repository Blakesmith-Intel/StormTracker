import assert from "node:assert/strict";

import {
  powerOutageEntityFromPick,
  powerOutageIdFromPick
} from "../src/context-layers/power-outages-operational-v1.js?v=9.11.0-dev2";

const directEntity = {
  stormTrackerPowerOutageId:
    "energex:direct-123"
};

const primitiveEntity = {
  stormTrackerPowerOutageId:
    "ergon:primitive-456"
};

assert.equal(
  powerOutageEntityFromPick({
    id:
      directEntity
  }),
  directEntity,
  "Direct Cesium pick.id should resolve to the picked outage entity."
);

assert.equal(
  powerOutageEntityFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  primitiveEntity,
  "Ground/polygon primitive picks must resolve through picked.primitive.id."
);

assert.equal(
  powerOutageIdFromPick({
    id:
      directEntity
  }),
  "energex:direct-123"
);

assert.equal(
  powerOutageIdFromPick({
    primitive: {
      id:
        primitiveEntity
    }
  }),
  "ergon:primitive-456"
);

assert.equal(
  powerOutageIdFromPick({
    id: {
      someOtherEntity:
        true
    }
  }),
  ""
);

assert.equal(
  powerOutageIdFromPick(
    null
  ),
  ""
);

console.log(
  "Power outage interaction checks passed: direct entity and primitive-backed polygon picks resolve to provider-qualified outage IDs."
);
