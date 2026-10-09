import assert from "node:assert/strict";
import { directPoint } from "../src/geo.js";
import {
  createAdaptiveThreatConeController, pointWithinIssuedThreatCone
} from "../src/adaptive-threat-cone-v1.js";

const origin={longitude:153,latitude:-27};
const step=(point,heading,km)=>directPoint(point.longitude,point.latitude,heading,km*1000);
const stamp=m=>new Date(Date.parse("2026-10-09T00:00:00Z")+m*60000).toISOString();
const observation=(m,position)=>({
  observed_utc:stamp(m),
  centroid_longitude:position.longitude,
  centroid_latitude:position.latitude
});
const track=(heading=90,speed=40,id="ST0014")=>({
  track_id:id,motion:{heading_degrees:heading,speed_kmh:speed}
});
// Controlled forecast builder with the same public cone geometry as the
// production function: centreline at observed centroid plus constant motion.
const fakeBuild=(t,obs)=>{
  if(!t.motion)return null;
  const start={longitude:obs.centroid_longitude,latitude:obs.centroid_latitude};
  const {speed_kmh,heading_degrees}=t.motion;
  const times=[0,30,60,90];
  return {
    track_id:t.track_id,horizon_minutes:90,speed_kmh,
    heading_degrees,measured_heading_degrees:heading_degrees,
    footprint_radius_km:2,heading_half_angle_degrees:8,
    samples:times.map(minutes_ahead=>({
      minutes_ahead,centre:step(start,heading_degrees,speed_kmh*minutes_ahead/60)
    }))
  };
};
const controller=()=>createAdaptiveThreatConeController({
  buildCone:fakeBuild,rolloverMinutes:30,
  turnThresholdDegrees:12,breachMarginKm:0.5
});

const stationary=controller();
const first=stationary.evaluate(track(),observation(0,origin));
assert.equal(first.reason,"initial");
assert.equal(first.rebased,true);
assert.ok(pointWithinIssuedThreatCone(first.cone,step(origin,90,20)));
assert.ok(!pointWithinIssuedThreatCone(first.cone,step(origin,0,20)));
const normal=stationary.evaluate(track(),observation(5,step(origin,90,40/12)));
assert.equal(normal.rebased,false);
assert.equal(normal.reason,"inside-envelope");
assert.equal(normal.cone,first.cone,"no jitter or reallocation on harmless motion");
assert.equal(stationary.evaluate(track(),observation(5,step(origin,90,40/12))).reason,"same-observation");
const jump=stationary.evaluate(track(),observation(10,step(origin,0,25)));
assert.equal(jump.reason,"observed-outside");
assert.equal(jump.rebased,true);
assert.notEqual(jump.cone,first.cone);

const speedController=controller();
const original=speedController.evaluate(track(),observation(0,origin));
const diverged=speedController.evaluate(track(90,110),observation(5,step(origin,90,40/12)));
assert.equal(diverged.reason,"projected-track-outside");
assert.ok(diverged.rebased);
assert.notEqual(diverged.cone,original.cone);

const turning=controller();
turning.evaluate(track(),observation(0,origin));
const turn=turning.evaluate(track(45,40),observation(5,step(origin,90,40/12)));
assert.ok(["projected-track-outside","direction-change"].includes(turn.reason));
assert.ok(turn.rebased);

const ageing=controller();
const issued=ageing.evaluate(track(),observation(0,origin));
const expired=ageing.evaluate(track(),observation(35,step(origin,90,40*35/60)));
assert.equal(expired.reason,"rolling-refresh");
assert.ok(expired.rebased);
assert.notEqual(expired.cone,issued.cone);
const rewind=ageing.evaluate(track(),observation(10,step(origin,90,40/6)));
assert.equal(rewind.reason,"timeline-rewound");
assert.ok(rewind.rebased,"scrubbing old frames must not inherit later issued geometry");

const noWind=ageing.evaluate({track_id:"ST0014",motion:null},observation(15,origin));
assert.equal(noWind.cone,null);
assert.equal(noWind.reason,"motion-unavailable");
assert.equal(ageing.evaluate(track(),observation(20,origin)).reason,"initial");
ageing.clear("ST0014");
assert.equal(ageing.evaluate(track(),observation(25,origin)).reason,"initial");
ageing.clear();
assert.equal(ageing.evaluate(track(),observation(30,origin)).reason,"initial");
assert.equal(controller().evaluate(track(),observation(0,origin)).cone.track_id,"ST0014");
console.log("PASS adaptive +90m motion cones: observed breach, projected escape, turning, 30m ageing, rewind, stability, missing motion and reset.");
