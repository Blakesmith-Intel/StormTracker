import assert from "node:assert/strict";
import { directPoint } from "../src/geo.js";
import { geodesicMotion } from "../src/tracking.js";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";
import {
  createAdaptiveThreatConeController, pointWithinIssuedThreatCone,
  evaluateChronologicalTrackThreatCone,
  measuredTrackMotionAtObservation
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
// A storm that has moved several kilometres can remain INSIDE a broad
// 90-minute threat envelope. Its cone should still move forward on the next
// source scan rather than leaving the origin visually stranded behind it.
const moving=controller();
const startMoving=moving.evaluate(track(),observation(0,origin));
const small=moving.evaluate(track(),observation(5,step(origin,90,2)));
assert.equal(small.reason,"inside-envelope");
assert.equal(small.cone,startMoving.cone,"2 km jitter must not redraw the cone");
const advanced=moving.evaluate(track(),observation(10,step(origin,90,5)));
assert.equal(advanced.reason,"storm-advanced");
assert.equal(advanced.rebased,true);
assert.notEqual(advanced.cone,startMoving.cone);
assert.ok(pointWithinIssuedThreatCone(startMoving.cone,step(origin,90,5)),
  "a centroid can advance meaningfully even while still inside the original broad cone");
console.log("PASS adaptive +90m motion cones: observed breach, projected escape, turning, 30m ageing, rewind, storm translation, stability, missing motion and reset.");

// Regression: viewing 00:15, rewinding to 00:10 and replaying 00:15 must
// produce identical source-time geometry. Never use the final track's
// current motion for an earlier radar observation.
const historical=[
  observation(0,origin),
  observation(5,step(origin,90,3.33)),
  observation(10,step(origin,90,6.66)),
  observation(15,step(step(origin,90,6.66),0,3.33))
];
const past={
  track_id:"ST0014",
  history:historical,
  motion:{ heading_degrees:0, speed_kmh:140 }
};
const at10 = evaluateChronologicalTrackThreatCone(
  past,historical[2],fakeBuild,{horizonMinutes:90},
  {rolloverMinutes:30,turnThresholdDegrees:12,breachMarginKm:0.5}
);
const at15 = evaluateChronologicalTrackThreatCone(
  past,historical[3],fakeBuild,{horizonMinutes:90},
  {rolloverMinutes:30,turnThresholdDegrees:12,breachMarginKm:0.5}
);
const at10Repeated = evaluateChronologicalTrackThreatCone(
  past,historical[2],fakeBuild,{horizonMinutes:90},
  {rolloverMinutes:30,turnThresholdDegrees:12,breachMarginKm:0.5}
);
assert.equal(Math.round(at10.cone.heading_degrees),90,"early eastward track cannot inherit later northward motion");
assert.equal(Math.round(at15.cone.heading_degrees),0);
assert.ok(at15.rebased,"significant turn after 00:10 must reissue cone");
assert.deepEqual(at10,at10Repeated,"scrubbing and loop restarts deterministically reproduce the same cone");
assert.equal(at10.issue_observed_utc,historical[1].observed_utc);
const truncated={...past,history:historical.slice(0,3),motion:{heading_degrees:180,speed_kmh:900}};
assert.deepEqual(
  evaluateChronologicalTrackThreatCone(truncated,historical[2],fakeBuild,{horizonMinutes:90},
    {rolloverMinutes:30,turnThresholdDegrees:12,breachMarginKm:0.5}),
  at10,
  "future observations and latest-motion metadata have no effect on earlier cone"
);
assert.equal(
  evaluateChronologicalTrackThreatCone(past,historical[0],fakeBuild).cone,
  null,
  "single source observation is insufficient to infer storm motion"
);
assert.equal(
  evaluateChronologicalTrackThreatCone(past,observation(12,step(origin,90,7)),fakeBuild).cone,
  null,
  "must not invent a forecast at a timestamp without a genuine track observation"
);
assert.equal(
  Math.round(measuredTrackMotionAtObservation(past,historical[2]).heading_degrees),
  90
);
assert.ok(Math.abs(measuredTrackMotionAtObservation(past,historical[3]).heading_degrees)<1);
console.log("PASS threat cone playback determinism, historical motion, future-data isolation, observed-only snapshots and scrubbing.");

// Confirm cumulative, individually sub-12-degree motion changes cause the
// actual displayed cone to change heading, not simply register a reissue.
const q=(minute,pt)=>({...observation(minute,pt),sampled_area_km2:300});
const slowTurn=[
  q(0,origin)
];
slowTurn.push(q(5,step(origin,90,1.5)));
slowTurn.push(q(10,step({longitude:slowTurn[1].centroid_longitude,latitude:slowTurn[1].centroid_latitude},90,1.5)));
slowTurn.push(q(15,step({longitude:slowTurn[2].centroid_longitude,latitude:slowTurn[2].centroid_latitude},84,1.5)));
slowTurn.push(q(20,step({longitude:slowTurn[3].centroid_longitude,latitude:slowTurn[3].centroid_latitude},81,1.5)));
const trackAt=index=>{
  const hist=slowTurn.slice(0,index+1);
  return {track_id:"ST0055",history:hist,
    motion:geodesicMotion(hist.at(-2),hist.at(-1))};
};
const steeringController=createAdaptiveThreatConeController({
  buildCone:buildTrackThreatCone,rolloverMinutes:30,turnThresholdDegrees:12,
  steeringChangeThresholdDegrees:8,minimumSteeringSpeedKmh:12,
  minimumSteeringMotionKm:1.25,breachMarginKm:0.5,
  minimumTranslationKm:4
});
const eastIssue=steeringController.evaluate(trackAt(1),slowTurn[1]);
assert.equal(eastIssue.reason,"initial");
const smallTurn=steeringController.evaluate(trackAt(3),slowTurn[3]);
assert.equal(smallTurn.reason,"inside-envelope","small, supported steering should not jitter the cone");
const accumulatedTurn=steeringController.evaluate(trackAt(4),slowTurn[4]);
assert.equal(accumulatedTurn.reason,"steering-change");
assert.ok(accumulatedTurn.rebased);
assert.equal(accumulatedTurn.cone.steering_heading_applied,true);
assert.ok(Math.abs(accumulatedTurn.cone.heading_degrees-81)<0.2,
  "a reissued cone must face measured ~81-degree steering, not its old east heading");
assert.ok(accumulatedTurn.cone.heading_degrees<eastIssue.cone.heading_degrees-7);
const deterministic= evaluateChronologicalTrackThreatCone(
  trackAt(4),slowTurn[4],buildTrackThreatCone,
  {horizonMinutes:90,directionChangeThresholdDegrees:12},
  {rolloverMinutes:30,turnThresholdDegrees:12,
    steeringChangeThresholdDegrees:8,minimumSteeringMotionKm:1.25,
    minimumSteeringSpeedKmh:12,breachMarginKm:0.5}
);
assert.equal(deterministic.reason,"steering-change");
assert.ok(Math.abs(deterministic.cone.heading_degrees-81)<0.2);
const lastPoint={longitude:slowTurn[4].centroid_longitude,latitude:slowTurn[4].centroid_latitude};
const jitter=q(25,step(lastPoint,0,0.2));
const lowSpeed={track_id:"ST0055",history:[...slowTurn,jitter],
  motion:geodesicMotion(slowTurn.at(-1),jitter)};
const jitterResult=steeringController.evaluate(lowSpeed,jitter);
assert.equal(jitterResult.reason,"inside-envelope","tiny slow centroid jitter must not swing cone north");
assert.equal(jitterResult.cone.heading_degrees,accumulatedTurn.cone.heading_degrees);
console.log("PASS cumulative sub-12-degree steering, actual reorientation, deterministic rewind and low-speed jitter suppression.");
