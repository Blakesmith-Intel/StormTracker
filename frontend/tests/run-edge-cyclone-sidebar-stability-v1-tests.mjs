import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
// Source-level layout invariant protects all window sizes and Edge's
// dynamic historical/diagnostics controls without changing the renderer.
const css=readFileSync(new URL("../src/operational-dashboard-v9-1.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const shell=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const overlay=readFileSync(new URL("../src/historical-cyclone-overlay-v1.js",import.meta.url),"utf8");
const block=css.slice(css.indexOf("/* Edge/Chromium viewport-robust operational sidebar"));
assert.ok(block.startsWith("/* Edge/Chromium viewport-robust"));
assert.match(block,/#app\s*\{[^}]*height:100dvh;[^}]*max-height:100dvh;/s);
assert.match(block,/#controlSidebar\s*\{[^}]*height:100%;[^}]*max-height:100%;/s);
assert.match(block,/#controlSidebar\s*\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;/s);
assert.match(block,/#controlSidebar\s*>\s*\*\s*\{[^}]*max-width:100%;/s);
assert.match(block,/@media \(max-width:700px\)[\s\S]*?grid-template-rows:minmax\(0,42dvh\) minmax\(0,1fr\)/);
assert.match(block,/@media \(max-width:430px\)[\s\S]*?grid-template-rows:minmax\(0,40dvh\) minmax\(0,1fr\)/);
assert.match(block,/@media \(max-height:760px\) and \(min-width:701px\)[\s\S]*?grid-template-rows:minmax\(0,42dvh\) minmax\(0,1fr\)/);
assert.match(block,/#historicalCycloneQaPanel,#memoryQaPanel\s*\{\s*grid-column:1 \/ -1;\s*grid-row:auto;/);
assert.match(html,/operational-dashboard-v9-1\.css\?v=[^"]*edge-sidebar-terrainfix-v1/);
assert.match(html,/live3d-operational-v9\.js\?v=[^"]*edge-sidebar-terrainfix-v1/);
assert.match(shell,/live3d-operational-v9\.html\?v=[^"]*edge-sidebar-terrainfix-v1/);
assert.doesNotMatch(overlay,/outline:true,outlineColor:/,
  "Terrain-clamped polygon fill must NOT request unsupported built-in outlines");
assert.match(overlay,/clampToGround:true[\s\S]*?material:fill\.withAlpha\(0\.95\)/);
assert.match(overlay,/const activeEntities=new Map\(\)/);
assert.match(overlay,/sourceGeometryCache\.get\(area\)/);
assert.match(overlay,/retireStale\(needed\)/);
console.log("PASS Edge viewport-bounded scrollable sidebar at tall/short/mobile dimensions; source-exact terrain borders and stable cyclone geometry.");
