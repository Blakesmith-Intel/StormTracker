import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const read=path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const basemap=read("../src/context-layers/basemap-manager-v1.js");
const power=read("../src/context-layers/power-outages-operational-v1.js");
const road=read("../src/context-layers/flood-road-closures-operational-v1.js");
const gauge=read("../src/context-layers/river-gauges-operational-v1.js");
const build=read("../../scripts/build-current-site.sh");

assert.match(basemap,/if\(navigationActive\)return "navigation";/);
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
