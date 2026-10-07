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

console.log(
  "Camera-performance checks passed: interaction quality relaxes temporarily and restores automatically."
);
