import assert from "node:assert/strict";

import {
  geographicToPixel,
  registrationResidualPixels,
  selectRegistrationAnchors
} from "../src/georegistration-v1.js";

const frame = {
  width: 100,
  height: 80,

  georef: {
    projection: "EPSG:3857",
    minX: 1000000,
    maxX: 1100000,
    minY: -3000000,
    maxY: -2920000
  },

  categories:
    new Uint8Array(
      100 * 80
    )
};

frame.categories[
  20 * frame.width
  + 25
] = 8;

frame.categories[
  60 * frame.width
  + 75
] = 7;

frame.categories[
  22 * frame.width
  + 27
] = 9;

const residual =
  registrationResidualPixels(
    frame,
    25,
    20
  );

assert.ok(
  residual.magnitude_px
  < 1e-8
);

const anchors =
  selectRegistrationAnchors(
    frame,
    {
      count: 2,
      minimumCategory: 2,
      minimumSeparationPx: 20
    }
  );

assert.equal(
  anchors.length,
  2
);

assert.equal(
  anchors[0].category,
  9
);

assert.equal(
  anchors[1].category,
  7
);

const pixel =
  geographicToPixel(
    frame,
    anchors[0].longitude,
    anchors[0].latitude
  );

assert.ok(
  Math.abs(
    pixel.column
    - anchors[0].column
  )
  < 1e-8
);

assert.ok(
  Math.abs(
    pixel.row
    - anchors[0].row
  )
  < 1e-8
);

console.log(
  "5 georegistration tests passed."
);
