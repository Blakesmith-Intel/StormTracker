import assert from "node:assert/strict";

import {
  IDLE_GLOBE_SSE,
  INTERACTION_GLOBE_SSE,
  createCameraPerformanceGovernor
} from "../src/camera-performance-v1.js";

const globe = {
  maximumScreenSpaceError:
    IDLE_GLOBE_SSE
};

let callback = null;
let renders = 0;
let cancelled = 0;

const governor =
  createCameraPerformanceGovernor({
    globe,

    scene: {
      requestRender() {
        renders++;
      }
    },

    schedule(
      cb,
      delay
    ) {
      callback = cb;
      assert.equal(
        delay,
        160
      );
      return 1;
    },

    cancel() {
      cancelled++;
    }
  });

governor.pulse();

assert.equal(
  globe.maximumScreenSpaceError,
  INTERACTION_GLOBE_SSE
);

assert.equal(
  governor.active,
  true
);

governor.pulse();

assert.equal(
  cancelled,
  1
);

callback();

assert.equal(
  globe.maximumScreenSpaceError,
  IDLE_GLOBE_SSE
);

assert.equal(
  governor.active,
  false
);

governor.pulse();
governor.restore();

assert.equal(
  globe.maximumScreenSpaceError,
  IDLE_GLOBE_SSE
);

assert.equal(
  governor.active,
  false
);

assert.ok(
  renders >= 4
);

// A coarse-pointer (phone/tablet) retains reduced tile detail for the
// duration of bursty gestures; desktop retains the original governor.
let mobileRestore=null;
const mobileGlobe={maximumScreenSpaceError:4};
const mobileGovernor=createCameraPerformanceGovernor({
  globe:mobileGlobe,interactionScreenSpaceError:12,settleMs:380,
  schedule(cb,ms){assert.equal(ms,380);mobileRestore=cb;return 7;},
  cancel(){}
});
mobileGovernor.pulse();
mobileGovernor.pulse();
assert.equal(mobileGlobe.maximumScreenSpaceError,12);
mobileRestore();
assert.equal(mobileGlobe.maximumScreenSpaceError,4);
assert.equal(mobileGovernor.active,false);
console.log(
  "Camera-performance checks passed: desktop and mobile camera-quality governors restore idle detail."
);
