import assert from "node:assert/strict";
import {
  capPolygonToGeoJSON,validateOfficialThunderstormWarningProduct
} from "../src/official-thunderstorm-warning-geometry-v1.js";
// Synthetic CAP geometry is a TEST FIXTURE ONLY, not a real warning.
const area=capPolygonToGeoJSON("-27.5,153.0 -27.6,153.1 -27.7,152.9 -27.5,153.0");
assert.deepEqual(area.coordinates[0][0],[153,-27.5],
  "CAP latitude,longitude converted only by coordinate order");
assert.equal(area.coordinates[0].length,4);
assert.deepEqual(area.coordinates[0].at(-1),area.coordinates[0][0]);
const open=capPolygonToGeoJSON("-28,153 -28,154 -29,154");
assert.equal(open.coordinates[0].length,4,"Close topology without inventing a radius");
for(const bad of [
  "99,153 -28,154 -29,155",
  "-28,181 -28,154 -29,155",
  "not a polygon",
  "-28,153 -28,153 -28,153",
  "-28,153 -28,154"
])assert.throws(()=>capPolygonToGeoJSON(bad));
const now="2026-10-16T10:00:00Z";
const sample={
 identifier:"TEST-FIXTURE-QLD",
 issuer:"Bureau of Meteorology",
 state:"QLD",
 event:"Severe Thunderstorm Warning",
 productType:"detailed",
 issuedUtc:"2026-10-16T09:15:00Z",
 expiresUtc:"2026-10-16T12:30:00Z",
 bulletinUrl:"https://www.bom.gov.au/warnings/",
 geometry:area
};
assert.deepEqual(
 Object.keys(validateOfficialThunderstormWarningProduct(sample,{nowUtc:now}))
   .filter(x=>x==="status"),
 ["status"]
);
const valid=validateOfficialThunderstormWarningProduct(sample,{nowUtc:now});
assert.equal(valid.status,"active");
assert.equal(valid.geometry,area,"Original source shape must remain intact");
assert.equal(valid.productType,"detailed");
assert.equal(valid.officialWarning,true);
assert.equal(valid.historical,false);
assert.equal(valid.geometryWasSourceSupplied,true);
const mutate=(key,value)=>({...sample,[key]:value});
for(const [source,reason] of [
 [mutate("issuer","Queensland Fire Department"),"not BoM"],
 [mutate("event","Cyclone Wind Area"),"not thunderstorm"],
 [mutate("productType","invented-cell"),"not verified regional/detailed"],
 [mutate("expiresUtc","2026-10-16T09:59:59Z"),"expired"],
 [mutate("issuedUtc","2026-10-17T01:00:00Z"),"future source issue"],
 [mutate("bulletinUrl","https://example.com/fake-warning"),"not BoM link"],
 [mutate("geometry",null),"cannot invent polygons"]
]){
 const v=validateOfficialThunderstormWarningProduct(source,{nowUtc:now});
 assert.equal(v.status,"unavailable",reason);
}
const nsw=mutate("state","NSW");
assert.equal(validateOfficialThunderstormWarningProduct(nsw,{nowUtc:now}).status,"unavailable",
  "Never display a NSW warning unless clipped to installed radar coverage");
assert.equal(validateOfficialThunderstormWarningProduct(nsw,{nowUtc:now,
 nswRadarCoverageClipper:()=>null}).status,"unavailable");
const clipped={type:"Polygon",coordinates:[
 [[153,-29],[153.1,-29],[153.1,-29.1],[153,-29]]
]};
const within=validateOfficialThunderstormWarningProduct(nsw,{nowUtc:now,
 nswRadarCoverageClipper:()=>clipped});
assert.equal(within.status,"active");
assert.equal(within.geometry,clipped);
assert.throws(()=>validateOfficialThunderstormWarningProduct(sample,{}),TypeError);
console.log("PASS source-only BoM warning geometry, CAP polygon orientation/vertices, no stale/unverified storms and mandatory NSW radar coverage clip.");
