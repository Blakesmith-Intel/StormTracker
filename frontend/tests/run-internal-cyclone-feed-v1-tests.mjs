import assert from "node:assert/strict";
import { INTERNAL_CYCLONE_FEED_SCHEMA, validateInternalCycloneSnapshot }
  from "../src/internal-cyclone-feed-v1.js";

const NOW = "2026-10-17T04:00:00Z";
const issued = "2026-10-17T03:00:00Z";
const baseUtc = "2026-10-17T02:00:00Z";
const original = {
  type: "FeatureCollection",
  properties: {
    publisher: "Bureau of Meteorology", systemId: "SYNTHETIC-ONLY",
    systemName: "FAKE STORM", productId: "IDQ65248",
    issuedUtc: issued, forecastBaseUtc: baseUtc
  },
  features: [
    {type:"Feature",properties:{role:"forecast_fix",
      validUtc:"2026-10-17T11:00:00Z",category:1,timeOffset:"9"},
     geometry:{type:"Point",coordinates:[150,-20]}},
    {type:"Feature",properties:{role:"uncertainty_area",
      areaType:"Likely Tracks Area",extent:"Up to 72 hours"},
     geometry:{type:"Polygon",coordinates:[
      [[149,-19],[151,-19],[151,-21],[149,-19]]]}},
    {type:"Feature",properties:{role:"source_issued_wind_area"},
     geometry:{type:"Polygon",coordinates:[
      [[149,-19],[152,-19],[152,-22],[149,-19]]]}}
  ]
};
const source = {
  productId:"IDQ65248",systemId:"SYNTHETIC-ONLY",name:"FAKE STORM",
  issueUtc:issued,expiresUtc:"2026-10-17T15:00:00Z",
  sourceSha256:"a".repeat(64),
  sourceUrl:"ftp://ftp.bom.gov.au/anon/gen/fwo/IDQ65248.gml",
  forecast: original
};
const template = {
 schema:INTERNAL_CYCLONE_FEED_SCHEMA,status:"active",
 generatedUtc:NOW,complete:true,products:[source]
};
const clone = () => JSON.parse(JSON.stringify(template));
const check = v => validateInternalCycloneSnapshot(v,{nowUtc:NOW});
const active = check(clone());
assert.equal(active.status,"active");
assert.equal(active.storms.length,1);
assert.equal(active.storms[0].features.length,2,
  "Source wind and warning areas must remain distinct from the forecast cone");
assert.equal(active.storms[0].features[1].areaKey,"72");
assert.deepEqual(active.storms[0].features[1].geometry.coordinates,
  original.features[1].geometry.coordinates,"Never modify actual source vertices");
assert.equal(active.storms[0].features[0].leadHours,9);
const empty = {...template,status:"no-active-products",products:[]};
assert.equal(check(empty).status,"no-active-products");
assert.equal(check({...empty,status:"source-unavailable"}).status,"unavailable");
assert.equal(check({...empty,complete:false}).status,"unavailable");
assert.equal(check({...template,complete:false}).status,"active-partial");
for(const mutate of [
 v=>v.generatedUtc="2026-10-16T00:00:00Z",
 v=>v.products[0].expiresUtc="2026-10-17T03:59:59Z",
 v=>v.products[0].sourceUrl="https://evil.example/cyclone",
 v=>v.products[0].forecast.properties.productId="IDQ65249",
 v=>v.products[0].forecast.features[0].geometry.coordinates=[150,-200],
 v=>v.products[0].forecast.features[1].properties.areaType="FAKE CIRCLE",
 v=>v.products[0].forecast.features[1].geometry.coordinates[0].pop(),
 v=>v.products[0].issueUtc="2026-10-18T03:00:00Z",
 v=>v.products.push(v.products[0]),
 ]) {
 const v=clone();mutate(v);
 assert.equal(check(v).status,"unavailable","Reject bad, duplicated or stale BoM source");
}
assert.throws(()=>validateInternalCycloneSnapshot(clone(), {nowUtc:"invalid"}),TypeError);
console.log("PASS internal cyclone browser contract: source identity, expiry, exact original uncertainty, no invented areas and distinct source outages.");
