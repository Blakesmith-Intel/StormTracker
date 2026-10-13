import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setStormTrackTrailVisibility } from "../src/storm-track-trail-visibility-v1.js";

// Labels control historical storm trails and paired DOM identifier markers.
// Threat-cone geometry, severe alerts and contextual map entities remain
// independently controlled, including while radar playback is paused.
const entities={values:[
  {id:"hybrid-trail-ST-1",show:true},
  {id:"hybrid-threat-cone-ST-1",show:true},
  {id:"hybrid-threat-boundary-ST-1",show:true},
  {id:"hybrid-threat-centreline-ST-1",show:true},
  {id:"hybrid-threat-marker-ST-1-30",show:true},
  {id:"severe-alert-ST-1",show:true},
  {id:"road-closure-42",show:true},
  {id:"hybrid-volume-point",show:true}
]};
assert.equal(setStormTrackTrailVisibility(entities,false),1);
assert.equal(entities.values[0].show,false);
assert.ok(entities.values.slice(1).every(entity=>entity.show===true),
  "Labels off must not override independent threat-cone or warning controls");
assert.equal(setStormTrackTrailVisibility(entities,true),1);
assert.ok(entities.values.every(entity=>entity.show===true));
// Paused frame: nothing advances, so the current-frame trail must still hide.
assert.equal(setStormTrackTrailVisibility(entities,false),1);
assert.equal(entities.values[0].show,false);
const source=readFileSync(fileURLToPath(
  new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(source,/setStormTrackTrailVisibility\(hybridSource\.entities, show\)/);
assert.match(source,/setStormTrackTrailVisibility\(hybridSource\.entities,trackAnnotationsVisible\)/);
console.log("V9.18 paused-frame storm trail visibility and independent cone regression passed");
