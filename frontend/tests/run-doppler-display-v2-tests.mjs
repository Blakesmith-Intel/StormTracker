import assert from "node:assert/strict";

import {
  nearestPaletteMatch
} from "../src/bom-doppler-display-v2.js";

const palette = {
  swatches: [
    {
      rgb:[40,80,200],
      velocity_kmh:-20
    },
    {
      rgb:[235,235,235],
      velocity_kmh:0
    },
    {
      rgb:[240,175,35],
      velocity_kmh:20
    }
  ]
};

const exact =
  nearestPaletteMatch(
    [40,80,200],
    palette
  );

assert.equal(
  exact.velocity_kmh,
  -20
);

assert.equal(
  exact.match_mode,
  "exact"
);

const nearBlue =
  nearestPaletteMatch(
    [45,82,194],
    palette
  );

assert.equal(
  nearBlue.velocity_kmh,
  -20
);

assert.equal(
  nearBlue.match_mode,
  "near"
);

const nearWarm =
  nearestPaletteMatch(
    [235,171,42],
    palette
  );

assert.equal(
  nearWarm.velocity_kmh,
  20
);

const unrelated =
  nearestPaletteMatch(
    [120,180,120],
    palette
  );

assert.equal(
  unrelated,
  null
);

const farBlue =
  nearestPaletteMatch(
    [90,125,250],
    palette,
    {
      relaxedDistance:24
    }
  );

assert.equal(
  farBlue,
  null
);

console.log(
  "7 Doppler display-classifier tests passed."
);
