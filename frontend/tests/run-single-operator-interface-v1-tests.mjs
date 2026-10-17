import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const html=read("../live3d-operational-v9.html");
const runtime=read("../src/live3d-operational-v9.js");
const tools=read("../src/friendly-map-tools-v1.js");
const css=read("../src/friendly-ui-v1.css");
const singleCss=read("../src/single-interface-v1.css");
const root=read("../index.html");
const power=read("../src/context-layers/power-outages-operational-v1.js");
const road=read("../src/context-layers/flood-road-closures-operational-v1.js");
const river=read("../src/context-layers/river-gauges-operational-v1.js");
const qfd=read("../src/context-layers/qfd-technical-rescues-operational-v1.js");

assert.match(html,/<body class="simple-ui">/);
assert.doesNotMatch(html,/id="simpleModeToggle"|More options|class="card overview"|class="live-notices"|class="science-toggle"|id="showAdvancedScience"|id="blobVolume"|id="showSevereRadarAlerts"|id="showExperimentalHookAlerts"/);
assert.doesNotMatch(tools,/simpleModeToggle|updateMode|classList\.toggle\("simple-ui"/);
assert.doesNotMatch(runtime,/showAdvancedScience|\$\("blobVolume"\)|showSevereRadarAlerts|showExperimentalHookAlerts/);
assert.doesNotMatch(css,/More options|Advanced view|simpleModeToggle|\:not\(\.river-gauge-row\)/);
assert.match(singleCss,/body\.simple-ui #app/);
assert.match(html,/id="runtimeDiagnostics" hidden aria-hidden="true"/);
assert.ok(html.includes('id="terrainStatus"'));
assert.doesNotMatch(html,/id="terrainEnabled"/);
assert.doesNotMatch(runtime,/terrainControl|\$\("terrainEnabled"\)/);
assert.ok(!html.includes("id=\"refreshPowerOutagesButton\""));
assert.ok(!html.includes("id=\"refreshFloodRoadClosuresButton\""));
assert.ok(!html.includes("id=\"refreshRiverGaugesButton\""));
assert.ok(!html.includes("id=\"refreshQfdTechnicalRescuesButton\""));
for (const adapter of [power,road,river,qfd]) {
 assert.match(adapter,/\?\.addEventListener\(/,
   "removed legacy sidebar Refresh button must never be required to initialise layer");
}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const set=new Set(ids);
assert.equal(ids.length,set.size,"single UI must have unique ids");
for (const [,id] of runtime.matchAll(/\$\("([^"]+)"\)/g))
 assert.ok(set.has(id),"unbound radar control/diagnostic: "+id);
for(const id of [
  "loopDurationMinutes","loadHybridButton","loadButton","hybridPlayButton",
  "jumpLatestButton","hybridFrameSlider","playbackSpeed","status",
  "radarOpacity","volumeOpacity","showTrackLabels","trackDisplayFilter",
  "showTrackThreatCone","openDetailsButton","detailsDialog","basemapSelect",
  "showFloodRoadClosures","showPowerOutages","showRiverGauges",
  "showQfdTechnicalRescues","qfdSymbolLegend","riverGaugeSeverityLegend",
  "openRoadLgaExplorer","openPowerOutageExplorer","sidebarPowerLastRefresh",
  "sidebarRoadLastRefresh","radarSite","multiRadarSelectButton",
  "measureToggle","mapScaleBar","legendDock","terrainStatus",
  "minimumDbzh","occupancyThreshold","verticalScale","pointSize"
]){
 assert.ok(set.has(id),"Missing approved feature control: "+id);
}
assert.match(runtime,/function useBlobVolume\(\)\{ return true; \}/);
assert.match(runtime,/terrainManager\.setEnabled\(true\)/);
assert.doesNotMatch(runtime,/mountHistoricalCycloneQA/);
assert.match(root,/v9-single-operator-ui/);
assert.match(html,/single-interface-v1\.css\?v=single-ui-20261017-v1/);
assert.match(tools,/new Cesium\.CustomDataSource/);
assert.match(tools,/viewer\.camera\.changed\.addEventListener/);
console.log("Single operator UI independent of legacy expanded controls, with core runtime fields grounded.");
