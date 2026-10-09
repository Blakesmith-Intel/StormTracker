import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  buildIndependentDopplerFrames, independentDopplerIndex,
  nearestIndependentDopplerFrameIndex, nextNativeDopplerIndex
} from "../src/independent-doppler-loop-v1.js";
const stamp = minute => new Date(Date.UTC(2026,9,8,17,minute)).toISOString();
const windSource={frames:[14,19,24,28,33,39,43].map((minute,index)=>({
  filename:"IDR66I.T.2026100817"+String(minute).padStart(2,"0")+".png",
  observedUtc:stamp(minute),index
}))};
const radarTimes=[5,10,15,20,25,30,35].map(stamp);
const windFrames=buildIndependentDopplerFrames(windSource,{
  filename:"IDR66I.gif",observedUtc:stamp(48)
});
assert.equal(radarTimes.length,7);
assert.equal(windFrames.length,8,"all real wind observations kept, even if source window differs");
assert.equal(windFrames[0].observedUtc,stamp(14));
assert.equal(windFrames.at(-1).source_kind,"latest");
assert.equal(windFrames.at(-1).observedUtc,stamp(48));
assert.notEqual(windFrames[0].observedUtc,radarTimes[0]);
assert.equal(buildIndependentDopplerFrames(windSource,{
  filename:"IDR66I.gif",observedUtc:stamp(39)}).length,7);
assert.equal(independentDopplerIndex(windFrames,windFrames,2),2);
assert.equal(nearestIndependentDopplerFrameIndex(windFrames,stamp(20)),1);
assert.equal(nearestIndependentDopplerFrameIndex(windFrames,stamp(35)),4);
assert.equal(nextNativeDopplerIndex(-1,8),0);
assert.equal(nextNativeDopplerIndex(7,8),0);
assert.equal(nextNativeDopplerIndex(4,8),5);
assert.equal(nextNativeDopplerIndex(0,0),-1);
let wind=-1,radar=0;
const seen=[];
for(let tick=0;tick<36;tick++){
  radar=(radar+1)%radarTimes.length;
  wind=nextNativeDopplerIndex(wind,windFrames.length);
  seen.push({radar,wind});
}
assert.equal(seen.length,36);
assert.ok(new Set(seen.map(x=>x.radar)).size===7);
assert.ok(new Set(seen.map(x=>x.wind)).size===8);
assert.equal(seen[7].wind,7);
assert.equal(seen[8].wind,0,"wind wraps without wrapping or gating radar");
assert.equal(seen[8].radar,2,"radar keeps its own modulo length");
const script=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const html=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
const css=readFileSync(fileURLToPath(new URL("../src/operational-dashboard-v9-1.css",import.meta.url)),"utf8");
assert.match(script,/playback = createContinuousPlayback\(/);
assert.match(script,/independentDopplerRefresh = createLiveLoopRefresh\(/);
assert.match(script,/function driveWindFromCommonPlayback\(/);
assert.match(script,/preparedWind=await prepareWindForPlayback\(requestedIndex\)/);
assert.match(script,/await commitWindObservation\(preparedWind,\{updateUi:false,renderToken\}\)/,
  "wind imagery must be prepared and committed before the source timeline advances");
assert.doesNotMatch(script,/driveWindFromCommonPlayback\(hybridFrameIndex\)/,
  "radar timeline must not dispatch wind asynchronously after slider commit");
assert.match(script,/nextNativeDopplerIndex\(windCycleCursor, independentDopplerFrames.length\)/);
assert.match(script,/nearestIndependentDopplerFrameIndex\(/);
assert.match(script,/windRenderPending/);
assert.match(script,/showIndependentDopplerFrame\(next\)\.catch/);
assert.match(script,/const withDoppler = false/);
assert.match(script,/const requestedInferred = requestedPlan.filter/);
assert.match(script,/const timeline = radarHistoryTimeline\(radarTimes, shared\)/);
assert.doesNotMatch(script,/independentDopplerPlayback/);
assert.doesNotMatch(script,/dopplerFrameSlider/);
assert.doesNotMatch(script,/RADAR ONLY — Doppler unavailable/);
assert.doesNotMatch(script,/buildRadarPrimaryProductTimeline\(\s*times, sources.histories/);
assert.match(html,/id="hybridPlayButton"/);
assert.match(html,/id="hybridFrameSlider"/);
assert.match(html,/id="radarPlaybackTime"/);
assert.match(html,/id="dopplerPlaybackTime"/);
assert.match(html,/id="dualSourceTimes"/);
assert.match(html,/id="sourceTimeGap"/);
assert.match(script,/function updateDualSourceTimes\(\)/);
assert.match(script,/formatProductTime\(utc,\{compact:true\}\)/);
assert.match(script,/delta>15/);
assert.doesNotMatch(html,/id="dopplerPlayButton"|id="dopplerFrameSlider"|id="dopplerControls"/);
assert.match(css,/\.dual-source-times/);
console.log("PASS one player, two independent native loops, all radar/Doppler frames and genuine per-layer timestamps.");
