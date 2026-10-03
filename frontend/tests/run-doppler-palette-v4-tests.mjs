import assert from "node:assert/strict";

import {
  locateFullVelocityPalette
} from "../src/doppler-palette-full-v4.js";

function fixture() {
  const width =
    120;

  const height =
    150;

  const data =
    new Uint8ClampedArray(
      width
      * height
      * 4
    );

  function setPixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y
        * width
        + x
      )
      * 4;

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
        [8,8,8]
      );
    }
  }

  const barY =
    132;

  const towards = [
    [0,0,120],
    [0,0,180],
    [0,60,220],
    [0,130,250]
  ];

  const away = [
    [255,245,0],
    [255,170,0],
    [255,90,0],
    [210,0,0]
  ];

  let x =
    8;

  for (
    const rgb
    of towards
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        rgb
      );
    }

    x +=
      10;
  }

  for (
    let n = 0;
    n < 8;
    n++
  ) {
    setPixel(
      x + n,
      barY,
      [240,240,240]
    );
  }

  x +=
    10;

  for (
    const rgb
    of away
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        rgb
      );
    }

    x +=
      10;
  }

  return {
    width,
    height,
    data
  };
}

const result =
  locateFullVelocityPalette(
    fixture()
  );

assert.ok(
  result
);

assert.equal(
  result.y,
  132
);

assert.equal(
  result.towards.length,
  4
);

assert.equal(
  result.away.length,
  4
);

assert.ok(
  result.neutral.length
  >= 1
);

assert.deepEqual(
  result.towards[0].rgb,
  [0,0,120]
);

assert.deepEqual(
  result.away.at(-1).rgb,
  [210,0,0]
);

console.log(
  "7 Doppler full-palette V4 tests passed."
);
