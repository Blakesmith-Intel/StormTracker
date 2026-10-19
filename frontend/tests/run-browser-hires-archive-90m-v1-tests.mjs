import assert from "node:assert/strict";
import {availableMeasuredHiResLoopMinutes,measuredHiResRainWindow,
 isVerifiedHiResRadarFrame} from "../src/hires-radar-loop-policy-v1.js";
import {RAIN_ONLY_LOOP_MINUTES,buildOperationalWindowChoices}
 from "../src/operational-window-choices-v1.js";
import {readFileSync} from "node:fs";

const start=Date.parse("2026-10-19T00:00:00Z");
const time=i=>new Date(start+i*300000).toISOString().replace(".000Z","Z");
const raw=Array.from({length:48},(_,i)=>time(i));
const counts=[[30,6],[60,12],[90,18],[120,24],[180,36]];
assert.deepEqual(RAIN_ONLY_LOOP_MINUTES,[30,60,90,120,180]);

for(const [duration,count] of counts){
 const series=raw.slice(0,count);
 const window=measuredHiResRainWindow(series,String(duration));
 assert.equal(window.plan.length,count,duration+"m must have "+count+" scans");
 assert.equal(window.partial,false);
 assert(window.plan.every(x=>x.kind==="observed"),"No interpolated frames");
 assert.equal(window.plan[0].observedUtc,series[0]);
 assert(availableMeasuredHiResLoopMinutes(series).includes(duration),
  duration+"m becomes available when "+count+" genuine scans have arrived");
 if(count>6){
  const nearly=series.slice(0,-1);
  assert(!availableMeasuredHiResLoopMinutes(nearly).includes(duration),
   duration+"m cannot unlock early");
 }
}
const half=raw.slice(0,18);
assert.deepEqual(availableMeasuredHiResLoopMinutes(half),[30,60,90]);
const choices=buildOperationalWindowChoices({rainHasFrames:true,
 rainAvailableMinutes:availableMeasuredHiResLoopMinutes(half)});
assert.equal(choices.find(x=>x.value==="90").disabled,false);
assert.equal(choices.find(x=>x.value==="120").disabled,true);
assert.equal(choices.find(x=>x.value==="180").disabled,true);
const full=measuredHiResRainWindow(raw,"180");
assert.equal(full.plan.length,36);
assert.equal(full.plan[0].observedUtc,raw[12]);
const gap=raw.filter((_,i)=>i!==43);
assert(!availableMeasuredHiResLoopMinutes(gap).includes(30));
assert(!availableMeasuredHiResLoopMinutes(gap).includes(90));
assert(measuredHiResRainWindow(gap,"180").partial);
assert.equal(measuredHiResRainWindow(gap,"180").plan.length,35);
assert(!measuredHiResRainWindow(gap,"180").plan.some(x=>x.observedUtc===raw[43]));
const invalid={sourceId:"BOM-FTP-MOSAIC",observedUtc:raw[0]};
assert(!isVerifiedHiResRadarFrame(invalid));
const storage=readFileSync("frontend/src/storage.js","utf8");
assert(storage.includes('const DB_NAME = "stormtracker-browser"'));
assert(storage.includes('db.createObjectStore("frames"'));
assert(storage.includes("export async function getRadarFrames("));
assert(storage.includes("export async function putRadarFrame("));
const release=readFileSync("scripts/apply-ftp-aep-release-v10.py","utf8");
assert(release.includes("availableMeasuredHiResLoopMinutes(availableRadarHistoryTimes)"));
assert(release.includes("getRadarFrames(region, cacheCutoff).then(frames=>frames.filter(isVerifiedHiResRadarFrame))"));
console.log("PASS_BROWSER_HIRES_ARCHIVE_30_60_90_120_180_REAL_5MIN_FRAMES",JSON.stringify({
 minutes:counts.map(x=>x[0]),frameCounts:counts.map(x=>x[1]),
 storage:"IndexedDB",hoursRetained:4,noSynthetic:true
}));
