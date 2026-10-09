import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  MAX_CONTEXT_SNAPSHOT_AGE_MS,
  sourceSnapshotState,
  sourceFailureStatus,
  checkedAtAest
} from "../src/context-layers/source-freshness-v1.js";

let passed = 0;
function test(name, body) {
  body();
  console.log("PASS " + name);
  passed++;
}
const checked = Date.parse("2026-10-08T06:26:00Z");
const closures = MAX_CONTEXT_SNAPSHOT_AGE_MS.floodRoadClosures;
const outages = MAX_CONTEXT_SNAPSHOT_AGE_MS.powerOutages;
const sample = (offset, maxAgeMs) =>
  sourceSnapshotState({lastLoadedAt:checked,maxAgeMs,nowMs:checked+offset});

test("QLDTraffic snapshot expiry follows six five-minute polls", () => {
  assert.equal(closures, 30*60*1000);
  assert.equal(sample(closures-1,closures).kind,"current");
  assert.equal(sample(closures,closures).kind,"expired");
  assert.equal(sample(closures,closures).expired,true);
});
test("Outage snapshot expiry follows four 15-minute polls", () => {
  assert.equal(outages, 60*60*1000);
  assert.equal(sample(outages-1,outages).kind,"current");
  assert.equal(sample(outages,outages).kind,"expired");
});
test("No provider response is unavailable, not accidentally expired", () => {
  assert.deepEqual(sourceSnapshotState({lastLoadedAt:0,maxAgeMs:outages}),
    {kind:"unavailable",ageMs:null,expired:false});
});
test("Invalid age limits are rejected", () => {
  assert.throws(()=>sourceSnapshotState({lastLoadedAt:checked,maxAgeMs:0}),RangeError);
  assert.throws(()=>sourceSnapshotState({lastLoadedAt:checked,maxAgeMs:NaN}),RangeError);
});
test("Clock rollback cannot indefinitely preserve incidents", () => {
  assert.equal(sample(-300000,outages).kind,"clock-anomaly");
  assert.equal(sample(-300000,outages).expired,true);
  assert.equal(sample(-1000,outages).kind,"current");
});
test("Unverified recent incidents show a conspicuous failure warning", () => {
  const result=sourceFailureStatus({
    error:new Error("Upstream 503"),lastLoadedAt:checked,maxAgeMs:outages,
    nowMs:checked+5*60*1000
  });
  assert.equal(result.kind,"warning");
  assert.match(result.message,/UNVERIFIED/);
  assert.match(result.message,/Upstream 503/);
  assert.match(result.message,/last checked/);
});
test("Expired incidents are explicitly cleared in the status", () => {
  const result=sourceFailureStatus({
    error:"timeout",lastLoadedAt:checked,maxAgeMs:closures,
    nowMs:checked+31*60*1000
  });
  assert.equal(result.kind,"error");
  assert.equal(result.expired,true);
  assert.match(result.message,/expired incidents cleared/);
});
test("First-check failure never claims cached incident validity", () => {
  const result=sourceFailureStatus({error:"offline",maxAgeMs:outages});
  assert.equal(result.kind,"error");
  assert.match(result.message,/no verified incidents/);
});
test("AEST last-checked clock is usable and blank for an absent check", () => {
  assert.match(checkedAtAest(checked),/16:26/);
  assert.equal(checkedAtAest(0),"");
});
const src = relative => readFileSync(
  fileURLToPath(new URL(relative,import.meta.url)),"utf8");
test("Both operational data sources invalidate expired map entities", () => {
  for (const name of ["power-outages-v1.js","flood-road-closures-v1.js"]) {
    const code=src("../src/context-layers/"+name);
    assert.match(code,/function expireStaleSnapshot\(\)/);
    assert.match(code,/dataSource\.entities\.removeAll\(\)/);
    assert.match(code,/onUpdate\(\[\]\)/);
    assert.match(code,/sourceFailureStatus\(/);
    assert.match(code,/visibilitychange/);
    assert.match(code,/checkedAtAest\(lastLoadedAt\)/);
    assert.match(code,/lastPresentedStatus/);
    assert.match(code,/reportStatus\(lastPresentedStatus\)/);
  }
});
test("Browser release entrypoints bust old module and stylesheet caches", () => {
  const html=src("../live3d-operational-v9.html");
  const controller=src("../src/live3d-operational-v9.js");
  assert.match(html,/live3d-operational-v9\.js\?v=source-native-playback-review-v1/);
  assert.match(html,/operational-dashboard-v9-1\.css\?v=source-native-playback-review-v1/);
  assert.match(controller,/flood-road-closures-operational-v1\.js\?v=9\.15\.0-unplanned/);
  assert.match(controller,/power-outages-operational-v1\.js\?v=9\.14\.0/);
});
test("Incident cards do not tunnel clicks to other contextual layers", () => {
  const road=src("../src/context-layers/flood-road-closures-operational-v1.js");
  const power=src("../src/context-layers/power-outages-operational-v1.js");
  assert.match(road,/#nav,#floodRoadClosureInfo,#powerOutageInfo,#riverGaugeInfo/);
  assert.match(power,/#nav,#powerOutageInfo,#floodRoadClosureInfo,#riverGaugeInfo/);
});
test("Unverified road closures get a visible amber status", () => {
  assert.match(src("../src/operational-dashboard-v9-1.css"),
    /#floodRoadClosureStatus\[data-kind="warning"\]/);
});
console.log("\n"+passed+" source-freshness regression checks passed.");
