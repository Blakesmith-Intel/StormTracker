import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const css=read("../src/operational-dashboard-v9-1.css");
const labels=read("../src/context-layers/qld-town-label-layer-v1.js");
const runtime=read("../src/live3d-operational-v9.js");
const html=read("../live3d-operational-v9.html");
// This is a permanent layering CONTRACT, not an accidental z-index in a
// particular screenshot. Future map imagery belongs inside the isolated
// Cesium scene; no weather data entity can cover geographic labels.
assert.match(css,/#mapPanel\s*\{[^}]*isolation:isolate;/);
assert.match(css,/#cesiumContainer\s*\{[^}]*z-index:0;isolation:isolate;/);
assert.match(css,/--stormtracker-geo-label-z:2000;/);
assert.match(css,/--stormtracker-control-z:3000;/);
assert.match(css,/\.qld-place-foreground\s*\{[^}]*z-index:var\(--stormtracker-geo-label-z\)/);
assert.match(css,/#nav\s*\{[^}]*z-index:var\(--stormtracker-control-z\)/);
assert.match(css,/#cesiumCredits\s*\{[^}]*z-index:var\(--stormtracker-control-z\)/);
assert.match(css,/\.map-info-card\s*\{[^}]*z-index:var\(--stormtracker-control-z\)/);
assert.match(labels,/container\.appendChild\(root\)/);
assert.match(labels,/root\.className="qld-place-foreground"/);
assert.match(runtime,/container: document\.getElementById\("mapPanel"\)/);
assert.match(css,/\.qld-place-foreground\s*\{[^}]*pointer-events:none/);
assert.match(html,/operational-dashboard-v9-1\.css\?v=9\.16\.13-top-geography/);
console.log("PASS permanent foreground labels above Cesium and future weather layers with clickable UI/attribution reserved higher.");
