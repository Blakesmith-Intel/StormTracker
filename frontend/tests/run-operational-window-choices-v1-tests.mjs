import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RAIN_ONLY_LOOP_MINUTES, buildOperationalWindowChoices
} from "../src/operational-window-choices-v1.js";
import { DOPPLER_AVAILABLE_LOOP_VALUE } from "../src/doppler-available-window-v1.js";

assert.deepEqual(RAIN_ONLY_LOOP_MINUTES,[60,120,180]);
const choices=buildOperationalWindowChoices({
  combinedAvailable:true,rainAvailableMinutes:[30,60,90,120,180]
});
assert.equal(choices.length,4,"only four choices, regardless of other radar durations");
assert.deepEqual(choices.map(x=>x.value),[DOPPLER_AVAILABLE_LOOP_VALUE,"60","120","180"]);
assert.deepEqual(choices.map(x=>x.label),[
  "Radar + Doppler — All available",
  "60 min — Rain radar only",
  "120 min — Rain radar only",
  "180 min — Rain radar only"
]);
assert.ok(choices.every(x=>!x.disabled));
const fewer=buildOperationalWindowChoices({
  combinedAvailable:false,rainAvailableMinutes:[30,60,90]
});
assert.deepEqual(fewer.map(x=>x.disabled),[true,false,true,true],
  "keep four options visible but disable unavailable sources");
assert.deepEqual(buildOperationalWindowChoices().map(x=>x.disabled),[true,true,true,true]);

const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const markup=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
assert.match(runtime,/buildOperationalWindowChoices\(\{/);
assert.match(runtime,/selector.replaceChildren\(\.\.\.options\)/);
assert.match(runtime,/const selected = choices.some\(choice => choice.value === previous\)/,
  "temporary source outages must never switch rain-only to Doppler mode");
assert.match(runtime,/\$\("loadHybridButton"\).disabled = !selectedWindow/,
  "unavailable rain windows cannot be requested");
assert.match(runtime,/function shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/return isDopplerSourceActive\(\) && isCombinedDopplerWindowSelected\(\)/);
assert.match(runtime,/function driveWindFromCommonPlayback\(radarIndex\) \{\s*if \(!shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/function renderDopplerOverlay\(\)[\s\S]*?if\(!shouldDisplayDopplerForSelectedWindow\(\)\)/);
assert.match(runtime,/if\(token!==dopplerOverlayRenderToken\|\|!shouldDisplayDopplerForSelectedWindow\(\)/,
 "prevent asynchronous wind tile from showing after selecting rain only");
assert.match(runtime,/renderDopplerOverlay\(\);\s*updateIndependentDopplerUi\(\);\s*updateLoopButtonLabel\(\)/,
 "changing to rain-only clears Doppler at once, before radar frames reload");
assert.match(runtime,/const active=shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/const windUtc=shouldDisplayDopplerForSelectedWindow\(\)/);
assert.match(runtime,/wind.textContent=!shouldDisplayDopplerForSelectedWindow\(\) \? "Rain only"/);
assert.match(runtime,/independentDopplerRefresh = createLiveLoopRefresh\(/,
 "Doppler source should keep refreshing for future combined selection");
assert.match(runtime,/hybridCombinedSchedule = isCombined \? combinedSchedule : \[\]/,
 "retain existing combined playback implementation");
assert.doesNotMatch(markup,/id="showDopplerOverlay"|id="dopplerPlayButton"/);
assert.doesNotMatch(markup,/Load 30-min storm loop/);
assert.match(markup,/id="radarOpacity"|id="dopplerOpacity"|id="volumeOpacity"/);
console.log("PASS exactly four ordered window choices; combined Doppler intact; wind hidden in rain-only without stopping source refresh.");
