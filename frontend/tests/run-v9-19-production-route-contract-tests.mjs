import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const runtime=read("../src/live3d-operational-v9.js");
const radar=read("../src/radar-source.js");
const adaptive=read("../src/adaptive-threat-cone-v1.js");
const basemap=read("../src/context-layers/basemap-manager-v1.js");
const html=read("../live3d-operational-v9.html");
const contexts=[
  "../src/context-layers/power-outages-operational-v1.js",
  "../src/context-layers/flood-road-closures-operational-v1.js",
  "../src/context-layers/river-gauges-operational-v1.js"
];
const prod="/StormTracker/live3d-operational-v9.html";
const qa="/StormTracker/preview/next-baseline/live3d-operational-v9.html";
const oldQa="/StormTracker/preview/radar-history-fix/live3d-operational-v9.html";
const isProd=p=>/\/live3d-operational-v9\.html$/.test(p)&&!p.includes("/preview/");
assert.equal(isProd(prod),true);
assert.equal(isProd("/live3d-operational-v9.html"),true);
assert.equal(isProd(qa),false);
assert.equal(isProd(oldQa),false);
assert.equal(isProd("/StormTracker/"),false);
assert.match(runtime,/const PUBLISHED_PRODUCTION_RUNTIME =\s*\/\\\/live3d-operational-v9\\\.html\$\//,
  "approved production route must be a deliberate condition, not all pages");
assert.match(runtime,/const BOUNDED_RADAR_RECOVERY_QA\s*=\s*PUBLISHED_PRODUCTION_RUNTIME\s*\|\|/,
  "production must inherit the accepted bounded radar/history source discovery");
assert.match(runtime,/const LABEL_GPU_QA\s*=\s*BOUNDED_RADAR_RECOVERY_QA\s*\|\|/,
  "production must preserve deferred Cesium graphics and gazetteer navigation guards");
assert.match(runtime,/persistentSatelliteCoverage:\s*PUBLISHED_PRODUCTION_RUNTIME\s*\|\|/,
  "production must preserve official QLD/NSW satellite presentation");
assert.match(runtime,/shouldPrepareSupplementalForPlayback\(supplementalAnchor\)/,
  "production must not block inferred frames on supplementary radar requests");
assert.match(adaptive,/credibleMeasuredMotionAtObservation/,
  "production must provide the accepted motion-confidence cone safeguard");
assert.match(runtime,/minimumMeasuredReanchorKm:0\.15/,
  "production must preserve the user-approved 0m cone reanchoring");
assert.match(runtime,/sidebarToggle\.addEventListener\("click"/,
  "production must support hide/show sidebar");
assert.match(html,/id="showTrackLabels" type="checkbox"/,
  "labels control must be preserved");
assert.doesNotMatch(html,/id="showTrackLabels"[^>]*\bchecked\b/,
  "labels must be off by default");
assert.match(html,/id="trackLabelsScopeNote"/,
  "primary-radar-only label limitation must be documented in-app");
assert.match(radar,/live3d-operational-v9/,
  "published production must enable rate-limited WMTS requests");
assert.match(radar,/isNetworkGuardPreview/);
// Release inherits GPU-safe hover suppression for each operational marker.
for(const path of contexts){
  const source=read(path);
  assert.match(source,/const suppressHoverGpuPicking\s*=/);
  assert.match(source,/live3d-operational-v9/,
    path+" must guard production pointer-movement Cesium GPU picking");
  assert.match(source,/\/preview\/next-baseline\//,
    path+" must still retain diagnostic preview behavior");
}
assert.match(basemap,/nswRegionalDetailActive/,
  "regional NSW DEA mosaic and closer-scale official aerial remain present");
console.log("PASS v9.19.0 root production route inherits approved preview radar, imagery, GPU, labels, UI and motion safety; older QA routes remain separate.");
