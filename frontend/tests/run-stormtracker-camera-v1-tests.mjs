import assert from "node:assert/strict";

import {
  orbitStateByPixels,
  panTargetByScreenPixels,
  zoomStateByDirection
} from "../src/stormtracker-camera-v1.js";

const base = {
  longitude:153,
  latitude:-27,
  range:400000,
  heading:0,
  pitch:-1.2,
  targetHeight:0
};

const panRight =
  panTargetByScreenPixels(
    base,
    100,
    0,
    100
  );

assert.ok(
  panRight.longitude < base.longitude
);

const panDown =
  panTargetByScreenPixels(
    base,
    0,
    100,
    100
  );

assert.ok(
  panDown.latitude > base.latitude
);

const orbit =
  orbitStateByPixels(
    base,
    100,
    20
  );

assert.ok(
  orbit.heading > base.heading
);

assert.ok(
  orbit.pitch > base.pitch
);

const zoomIn =
  zoomStateByDirection(
    base,
    -1
  );

assert.ok(
  zoomIn.range < base.range
);

const zoomOut =
  zoomStateByDirection(
    base,
    1
  );

assert.ok(
  zoomOut.range > base.range
);

const clamped =
  zoomStateByDirection(
    {
      ...base,
      range:810
    },
    -1,
    {
      minimumRange:800
    }
  );

assert.equal(
  clamped.range,
  800
);

console.log(
  "7 shared camera controller tests passed."
);
