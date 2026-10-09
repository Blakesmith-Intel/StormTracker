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
assert.match(js,/stormTrackLabelOverlay\.setVisible\(show\)/,
  "The Labels checkbox must immediately hide or show paired centroid markers and text.");
assert.match(js,/setStormTrackTrailVisibility\(hybridSource\.entities, show\)/,
  "The Labels checkbox must also immediately hide/show history trails on paused frames.");
assert.match(js,/\$\("showTrackLabels"\)\.addEventListener\("change",updateRenderedTrackLabels\)/);

assert.match(js,/showTrackThreatCone/);
assert.match(js,/dopplerOverlayTransition/);
assert.match(js,/viewer\.imageryLayers\.raiseToTop\(\s*surfaceLayer\s*\)/);
const d0=js.indexOf("function renderDopplerOverlay()");
const d1=js.indexOf("function updateDopplerUiForFrame",d0);
assert.ok(d0>=0&&d1>d0);
const block=js.slice(d0,d1);
assert.doesNotMatch(block,/PointPrimitiveCollection/);
assert.match(js,/function prepareNativeDopplerProvider\(/);
assert.match(js,/SingleTileImageryProvider.fromUrl\(/);
const c0=js.indexOf("function renderIssuedThreatCone(");
const c1=js.indexOf("function precedingMeasuredThreatCone(",c0);
assert.ok(c0>=0&&c1>c0,"threat cone render block missing");
const coneBlock=js.slice(c0,c1);
assert.match(coneBlock,/const coneColour = colour\.withAlpha\(heldObservedUtc \? 0\.20 : 0\.30\)/);
assert.match(coneBlock,/hybrid-threat-boundary-/);
assert.match(coneBlock,/width:\s*heldObservedUtc \? 3 : 4/);
assert.match(coneBlock,/pixelSize:\s*8/);
assert.match(js,/evaluateChronologicalTrackThreatCone\(/);
assert.match(js,/measuredTrackMotionAtObservation\(selectedTrack, observation\)/);
assert.match(coneBlock,/projected-track-outside/);
assert.match(coneBlock,/storm-advanced/);
assert.match(coneBlock,/steering-change/);
assert.match(coneBlock,/latest measured/);
assert.match(js,/renderIssuedThreatCone\(track, projection, null, observation\)/);
assert.match(js,/precedingMeasuredThreatCone\(index, selectedTrackId\(\)\)/);
assert.match(js,/renderIssuedThreatCone\(held\.track, held\.projection, held\.sourceUtc\)/);
assert.match(coneBlock,/holding last measured \+90m cone from/);
assert.match(js,/maximumHoldMinutes = 15/);
assert.match(js,/Motion cone paused on inferred display frame; resumes at next measured observation/);
assert.doesNotMatch(js,/adaptiveThreatCones\.clear\(\)/, "source-time replay eliminates mutable cone history");

console.log("Track display controls, stronger threat-cone visibility and radar-over-Doppler transition layering checks passed.");
