import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildRadarPrimaryProductTimeline } from "../src/shared-product-timeline-v1.js";
import { sourceFrameLoadDecision } from "../src/radar-frame-availability-v1.js";
import { radarHistoryTimeline } from "../src/live-loop-refresh-v1.js";

const stamp = minute => new Date(Date.UTC(2026,9,8,17,minute)).toISOString();
const radarTimes = [5,10,15,20,25,30,35].map(stamp);
// Real operational counterexample: historical Doppler timestamps are staggered
// and only cover part of the observed reflectivity window.
const sourceFrames = [14,19,24,28,33,39,43].map((minute,index)=>({
  filename: "IDR66I.T.2026100817"+String(minute).padStart(2,"0")+".png",
  observedUtc:stamp(minute),source_kind:"history",index
}));
const sources = new Map([["66",{frames:sourceFrames}]]);
const plan = buildRadarPrimaryProductTimeline(radarTimes,sources,new Map(),["66"],8);
const timeline = radarHistoryTimeline(radarTimes,plan);
assert.equal(timeline.entries.length,7,"seven real radar scans retained");
assert.equal(timeline.startUtc,stamp(5));
assert.equal(timeline.endUtc,stamp(35));
assert.equal(plan.mode,"reflectivity-primary");
assert.equal(plan.entries[0].pairings[0].matched,false,"nine minutes is outside eight-minute limit");
assert.equal(plan.entries[1].pairings[0].matched,true,"four minutes is acceptable");
assert.equal(plan.entries[1].pairings[0].deltaMinutes,4);
assert.equal(plan.entries[2].pairings[0].deltaMinutes,1);
assert.equal(plan.entries[2].pairings[0].candidate.observedUtc,stamp(14));
assert.equal(plan.entries.at(-1).pairings[0].candidate.observedUtc,stamp(33));
assert.equal(plan.entries.at(-1).pairings[0].deltaMinutes,2);

const pairs = timeline.entries.map(entry => ({entry, radarLoad:{
  status:"fulfilled",value:{observedUtc:entry.observedUtc}
},dopplerLoad:{status:"fulfilled",value:{
  reflectivityUtc:entry.observedUtc,
  pairings:entry.pairings,
  records: entry.pairings.map(p => p.matched ? {radarId:"66",observedUtc:p.candidate.observedUtc} : {
    radarId:"66",observedUtc:null,samples:[]
  })
}}}));
assert.equal(pairs.filter(({entry})=>entry.pairings.some(p=>p.matched)).length,6);
assert.equal(pairs.filter(({radarLoad,dopplerLoad})=>sourceFrameLoadDecision({
  radarLoad,dopplerLoad,requiresDoppler:false,requiredRadarIds:["66"]
}).accepted).length,7,"unmatched Doppler does not discard measured reflectivity");
const impossible=sourceFrameLoadDecision({radarLoad:{status:"rejected",reason:Error("WMTS not served")},
  dopplerLoad:pairs[0].dopplerLoad,requiresDoppler:false,requiredRadarIds:["66"]});
assert.equal(impossible.accepted,false,"never fake unavailable reflectivity");

const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(runtime,/buildRadarPrimaryProductTimeline\(\s*times, sources.histories, sources.latestRecords, selectedSourceRadars\(\), 8/);
assert.match(runtime,/const timeline = radarHistoryTimeline\(radarTimes, shared\)/);
assert.match(runtime,/requiresDoppler: false/);
assert.match(runtime,/const dopplerGatedRefresh = false/);
assert.match(runtime,/withDoppler: false,\s*radarTimes:/);
assert.match(runtime,/RADAR ONLY — Doppler unavailable/);
console.log("PASS seven real radar observations retained with six nearest actual Doppler scans (<=8min), unmatched frames explicit.");
