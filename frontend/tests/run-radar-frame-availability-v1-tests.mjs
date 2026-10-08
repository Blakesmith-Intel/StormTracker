import assert from "node:assert/strict";
import { sourceFrameLoadDecision, summariseSkippedObservedFrames } from "../src/radar-frame-availability-v1.js";
const okRadar={status:"fulfilled",value:{observedUtc:"2026-10-08T16:35:00Z"}};
const paired={status:"fulfilled",value:{
  reflectivityUtc:"2026-10-08T16:35:00Z",
  records:[],pairings:[{radarId:"66",matched:true,deltaMinutes:3}]
}};
const badRadar={status:"rejected",reason:new Error("WMTS tile unavailable")};
const badDoppler={status:"rejected",reason:new Error("BOM Doppler relay timeout")};
assert.equal(sourceFrameLoadDecision({radarLoad:okRadar,dopplerLoad:paired,requiresDoppler:true,requiredRadarIds:["66"]}).accepted,true);
const radarOnly=sourceFrameLoadDecision({radarLoad:okRadar,dopplerLoad:badDoppler,requiresDoppler:false,requiredRadarIds:["66"]});
assert.equal(radarOnly.accepted,true);
assert.equal(radarOnly.kind,"radar-only");
assert.equal(radarOnly.state.reflectivityUtc,"2026-10-08T16:35:00Z");
assert.equal(radarOnly.state.records.length,0);
const noRadar=sourceFrameLoadDecision({radarLoad:badRadar,dopplerLoad:paired,requiresDoppler:true,requiredRadarIds:["66"]});
assert.equal(noRadar.accepted,false);
assert.equal(noRadar.kind,"radar-unreadable");
assert.match(noRadar.message,/WMTS/);
const noDoppler=sourceFrameLoadDecision({radarLoad:okRadar,dopplerLoad:badDoppler,requiresDoppler:true,requiredRadarIds:["66"]});
assert.equal(noDoppler.accepted,false);
assert.equal(noDoppler.kind,"doppler-unreadable");
const unmatched=sourceFrameLoadDecision({radarLoad:okRadar,dopplerLoad:{status:"fulfilled",value:{pairings:[{radarId:"66",matched:false,deltaMinutes:9,loadError:"No BoM historical PNG"}]}},requiresDoppler:true,requiredRadarIds:["66"]});
assert.equal(unmatched.accepted,false);
assert.equal(unmatched.kind,"doppler-unmatched");
assert.deepEqual(unmatched.missingRadarIds,["66"]);
assert.match(unmatched.message,/historical PNG/);
assert.equal(sourceFrameLoadDecision({radarLoad:okRadar,dopplerLoad:badDoppler,requiresDoppler:false}).state.pairings.length,0);
const summary=summariseSkippedObservedFrames([
  {observedUtc:"2026-10-08T16:30:00Z",kind:"radar-unreadable",message:"tile missing"},
  {observedUtc:"2026-10-08T16:35:00Z",kind:"doppler-unmatched",message:"gap"},
  {observedUtc:"2026-10-08T16:40:00Z",kind:"doppler-unmatched",message:"gap"}
]);
assert.match(summary.summary,/3 skipped/);
assert.match(summary.summary,/1 reflectivity unreadable/);
assert.match(summary.summary,/2 Doppler unmatched/);
assert.match(summary.detail,/16:30/);
assert.equal(summariseSkippedObservedFrames([]).summary,"");
console.log("PASS radar/Doppler source-specific frame diagnostics and radar-only recovery (12 assertions).");