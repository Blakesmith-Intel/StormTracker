import assert from "node:assert/strict";

import {
  interpolateRadarFrame,
  isTemporallyInferredRadarFrame
} from "../src/radar-temporal-interpolation-v1.js";

const base = {
  radarId: "BOM-MOSAIC",
  sourceId: "BOM-MOSAIC",
  width: 2,
  height: 2,
  georef: {
    projection: "EPSG:3857",
    minX: 1,
    maxX: 2,
    minY: 3,
    maxY: 4
  },
  sourceMetadata: {
    provider: "Australian Bureau of Meteorology"
  }
};

const before = {
  ...base,
  observedUtc: "2026-10-07T10:00:00Z",
  categories: Uint8Array.from([0, 4, 8, 12])
};

const after = {
  ...base,
  observedUtc: "2026-10-07T10:10:00Z",
  categories: Uint8Array.from([0, 8, 12, 4])
};

const midpoint = interpolateRadarFrame(
  before,
  after,
  "2026-10-07T10:05:00Z",
  0.5
);

assert.deepEqual(
  [...midpoint.categories],
  [0, 6, 10, 8]
);
assert.equal(
  midpoint.sourceMetadata.temporalInference.beforeUtc,
  before.observedUtc
);
assert.equal(
  midpoint.sourceMetadata.temporalInference.afterUtc,
  after.observedUtc
);
assert.equal(
  midpoint.sourceMetadata.volumeStatus,
  "inferred-temporal-display-only"
);
assert.equal(isTemporallyInferredRadarFrame(midpoint), true);
assert.equal(isTemporallyInferredRadarFrame(before), false);

assert.throws(
  () => interpolateRadarFrame(
    before,
    {
      ...after,
      width: 3
    },
    "2026-10-07T10:05:00Z",
    0.5
  ),
  /not spatially compatible/
);

assert.throws(
  () => interpolateRadarFrame(
    before,
    after,
    "2026-10-07T10:20:00Z",
    2
  ),
  /strictly between/
);

console.log(
  "Temporal radar interpolation checks passed: bounded display-only blending, metadata labelling and spatial/time guards."
);
