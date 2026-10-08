import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  MINIMUM_VOLUME_DISPLAY_DBZ,
  volumeDisplayThresholdDbz,
  shouldRenderVolumePoint
} from "../src/volume-display-threshold-v1.js";
import { shouldDisplayMeasuredTrackPoint } from "../src/measured-track-volume-v1.js";

const root = new URL("../../", import.meta.url);
const read = p => readFileSync(fileURLToPath(new URL(p, root)), "utf8");
const js = read("frontend/src/live3d-operational-v9.js");
const html = read("frontend/live3d-operational-v9.html");

assert.equal(MINIMUM_VOLUME_DISPLAY_DBZ, 40);
for (const bad of [undefined, null, NaN, -1, 0, 20, 30, 39, ""]) {
  assert.equal(volumeDisplayThresholdDbz(bad), 40, "must never lower display floor");
}
for (const value of [40, 45, 50, 60]) {
  assert.equal(volumeDisplayThresholdDbz(value), value);
}
assert.equal(shouldRenderVolumePoint(39.9), false);
assert.equal(shouldRenderVolumePoint(40), true);
assert.equal(shouldRenderVolumePoint(45), true);
assert.equal(shouldRenderVolumePoint(45, 50), false);
assert.equal(shouldRenderVolumePoint(50, 50), true);
assert.equal(shouldRenderVolumePoint(NaN), false);
assert.equal(shouldRenderVolumePoint(Infinity), false);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:39.9},volumeDisplayThresholdDbz(20)),false);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:40},volumeDisplayThresholdDbz(20)),true);

// Both main frame-wide and selected measured-cell 3-D primitives obey 40+;
// the 2-D BoM surface, cell analysis, colour palette and storm track science do not.
const frameStart = js.indexOf("function renderInferredVolume(frame)");
const frameEnd = js.indexOf("\nfunction sameObservedInstant", frameStart);
const frameBlock = js.slice(frameStart, frameEnd);
assert.ok(frameStart > 0 && frameEnd > frameStart);
assert.match(frameBlock,/const minimumDbzh =\s*volumeDisplayThresholdDbz\(\$\("minimumDbzh"\)\.value\)/);
assert.match(frameBlock,/const displayedInferred = inferred\.filter\(\s*point => shouldRenderVolumePoint\(point\.dbzh, minimumDbzh\)/);
assert.match(frameBlock,/for \(const point of displayedInferred\)/);
assert.match(frameBlock,/minimumOutputDbz: 30/,"model sampling must not change");
assert.match(frameBlock,/displayThresholdDbz: 30/,"support classifications must not change");

const trackStart=js.indexOf("function renderHybridTracks(index)");
const trackEnd=js.indexOf("\nfunction updateHybridSourceMetrics",trackStart);
const trackBlock=js.slice(trackStart,trackEnd);
assert.match(trackBlock,/const displayedMinimumDbz=volumeDisplayThresholdDbz\(\$\("minimumDbzh"\)\.value\)/);
assert.match(trackBlock,/if \(!shouldDisplayMeasuredTrackPoint\(point,displayedMinimumDbz\)\) continue/);
assert.match(trackBlock,/if \(measured\.representative_dbzh < displayedMinimumDbz\) continue/);
assert.match(trackBlock,/volume\.measured_reflectivity_footprint/);

assert.match(js,/displayThresholdDbz: 30,\s*basePointSize:/);
assert.match(html, /id="minimumDbzhValue">40<\/span> dBZ/);
assert.match(html, /id="minimumDbzh"\s*type="range"\s*min="40"\s*max="60"\s*value="40"/);
assert.match(html, /original BoM 2-D radar surface is unchanged/);
assert.match(js,/renderSurface\(/, "published source radar surface remains");
assert.match(js,/renderDopplerOverlay\(/);
assert.match(js,/createStormTrackLabelOverlay/);
console.log("40 dBZ volumetric-only threshold tests passed: boundary, storm tracks, frame-wide, source intensity projection, retained analysis and 2-D radar.");
