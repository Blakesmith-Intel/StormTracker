import assert from "node:assert/strict";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";
import {directPoint, distanceKm, initialBearingDegrees} from "../src/geo.js";

const history = [
  { observed_utc:"2026-10-05T00:00:00Z", centroid_longitude:153.00, centroid_latitude:-27.00, sampled_area_km2:78.5 },
  { observed_utc:"2026-10-05T00:10:00Z", centroid_longitude:153.08, centroid_latitude:-27.00, sampled_area_km2:78.5 },
  { observed_utc:"2026-10-05T00:20:00Z", centroid_longitude:153.16, centroid_latitude:-27.00, sampled_area_km2:78.5 }
];
const track = { track_id:"ST0001", history, motion:{ speed_kmh:48, heading_degrees:90 } };
const cone = buildTrackThreatCone(track, history.at(-1));
assert.ok(cone);
assert.equal(cone.horizon_minutes, 90);
assert.deepEqual(cone.samples.map(item=>item.minutes_ahead), [0,30,60,90]);
assert.equal(cone.polygon.length, 7);
assert.deepEqual(cone.polygon[0],cone.samples[0].centre,
  "the rendered polygon must START on the measured storm dot, not a wide rear edge");
assert.deepEqual(cone.centreline[0],cone.samples[0].centre);
assert.ok(cone.samples.at(-1).centre.longitude > history.at(-1).centroid_longitude);
assert.ok(cone.samples.at(-1).half_width_km > cone.footprint_radius_km);
assert.ok(cone.heading_half_angle_degrees >= 8);
assert.match(cone.interpretation, /not a forecast probability/);
assert.equal(buildTrackThreatCone({history,motion:null}, history.at(-1)), null);

assert.equal(cone.direction_change_threshold_degrees, 12);
assert.equal(cone.direction_change_detected, false);

const turningHistory = [
  { observed_utc:"2026-10-05T00:00:00Z", centroid_longitude:153.00, centroid_latitude:-27.00, sampled_area_km2:78.5 },
  { observed_utc:"2026-10-05T00:10:00Z", centroid_longitude:153.08, centroid_latitude:-27.00, sampled_area_km2:78.5 },
  { observed_utc:"2026-10-05T00:20:00Z", centroid_longitude:153.14, centroid_latitude:-26.94, sampled_area_km2:78.5 }
];
const turningTrack = {
  track_id:"ST0099",
  history:turningHistory,
  motion:{ speed_kmh:48, heading_degrees:45 }
};
const turningCone = buildTrackThreatCone(turningTrack, turningHistory.at(-1));
assert.ok(turningCone);
assert.equal(turningCone.direction_change_detected, true);
assert.ok(turningCone.direction_change_degrees >= 12);
assert.equal(Math.round(turningCone.heading_degrees), 45);


// The normal 3-segment smoother can lag a real small turn. When the
// controller verifies steering, forced heading must point at the latest
// geodesic motion, not the older weighted average.
const shallowTurnTrack={
  track_id:"ST0142",
  history:[
    {...history[0]},
    {...history[1]},
    { ...history[2], centroid_longitude:153.16, centroid_latitude:-26.995}
  ],
  motion:{speed_kmh:48,heading_degrees:85}
};
const smoothed=buildTrackThreatCone(shallowTurnTrack,shallowTurnTrack.history.at(-1));
const steered=buildTrackThreatCone(shallowTurnTrack,shallowTurnTrack.history.at(-1),{
  forceMeasuredHeading:true
});
assert.ok(Math.abs(smoothed.heading_degrees-85)>1,"test requires demonstrable smoothing lag");
assert.equal(steered.heading_degrees,85,"a verified steering reissue must use the real measured heading");
assert.equal(steered.steering_heading_applied,true);
assert.equal(smoothed.steering_heading_applied,false);
// Real-user Mt Isa ST0003 symptom: measured 279° and 285° movement is
// westward and must project WEST from the observed dot.  No screen-space
// assumption substitutes for actual geographic vertices.
const isa={longitude:139.65,latitude:-20.77};
for(const heading of [279,285]){
  const older=directPoint(isa.longitude,isa.latitude,(heading+180)%360,2800);
  const observed={observed_utc:"2026-10-15T09:10:00Z",
    centroid_longitude:isa.longitude,centroid_latitude:isa.latitude,
    sampled_area_km2:100};
  const old={...observed,observed_utc:"2026-10-15T09:05:00Z",
    centroid_longitude:older.longitude,centroid_latitude:older.latitude};
  const track={track_id:"ST0003",history:[old,observed],
    motion:{heading_degrees:heading,speed_kmh:34,distance_km:2.8}};
  const projected=buildTrackThreatCone(track,observed,{forceMeasuredHeading:true});
  assert.deepEqual(projected.polygon[0],projected.samples[0].centre);
  assert.deepEqual(projected.samples[0].centre,
    {longitude:observed.centroid_longitude,latitude:observed.centroid_latitude});
  const future=projected.samples.find(x=>x.minutes_ahead===30).centre;
  assert.ok(future.longitude < observed.centroid_longitude,
    "westward measured heading "+heading+"° must not draw +30m to the east");
  assert.ok(Math.abs(initialBearingDegrees(observed.centroid_longitude,
    observed.centroid_latitude,future.longitude,future.latitude)-heading)<0.1,
    "forecast 30m bearing must be identical to displayed "+heading+"°");
  assert.ok(distanceKm(future.longitude,future.latitude,
    observed.centroid_longitude,observed.centroid_latitude)>10);
}
console.log("Track threat-cone checks passed: 90-minute motion extrapolation, 12-degree direction-change response and footprint/heading-spread widening.");
