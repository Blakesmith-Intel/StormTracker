import assert from "node:assert/strict";
import {qldLocalityQueryUrl} from "../frontend/src/context-layers/qld-nearby-localities-v1.js";
import {
  ENERGEX_OUTAGE_AREA_QUERY_URL, ENERGEX_OUTAGE_POINT_QUERY_URL,
  ERGON_OUTAGE_AREA_QUERY_URL, ERGON_OUTAGE_POINT_QUERY_URL
} from "../frontend/src/context-layers/power-outages-v1.js";

// Network smoke runs in GitHub CI, not in a user's browser runtime.
// The real service must allow the deployed GitHub Pages origin.
const origin="https://blakesmith-intel.github.io";
async function check(name,url,requireNonempty=false) {
  const response=await fetch(url,{
    headers:{Origin:origin,Accept:"application/geo+json,application/json"},
    signal:AbortSignal.timeout(23000)
  });
  assert.equal(response.ok,true,`${name} HTTP ${response.status}`);
  const cors=response.headers.get("access-control-allow-origin")??"";
  assert.ok(cors==="*"||cors.includes(origin),
    `${name} does not permit Pages browser CORS: ${cors||"none"}`);
  const data=await response.json();
  assert.ok(!data?.error,`${name} returned ArcGIS error ${JSON.stringify(data.error)}`);
  assert.ok(Array.isArray(data.features),`${name} must return GeoJSON features`);
  if(requireNonempty)assert.ok(data.features.length>0,`${name} returned no known QLD settlements`);
  console.log(`${name}: ${data.features.length} records, browser CORS ${cors}`);
  return data;
}
const limits=url=>{
  const u=new URL(url);u.searchParams.set("resultOffset","0");
  u.searchParams.set("resultRecordCount","15");return u.toString();
};
await check("QLD Gazetteer Birdsville localities",
  qldLocalityQueryUrl({west:139.0,east:140.0,south:-26.5,north:-25.5}),true);
for(const [name,url] of [
  ["Energex outage polygons",ENERGEX_OUTAGE_AREA_QUERY_URL],
  ["Energex outage points",ENERGEX_OUTAGE_POINT_QUERY_URL],
  ["Ergon outage polygons",ERGON_OUTAGE_AREA_QUERY_URL],
  ["Ergon outage points",ERGON_OUTAGE_POINT_QUERY_URL]
]) {
  await check(name,limits(url));
}
console.log("Live-source smoke passed: official QLD localities plus both map geometry layers for each electricity provider, accessible from GitHub Pages.");
