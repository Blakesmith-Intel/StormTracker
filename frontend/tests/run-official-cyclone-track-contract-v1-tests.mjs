import assert from "node:assert/strict";
import {
  BOM_CYCLONE_GML_PRODUCTS,BOM_CYCLONE_ROLES,
  isOfficialCycloneGeometry,validateOfficialCycloneTrackProduct
} from "../src/official-cyclone-track-contract-v1.js";
assert.ok(BOM_CYCLONE_GML_PRODUCTS.includes("IDQ65248"));
assert.ok(BOM_CYCLONE_GML_PRODUCTS.includes("IDQ65252"));
const now="2026-10-16T10:00:00Z";
const line=[[149,-15],[150,-16],[151,-17]];
const cone=[[[149,-15],[153,-15],[153,-18],[149,-18],[149,-15]]];
const base={
 type:"FeatureCollection",
 properties:{
   publisher:"Bureau of Meteorology",
   productId:"IDQ65248",
   issuedUtc:"2026-10-16T09:00:00Z",
   bulletinUrl:"https://www.bom.gov.au/warnings/"
 },
 features:[
   {type:"Feature",id:"test-source-1",properties:{
     systemId:"test-storm",name:"TEST FIXTURE — NOT A REAL CYCLONE",
     role:"observed_track"
   },geometry:{type:"LineString",coordinates:line}},
   {type:"Feature",id:"test-source-2",properties:{
     systemId:"test-storm",name:"TEST FIXTURE — NOT A REAL CYCLONE",
     role:"forecast_track",validUtc:"2026-10-17T12:00:00Z"
   },geometry:{type:"LineString",coordinates:line}},
   {type:"Feature",id:"test-source-3",properties:{
     systemId:"test-storm",role:"uncertainty_area"
   },geometry:{type:"Polygon",coordinates:cone}},
   {type:"Feature",id:"test-source-4",properties:{
     systemId:"test-storm",role:"watch_area",
     expiresUtc:"2026-10-16T11:00:00Z"
   },geometry:{type:"Polygon",coordinates:cone}},
   {type:"Feature",id:"test-source-5",properties:{
     systemId:"test-storm",role:"warning_area",
     expiresUtc:"2026-10-16T09:30:00Z"
   },geometry:{type:"Polygon",coordinates:cone}}
 ]
};
const clone=()=>JSON.parse(JSON.stringify(base));
const valid=validateOfficialCycloneTrackProduct(base,{nowUtc:now});
assert.equal(valid.status,"active");
assert.equal(valid.productId,"IDQ65248");
assert.equal(valid.features.length,4,"Expired official warning polygon omitted");
assert.equal(valid.features[0].geometry.coordinates,line);
assert.equal(valid.features[1].validUtc,"2026-10-17T12:00:00Z");
assert.equal(valid.features[2].role,"uncertainty_area");
assert.ok(valid.features.every(f=>f.bulletinUrl==="https://www.bom.gov.au/warnings/"));
const bad=clone();bad.properties.issuedUtc="2026-10-15T00:00:00Z";
assert.equal(validateOfficialCycloneTrackProduct(bad,{nowUtc:now}).status,"unavailable",
  "Never show stale official cyclone track as current");
for(const [mutate,why] of [
 [f=>f.properties.productId="IDQ00000","unknown product"],
 [f=>f.properties.publisher="Research University","unverified publisher"],
 [f=>f.properties.bulletinUrl="https://example.com/warning","unofficial link"],
 [f=>f.features[0].geometry.coordinates=[[150,-100],[152,-10]],"invalid latitude"],
 [f=>f.features[0].properties.role="forecast_fix","wrong geometry for role"],
 [f=>f.features[0].properties.category=10,"bad category"],
 [f=>f.features[1].properties.validUtc="2026-10-29T00:00:00Z","fake extended forecast"],
 [f=>f.features[1].id=f.features[0].id,"duplicate feature"],
 [f=>f.features[0].properties.systemId="","no system ID"],
 ]){const test=clone();mutate(test);assert.equal(
 validateOfficialCycloneTrackProduct(test,{nowUtc:now}).status,"unavailable",why);}
const empty=clone();empty.features=[];
assert.equal(validateOfficialCycloneTrackProduct(empty,{nowUtc:now}).status,"no-active-products");
assert.equal(validateOfficialCycloneTrackProduct(null,{nowUtc:now}).status,"unavailable");
assert.throws(()=>validateOfficialCycloneTrackProduct(base,{}),TypeError);
assert.equal(isOfficialCycloneGeometry({type:"Polygon",coordinates:cone},"uncertainty_area"),true);
assert.equal(isOfficialCycloneGeometry({type:"Polygon",coordinates:cone},"forecast_fix"),false);
assert.ok(BOM_CYCLONE_ROLES.includes("gale_wind_area"));
console.log("PASS no invented cyclone track or forecast cone: authentic product/issue/UTC, geometry, role, expiry, source bulletin, category and stale removal.");
