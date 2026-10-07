import assert from "node:assert/strict";
import {
  fetchQueenslandPopulationCentres,
  QUEENSLAND_POPULATION_CENTRES_QUERY_URL
} from "../frontend/src/context-layers/stable-queensland-place-labels-v1.js";

const origin = "https://blakesmith-intel.github.io";
const metadataUrl = QUEENSLAND_POPULATION_CENTRES_QUERY_URL.replace(/\/query$/, "") + "?f=json";
const metaResponse = await fetch(metadataUrl, {
  headers: {Origin:origin},
  signal: AbortSignal.timeout(20000)
});
assert.equal(metaResponse.ok,true,"Queensland Government population-centre layer metadata HTTP failure");
const meta = await metaResponse.json();
assert.equal(meta.name,"Population centres");
assert.equal(meta.geometryType,"esriGeometryPoint");
const names = new Set((meta.fields??[]).map(f=>f.name.toLowerCase()));
for(const field of ["objectid","name","population","upper_scale"]){
  assert.ok(names.has(field),`Missing Queensland place field: ${field}`);
}
const cors = metaResponse.headers.get("access-control-allow-origin") ?? "";
assert.ok(cors === "*" || cors.includes(origin),"Town labels must be fetchable from browser CORS");
const places = await fetchQueenslandPopulationCentres({
  fetchImpl:(url,opts={})=>fetch(url,{
    ...opts,
    headers:{...opts.headers,Origin:origin}
  })
});
const birdsville = places.find(p=>p.name.toLowerCase()==="birdsville");
assert.ok(birdsville,"Birdsville is missing from Queensland population centre data");
assert.ok(birdsville.longitude>139 && birdsville.longitude<140);
assert.ok(birdsville.latitude<-25 && birdsville.latitude>-27);
assert.ok(places.length>150,"Town feed too sparse to support rural Queensland mapping");
console.log(`QLD fixed-labels live smoke passed: ${places.length} named centres; Birdsville (${birdsville.latitude.toFixed(4)}, ${birdsville.longitude.toFixed(4)}); official service CORS available.`);
