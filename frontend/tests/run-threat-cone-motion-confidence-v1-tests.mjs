import assert from "node:assert/strict";
import { directPoint, initialBearingDegrees, distanceKm } from "../src/geo.js";
import { geodesicMotion } from "../src/tracking.js";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";
import {
  credibleMeasuredMotionAtObservation,
  evaluateChronologicalTrackThreatCone
} from "../src/adaptive-threat-cone-v1.js";

const origin={longitude:139.48,latitude:-20.72};
const utc=m=>new Date(Date.parse("2026-10-15T08:45:00Z")+m*60000).toISOString();
const makeObs=(minute,coord)=>({
  observed_utc:utc(minute),centroid_longitude:coord.longitude,
  centroid_latitude:coord.latitude,sampled_area_km2:140
});
const move=(coord,bearing,speedKmh,minutes=5)=>
  directPoint(coord.longitude,coord.latitude,bearing,speedKmh*minutes/60*1000);

// Reconstruct the trajectory pattern shown in the 18:55 / 19:00 / 19:25
// screenshots using ILLUSTRATIVE centroids, not actual downloaded BoM data.
// A sharply changing 7km/h 5-minute centroid is not strong evidence for a
// confident +90-minute projected path.
const coords=[origin];let current=origin;
for(const [bearing,speed] of [[137,29],[117,26],[49,7]]){
  current=move(current,bearing,speed);coords.push(current);
}
const observations=coords.map((c,i)=>makeObs(i*5,c));
const observedTrack={track_id:"ST0003",history:observations,
  motion:geodesicMotion(observations[2],observations[3])};
const prior=credibleMeasuredMotionAtObservation(
  observedTrack,observations[2]);
assert.equal(prior.source,"instantaneous");
assert.ok(prior.motion.speed_kmh>25);
const latest=credibleMeasuredMotionAtObservation(
  observedTrack,observations[3]);
assert.equal(latest.motion,null,
  "a new 7km/h turning centroid step is not a defensible 90-minute forecast");
assert.ok(["inconsistent-motion","low-motion-confidence"].includes(latest.reason));
const withheld=evaluateChronologicalTrackThreatCone(
  observedTrack,observations[3],buildTrackThreatCone,
  {horizonMinutes:90},{followMeasuredPosition:true}
);
assert.equal(withheld.cone,null,
  "do not keep or re-anchor an earlier 117° cone when 7km/h new movement is noisy");
assert.equal(withheld.reason,latest.reason);

// Slow but coherent 0.7km measured moves over consecutive source frames
// are allowed: 0.7km per 5m = 8.4km/h, yet displacement across 10m is
// 1.4km with consistent heading and sufficient spatial evidence.
let slow=origin;const supported=[makeObs(0,slow)];
for(const [i,heading] of [0,0,0].entries()){
  slow=move(slow,heading,8.4);
  supported.push(makeObs((i+1)*5,slow));
}
const stableTrack={track_id:"ST0004",history:supported};
const credible=credibleMeasuredMotionAtObservation(
  stableTrack,supported[2]);
assert.equal(credible.source,"sustained");
assert.ok(credible.motion.speed_kmh>=6 && credible.motion.speed_kmh<12);
assert.ok(credible.motion.distance_km>=1.25);
const projected=evaluateChronologicalTrackThreatCone(
  stableTrack,supported[3],buildTrackThreatCone,
  {horizonMinutes:90},{followMeasuredPosition:true}
);
assert.ok(projected.cone,"consistent slow source-observed travel may project");
assert.ok(Math.abs(projected.cone.heading_degrees)<2,
  "supported slow motion projects along its actual measured northward heading");
assert.equal(projected.cone.steering_evidence,"sustained-measured-observations");
assert.equal(projected.cone.samples[0].minutes_ahead,0);
assert.equal(projected.cone.samples.at(-1).minutes_ahead,90);
assert.ok(projected.cone.samples[1].centre.latitude>
  supported[3].centroid_latitude);
assert.deepEqual(projected,evaluateChronologicalTrackThreatCone(
  stableTrack,supported[3],buildTrackThreatCone,
  {horizonMinutes:90},{followMeasuredPosition:true}),
  "playback order and seeking must not change measured-motion confidence");
// Alter the 3rd movement abruptly: previous motion is no longer valid
// evidence for a slow, directionally coherent updated source.
const abrupt=[...supported.slice(0,3)];
const aberrant=makeObs(15,move({
  longitude:supported[2].centroid_longitude,
  latitude:supported[2].centroid_latitude
},105,7));
abrupt.push(aberrant);
assert.equal(credibleMeasuredMotionAtObservation(
  {track_id:"ST0004",history:abrupt},aberrant).motion,null);
console.log("PASS low-confidence Mt Isa turn withheld; two agreeing slow observed movements retained; deterministic +90m and no fabricated velocity.");
