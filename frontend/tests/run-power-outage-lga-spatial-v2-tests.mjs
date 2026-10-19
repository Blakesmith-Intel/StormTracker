import assert from "node:assert/strict";
import {outageGeometrySignature,outageLgaSpatialQuery,
  parseOutageLgaIntersection,resolveLgasForOutageGeometry,
  resolveOutageEventLgas,groupOutagesByVerifiedGeometry}
  from "../src/context-layers/outage-lga-spatial-v2.js";
import {groupOutagesBySuburb} from "../src/context-layers/power-outage-suburb-model-v1.js";

const polygon=(west,south,east,north)=>({
  type:"Polygon",coordinates:[[[west,south],[east,south],[east,north],
    [west,north],[west,south]]]
});
const outage=(id,suburbs,geometry,customers=923)=>({
  type:"Feature",id:"ergon:"+id,geometry,properties:{
    TYPE:"UNPLANNED",EVENT_ID:id,STORMTRACKER_PROVIDER:"Ergon",
    CUSTOMERS_AFFECTED:customers,SUBURBS:suburbs,
    STREETS:"Bridge St, Kenilworth St",STATUS:"Active"
  }
});
const toowoomba=outage("26SW12796",
  "EAST TOOWOOMBA, NEWTOWN, NORTH TOOWOOMBA, TOOWOOMBA CITY, TOOWOOMBA, WARWICK",
  polygon(151.92,-27.62,151.98,-27.53));
const query=outageLgaSpatialQuery(toowoomba);
assert.equal(query.method,"POST");
assert.equal(query.kind,"provider-polygon");
const body=new URLSearchParams(query.body);
assert.equal(body.get("geometryType"),"esriGeometryPolygon");
assert.equal(body.get("spatialRel"),"esriSpatialRelIntersects");
assert.equal(body.get("outFields"),"lga");
assert.deepEqual(JSON.parse(body.get("geometry")).rings,toowoomba.geometry.coordinates);
assert.ok(!outageLgaSpatialQuery({geometry:{type:"LineString",
 coordinates:[[151.9,-27.5],[152,-27.5]]}}));
assert.equal(outageLgaSpatialQuery({geometry:{type:"Point",
 coordinates:[151.95,-27.57]}}).method,"GET");
assert.deepEqual(parseOutageLgaIntersection({features:[{attributes:{
  lga:"Toowoomba Regional"}},{attributes:{lga:"Toowoomba Regional"}}]}),
  ["Toowoomba Regional"]);
assert.deepEqual(parseOutageLgaIntersection({features:[{attributes:{
 lga:"Southern Downs Regional"}},{attributes:{lga:"Toowoomba Regional"}}]}),
  ["Southern Downs Regional","Toowoomba Regional"]);
assert.throws(()=>parseOutageLgaIntersection({error:{message:"fail"}}));
let calls=0;
const providerFetch=async(url,options)=>{
  calls++;
  if(options.method==="POST")assert.equal(url,query.url);
  return {ok:true,json:async()=>({features:[{
    attributes:{lga:"Toowoomba Regional"}}]})};
};
assert.deepEqual(await resolveLgasForOutageGeometry(toowoomba,
 {fetchImpl:providerFetch}),["Toowoomba Regional"]);
const suburbGroups=groupOutagesBySuburb([toowoomba]);
const location=await resolveOutageEventLgas(suburbGroups,
 {fetchImpl:providerFetch});
assert.equal(calls,2);
assert.deepEqual(location.get("ergon:26SW12796").councils,
  ["Toowoomba Regional"]);
const cached=await resolveOutageEventLgas(suburbGroups,
 {existing:location,fetchImpl:providerFetch});
assert.equal(calls,2,"Verified source geometry is queried once, not on each panel refresh");
assert.equal(outageGeometrySignature(toowoomba),
  location.get("ergon:26SW12796").signature);
const officialLocality=new Map([
 ["EAST TOOWOOMBA","Toowoomba Regional"],
 ["NEWTOWN","Toowoomba Regional"],
 ["NORTH TOOWOOMBA","Toowoomba Regional"],
 ["TOOWOOMBA CITY","Toowoomba Regional"],
 ["TOOWOOMBA","Toowoomba Regional"],
 ["WARWICK","Southern Downs Regional"]
]);
let rendered=groupOutagesByVerifiedGeometry(suburbGroups,location,officialLocality);
assert.deepEqual(rendered.groups.map(x=>x.name),["Toowoomba Regional"],
 "Provider Warwick text cannot assign a Toowoomba polygon to Southern Downs");
assert.equal(rendered.unlocated.length,0);
assert.equal(rendered.groups[0].items.length,1);
assert.equal(rendered.groups[0].items[0].summary.customersAffected,923,
  "One incident cannot double its customers by listed locality count");
assert.equal(rendered.groups[0].suburbs.some(s=>s.name==="WARWICK"),false);
assert.deepEqual(rendered.groups[0].items[0].providerLocationConflicts,["WARWICK"]);
const boundaryFailure=groupOutagesByVerifiedGeometry(suburbGroups,
 new Map(),officialLocality);
assert.equal(boundaryFailure.groups.length,0);
assert.equal(boundaryFailure.unlocated.length,1,
 "Missing geometry evidence must not cause a fabricated council assignment");
const cross=outage("CROSS","WARWICK, TOOWOOMBA",
  polygon(151.4,-28.0,152,-27.5),77);
const crossGroups=groupOutagesBySuburb([cross]);
const crossCouncilMap=new Map([["ergon:CROSS",{
 signature:outageGeometrySignature(cross),
 councils:["Toowoomba Regional","Southern Downs Regional"]}]]);
const crossOutput=groupOutagesByVerifiedGeometry(crossGroups,crossCouncilMap,
 officialLocality);
assert.equal(crossOutput.groups.length,2);
assert.equal(crossOutput.groups[0].items.length,1);
assert.equal(crossOutput.groups[1].items.length,1);
assert.ok(crossOutput.groups.find(c=>c.name==="Southern Downs Regional")
  .suburbs.some(s=>s.name==="WARWICK"));
const noCouncilNames=groupOutagesByVerifiedGeometry(suburbGroups,location,
 new Map());
assert.deepEqual(noCouncilNames.groups.map(g=>g.name),["Toowoomba Regional"]);
assert.deepEqual(noCouncilNames.groups[0].suburbs.map(g=>g.name),
 ["Mapped affected area"],"Failed locality query never invents a suburb/council");
console.log("PASS source polygon/LGA intersection, 923-customer Toowoomba vs Warwick, no spurious Southern Downs, cross-council geometry, unlocated safety, query caching.");
