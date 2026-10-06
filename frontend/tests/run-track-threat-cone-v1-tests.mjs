import assert from "node:assert/strict";
import { buildTrackThreatCone } from "../src/track-threat-cone-v1.js";

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
assert.equal(cone.polygon.length, 8);
assert.ok(cone.samples.at(-1).centre.longitude > history.at(-1).centroid_longitude);
assert.ok(cone.samples.at(-1).half_width_km > cone.footprint_radius_km);
assert.ok(cone.heading_half_angle_degrees >= 8);
assert.match(cone.interpretation, /not a forecast probability/);
assert.equal(buildTrackThreatCone({history,motion:null}, history.at(-1)), null);
console.log("Track threat-cone checks passed: 90-minute constant-motion extrapolation with footprint/heading-spread widening.");
