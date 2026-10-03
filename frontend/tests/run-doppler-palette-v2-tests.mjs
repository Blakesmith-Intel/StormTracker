import assert from "node:assert/strict";

import {
  locateVelocityBar
} from "../src/doppler-palette-recovery-v2.js";

function createFixture() {
  const width = 180;
  const height = 80;

  const data =
    new Uint8ClampedArray(
      width * height * 4
    );

  function pixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y * width
        + x
      ) * 4;

    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
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
      pixel(
        x,
        y,
        [12,12,12]
      );
    }
  }

  // Noise elsewhere in footer.
  for (
    let x = 15;
    x < 28;
    x++
  ) {
    pixel(
      x,
      58,
      [255,120,0]
    );
  }

  const colours = [
    [0,0,180],
    [0,70,220],
    [0,140,255],
    [70,190,255],
    [150,230,255],
    [255,255,0],
    [255,190,0],
    [255,120,0],
    [255,50,0],
    [190,0,0]
  ];

  let x = 35;

  for (
    const colour
    of colours
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      pixel(
        x + n,
        64,
        colour
      );
    }

    x += 10;
  }

  return {
    width,
    height,
    data
  };
}

const bar =
  locateVelocityBar(
    createFixture()
  );

assert.ok(bar);

assert.equal(
  bar.y,
  64
);

assert.equal(
  bar.runs.length,
  10
);

assert.deepEqual(
  bar.runs[0].rgb,
  [0,0,180]
);

assert.deepEqual(
  bar.runs.at(-1).rgb,
  [190,0,0]
);

assert.ok(
  bar.maxX
  > bar.minX
);

console.log(
  "6 Doppler palette V2 tests passed."
);
