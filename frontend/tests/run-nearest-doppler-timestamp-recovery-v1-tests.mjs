import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildIndependentDopplerFrames, independentDopplerIndex
} from "../src/independent-doppler-loop-v1.js";
const stamp = minute => new Date(Date.UTC(2026,9,8,17,minute)).toISOString();
const history = { frames:[14,19,24,28,33,39,43].map((minute,index)=>({
  filename:"IDR66I.T.2026100817"+String(minute).padStart(2,"0")+".png",
  observedUtc:stamp(minute),index
})) };
const radarTimes=[5,10,15,20,25,30,35].map(stamp);
const windFrames=buildIndependentDopplerFrames(history,{filename:"IDR66I.gif",observedUtc:stamp(48)});
assert.equal(windFrames.length,8,"independent wind history uses all actual wind observations");
assert.equal(windFrames[0].observedUtc,stamp(14));
assert.equal(windFrames.at(-1).source_kind,"latest");
assert.equal(windFrames.at(-1).observedUtc,stamp(48));
assert.equal(radarTimes.length,7,"reflectivity sources are separate");
assert.notEqual(windFrames[0].observedUtc,radarTimes[0]);
const noRepeat=buildIndependentDopplerFrames(history,{
  filename:"IDR66I.gif",observedUtc:stamp(39)
});
assert.equal(noRepeat.length,7,"latest GIF cannot duplicate or backdate archived scans");
const empty=buildIndependentDopplerFrames({frames:[]});
assert.equal(empty.length,0);
assert.equal(independentDopplerIndex(windFrames,[],0),7);
assert.equal(independentDopplerIndex(windFrames,windFrames,2),2);
assert.equal(independentDopplerIndex(windFrames.slice(1),windFrames,7),6);
const script=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const html=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
assert.match(script,/buildIndependentDopplerFrames\(/);
assert.match(script,/independentDopplerPlayback = createContinuousPlayback\(/);
assert.match(script,/independentDopplerRefresh = createLiveLoopRefresh\(/);
assert.match(script,/showIndependentDopplerFrame\(/);
assert.match(script,/independentDopplerCanvas\(/);
assert.match(script,/const withDoppler = false/);
assert.match(script,/const requestedInferred = requestedPlan.filter/);
assert.match(script,/const timeline = radarHistoryTimeline\(radarTimes, shared\)/);
assert.match(script,/radarHistoryTimes|radarFrameCache/);
assert.doesNotMatch(script,/RADAR ONLY — Doppler unavailable/);
assert.doesNotMatch(script,/buildRadarPrimaryProductTimeline\(\s*times, sources.histories/);
assert.match(html,/<details class="independent-doppler-controls" id="dopplerControls">/);
assert.match(html,/<summary>Doppler controls/);
assert.match(html,/id="dopplerPlayButton"/);
assert.match(html,/id="dopplerFrameSlider"/);
assert.match(html,/id="dopplerPlaybackSpeed"/);
console.log("PASS separate reflectivity and Doppler clocks, collapsed wind controls and raw source-timestamp contracts.");
