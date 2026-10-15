import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {supplementalObservedAnchor} from "../src/supplemental-observed-anchor-v1.js";
const source=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
const html=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
const css=readFileSync(fileURLToPath(new URL("../src/operational-dashboard-v9-1.css",import.meta.url)),"utf8");
const utc=n=>new Date(Date.parse("2026-10-15T00:00:00Z")+n*60000).toISOString();
const obs=(minute,region="66")=>({observedUtc:utc(minute),
  sourceMetadata:{region}});
const inferred=(minute,region="66")=>({observedUtc:utc(minute),
  sourceMetadata:{region,temporalInference:{method:"category-interpolation"}}});
const frames=[obs(0),inferred(5),inferred(10),obs(15),inferred(20)];
assert.deepEqual(supplementalObservedAnchor(frames[1],frames),
  {observedUtc:utc(0),held:true,ageMinutes:5},
  "first inferred display frame holds genuine preceding BoM observation");
assert.deepEqual(supplementalObservedAnchor(frames[2],frames),
  {observedUtc:utc(0),held:true,ageMinutes:10},
  "consecutive inferred steps do not clear supplementary images");
assert.deepEqual(supplementalObservedAnchor(frames[3],frames),
  {observedUtc:utc(15),held:false,ageMinutes:0},
  "next genuine scan resumes atomic multi-radar replacement");
assert.deepEqual(supplementalObservedAnchor(frames[4],frames),
  {observedUtc:utc(15),held:true,ageMinutes:5});
assert.equal(supplementalObservedAnchor(inferred(17),[obs(0),inferred(17)]),null,
  "no stale supplementary radar is shown past the bounded 15m gap");
assert.equal(supplementalObservedAnchor(inferred(5),[obs(0,"50")]),null,
  "different radar region cannot become the primary site's timestamp anchor");
assert.equal(supplementalObservedAnchor(inferred(5),[obs(10)]),null,
  "future measurements cannot leak backwards in playback");
assert.equal(supplementalObservedAnchor(inferred(5),[]),null,
  "inferred frame cannot create a fake measurement without source evidence");
assert.equal(supplementalObservedAnchor(null,frames),null);
assert.equal(supplementalObservedAnchor(frames[2],frames,5),null,
  "maximum hold threshold can be lowered");
assert.match(source,/function supplementalAnchorForFrame\(frame\)/);
assert.match(source,/supplementalObservedAnchor\(frame,hybridFrames,15\)/);
assert.match(source,/supplementalRadarDisplay\.prepare\(supplementalAnchor\.observedUtc\)/,
  "primary playback stages a real supplemental observation even for inferred frames");
assert.match(source,/supplementalRadarDisplay\.commit\(supplementalAnchor\.observedUtc/,
  "primary image reveal does not push inferred UTC into additional site images");
assert.doesNotMatch(source,/frame\.sourceMetadata\?\.temporalInference \|\| isNativeDopplerPlayback\(\)/,
  "inferred source mode no longer resets all selected secondary radars");
assert.match(source,/latestFrame===frame && !isNativeDopplerPlayback\(\)/,
  "paused site selection commits only when the same displayed frame is active");
assert.match(source,/displaySupplementalHoldStatus\(supplementalAnchor\)/);
assert.match(html,/<aside id="controlSidebar"/);
assert.match(html,/id="sidebarToggle"[^>]+aria-controls="controlSidebar"/);
assert.match(html,/id="supplementalHoldNote"[^>]+hidden/);
assert.match(source,/sidebarToggle\.addEventListener\("click"/);
assert.match(source,/viewer\.resize\(\);scene\.requestRender\(\)/,
  "sidebar width change must resize the Cesium canvas rather than reset view");
assert.match(css,/#app\.sidebar-collapsed\s*\{/);
assert.match(css,/#app\.sidebar-collapsed > #controlSidebar\s*\{display:none!important;\}/);
assert.match(css,/@media\(max-width:700px\)\s*\{\s*#app\.sidebar-collapsed/,
  "full-map toggle must override normal stacked mobile layout");
assert.match(source,/reissueOnObservedExit:true, observedExitMarginKm:0\.5/,
  "cone breach fix must ship together with the next-baseline candidate");
console.log("PASS inferred supplemental hold uses only genuine source stamps with 15-minute bound; atomic playback and paused selection; restored map-width controls; included cone breach.");
