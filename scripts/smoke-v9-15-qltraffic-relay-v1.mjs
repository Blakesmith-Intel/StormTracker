// Live release gate for a safely isolated V9.15 QLDTraffic endpoint.
// Verify current provider records against public published data. Never infer
// a closure from its name, coordinates or weather. Do not log private fields.
import assert from "node:assert/strict";
import {
  isActiveFloodRoadClosure,filterFloodRoadClosures
} from "../frontend/src/context-layers/flood-road-closure-filter-v1.js";

const origin="https://blakesmith-intel.github.io";
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const upstream="https://data.qldtraffic.qld.gov.au/events_v2.geojson";
async function request(url,withOrigin=false){
  const response=await fetch(url,{
    headers:{Accept:"application/json",...(withOrigin?{Origin:origin}:{})},
    signal:AbortSignal.timeout(25000),cache:"no-store"
  });
  if(withOrigin)assert.equal(response.headers.get("access-control-allow-origin"),origin,
    "CORS should allow the existing production/preview Pages origin");
  assert.ok(response.ok,"Unexpected status "+response.status+" from "+new URL(url).pathname);
  const payload=await response.json();
  assert.ok(Array.isArray(payload.features),"Provider must return FeatureCollection");
  return payload;
}
const [oldRoute,newRoute,official]=await Promise.all([
  request(base+"/flood-road-closures",true),
  request(base+"/flood-road-closures-v9-15",true),
  request(upstream)
]);
assert.equal(oldRoute.stormtracker?.filter,"published + flood-related + closures",
  "Production route classification must not be silently changed");
assert.match(newRoute.stormtracker?.filter??"",/all traffic/i);
assert.match(newRoute.stormtracker?.filter??"",/Heavy rain/i);
assert.ok(Number.isFinite(Date.parse(newRoute.stormtracker?.stored_at)),
  "V9.15 source snapshot must have a valid freshness timestamp");
const ageMs=Date.now()-Date.parse(newRoute.stormtracker.stored_at);
assert.ok(ageMs>=-60000&&ageMs<10*60*1000,
  "A stale fallback snapshot must not pass as currently verified");
for(const feature of newRoute.features){
  assert.equal(isActiveFloodRoadClosure(feature),true,
    "Invalid or expired closure unexpectedly included in preview: "+feature.properties?.id);
}
const officialMatches=filterFloodRoadClosures(official).features;
const officialIds=new Set(officialMatches.map(x=>String(x.properties?.id)));
const previewIds=new Set(newRoute.features.map(x=>String(x.properties?.id)));
for(const id of officialIds)assert.ok(previewIds.has(id),
  "QLDTraffic currently publishes valid all-traffic closure omitted by V9.15 relay: "+id);
for(const id of previewIds)assert.ok(officialIds.has(id),
  "V9.15 relay contains a closure missing from the current official QLDTraffic feed: "+id);
const officialLaidley=official.features.find(x=>Number(x.properties?.id)===750590);
if(officialLaidley&&isActiveFloodRoadClosure(officialLaidley)){
  assert.ok(previewIds.has("750590"),"Missing official Laidley Creek West closure 750590");
  console.log("PASS Laidley Creek West Road 750590 preserved from official source");
}else console.log("NOTE Laidley event 750590 not currently eligible in published live source");
console.log("PASS Production route preserved:",oldRoute.features.length,"legacy incidents");
console.log("PASS V9.15 strict route:",newRoute.features.length,"current all-traffic incidents");
console.log("PASS Exact match with official live QLDTraffic classifications:",officialMatches.length,
 "and authorised Pages CORS; no expired or excluded incidents");
