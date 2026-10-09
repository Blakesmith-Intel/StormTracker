import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(fileURLToPath(new URL(p,root)),"utf8");
const html=read("frontend/live3d-operational-v9.html");
const js=read("frontend/src/live3d-operational-v9.js");
assert.match(html,/id="showTrackLabels"[^>]*checked/);
assert.match(html,/id="trackDisplayFilter"/);
assert.match(html,/id="showTrackThreatCone"/);
assert.match(html,/pointSizeValue[^>]*>3</);
assert.match(html,/id="pointSize"[\s\S]*value="3"/);
assert.match(js,/buildTrackThreatCone/);
assert.match(js,/selectedTrackDisplayId/);
assert.match(js,/showTrackLabels/);

assert.match(js,/function updateRenderedTrackLabels\(\)/,
  "Storm identifier pairs must refresh without advancing or replaying a frame.");
assert.match(js,/stormTrackLabelOverlay\.setVisible\(Boolean\(\$\("showTrackLabels"\)\?\.checked\)\)/,
  "The Labels checkbox must immediately hide or show both the point and the label.");
assert.match(js,/\$\("showTrackLabels"\)\.addEventListener\("change",updateRenderedTrackLabels\)/);

assert.match(js,/showTrackThreatCone/);
assert.match(js,/dopplerOverlayTransition/);
assert.match(js,/viewer\.imageryLayers\.raiseToTop\(\s*surfaceLayer\s*\)/);
const d0=js.indexOf("function renderDopplerOverlay()");
const d1=js.indexOf("function updateDopplerUiForFrame",d0);
assert.ok(d0>=0&&d1>d0);
const block=js.slice(d0,d1);
assert.doesNotMatch(block,/PointPrimitiveCollection/);
assert.match(block,/SingleTileImageryProvider/);
const c0=js.indexOf("const coneColour = colour.withAlpha(0.30)");
const c1=js.indexOf("const top40Text",c0);
assert.ok(c0>=0&&c1>c0,"threat cone render block missing");
const coneBlock=js.slice(c0,c1);
assert.match(coneBlock,/const coneColour = colour\.withAlpha\(0\.30\)/);
assert.match(coneBlock,/hybrid-threat-boundary-/);
assert.match(coneBlock,/width:\s*4/);
assert.match(coneBlock,/pixelSize:\s*8/);
assert.match(js,/evaluateChronologicalTrackThreatCone\(/);
assert.match(js,/measuredTrackMotionAtObservation\(selectedTrack, observation\)/);
assert.match(coneBlock,/projected-track-outside/);
assert.match(js,/Motion cone paused on inferred display frame; resumes at next measured observation/);
assert.doesNotMatch(js,/adaptiveThreatCones\.clear\(\)/, "source-time replay eliminates mutable cone history");

console.log("Track display controls, stronger threat-cone visibility and radar-over-Doppler transition layering checks passed.");
