import assert from "node:assert/strict";

import {
  BOM_DOPPLER_VELOCITY_SCALE_KMH,
  decodeBureauDopplerPanel,
  locateExactBureauVelocityPalette
} from "../src/bom-doppler-decoder-v1.js";

const scale = [
  -70,
  -60,
  -50,
  -40,
  -30,
  -20,
  -15,
  -10,
  -5,
  0,
  5,
  10,
  15,
  20,
  30,
  40,
  50,
  60,
  70
];

assert.deepEqual(
  BOM_DOPPLER_VELOCITY_SCALE_KMH,
  scale
);

function fixture() {
  const width =
    140;

  const height =
    170;

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
    const index =
      (
        y
        * width
        + x
      )
      * 4;

    data[index] =
      rgb[0];

    data[index + 1] =
      rgb[1];

    data[index + 2] =
      rgb[2];

    data[index + 3] =
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
        [12,12,12]
      );
    }
  }

  const colours = [
    [0,0,90],
    [0,0,120],
    [0,20,150],
    [0,50,180],
    [0,80,200],
    [0,110,220],
    [20,140,230],
    [60,170,240],
    [110,205,245],
    [245,245,245],
    [245,235,0],
    [250,210,0],
    [250,180,0],
    [250,145,0],
    [245,110,0],
    [240,75,0],
    [230,45,0],
    [215,20,0],
    [190,0,0]
  ];

  const footerStart =
    width;

  const barY =
    footerStart + 12;

  let x =
    6;

  for (
    const colour
    of colours
  ) {
    for (
      let n = 0;
      n < 6;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        colour
      );
    }

    x +=
      7;
  }

  // Add map-area pixels that exactly use real palette colours.
  // The palette detector must ignore them because they are not in the footer.
  setPixel(
    10,
    10,
    colours[0]
  );

  setPixel(
    20,
    20,
    colours.at(-1)
  );

  // Add known Doppler pixels inside the square radar panel.
  setPixel(
    30,
    30,
    colours[0]
  );

  setPixel(
    31,
    30,
    colours[9]
  );

  setPixel(
    32,
    30,
    colours.at(-1)
  );

  return {
    imageData: {
      width,
      height,
      data
    },

    colours,

    barY
  };
}

const {
  imageData,
  colours,
  barY
} =
  fixture();

const palette =
  locateExactBureauVelocityPalette(
    imageData
  );

assert.equal(
  palette.y,
  barY
);

assert.equal(
  palette.swatches.length,
  19
);

assert.equal(
  palette.swatches[0].velocity_kmh,
  -70
);

assert.equal(
  palette.swatches[9].velocity_kmh,
  0
);

assert.equal(
  palette.swatches[18].velocity_kmh,
  70
);

assert.deepEqual(
  palette.swatches[0].rgb,
  colours[0]
);

assert.deepEqual(
  palette.swatches[18].rgb,
  colours[18]
);

const decoded =
  decodeBureauDopplerPanel(
    imageData,
    palette
  );

assert.equal(
  decoded.panelSize,
  imageData.width
);

assert.ok(
  decoded.validPixelCount
  >= 5
);

assert.equal(
  decoded.minimumVelocityKmh,
  -70
);

assert.equal(
  decoded.maximumVelocityKmh,
  70
);

assert.equal(
  decoded.radialVelocitySpanKmh,
  140
);

console.log(
  "12 Doppler decoder V1 tests passed."
);
