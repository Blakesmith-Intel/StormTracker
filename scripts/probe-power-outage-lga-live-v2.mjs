// Real official Queensland geometry/CORS diagnostic, independent of the
// deterministic offline CI tests. Does not change production outage data.
import assert from "node:assert/strict";
import {resolveLgasForOutageGeometry}
  from "../frontend/src/context-layers/outage-lga-spatial-v2.js";
import {ERGON_OUTAGE_AREA_QUERY_URL}
  from "../frontend/src/context-layers/power-outages-v1.js";
const square=(lon,lat,size=0.004)=>({
 type:"Polygon",coordinates:[[[lon-size,lat-size],[lon+size,lat-size],
  [lon+size,lat+size],[lon-size,lat+size],[lon-size,lat-size]]]
});
const rawFetch=globalThis.fetch;
const inspect=async(url,options={})=>{
 const reply=await rawFetch(url,{
  ...options,headers:{...(options.headers??{}),
   Origin:"https://blakesmith-intel.github.io"}
 });
 console.log("Official Queensland GIS:",reply.status,
  "CORS:",reply.headers.get("access-control-allow-origin"),
  "method:",options.method??"GET");
 const cors=reply.headers.get("access-control-allow-origin");
 assert.ok(cors==="*"||cors==="https://blakesmith-intel.github.io",
  "Official ArcGIS API must permit the deployed browser origin");
 return reply;
};
for(const [place,lon,lat,want,exclude] of [
 ["Toowoomba",151.95,-27.56,"Toowoomba","Southern Downs"],
 ["Warwick",152.03,-28.22,"Southern Downs","Toowoomba"]
]){
 const feature={geometry:square(lon,lat)};
 const lgAs=await resolveLgasForOutageGeometry(feature,{fetchImpl:inspect});
 console.log(place,"verified polygon LGAs:",JSON.stringify(lgAs));
 assert.ok(lgAs.some(s=>s.includes(want)),place+" must intersect "+want);
 assert.ok(!lgAs.some(s=>s.includes(exclude)),
  place+" must NOT intersect "+exclude);
}
const liveUrl=new URL(ERGON_OUTAGE_AREA_QUERY_URL);
liveUrl.searchParams.set("where","EVENT_ID = '26SW12796'");
liveUrl.searchParams.set("resultRecordCount","10");
const control=new AbortController(),t=setTimeout(()=>control.abort(),15000);
try{
 const response=await rawFetch(liveUrl,{signal:control.signal});
 if(!response.ok)throw Error("Live Ergon outage source HTTP "+response.status);
 const data=await response.json();
 const features=(data.features??[]).filter(f=>
   String(f.properties?.EVENT_ID??"")==="26SW12796");
 if(!features.length)console.log("Event 26SW12796 no longer active; geographic end-to-end fixture still validated.");
 for(const f of features){
  console.log("Live Ergon event 26SW12796 geometry:",f.geometry?.type);
  const lgas=await resolveLgasForOutageGeometry(f,{fetchImpl:inspect});
  console.log("Live Ergon event 26SW12796 official area intersection:",lgas);
 }
}catch(e){
 console.warn("Optional live event inspection unavailable:",e.message);
}finally{clearTimeout(t);}
console.log("PASS real Queensland LGA polygon POST, browser CORS, Toowoomba and Warwick isolated correctly.");
