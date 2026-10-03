import assert from "node:assert/strict";

import {
  locateEmbeddedLegend
} from "../src/doppler-palette-recovery-v1.js";

function fakeImageData() {
  const width =
    120;

  const height =
    40;

  const data =
    new Uint8ClampedArray(
      width * height * 4
    );

  function setPixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y * width
        + x
      ) * 4;

    data[i] =
      rgb[0];

    data[i + 1] =
      rgb[1];

    data[i + 2] =
      rgb[2];

    data[i + 3] =
      255;
  }

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      setPixel(
        x,
        y,
        [10,10,10]
      );
    }
  }

  const colours = [
    [0,40,220],
    [0,180,255],
    [255,255,0],
    [255,120,0],
    [255,0,0]
  ];

  let x =
    20;

  for (
    const colour
    of colours
  ) {
    for (
      let i = 0;
      i < 12;
      i++
    ) {
      setPixel(
        x + i,
        32,
        colour
      );
    }

    x +=
      12;
  }

  return {
    width,
    height,
    data
  };
}

const legend =
  locateEmbeddedLegend(
    fakeImageData()
  );

assert.ok(
  legend
);

assert.equal(
  legend.y,
  32
);

assert.equal(
  legend.runs.length,
  5
);

assert.deepEqual(
  legend.runs[0].rgb,
  [0,40,220]
);

assert.deepEqual(
  legend.runs.at(-1).rgb,
  [255,0,0]
);

console.log(
  "5 Doppler palette-recovery tests passed."
);
