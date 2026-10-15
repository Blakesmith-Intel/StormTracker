import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {buildTrackThreatCone} from "../src/track-threat-cone-v1.js";
import {distanceKm,directPoint} from "../src/geo.js";
import {geodesicMotion} from "../src/tracking.js";

const runtime=readFileSync(fileURLToPath(
  new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const geometry=runtime.slice(runtime.indexOf("function renderIssuedThreatCone("),
  runtime.indexOf("const THREAT_CONE_CONTROLLER_OPTIONS"));
const marker=runtime.slice(runtime.indexOf("function renderHybridTracks(index)"),
  runtime.indexOf("if (presentation.show) stormTrackMarkers.push("));

assert.match(runtime,/const STORM_TRACK_ANCHOR_ALTITUDE_METRES = 1200;/);
assert.match(geometry,
  /const coneAltitude = displayAltitude\(STORM_TRACK_ANCHOR_ALTITUDE_METRES\);/,
  "the drawn cone must occupy the same plane as the storm ID label");
assert.match(marker,/const altitude = STORM_TRACK_ANCHOR_ALTITUDE_METRES;/,
  "DOM storm centre label must use that exact shared altitude");
assert.match(marker,/position = Cesium\.Cartesian3\.fromDegrees\(\s*observation\.centroid_longitude,\s*observation\.centroid_latitude,\s*displayAltitude\(altitude\)/);
assert.match(geometry,/cone\.polygon\.map\(point => Cesium\.Cartesian3\.fromDegrees\(\s*point\.longitude, point\.latitude, coneAltitude\s*\)/);
assert.doesNotMatch(geometry,/const coneAltitude = displayAltitude\(350\)/,
  "old low-level 350m cone plane causes large apparent offset at oblique camera angles");

// Actual source geometry: the +0 minute origin is NOT the radar hotspot or
// the side of the polygon. It must be the SAME measured connected-pixel
// centroid as the overlaid ST0001/0003 dot, even if the rain echo spreads wide.
const first={observed_utc:"2026-10-15T08:00:00Z",
  centroid_longitude:139.49,centroid_latitude:-20.73,sampled_area_km2:220};
const moved=directPoint(first.centroid_longitude,first.centroid_latitude,9,2800);
const second={observed_utc:"2026-10-15T08:05:00Z",
  centroid_longitude:moved.longitude,centroid_latitude:moved.latitude,
  sampled_area_km2:220};
const track={track_id:"ST0001",history:[first,second],
  motion:geodesicMotion(first,second)};
const cone=buildTrackThreatCone(track,second,{horizonMinutes:90,
  forceMeasuredHeading:true});
assert.ok(cone);
assert.equal(cone.samples[0].minutes_ahead,0);
assert.ok(distanceKm(cone.samples[0].centre.longitude,
  cone.samples[0].centre.latitude,second.centroid_longitude,
  second.centroid_latitude)<0.00001,
  "the cone MUST start at the selected storm observation");
assert.ok(Math.abs(cone.heading_degrees-9)<0.1,
  "9-degree measured motion and 9-degree cone are not a heading issue");
assert.equal(cone.samples.at(-1).minutes_ahead,90);
console.log("PASS same-frame ST0001 centroid anchor and +90m cone share one vertical projection plane, real source position and observed heading.");
