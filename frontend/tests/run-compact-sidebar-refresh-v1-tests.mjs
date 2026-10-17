import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {formatIncidentRefreshTime} from "../src/context-layers/incident-refreshed-time-v1.js";

const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const html=read("../live3d-operational-v9.html");
const css=read("../src/sidebar-compact-refresh-v1.css");
const controller=read("../src/live3d-operational-v9.js");
const power=read("../src/context-layers/power-outage-suburb-explorer-v1.js");
const road=read("../src/context-layers/road-closure-lga-explorer-v1.js");
const powerLayer=read("../src/context-layers/power-outages-v1.js");
const roadLayer=read("../src/context-layers/flood-road-closures-v1.js");
const powerRuntime=read("../src/context-layers/power-outages-operational-v1.js");
const roadRuntime=read("../src/context-layers/flood-road-closures-operational-v1.js");
const entry=read("../index.html");

assert.equal(formatIncidentRefreshTime(0),"Not checked yet");
assert.equal(formatIncidentRefreshTime(0,{failed:true}),"Refresh unavailable");
assert.equal(formatIncidentRefreshTime(Date.parse("2026-10-17T00:45:00Z")),
  "Last refreshed 10:45 AEST");
assert.equal(formatIncidentRefreshTime(Date.parse("2026-10-17T00:45:00Z"),{failed:true}),
  "Refresh failed · last successful 10:45 AEST");
assert.equal(formatIncidentRefreshTime(Date.parse("2026-10-17T00:45:00Z"),{failed:true,expired:true}),
  "Data expired · last successful 10:45 AEST");
assert.equal((html.match(/id="radarClockGroup"/g)||[]).length,0);
assert.doesNotMatch(html,/id="radarPlaybackTime"/);
assert.doesNotMatch(css,/radarClockGroup/);
assert.doesNotMatch(controller,/radarClockGroup|radarPlaybackTime/);
assert.match(html, /id="windClockGroup" hidden/);
assert.match(html, /id="status" class="radar-playback-status"/);
assert.equal((html.match(/id="status"/g)||[]).length,1);
const storm=html.slice(html.indexOf('<section class="card storm-controls"'),html.indexOf('<section class="card layer-controls"'));
for(const id of ["showTrackLabels","trackDisplayFilter","showTrackThreatCone",
  "trackThreatConeStatus","trackLabelsScopeNote","openDetailsButton"]){
 assert.ok(storm.includes('id="'+id+'"'),"Missing storm control "+id);
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
}
assert.match(storm, /class="storm-main-row"/);
assert.match(storm, /class="storm-scope-help"/);
assert.match(css, /grid-template-columns:minmax\(0,1fr\) auto!important/);
assert.match(css, /max-height:100dvh/);
assert.match(css, /overscroll-behavior:contain/);
assert.match(html, /id="sidebarPowerLastRefresh"/);
assert.match(html, /id="sidebarRoadLastRefresh"/);
assert.match(power, /formatIncidentRefreshTime\(ms,\{failed,expired\}\)/);
assert.match(road, /formatIncidentRefreshTime\(ms,\{failed,expired\}\)/);
assert.match(power, /lastSuccessfulAt=checkedAt/);
assert.match(road, /lastSuccessfulAt=checkedAt/);
for(const s of [powerLayer,roadLayer]){
 assert.match(s, /refreshWhileHidden = false/);
 assert.match(s, /refresh\(\{force:refreshWhileHidden\}\)/);
 assert.match(s, /dataSource.show \|\| refreshWhileHidden/);
 assert.match(s, /!dataSource.show/); // does not change visibility
}
assert.match(powerRuntime, /refreshWhileHidden: true/);
assert.match(roadRuntime, /refreshWhileHidden: true/);
for(const id of ["showPowerOutages","showFloodRoadClosures"]){
 assert.match(html,new RegExp('id="'+id+'" type="checkbox"'));
 assert.doesNotMatch(html,new RegExp('id="'+id+'" type="checkbox" checked'));
}
assert.match(controller, /DEFAULT_OFF_LAYER_IDS/);
assert.match(entry, /v8-council-customers/);
console.log("Compact sidebar, original-clock visibility and live-source refresh stamps passed.");
