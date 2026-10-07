import assert from "node:assert/strict";

import {
  DEFAULT_DOPPLER_CROSSFADE_MS,
  dopplerOverlayFrameKey,
  transitionProgress,
  createDopplerLayerTransition
} from "../src/doppler-layer-transition-v1.js";

assert.equal(
  dopplerOverlayFrameKey(
    "66",
    {
      filename:
        "IDR663.T.202610080000.png"
    }
  ),
  "66:IDR663.T.202610080000.png"
);

assert.equal(
  dopplerOverlayFrameKey(
    "66",
    {
      observedUtc:
        "2026-10-08T00:00:00Z"
    }
  ),
  "66:2026-10-08T00:00:00Z"
);

assert.equal(
  transitionProgress(
    90,
    180
  ),
  0.5
);

assert.equal(
  transitionProgress(
    999,
    180
  ),
  1
);

const layers = [];
const removed = [];
let renderCount = 0;
let clock = 0;
let nextHandle = 1;
const callbacks = new Map();

const imageryLayers = {
  add(layer) {
    layers.push(
      layer
    );

    return layer;
  },

  remove(
    layer,
    destroy
  ) {
    const index =
      layers.indexOf(
        layer
      );

    if (index >= 0) {
      layers.splice(
        index,
        1
      );
    }

    removed.push({
      layer,
      destroy
    });

    return true;
  }
};

function requestFrame(
  callback
) {
  const handle =
    nextHandle++;

  callbacks.set(
    handle,
    callback
  );

  return handle;
}

function cancelFrame(
  handle
) {
  callbacks.delete(
    handle
  );
}

function advance(
  milliseconds
) {
  clock +=
    milliseconds;

  const scheduled =
    [...callbacks.entries()];

  callbacks.clear();

  for (
    const [
      ,
      callback
    ]
    of scheduled
  ) {
    callback(
      clock
    );
  }
}

const transition =
  createDopplerLayerTransition({
    imageryLayers,

    requestRender() {
      renderCount++;
    },

    requestFrame,
    cancelFrame,

    now() {
      return clock;
    }
  });

const first = {
  alpha:
    1,
  id:
    "first"
};

transition.replace({
  layer:
    first,
  key:
    "66:first",
  alpha:
    0.45
});

assert.equal(
  layers.length,
  1
);

assert.equal(
  first.alpha,
  0.45
);

const same = {
  alpha:
    0,
  id:
    "unused"
};

const unchanged =
  transition.replace({
    layer:
      same,
    key:
      "66:first",
    alpha:
      0.5
  });

assert.equal(
  unchanged.changed,
  false
);

assert.equal(
  layers.length,
  1
);

assert.equal(
  first.alpha,
  0.5
);

const second = {
  alpha:
    1,
  id:
    "second"
};

transition.replace({
  layer:
    second,
  key:
    "66:second",
  alpha:
    0.5,
  durationMs:
    DEFAULT_DOPPLER_CROSSFADE_MS
});

assert.equal(
  layers.length,
  2
);

assert.equal(
  second.alpha,
  0
);

advance(
  90
);

assert.ok(
  second.alpha > 0.24
  && second.alpha < 0.26
);

assert.ok(
  first.alpha > 0.24
  && first.alpha < 0.26
);

advance(
  90
);

assert.equal(
  layers.length,
  1
);

assert.equal(
  layers[0],
  second
);

assert.equal(
  second.alpha,
  0.5
);

transition.clear({
  durationMs:
    120
});

assert.equal(
  layers.length,
  1
);

advance(
  60
);

assert.ok(
  second.alpha > 0.24
  && second.alpha < 0.26
);

advance(
  60
);

assert.equal(
  layers.length,
  0
);

assert.ok(
  removed.length >= 2
);

assert.ok(
  renderCount >= 4
);

console.log(
  "Doppler layer transition checks passed: same-frame reuse, double-buffer crossfade and smooth fade-out without blanking between matched frames."
);
