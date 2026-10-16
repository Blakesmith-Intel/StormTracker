import assert from "node:assert/strict";

import {
  classifyWheelDelta,
  orbitStateByPixels,
  panTargetByScreenPixels,
  zoomStateByDirection,
  wheelZoomRange
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



assert.deepEqual(
  classifyWheelDelta(
    -100,
    0
  ),
  {
    mode:"discrete",
    steps:-1
  }
);

assert.deepEqual(
  classifyWheelDelta(
    100,
    0
  ),
  {
    mode:"discrete",
    steps:1
  }
);

assert.deepEqual(
  classifyWheelDelta(
    200,
    0
  ),
  {
    mode:"discrete",
    steps:2
  }
);

assert.deepEqual(
  classifyWheelDelta(
    15,
    0
  ),
  {
    mode:"smooth",
    steps:1
  }
);

assert.ok(wheelZoomRange(100000,15)>100000,"smooth trackpad scroll must zoom");
assert.ok(wheelZoomRange(100000,30)>wheelZoomRange(100000,15),"scroll samples must accumulate");
assert.equal(wheelZoomRange(810,-500),800,"large zoom-in pulses obey minimum range");
assert.ok(wheelZoomRange(100000,10000) < 230000,"single-frame zoom pulses are bounded");
console.log("Camera pan, tilt, wheel and bounded continuous zoom tests passed.");
