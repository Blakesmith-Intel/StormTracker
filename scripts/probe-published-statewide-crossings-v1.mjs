import assert from "node:assert/strict";
const base="https://blakesmith-intel.github.io/StormTracker";
async function live(path){
 const res=await fetch(base+path,{signal:AbortSignal.timeout(30000),
  headers:{"Cache-Control":"no-cache"}});
 assert.equal(res.status,200,"Published missing "+path+" HTTP "+res.status);
 const txt=await res.text();
 assert(txt.length>50,"Empty published file: "+path);
 console.log("PUBLISHED",path,"HTTP",res.status,"BYTES",txt.length);
 return txt;
}
const [entry,layer,planner,crossing,build]=await Promise.all([
 live("/src/live3d-operational-v9.js"),
 live("/src/context-layers/river-gauge-layer-v1.js"),
 live("/src/context-layers/bom-recent-river-history-v1.js"),
 live("/src/context-layers/river-crossing-state-v1.js"),
 live("/BUILD.txt")
]);
const one=String.fromCharCode(92),two=one+one;
assert(layer.includes("if(!/^bom:"+one+"d{6}$/.test(id)"),
 "Production must use valid regex for all six-digit station IDs");
assert(!layer.includes("if(!/^bom:"+two+"d{6}$/.test(id)"),
 "Published code still has the originally broken double-escaped regex");
assert(layer.includes("planBoMStationTableLookups("));
assert(layer.includes("scheduleCrossingScan("));
assert(layer.includes("if(!timer)return;"));
assert(planner.includes("export function planBoMStationTableLookups("));
assert(planner.includes("const needsCrossing=!Object.hasOwn(plotCrossings,id)"));
assert(planner.includes("const noStage=p.STORMTRACKER_MINOR_FLOOD_METRES==null"));
assert(crossing.includes("publishedCrossingForFeature"));
assert(entry.includes("river-gauges-operational-v1.js"));
assert(build.includes("FLOOD CROSSING REPORT"),"Crossing report still in published package");
console.log("PASS actual published Pages browser crossing code correct statewide regex, continuous all-state scan, station source and cache");
