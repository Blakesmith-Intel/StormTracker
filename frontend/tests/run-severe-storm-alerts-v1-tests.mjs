import assert from "node:assert/strict";
import {
  DAMAGING_WIND_GUST_REFERENCE_KMH,
  findExperimentalHookArc,
  buildSevereStormFrameAlerts
} from "../src/severe-storm-alerts-v1.js";

let passed = 0;
function test(name, callback) {
  callback();
  passed++;
  console.log("PASS " + name);
}
function location(frame, col, row) {
  const R = 6378137;
  const g = frame.georef;
  const x = g.minX + (col + .5) * (g.maxX - g.minX) / frame.width;
  const y = g.maxY - (row + .5) * (g.maxY - g.minY) / frame.height;
  return {
    longitude: x / R * 180 / Math.PI,
    latitude: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
  };
}
function fixture(utc = "2026-10-08T04:00:00Z", shape = "none") {
  const width = 96, height = 96;
  const frame = {
    observedUtc: utc, width, height,
    georef: { projection: "EPSG:3857", minX:16900000, maxX:16940000, minY:-3400000, maxY:-3360000 },
    categories: new Uint8Array(width * height), sourceMetadata: {}
  };
  const labels = new Uint16Array(width * height);
  for (let y = 44; y <= 52; y++) for (let x = 44; x <= 52; x++) {
    labels[y * width + x] = 1;
    frame.categories[y * width + x] = 11;
  }
  if (shape === "arc" || shape === "ring") {
    const end = shape === "arc" ? 210 : 360;
    const start = shape === "arc" ? 70 : 0;
    for (let deg = start; deg < end; deg += 2) {
      const a = deg * Math.PI / 180;
      for (let r = 11; r <= 14; r++) {
        const x = Math.round(48 + r * Math.cos(a));
        const y = Math.round(48 + r * Math.sin(a));
        frame.categories[y * width + x] = 4;
      }
    }
    // Low-reflectivity bridge provides pixel connectivity to tracked strong core.
    for (let r = 3; r <= 12; r++) {
      const a = (shape === "arc" ? 70 : 90) * Math.PI / 180;
      const x = Math.round(48 + r * Math.cos(a));
      const y = Math.round(48 + r * Math.sin(a));
      if (!labels[y * width + x]) frame.categories[y * width + x] = 4;
    }
  }
  const track = {
    track_id:"ST0001",
    history:[{
      observed_utc:utc,
      source_cells:[["BOM-MOSAIC",1]],
      centroid_longitude:location(frame,48,48).longitude,
      centroid_latitude:location(frame,48,48).latitude
    }]
  };
  const result = {
    tracks:[track],
    segmentations:[{ radar_id:"BOM-MOSAIC",labels, width,height }]
  };
  return {frame,result};
}
function doppler(frame, signedSpeed, calibrated = false, deltaMinutes = 0) {
  const centre = location(frame, 48, 48);
  return { records: [{
    radarId:"66",
    observedUtc: new Date(Date.parse(frame.observedUtc) + deltaMinutes * 60000).toISOString(),
    velocityRangeVerified:calibrated,
    verifiedRadialRangeKmh:calibrated?120:70,
    samples:[...Array(4)].map((_,i)=>({
      ...centre,
      velocity_kmh: signedSpeed,
      longitude:location(frame,47+i,48).longitude
    }))
  }] };
}

test("wind reference set at 90 km/h", () =>
  assert.equal(DAMAGING_WIND_GUST_REFERENCE_KMH,90));

test("ordinary BoM 70 km/h image cannot generate a wind alert", () => {
  const {frame,result}=fixture();
  const r=buildSevereStormFrameAlerts({frame,result,dopplerState:doppler(frame,70)});
  assert.equal(r.windSourceSupported,false);
  assert.equal(r.alerts.length,0);
});
test("unverified 100 km/h is rejected", () => {
  const {frame,result}=fixture();
  const r=buildSevereStormFrameAlerts({frame,result,dopplerState:doppler(frame,100)});
  assert.equal(r.alerts.length,0);
});
test("future independently verified source can qualify exactly 90 km/h", () => {
  const {frame,result}=fixture();
  const r=buildSevereStormFrameAlerts({frame,result,dopplerState:doppler(frame,-90,true)});
  assert.equal(r.windSourceSupported,true);
  assert.equal(r.alerts.length,1);
  assert.equal(r.alerts[0].type,"wind");
  assert.equal(r.alerts[0].velocity_kmh,-90);
  assert.equal(r.alerts[0].track_id,"ST0001");
});
test("future verified source rejects nonmatching scan timestamps", () => {
  const {frame,result}=fixture();
  const r=buildSevereStormFrameAlerts({frame,result,dopplerState:doppler(frame,105,true,9)});
  assert.equal(r.alerts.length,0);
});
test("temporally inferred frame cannot produce alert", () => {
  const {frame,result}=fixture();
  frame.sourceMetadata.temporalInference={beforeUtc:frame.observedUtc};
  const r=buildSevereStormFrameAlerts({frame,result,dopplerState:doppler(frame,115,true)});
  assert.equal(r.alerts.length,0);
});
test("no shape flag for simple filled reflectivity core", () => {
  const {frame,result}=fixture();
  assert.equal(findExperimentalHookArc(frame,result,"ST0001"),null);
});
test("no hook-shape candidate without consecutive measured scans", () => {
  const {frame,result}=fixture("2026-10-08T04:05:00Z","arc");
  const r=buildSevereStormFrameAlerts({frame,result,enableExperimentalHook:true});
  assert.equal(r.alerts.length,0);
});
test("circular lower-intensity ring does not qualify as an arc", () => {
  const {frame,result}=fixture("2026-10-08T04:00:00Z","ring");
  assert.equal(findExperimentalHookArc(frame,result,"ST0001"),null);
});
test("two qualifying successive arcs become an explicitly experimental candidate", () => {
  const prev=fixture("2026-10-08T04:00:00Z","arc");
  const current=fixture("2026-10-08T04:05:00Z","arc");
  const r=buildSevereStormFrameAlerts({
    frame:current.frame,result:current.result,
    previousFrame:prev.frame,previousResult:prev.result,
    enableExperimentalHook:true
  });
  assert.equal(r.alerts.length,1);
  assert.equal(r.alerts[0].type,"hook");
  assert.ok(r.alerts[0].caveat.includes("Not verified"));
});
test("hook-shape candidate expires across missing historical scan", () => {
  const prev=fixture("2026-10-08T04:00:00Z","arc");
  const current=fixture("2026-10-08T04:20:00Z","arc");
  const r=buildSevereStormFrameAlerts({
    frame:current.frame,result:current.result,
    previousFrame:prev.frame,previousResult:prev.result,
    enableExperimentalHook:true
  });
  assert.equal(r.alerts.length,0);
});
console.log("\n" + passed + " severe radar alert contract tests passed.");