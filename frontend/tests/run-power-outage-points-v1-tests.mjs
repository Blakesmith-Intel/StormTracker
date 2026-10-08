import assert from "node:assert/strict";
import {
  fetchPagedPowerOutageFeatures, loadPowerOutages,
  powerOutageSummary, ERGON_OUTAGE_POINT_QUERY_URL,
  ENERGEX_OUTAGE_POINT_QUERY_URL
} from "../src/context-layers/power-outages-v1.js";

const now=Date.parse("2026-10-08T20:58:00+10:00");
const at=Date.parse("2026-10-08T16:26:00+10:00");
const feature=(id,name,type="UNPLANNED",geometry="Point")=>({
  type:"Feature",id,
  properties:{OBJECTID:id,EVENT_ID:name,TYPE:type,STATUS:"Crews en route",
    CUSTOMERS_AFFECTED:19,SUBURBS:"BROOKSTEAD",START:at,FINISH:null,
    EXTRACTED:now,STREETS:"BROOKSTEAD NORWIN RD"},
  geometry:geometry==="Point"?{type:"Point",coordinates:[151.43,-27.76]}:
    {type:"Polygon",coordinates:[[[151.4,-27.8],[151.45,-27.8],
      [151.45,-27.75],[151.4,-27.8]]]}
});
const collection=features=>({type:"FeatureCollection",features});
const ergonArea=collection([feature(1,"ER-A", "UNPLANNED","Polygon")]);
const ergonPoint=collection([feature(2,"26SW12295"),feature(3,"NO-PLANNED","PLANNED"),
  feature(4,"ER-A")]);
const energexArea=collection([feature(5,"E-A","UNPLANNED","Polygon")]);
const energexPoint=collection([feature(6,"E-A")]);
const seen=[];
const mock=async url=>{
  const u=String(url);seen.push(u);
  if(u.includes("essential-energy-outages")) throw new Error("Essential test intentionally unavailable");
  if(u.includes("VwErgonOutages")){
    return {ok:true,async json(){return u.includes("/1/query")?ergonPoint:ergonArea;}};
  }
  if(u.includes("VwEnergexOutages")){
    return {ok:true,async json(){return u.includes("/1/query")?energexPoint:energexArea;}};
  }
  return {ok:true,async json(){return collection([]);}};
};
const result=await loadPowerOutages({fetchImpl:mock,nowMs:now});
assert.ok(ERGON_OUTAGE_POINT_QUERY_URL.includes("/1/query"));
assert.ok(ENERGEX_OUTAGE_POINT_QUERY_URL.includes("/1/query"));
assert.ok(seen.some(url=>url.includes("VwErgonOutages/FeatureServer/1/query")));
assert.ok(seen.some(url=>url.includes("VwEnergexOutages/FeatureServer/1/query")));
const brookstead=result.payload.features.find(x=>x.id==="ergon:26SW12295");
assert.ok(brookstead,"16:26 Brookstead point-only outage cannot be missed");
assert.equal(brookstead.geometry.type,"Point");
assert.equal(powerOutageSummary(brookstead).customersAffected,19);
assert.ok(!result.payload.features.some(f=>f.properties.EVENT_ID==="NO-PLANNED"),
  "Planned outage points must never render");
assert.equal(result.payload.features.filter(f=>f.id==="ergon:ER-A").length,1);
assert.equal(result.payload.features.find(f=>f.id==="ergon:ER-A").geometry.type,"Polygon",
  "Where both official representations exist, retain affected-area polygon");
assert.equal(result.payload.features.filter(f=>f.id==="energex:E-A").length,1,
  "Energex area and point of the same event must not double count");

const secondSource=await loadPowerOutages({fetchImpl:async url=>{
  const u=String(url);
  if(u.includes("VwErgonOutages/FeatureServer/0/query"))
    return {ok:false,status:503};
  if(u.includes("VwErgonOutages/FeatureServer/1/query"))
    return {ok:true,async json(){return ergonPoint;}};
  if(u.includes("VwEnergexOutages"))
    return {ok:true,async json(){return collection([]);}};
  throw new Error("Other source unavailable");
},nowMs:now});
assert.ok(secondSource.payload.features.some(f=>f.id==="ergon:26SW12295"),
  "An area feed failure must not discard a healthy Ergon outage-point feed");
assert.ok(secondSource.partial);
assert.ok(secondSource.failedProviders.some(x=>x.provider==="Ergon area"));

const offsets=[];
const pages=[[feature(101,"A"),feature(102,"B")],[feature(103,"C")]];
const paged=await fetchPagedPowerOutageFeatures({
  url:"https://example.test/FeatureServer/1/query?where=1%3D1",
  provider:"Ergon",pageSize:2,fetchImpl:async url=>{
    const offset=Number(new URL(url).searchParams.get("resultOffset"));
    offsets.push(offset);
    return {ok:true,async json(){return collection(pages[offset/2]??[]);}};
  }
});
assert.deepEqual(offsets,[0,2]);
assert.deepEqual(paged.map(f=>f.properties.EVENT_ID),["A","B","C"]);
await assert.rejects(()=>fetchPagedPowerOutageFeatures({
  url:"https://example.test/FeatureServer/1/query",provider:"Ergon",
  pageSize:2,maxPages:3,fetchImpl:async()=>({
    ok:true,async json(){return collection(pages[0]);}
  })
}),/repeated a page/);
console.log("Power outage point/area regression passed: real Brookstead event fixture at 16:26, unplanned-only, no duplicate events, partial-layer survival and full pagination.");
