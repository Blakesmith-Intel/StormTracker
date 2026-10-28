import assert from "node:assert/strict";
import {sourceExactQldBomWfsFeatures,fetchQldBomWfsGeometry,QLD_BOM_GIS_WARNING_REPLICA}
 from "../../relay/bom-warning-gis2web-replica-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";
import {warningContainsPoint} from "../src/context-layers/bom-warning-terrain-imagery-v1.js";
import {boundaryIntersectionRequest} from "../../relay/bom-warning-polygons-v1.js";
const from=Date.parse("2026-10-28T09:45:52Z");
const to=Date.parse("2026-10-28T12:45:52Z");
const now=Date.parse("2026-10-28T11:53:00Z");
const issue={productCode:"IDQ21033",issuedUtc:new Date(from).toISOString(),
 expiresUtc:new Date(to).toISOString(),status:"issued",
 headline:"Severe Thunderstorm Warning for Central Coast and Whitsundays, Capricornia and Central Highlands and Coalfields",
 description:"Damaging winds and heavy rain",instruction:"Monitor the BoM warnings",
 areaDescription:"Central Coast and Whitsundays, Capricornia",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033"};
const ring=[[149.4,-21.5],[149.6,-21.5],[149.6,-21.7],[149.4,-21.7],[149.4,-21.5]];
const row=(product="IDQ65654",time=from,expiry=to,id=1)=>({
 type:"Feature",id,properties:{OBJECTID:id,product,validfrom_utc:time,
 validto_utc:expiry,phenomena:"Damaging Winds, Heavy Rain",warning:"STW"},
 geometry:{type:"Polygon",coordinates:[ring]}
});
const collection={type:"FeatureCollection",features:[row(),row("IDQ65654",from,to,2),
 row("IDQ65650",from,to,3),row("IDQ65654",from-3600000,to,4),
 row("IDQ65654",from,to-3600000,5)]};
const data=sourceExactQldBomWfsFeatures(collection,issue,{nowMs:now});
assert.equal(data.length,2,"Only source-exact product issue expiry and valid polygon survive");
assert.equal(data[0].productCode,"IDQ21033");
assert.equal(data[0].sourceProduct,"IDQ65654");
assert.equal(data[0].issuedUtc,issue.issuedUtc);
assert.equal(data[0].expiresUtc,issue.expiresUtc);
assert.equal(data[0].geometry.type,"Polygon");
assert(warningContainsPoint(data[0].geometry,149.5,-21.6));
assert(!warningContainsPoint(data[0].geometry,150,-21.6));
assert.match(data[0].warningGeometrySource,/GIS2Web/);
const query=boundaryIntersectionRequest(data[0].geometry,"https://government.example/query","lga");
const params=new URLSearchParams(query.form);
assert.equal(params.get("spatialRel"),"esriSpatialRelIntersects");
assert.equal(params.get("inSR"),"4326");
assert(!params.has("minArea")&&!params.has("maxAllowableOffset"));
const state=reconcileLatestBoMWarnings([{notice:issue,warnings:data}],{nowMs:now});
assert.equal(state.products.IDQ21033.status,"active");
assert.equal(state.products.IDQ21033.count,2);
assert.equal(state.warnings.length,2);
assert.equal(state.products.IDQ21035.status,"no-active");
const changed={...issue,status:"cancelled",issuedUtc:new Date(from+600000).toISOString()};
const cancelled=reconcileLatestBoMWarnings([{notice:issue,warnings:data},{notice:changed,warnings:[]}],{nowMs:now});
assert.equal(cancelled.products.IDQ21033.status,"cancelled");
assert.equal(cancelled.warnings.length,0);
assert.equal(sourceExactQldBomWfsFeatures(collection,{...issue,issuedUtc:new Date(from+600000).toISOString()},{nowMs:now}).length,0);
assert.equal(sourceExactQldBomWfsFeatures(collection,{...issue,status:"cancelled"},{nowMs:now}).length,0);
assert.equal(sourceExactQldBomWfsFeatures(collection,issue,{nowMs:to}).length,0);
const bad={type:"FeatureCollection",features:[row()]};
bad.features[0].geometry.coordinates=[[[179,-21],[180,-22],[181,-23],[179,-21]]];
assert.equal(sourceExactQldBomWfsFeatures(bad,issue,{nowMs:now}).length,0);
assert.throws(()=>sourceExactQldBomWfsFeatures({error:{code:400}},issue,{nowMs:now}));
assert.throws(()=>sourceExactQldBomWfsFeatures({type:"FeatureCollection"},issue,{nowMs:now}));
const reqs=[];
const result=await fetchQldBomWfsGeometry(issue,{nowMs:now,fetchImpl:async url=>{
 reqs.push(url);return {ok:true,async text(){return JSON.stringify(collection)}};
}});
assert.equal(result.length,2);
const url=new URL(reqs[0]);
assert(url.href.startsWith(QLD_BOM_GIS_WARNING_REPLICA));
assert(url.pathname.endsWith("/3/query"));
assert.equal(url.searchParams.get("where"),"product='IDQ65654'");
assert.equal(url.searchParams.get("f"),"geojson");
assert.equal(url.searchParams.get("outSR"),"4326");
console.log("PASS genuine QDMA BoM GIS2Web WFS-derived polygon source product + exact issued/expiry join, LGA/DDMG geometry, cancellation, stale rejection and native EPSG4326");
