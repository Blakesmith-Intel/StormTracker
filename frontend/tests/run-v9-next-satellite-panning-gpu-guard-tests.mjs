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
assert.match(index,/live3d-operational-v9\.html\?v=[^"]*nsw-regional-dea-v5/);
assert.match(html,/live3d-operational-v9\.js\?v=[^"]*nsw-regional-dea-v5/);
assert.match(controller,/basemap-manager-v1\.js\?v=[^"]*global-satellite-blue-gap-20261016-v1/);
assert.ok(controller.includes("power-outages-operational-v1.js?v=council-customers-20261017-v1"),
  "current outage adapter must retain the new isolated explorer integration");
assert.ok(controller.includes("flood-road-closures-operational-v1.js?v=sidebar-refresh-track-20261017-v1"),
  "existing closure GPU hover guard cache key must remain current");
assert.match(power,/suppressHoverGpuPicking/,
  "underlying power polygon hover GPU safeguard remains unchanged");
assert.match(controller,/river-gauges-operational-v1\.js\?v=9\.18\.11-gauge-green-yellow-red-v2/,
  "flood gauge cache key must include latest colours and GPU picking safeguards");


assert.match(basemap,/if\(navigationActive\)return "navigation";/);
assert.match(controller,/persistentSatelliteCoverage:[\s\S]*?\/preview\/next-baseline\//);
assert.match(basemap,/streetLayer\.show=true;/,
  "Do not hide the persistent global satellite underlay beneath missing DEA tiles");
assert.match(basemap,/createGlobalSatelliteFallbackProvider\(Cesium\)/);
assert.match(basemap,/GLOBAL_SATELLITE_FALLBACK/);
assert.match(basemap,/qldDetailLayer\.show=true;qldDetailLayer\.alpha=1;/);
assert.match(basemap,/nswDetailLayer\.show=false;nswDetailLayer\.alpha=1;/,
  "regional NSW must stay on uniform DEA rather than a forced mixed-age aerial mosaic");
assert.match(basemap,/const nextNswDetailed=chooseDetailForScale\(nswRegionalDetailActive/,
  "NSW aerial photos appear only when zoom justifies their native resolution");
assert.match(basemap,/cameraChangeUnlisten=scene\.camera\.changed\.addEventListener\(updateForCamera\)/,
  "NSW imagery switches via lightweight camera events, not per-frame GPU polling");
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
assert.match(build,/production="checked\/production-v9\.(?:19\.0|20\.[012])\/frontend"/,
  "the public site must copy an exact pinned, validated release source");
assert.match(build,/grep -Fq 'PUBLISHED_PRODUCTION_RUNTIME' "_site\/src\/live3d-operational-v9\.js"/,
  "published production must preserve preview safety behavior");
assert.match(build,/grep -Fq 'persistentSatelliteCoverage:' "_site\/src\/live3d-operational-v9\.js"/,
  "satellite continuation must be part of the sealed root");
assert.doesNotMatch(build,/candidate="_site\/preview\/next-baseline"/,
  "old mutable next-baseline preview is retired when production is sealed");
assert.match(build,/grep -Fq 'const suppressHoverGpuPicking' "_site\/src\/context-layers\/power-outages-operational-v1\.js"/);
assert.match(build,/grep -Fq 'const suppressHoverGpuPicking' "_site\/src\/context-layers\/flood-road-closures-operational-v1\.js"/);
assert.match(build,/grep -Fq 'const suppressHoverGpuPicking' "_site\/src\/context-layers\/river-gauges-operational-v1\.js"/);
console.log("PASS QLD/NSW satellite continuity, GPU-safe click interactions and exact pinned release source-based production build.");
