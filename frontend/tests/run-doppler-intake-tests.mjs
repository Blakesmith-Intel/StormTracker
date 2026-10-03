import assert from "node:assert/strict";

import {
  buildDopplerRelayUrl,
  DOPPLER_PRODUCTS
} from "../src/bom-doppler-intake-v1.js";

assert.equal(
  DOPPLER_PRODUCTS["08"],
  "IDR08I"
);

assert.equal(
  DOPPLER_PRODUCTS["50"],
  "IDR50I"
);

assert.equal(
  DOPPLER_PRODUCTS["66"],
  "IDR66I"
);

assert.equal(
  new URL(
    buildDopplerRelayUrl(
      "66"
    )
  ).searchParams.get(
    "product"
  ),
  "IDR66I"
);

assert.throws(
  () =>
    buildDopplerRelayUrl(
      "108"
    )
);

console.log(
  "5 Doppler intake tests passed."
);
