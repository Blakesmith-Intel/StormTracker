import assert from "node:assert/strict";
import {
  officialRecentTableTarget,
  parseBomRecentWaterLevels,
  inspectBomRecentWaterLevelTable,
  recentFloodHistoryCandidate,
  recentFloodHistoryGap,
  classifyBoMRecentHistoryFailure,
  fetchBoMRecentHistory
} from "../src/context-layers/bom-recent-river-history-v1.js";
const now=Date.UTC(2026,9,8,8,30); // 18:30 AEST
const url=officialRecentTableTarget("/fwo/IDQ65388/IDQ65388.540384.plt.shtml");
assert.deepEqual(url,{
  product:"IDQ65388",station:"540384",
  url:"https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540384.tbl.shtml"
});
for(const bad of [
 "https://evil.example/fwo/IDQ65388/IDQ65388.540384.plt.shtml",
 "/fwo/IDQ65388/IDQ65389.540384.plt.shtml",
 "/fwo/IDQ65388/IDQ65388.540384.tbl.shtml",
 "/fwo/IDQ65388/IDQ65388.540384.plt.shtml?next=https://evil.example",
 "/fwo/IDN65388/IDN65388.540384.plt.shtml",
 "/fwo/IDQ65388/IDQ65388.540384.plt.shtml#fragment",
 "/fwo/IDQ65388/IDQ65388.540384.plt.shtml/../../robots.txt"
])assert.equal(officialRecentTableTarget(bad),null,"Reject arbitrary external/hijacked BoM URLs");

function table(rows){
  return '<html><table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+rows.map(([t,h])=>
    '<tr><td class="tableStyle1_beforeT0">'+t+'</td><td class="tableStyle1_data">'+h+'</td></tr>'
  ).join("")+'</table></html>';
}
const rows=[
  ["06/10/2026 16:15","1.3"],["08/10/2026 16:45","1.40"],
  ["08/10/2026 17:30","1.42"],["08/10/2026 17:30","1.42"],
  ["08/10/2026 17:45","1.50"],["08/10/2026 18:15","1.75"],
  ["08/10/2026 18:15","1.77"],// conflicting duplicate => drop point
  ["08/10/2026 17:00","No Data"],["08/10/2026 17:05",""],
  ["08/10/2026 20:00","9999"],["45/10/2026 17:15","100"]
];
const parsed=parseBomRecentWaterLevels(table(rows),{nowMs:now});
assert.deepEqual(parsed,[
 {time:Date.UTC(2026,9,8,6,45),height:1.4},
 {time:Date.UTC(2026,9,8,7,30),height:1.42},
 {time:Date.UTC(2026,9,8,7,45),height:1.5}
]);
assert.equal(parseBomRecentWaterLevels(table([["07/10/2026 10:00","-0.31"]]),{nowMs:now}).at(0).height,-0.31);
assert.equal(parseBomRecentWaterLevels("<table><tr><td>wrong</td></tr></table>",{nowMs:now}).length,0);
assert.equal(parseBomRecentWaterLevels(table([["06/10/2026 16:15","1.3"]]),{nowMs:now,maxAgeHours:4}).length,0);
assert.deepEqual(inspectBomRecentWaterLevelTable(table([]),{nowMs:now}).samples,[]);
assert.equal(inspectBomRecentWaterLevelTable(table([]),{nowMs:now}).formatRecognised,true);
assert.equal(inspectBomRecentWaterLevelTable(
  table([["08/10/2026 18:00","No Data"]]),{nowMs:now}).formatRecognised,true);
assert.equal(inspectBomRecentWaterLevelTable(
  table([["broken-date","1.25"]]),{nowMs:now}).formatRecognised,false);
assert.equal(inspectBomRecentWaterLevelTable("<html>Blocked</html>").formatRecognised,false);
assert.equal(inspectBomRecentWaterLevelTable(table([["08/10/2026 17:30","1.42"]]),
  {nowMs:now}).samples.length,1);
const feature=(tidal=true,flood="")=>({id:"bom:540384",properties:{
 location_types:tidal?"water level gauge;tide gauge;":"water level gauge;",
 STORMTRACKER_FLOOD_CLASS:flood,STORMTRACKER_TENDENCY:"rising",
 STORMTRACKER_OBSERVED_TEXT:"6:15 pm Thu 08/10/2026",
 STORMTRACKER_RECENT_DATA_HREF:"/fwo/IDQ65388/IDQ65388.540384.plt.shtml"
}});
assert.equal(recentFloodHistoryCandidate(feature(),{},now),null,
  "Known tidal gauges must not make pointless massive history requests");
assert.equal(recentFloodHistoryGap(feature(true,"major"),{},now),null,
  "A confirmed tide can never generate a rate-only flash rise arrow");
assert.equal(recentFloodHistoryCandidate(feature(false,"below-minor"),{},now),null,
  "Unlocated below-minor gauges need conservative source screening");
assert.ok(recentFloodHistoryCandidate(feature(false,"minor"),{},now));
const west={...feature(false,"below-minor"),
  geometry:{type:"Point",coordinates:[144.6005,-25.9108]}};
assert.ok(recentFloodHistoryCandidate(west,{},now),
  "Inland below-minor rising gauge must obtain initial genuine history");
assert.ok(recentFloodHistoryGap(west,{},now),
  "Missing inland rapid-rise evidence must remain explicitly incomplete");
assert.equal(recentFloodHistoryCandidate({...west,properties:{...west.properties,
  STORMTRACKER_TENDENCY:"falling"}},{},now),null,
  "Only rising gauges may consume optional history capacity");
const coastal={...west,geometry:{type:"Point",coordinates:[153.432,-27.95]}};
assert.equal(recentFloodHistoryCandidate(coastal,{},now),null,
  "Avoid large below-minor history downloads for ordinary coastal rise");
const existing={"bom:540384":[
 {time:now-60*60000,height:1.0},{time:now-15*60000,height:1.6}
]};
assert.equal(recentFloodHistoryCandidate(feature(false,"minor"),existing,now),null);
// A missing official table URL is a genuine screening gap, not a negative
// result. A recent observed rise must align with the latest bulletin time.
const missing={...feature(false,"minor"),properties:{
  ...feature(false,"minor").properties,STORMTRACKER_RECENT_DATA_HREF:""
}};
assert.equal(recentFloodHistoryCandidate(missing,{},now),null);
assert.equal(recentFloodHistoryGap(missing,{},now)?.target,null);
assert.equal(recentFloodHistoryGap(feature(false,"minor"),existing,now),null);
const staleExisting={"bom:540384":[
  {time:now-80*60000,height:1.0},{time:now-40*60000,height:1.6}
]};
assert.ok(recentFloodHistoryGap(feature(false,"minor"),staleExisting,now),
  "A rise predating the latest bulletin must still be marked unassessed");

const target=officialRecentTableTarget("/fwo/IDQ65388/IDQ65388.540384.plt.shtml");
for(const [status,code,scope] of [
  [422,"no_usable_observations","station"],
  [404,"station_history_not_published","station"],
  [502,"source_response_too_large","station"],
  [503,"source_access_denied","service"],
  [429,"source_rate_limited","service"]
]){
  let thrown;
  try{
    await fetchBoMRecentHistory(target,{fetchImpl:async()=>new Response(
      JSON.stringify({code,upstreamStatus:status}),{
        status,headers:{"Content-Type":"application/json"}
      })});
  }catch(e){thrown=e;}
  assert.ok(thrown,"Expected typed BoM history HTTP error");
  assert.equal(thrown.status,status);
  assert.equal(thrown.code,code);
  assert.equal(thrown.scope,scope);
  assert.equal(classifyBoMRecentHistoryFailure(thrown),scope);
}
// A genuine unpublished optional station table is not an HTTP error, and
// cannot be used to certify a fall below the moderate flood threshold.
const missingPublished=await fetchBoMRecentHistory(target,{fetchImpl:async()=>new Response(JSON.stringify({
  format:"StormTrackerBomRecentRiverHistoryV1",
  product:target.product,station:target.station,
  availability:"not_published",sourceStatus:404,samples:[]
}),{status:200,headers:{"Content-Type":"application/json"}})});
assert.deepEqual(missingPublished,[]);
await assert.rejects(fetchBoMRecentHistory(target,{fetchImpl:async()=>new Response(JSON.stringify({
  format:"StormTrackerBomRecentRiverHistoryV1",
  product:target.product,station:target.station,
  availability:"not_published",samples:[{time:1,height:0}]
}),{status:200})}),/response mismatch/);
await assert.rejects(
  fetchBoMRecentHistory(target,{timeoutMs:2,
    fetchImpl:async(url,options)=>new Promise((resolve,reject)=>{
      options.signal.addEventListener("abort",()=>reject(
        new DOMException("signal is aborted without reason","AbortError")),{once:true});
    })
  }),error=>error?.code==="source_timeout" &&
    error?.scope==="service" && /timed out/.test(error.message));
assert.equal(classifyBoMRecentHistoryFailure(new TypeError("network")),"service");
console.log("Recent BoM table parser checks passed: strict host/product whitelist, AEST time, timestamp uniqueness, conflicting records rejected, 48h bounds and only relevant rising gauge backfill.");
