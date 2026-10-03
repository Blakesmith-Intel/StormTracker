import assert from "node:assert/strict";

function mode(preferTrackSpecific, trackVolumeCount) {
  return (
    preferTrackSpecific
    && trackVolumeCount > 0
  )
    ? "track-specific"
    : "frame-wide";
}

assert.equal(mode(true, 0), "frame-wide");
assert.equal(mode(true, 1), "track-specific");
assert.equal(mode(false, 1), "frame-wide");
assert.equal(mode(false, 0), "frame-wide");

console.log("4 Core V4 sync/fallback tests passed.");
