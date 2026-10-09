import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const root=new URL("../../",import.meta.url);
const read=p=>readFileSync(fileURLToPath(new URL(p,root)),"utf8");
const html=read("frontend/live3d-operational-v9.html");
const controller=read("frontend/src/live3d-operational-v9.js");
const measured=read("frontend/src/measured-track-volume-v1.js");
let checks=0;
function test(name,fn){fn();checks++;console.log("PASS "+name);}
test("Track-specific 3-D is permanently on: no UI checkbox",()=>{
  assert.doesNotMatch(html,/id="showTrackVolumes"/);
  assert.doesNotMatch(controller,/\$\("showTrackVolumes"\)/);
  assert.doesNotMatch(html,/Track-specific 3-D · always on/);
  assert.match(html,/id="openDetailsButton"/,"Track details remains available without redundant 3-D label");
  assert.match(controller,/const trackVolumesRequested = true/);
});
test("Track mode is requested for measured tracks and falls back on temporal frames",()=>{
  assert.match(controller,/function useTrackSpecificVolume\(index\)/);
  assert.match(controller,/&& hasTrackSpecificVolume\(index\)/);
  assert.match(controller,/isTemporallyInferredRadarFrame/);
  assert.match(controller,/Temporal gap-fill · frame-wide inferred/);
  assert.match(controller,/Frame-wide fallback \(no measured track\)/);
});
test("Track intensity pins preserve measured source palette, not weaker inferred colour",()=>{
  assert.match(measured,/measured_reflectivity_footprint:measuredReflectivityFootprint/);
  assert.match(measured,/source_category:Number\(frame\.categories\[index\]\)/);
  assert.match(measured,/representative_dbzh:inputDbz/);
  assert.match(controller,/volume\.measured_reflectivity_footprint/);
  assert.match(controller,/const rgb=displayRgb\(measured\.source_category\)/);
  assert.match(controller,/Cesium\.Color\.fromBytes\(rgb\[0\],rgb\[1\],rgb\[2\],255\)/);
  assert.match(controller,/projected 2-D source intensity/);
});
test("Vertical reflectivity remains inferred, rather than filled with surface measured dBZ",()=>{
  assert.ok(controller.includes("color: colourForDbzh(point.dbzh)"));
  assert.ok(controller.includes("},point.alpha,volumePercent)"));
  assert.match(controller,/shouldDisplayMeasuredTrackPoint\(point,displayedMinimumDbz\)/);
  assert.match(controller,/BoM measured 2-D reflectivity core \(projected\)/);
  assert.match(measured,/const inferred =\s*inferColumn/);
  assert.match(measured,/buildMeasuredTrackVolume/);
});
console.log(checks+" always-on track 3D/source intensity safeguards passed.");
