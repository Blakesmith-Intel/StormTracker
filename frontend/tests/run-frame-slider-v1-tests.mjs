import assert from "node:assert/strict";

import {
  frameSliderBounds,
  syncFrameSlider
} from "../src/frame-slider-v1.js";

assert.deepEqual(
  frameSliderBounds(6, 5),
  {
    min: 0,
    max: 5,
    step: 1,
    value: 5,
    disabled: false
  }
);

assert.deepEqual(
  frameSliderBounds(34, 20),
  {
    min: 0,
    max: 33,
    step: 1,
    value: 20,
    disabled: false
  }
);

assert.deepEqual(
  frameSliderBounds(34, 99),
  {
    min: 0,
    max: 33,
    step: 1,
    value: 33,
    disabled: false
  }
);

const slider = {
  min: "",
  max: "",
  step: "",
  value: "",
  disabled: true
};

syncFrameSlider(
  slider,
  34,
  6
);

assert.equal(
  slider.min,
  "0"
);
assert.equal(
  slider.max,
  "33"
);
assert.equal(
  slider.step,
  "1"
);
assert.equal(
  slider.value,
  "6"
);
assert.equal(
  slider.disabled,
  false
);

syncFrameSlider(
  slider,
  0,
  4
);

assert.equal(
  slider.max,
  "0"
);
assert.equal(
  slider.value,
  "0"
);
assert.equal(
  slider.disabled,
  true
);

console.log(
  "Frame-slider checks passed: bounds track the complete available frame count rather than the original six-frame default."
);
