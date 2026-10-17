import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("../live3d-operational-v9.html");
const js=read("../src/live3d-operational-v9.js");
const css=read("../src/single-interface-v1.css");
const index=read("../index.html");
assert.match(html,/<details id="radarPlaybackDetails" class="card loop-controls">\s*<summary class="section-title">▶ Radar playback<\/summary>/);
assert.doesNotMatch(html,/<details id="radarPlaybackDetails"[^>]*\sopen(?:\s|=|>)/,
  "Playback must start collapsed; no state restoration dependency");
const block=html.slice(html.indexOf('<details id="radarPlaybackDetails"'),html.indexOf('    </details>')+14);
for(const id of ["loopDurationMinutes","loadHybridButton","loadButton",
"hybridPlayButton","jumpLatestButton","hybridFrameSlider","playbackSpeed",
"hybridFrameLabel","operationalFrameTime","status","radarOpacity",
"volumeOpacity","dualSourceTimes","dopplerPlaybackTime"]){
 assert.ok(block.includes('id="'+id+'"'),"All playback widgets remain mounted for normal JS event binding: "+id);
}
assert.match(css,/#radarPlaybackDetails:not\(\[open\]\) > :not\(summary\)[\s\S]*?display:none!important/);
assert.match(css,/#radarPlaybackDetails\[open\] > summary::after/);
assert.match(js,/window\.__stormtrackerMemoryDiagnostics=/,
  "Manual diagnostics capture must remain without operator sidebar widget");
assert.doesNotMatch(js,/createResponsiveMemoryDiagnostics\(|sidebar:controlsSidebar,\s*capture:/);
assert.doesNotMatch(html,/id="memoryQaPanel"|Memory diagnostics/);
assert.match(index,/cyclone-compact-playback-v1/);
assert.match(html,/cyclone-historical-map-20261017-v1/);
assert.match(html,/<body class="simple-ui">/);
assert.match(js,/function setSidebarCollapsed\(collapsed\)/,
  "Previously sealed full-map control must remain independent");
console.log("PASS default-collapsed playback, live bound controls, no memory sidebar, unchanged full-map control.");
