import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setStormTrackTrailVisibility } from "../src/storm-track-trail-visibility-v1.js";

const entities = {values: [
  {id:"hybrid-trail-ST-1",show:true},
  {id:"hybrid-threat-cone-ST-1",show:true},
  {id:"hybrid-threat-boundary-ST-1",show:true},
  {id:"hybrid-threat-centreline-ST-1",show:true},
  {id:"hybrid-threat-marker-ST-1-30",show:true},
  {id:"severe-alert-ST-1",show:true},
  {id:"road-closure-42",show:true},
  {id:"hybrid-volume-point",show:true}
]};
assert.equal(setStormTrackTrailVisibility(entities,false),5);
assert.deepEqual(entities.values.slice(0,5).map(e=>e.show),Array(5).fill(false));
assert.deepEqual(entities.values.slice(5).map(e=>e.show),Array(3).fill(true));
assert.equal(setStormTrackTrailVisibility(entities,true),5);
assert.deepEqual(entities.values.map(e=>e.show),Array(8).fill(true));
// Mimic a paused frame: no advance, only visibility toggling.
assert.equal(setStormTrackTrailVisibility(entities,false),5);
assert.equal(entities.values[0].show,false);
const source = readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(source,/setStormTrackTrailVisibility\(hybridSource\.entities, show\)/);
assert.match(source,/setStormTrackTrailVisibility\(hybridSource\.entities,trackAnnotationsVisible\)/);
console.log("V9.18 paused-frame track visibility and rebuilt-frame regression passed");
