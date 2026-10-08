// Read-only operational acceptance: compare exact QLDTraffic published closure
// classifications with the candidate's filter. Does not expose public
// incident addresses or change upstream/provider state.
import assert from "node:assert/strict";
import {
  filterFloodRoadClosures,isActiveFloodRoadClosure
} from "../frontend/src/context-layers/flood-road-closure-filter-v1.js";
const upstream="https://data.qldtraffic.qld.gov.au/events_v2.geojson";
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),24000);
try {
 const response=await fetch(upstream,{signal:ctrl.signal,headers:{Accept:"application/geo+json,application/json"}});
 assert.ok(response.ok,`QLDTraffic upstream HTTP ${response.status}`);
 const payload=await response.json();
 assert.ok(Array.isArray(payload.features),"Provider did not supply GeoJSON features");
 const now=Date.now(),allowed=new Set(["flash flooding","long-term flooding","earlier flooding","heavy rain"]);
 const filtered=filterFloodRoadClosures(payload,now);
 const summary=Object.fromEntries([...allowed].map(k=>[k,0]));
 for(const f of filtered.features){
  const p=f.properties??{},impact=p.impact??{};
  const subtype=String(p.event_subtype??"").trim().toLowerCase(),
   cause=String(p.event_due_to??"").trim().toLowerCase();
  assert.equal(String(p.status).toLowerCase(),"published");
  assert.equal(String(impact.impact_type).toLowerCase(),"closures");
  assert.equal(String(impact.impact_subtype).toLowerCase(),"road closed to all traffic");
  assert.ok(allowed.has(subtype)||allowed.has(cause),"Unapproved closure classification: "+p.id);
  assert.ok(isActiveFloodRoadClosure(f,now),"Closure failed active-time filter: "+p.id);
  const key=allowed.has(subtype)?subtype:cause;
  summary[key]++;
 }
 const laidley=payload.features.find(f=>String(f.properties?.id)==="750590");
 if(laidley){
   assert.ok(filtered.features.some(f=>String(f.properties?.id)==="750590"),
     "Laidley Creek West Road 750590 was dropped despite published all-traffic Earlier flooding closure");
 }
 console.log("PASS Strict QLDTraffic current closures:",JSON.stringify({
   checkedAt:new Date(now).toISOString(),providerFeatures:payload.features.length,
   eligibleClosures:filtered.features.length,byCause:summary,
   laidleySeen:Boolean(laidley),laidleyEligible:laidley?true:null
 }));
} finally {clearTimeout(timer);}
