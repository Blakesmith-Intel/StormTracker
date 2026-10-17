import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const html=read("../live3d-operational-v9.html");
const controller=read("../src/live3d-operational-v9.js");
const css=read("../src/playback-sidebar-hierarchy-v1.css");
const sourceQfd=read("../src/context-layers/qfd-technical-rescues-operational-v1.js");
const sourceGauge=read("../src/context-layers/river-gauge-layer-v1.js");
const shell=read("../index.html");
function first(term){const i=html.indexOf(term);assert.ok(i>=0,"Missing "+term);return i;}
for(const id of ["hybridFrameSlider","playbackSpeed","hybridFrameLabel","operationalFrameTime",
"radarOpacity","radarOpacityValue","volumeOpacity","volumeOpacityValue","showTrackLabels",
"trackDisplayFilter","showTrackThreatCone","trackLabelsScopeNote","trackThreatConeStatus",
"showRiverGauges","showQfdTechnicalRescues","qfdSymbolLegend","qfdSymbolStatus",
"terrainEnabled"]){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+" duplicated/removed");
}
assert.ok(first('id="hybridFrameSlider"')<first('id="playbackSpeed"'));
assert.ok(first('id="playbackSpeed"')<first('id="hybridFrameLabel"'));
assert.ok(first('id="hybridFrameLabel"')<first('id="operationalFrameTime"'));
assert.ok(first('id="operationalFrameTime"')<first('id="radarOpacity"'));
assert.equal((html.match(/id="status"/g)||[]).length,1,"original status must not be duplicated");
assert.ok(first('id="playbackSpeed"')<first('id="status"'),"source status appears below speed");
assert.ok(first('id="status"')<first('id="radarOpacity"'),"source status appears above opacity");
assert.match(html,/<div id="status" class="radar-playback-status"/);
assert.doesNotMatch(html,/class="playback-frame-readout"/);
assert.match(css,/#controlSidebar \.loop-controls > #status/);
for(const name of ["showFloodRoadClosures","showPowerOutages","showRiverGauges","showQfdTechnicalRescues"]){
  assert.ok(html.includes('id="'+name+'" type="checkbox"'));
  assert.ok(!html.includes('id="'+name+'" type="checkbox" checked'));
}
assert.match(controller,/DEFAULT_OFF_LAYER_IDS/);

assert.ok(first('id="radarOpacity"')<first('id="volumeOpacity"'));
assert.ok(first('id="volumeOpacity"')<first('class="card storm-controls"'));
assert.ok(first('class="card storm-controls"')<first('class="card layer-controls"'));
assert.ok(first('id="showTrackLabels"')<first('id="showTrackThreatCone"'));
assert.match(html,/▶ Radar playback/);
assert.match(html,/◫ Layers/);
assert.ok(!html.includes("▶ Watch radar"));
assert.ok(!html.includes("◫ What to show"));
assert.ok(!html.includes('type="checkbox" checked> 3-D terrain'));
assert.match(html,/id="terrainEnabled" type="checkbox" checked disabled hidden/);
assert.match(controller,/terrainManager\.setEnabled\(true\)/);
assert.ok(!controller.includes('$("terrainEnabled").addEventListener('));
assert.match(css,/#controlSidebar #terrainEnabled,/);
assert.match(css,/body\.simple-ui #controlSidebar \.layer-controls \{display:block!important;\}/);
assert.match(css,/body\.simple-ui #controlSidebar \.loop-controls > \.playback-speed-row/);
assert.match(css,/body\.simple-ui #controlSidebar \.loop-controls > #status/);
assert.match(css,/body\.simple-ui #controlSidebar \.loop-controls > \.opacity-controls/);
assert.match(html,/class="flood-severity-glyph"/);
assert.match(html,/stroke="#e53935"/);
assert.match(html,/stroke="#ffd43b"/);
assert.match(html,/stroke="#2db76f"/);
for(const color of ["#e53935","#ffd43b","#2db76f"])
 assert.ok(sourceGauge.includes(color),"Gauge legend colors must match the existing real map marker");
assert.match(html,/<details id="qfdIncidentLegendDetails"/);
for(const group of ["RESCUE TECHNICAL","RESCUE ROAD CRASH","ASSIST PUBLIC"]){
 assert.ok(html.includes('data-qfd-group-icon="'+group+'"'),group);
}
assert.match(sourceQfd,/qfdSymbolFor\(group,officialSymbols\)/);
assert.match(sourceQfd,/Provisional icons/);
assert.match(css,/#qfdIncidentLegendDetails|\.qfd-incident-key/);
assert.match(shell,/v6-sidebar-refresh-track/);
assert.match(html,/playback-sidebar-hierarchy-v1\.css\?v=original-status-flood-glyph-layers-off-20261017-v2/);
console.log("Radar playback UI hierarchy, persistent terrain, traffic-light key and QFD legend passed.");
