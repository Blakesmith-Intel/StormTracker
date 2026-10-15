import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const basemap=read("../src/context-layers/basemap-manager-v1.js");
const power=read("../src/context-layers/power-outages-operational-v1.js");
const road=read("../src/context-layers/flood-road-closures-operational-v1.js");
const gauge=read("../src/context-layers/river-gauges-operational-v1.js");
const build=read("../../scripts/build-current-site.sh");
const controller=read("../src/live3d-operational-v9.js");
const html=read("../live3d-operational-v9.html");
const index=read("../index.html");
assert.match(index,/live3d-operational-v9\.html\?v=[^"]*regional-satellite-v3/);
assert.match(html,/live3d-operational-v9\.js\?v=[^"]*regional-satellite-v3/);
assert.match(controller,/basemap-manager-v1\.js\?v=[^"]*regional-satellite-coverage-v3/);
for(const part of ["power-outages","flood-road-closures"]){
  assert.match(controller,new RegExp(part+"-operational-v1\\.js\\?v=[^\\\"]*hover-qa-v2"),
    "closure/power hover guard imports must carry fresh cache keys");
}
assert.match(controller,/river-gauges-operational-v1\.js\?v=9\.18\.11-gauge-green-yellow-red-v2/,
  "flood gauge cache key must include latest colours and GPU picking safeguards");


assert.match(basemap,/if\(navigationActive\)return "navigation";/);
assert.match(controller,/persistentSatelliteCoverage:[\s\S]*?\/preview\/next-baseline\//);
assert.match(basemap,/streetLayer\.show=false;/);
assert.match(basemap,/qldDetailLayer\.show=true;qldDetailLayer\.alpha=1;/);
assert.match(basemap,/nswDetailLayer\.show=true;nswDetailLayer\.alpha=1;/);
const nav=basemap.slice(basemap.indexOf("function setNavigationActive("),basemap.indexOf("function setBasemap("));
assert.doesNotMatch(nav,/qldDetailLayer\.show\s*=\s*false|nswDetailLayer\.show\s*=\s*false/);
assert.doesNotMatch(nav,/detailTarget\s*=\s*false|detailBlend\s*=\s*0/,
  "camera motion must never reset visible QLD/NSW imagery or its opacity");
assert.match(nav,/navigationActive=true;/);
assert.match(nav,/navigationActive=false;[\s\S]*?updateForCamera\(\)/,
  "final zoom/detail decision resumes when panning settles");
for(const [name,source] of [["power",power],["road",road],["gauge",gauge]]){
  assert.match(source,/const suppressHoverGpuPicking\s*=\s*\[/);
  assert.ok(source.includes('"/preview/radar-history-fix/"'));
  assert.ok(source.includes('"/preview/next-baseline/"'));
  assert.match(source,/if \(!suppressHoverGpuPicking\)\s*\{/,
    name+" mousemove must not synchronously call Cesium drillPick on QA map gestures");
  assert.match(source,/LEFT_CLICK/,
    name+" must keep explicit marker click interaction functional");
}
assert.match(build,/grep -Fq 'Keep all currently visible satellite layers' "\$candidate\/src\/context-layers\/basemap-manager-v1\.js"/);
assert.doesNotMatch(build,/cp "\$accepted\/src\/context-layers\/basemap-manager-v1\.js" "\$candidate/,
  "candidate deployment must not replace the fixed satellite navigation manager");
assert.doesNotMatch(build,/for filename in power-outages-operational-v1\.js river-gauges-operational-v1\.js flood-road-closures-operational-v1\.js river-gauge-layer-v1\.js basemap-manager-v1\.js;/,
  "candidate deployment must not replace GPU hover guard with the accepted-only version");
console.log("PASS continuous regional satellite imagery while panning, unchanged click picks, disabled repeated hover picks and candidate build source wiring.");
