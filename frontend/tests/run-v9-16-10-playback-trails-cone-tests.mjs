import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setStormTrackTrailVisibility } from "../src/storm-track-trail-visibility-v1.js";
import { isDopplerOnlyPlaybackStep, sourceAlignedPlaybackDelayMs } from "../src/combined-loop-playback-v1.js";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";
import { evaluateChronologicalTrackThreatCone } from "../src/adaptive-threat-cone-v1.js";
import { directPoint, distanceKm } from "../src/geo.js";

// Hiding labels must immediately hide corresponding Cesium history trails,
// without hiding +90-minute cones or other operational overlays.
const entities={values:[
  {id:"hybrid-trail-ST0001",show:true},
  {id:"hybrid-trail-ST0020",show:true},
  {id:"hybrid-threat-centreline-ST0001",show:true},
  {id:"hybrid-threat-boundary-ST0001",show:true},
  {id:"hybrid-threat-cone-ST0001",show:true},
  {id:"road-closure-001",show:true}
]};
assert.equal(setStormTrackTrailVisibility(entities,false),2);
assert.equal(entities.values[0].show,false);
assert.equal(entities.values[1].show,false);
assert.ok(entities.values.slice(2).every(entity=>entity.show===true));
assert.equal(setStormTrackTrailVisibility(entities,true),2);
assert.ok(entities.values.every(entity=>entity.show===true));
assert.equal(setStormTrackTrailVisibility({values:[]},false),0);
assert.equal(setStormTrackTrailVisibility(null,false),0);

const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(runtime,/setStormTrackTrailVisibility\(hybridSource\.entities, show\)/,
  "paused labels toggle must immediately change existing trails");
assert.match(runtime,/id: `hybrid-trail-\$\{track\.track_id\}`,\s*show: Boolean\(\$\("showTrackLabels"\)\?\.checked\)/,
  "every newly created trail must respect the checkbox state");
assert.match(runtime,/stormTrackLabelOverlay\.setVisible\(show\)/);

const a={observedUtc:"2026-10-09T00:00:00Z"};
const b={observedUtc:"2026-10-09T00:05:00Z"};
assert.ok(isDopplerOnlyPlaybackStep(a,a,true,true));
assert.ok(!isDopplerOnlyPlaybackStep(a,b,true,true));
assert.ok(!isDopplerOnlyPlaybackStep(a,a,false,true));
assert.ok(!isDopplerOnlyPlaybackStep(a,a,true,false));
const schedule=Array.from({length:12},(_,i)=>({
  radarObservedUtc:new Date(Date.UTC(2026,9,9,0,Math.floor(i/2)*5)).toISOString()
}));
assert.equal(sourceAlignedPlaybackDelayMs(450,schedule,false),450);
assert.equal(sourceAlignedPlaybackDelayMs(450,schedule,true),225);
assert.equal(sourceAlignedPlaybackDelayMs(150,schedule,true),80);
assert.throws(()=>sourceAlignedPlaybackDelayMs(0,schedule,true),RangeError);
assert.match(runtime,/const steps=hybridCombinedSchedule\.length \? 0 :/,
  "combined playback must avoid synthetic radar morph frames");
assert.match(runtime,/windOnlyStep \? true : await renderSurface/,
  "Doppler-only union events must not re-render unchanged rain");
assert.match(runtime,/\+\+hybridSceneRenderToken;\s*\+\+independentDopplerRequest;[\s\S]*?renderDopplerOverlay\(\)/,
  "switching to rain only must invalidate queued hybrid and wind frame commits before clearing overlay");
assert.match(runtime,/if \(!shouldDisplayDopplerForSelectedWindow\(\)\)\s*throw Error\("Combined Doppler display was disabled during wind preparation"\)/,
  "a prepared stale Doppler scan must not commit after rain-only selection");
assert.match(runtime,/if \(!shouldDisplayDopplerForSelectedWindow\(\)\) \{[\s\S]*?windCycleCursor=nextIndex;\s*return;\s*\}/,
  "rain-only refresh keeps Doppler history updated without wind-image decode or display");


const start={longitude:153,latitude:-27};
const stamps=[0,5,10,15].map(minutes=>new Date(Date.UTC(2026,9,9,0,minutes)).toISOString());
const obs=stamps.map((observed_utc,i)=>{
  const position=directPoint(start.longitude,start.latitude,90,i*3000);
  return {observed_utc,
    centroid_longitude:position.longitude,
    centroid_latitude:position.latitude,
    sampled_area_km2:25};
});
const track={track_id:"ST0014",history:obs};
const projection=evaluateChronologicalTrackThreatCone(track,obs.at(-1),buildTrackThreatCone,
  {horizonMinutes:90},{followMeasuredPosition:true});
assert.ok(projection.cone);
const anchor=projection.cone.samples[0].centre;
assert.ok(distanceKm(anchor.longitude,anchor.latitude,obs.at(-1).centroid_longitude,
  obs.at(-1).centroid_latitude)<0.05,"cone should follow CURRENT measured storm position");
assert.deepEqual(projection,evaluateChronologicalTrackThreatCone(track,obs.at(-1),
  buildTrackThreatCone,{horizonMinutes:90},{followMeasuredPosition:true}),
  "scrubbing back to a known measured scan must reconstruct identical geometry");
assert.equal(buildTrackThreatCone({track_id:"ST-BAD",
  motion:{speed_kmh:900,heading_degrees:90}},obs.at(-1)),null,
  "an implausible 900km/h track association must not create a statewide cone");
console.log("PASS StormTracker V9.16.10 labels+trails, combined playback, measured cone anchoring, source preservation.");
