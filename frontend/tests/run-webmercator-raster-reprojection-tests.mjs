import assert from "node:assert/strict";

import {
  geographicOutputRowToSourceRow,
  reprojectWebMercatorRgbaToGeographic,
  sourceRowToGeographicOutputRow
} from "../src/webmercator-raster-reproject-v1.js";

const actualSeqFrame = {
  width: 768,
  height: 1024,

  georef: {
    projection: "EPSG:3857",
    minX: 16750872.119625352,
    maxX: 17220501.221409474,
    minY: -3401337.457151696,
    maxY: -2775165.3214395326
  }
};

const sourceRow = 713;

const correctedOutputRow =
  sourceRowToGeographicOutputRow(
    actualSeqFrame,
    sourceRow
  );

// At the Logan/Brisbane portion of this exact mosaic the old display method
// is wrong by roughly five source rows.
assert.ok(
  correctedOutputRow
  - sourceRow
  > 4
);

assert.ok(
  correctedOutputRow
  - sourceRow
  < 6
);

const roundTrip =
  geographicOutputRowToSourceRow(
    actualSeqFrame,
    correctedOutputRow
  );

assert.ok(
  Math.abs(
    roundTrip
    - sourceRow
  )
  < 1e-8
);

for (
  const row
  of [0,128,256,512,768,1023]
) {
  const outputRow =
    sourceRowToGeographicOutputRow(
      actualSeqFrame,
      row
    );

  const restored =
    geographicOutputRowToSourceRow(
      actualSeqFrame,
      outputRow
    );

  assert.ok(
    Math.abs(
      restored
      - row
    )
    < 1e-8
  );
}

const tiny = {
  width: 2,
  height: 4,

  georef: {
    projection: "EPSG:3857",
    minX: 0,
    maxX: 2000,
    minY: -4000000,
    maxY: -3000000
  }
};

const rgba =
  new Uint8ClampedArray(
    tiny.width
    * tiny.height
    * 4
  );

for (
  let row = 0;
  row < tiny.height;
  row++
) {
  for (
    let column = 0;
    column < tiny.width;
    column++
  ) {
    const i =
      (
        row
        * tiny.width
        + column
      )
      * 4;

    rgba[i] =
      row * 50;

    rgba[i + 3] =
      255;
  }
}

const projected =
  reprojectWebMercatorRgbaToGeographic(
    tiny,
    rgba
  );

assert.equal(
  projected.length,
  rgba.length
);

assert.equal(
  projected[3],
  255
);

console.log(
  "11 Web Mercator raster reprojection tests passed."
);
