import assert from "node:assert/strict";
import { directPoint, distanceKm } from "../src/geo.js";
import { geodesicMotion } from "../src/tracking.js";
import { createContinuousPlayback } from "../src/continuous-playback-v1.js";
import {
  sourceAlignedPlaybackDelayMs,
  isDopplerOnlyPlaybackStep
} from "../src/combined-loop-playback-v1.js";
import { evaluateChronologicalTrackThreatCone } from "../src/adaptive-threat-cone-v1.js";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";

const utc=minutes=>new Date(Date.parse("2026-10-09T00:00:00Z")+minutes*60000).toISOString();
const events=Array.from({length:14},(_,i)=>({radarObservedUtc:utc(5*Math.floor(i/2))}));
assert.equal(sourceAlignedPlaybackDelayMs(450,events,true),225,
  "14 authentic union steps must use the wall-clock budget of seven rain frames");
assert.equal(sourceAlignedPlaybackDelayMs(450,events,false),450,
  "radar-only source playback retains its baseline cadence");
assert.equal(sourceAlignedPlaybackDelayMs(450,[],true),450);
assert.throws(()=>sourceAlignedPlaybackDelayMs(0,events,true),RangeError);
const rain={observedUtc:utc(0)};
assert.equal(isDopplerOnlyPlaybackStep(rain,rain,true,true),true);
assert.equal(isDopplerOnlyPlaybackStep(rain,{...rain},true,true),false);
assert.equal(isDopplerOnlyPlaybackStep(rain,rain,false,true),false);
assert.equal(isDopplerOnlyPlaybackStep(rain,rain,true,false),false);

const anchor={longitude:153,latitude:-27};
const measured=Array.from({length:4},(_,i)=>{
  const point=directPoint(anchor.longitude,anchor.latitude,90,i*3000);
  return {observed_utc:utc(i*5),centroid_longitude:point.longitude,
    centroid_latitude:point.latitude,sampled_area_km2:25};
});
const track={track_id:"ST0001",history:measured};
const coneOptions={followMeasuredPosition:true};
const observed=evaluateChronologicalTrackThreatCone(
  track,measured[3],buildTrackThreatCone,{},coneOptions
);
assert.ok(observed.cone,"source-measured track should produce a cone");
assert.equal(observed.reason,"measured-position");
const centre=observed.cone.samples[0].centre;
assert.ok(distanceKm(centre.longitude,centre.latitude,
  measured[3].centroid_longitude,measured[3].centroid_latitude)<0.01,
  "display cone starts at the latest genuine observed ST centroid");
assert.deepEqual(observed,evaluateChronologicalTrackThreatCone(
  track,measured[3],buildTrackThreatCone,{},coneOptions
), "playing, looping, and scrubbing one scan always yields the same source-time geometry");
assert.equal(buildTrackThreatCone({
  track_id:"ST0002",motion:{speed_kmh:800,heading_degrees:90}
},measured[3]),null,"unreasonable track association must not produce a statewide cone");
assert.equal(evaluateChronologicalTrackThreatCone({
  ...track,history:measured.slice(0,1)
},measured[0],buildTrackThreatCone,{},coneOptions).cone,null,
"one source scan does not establish storm motion");

// A near-stationary storm marker can wobble 0.2 km north after repeated
// 3 km eastward measured steps. That false 0-degree heading must not swing
// the forward +90m envelope away from its supported eastward motion.
const jitterPoint=directPoint(
  measured[3].centroid_longitude,measured[3].centroid_latitude,0,200
);
const jitter={observed_utc:utc(20),centroid_longitude:jitterPoint.longitude,
  centroid_latitude:jitterPoint.latitude,sampled_area_km2:25};
const jitterTrack={track_id:"ST0001",history:[...measured,jitter],
  motion:geodesicMotion(measured[3],jitter)};
const jitterCone=buildTrackThreatCone(jitterTrack,jitter);
assert.ok(jitterCone);
assert.ok(Math.abs(jitterCone.heading_degrees-90)<5,
  "sub-kilometre centroid wobble must not swing a well-supported heading");
assert.ok(jitterCone.heading_half_angle_degrees<15,
  "sub-kilometre centroid wobble must not exaggerate cone width");

let index=0;
const presented=[];
let finished;
const done=new Promise(resolve=>{finished=resolve;});
const playback=createContinuousPlayback({
  count:()=>5,currentIndex:()=>index,delay:()=>1,
  showFrame:async next=>{
    presented.push(next);
    if(next!==2)index=next;
    if(presented.length===6){playback.pause();finished();}
    return next!==2;
  }
});
playback.play();
await Promise.race([
  done,
  new Promise((_,reject)=>setTimeout(()=>reject(Error("Playback recovery timed out")),2000))
]);
await playback.pause();
assert.deepEqual(presented,[1,2,3,4,0,1],
  "unavailable frame 2 is skipped; the next real scan and later loops still advance");

let unavailableErrors=0;
const failed=createContinuousPlayback({
  count:()=>3,currentIndex:()=>0,delay:()=>1,
  showFrame:async()=>false,onError:()=>{unavailableErrors++;}
});
await failed.play();
assert.equal(unavailableErrors,1,"all failed images stop with a clear error rather than spin forever");
assert.equal(failed.isPlaying(),false);
console.log("PASS native combined playback, duplicate-radar reuse, measured cones, implausible-motion suppression and stuck-index recovery.");
