import assert from "node:assert/strict";
import {
  officialRecentTableTarget,
  parseBomRecentWaterLevels,
  recentFloodHistoryCandidate
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
 {time:Date.UTC(2026,9,6,6,15),height:1.3},
 {time:Date.UTC(2026,9,8,6,45),height:1.4},
 {time:Date.UTC(2026,9,8,7,30),height:1.42},
 {time:Date.UTC(2026,9,8,7,45),height:1.5}
]);
assert.equal(parseBomRecentWaterLevels(table([["07/10/2026 10:00","-0.31"]]),{nowMs:now}).at(0).height,-0.31);
assert.equal(parseBomRecentWaterLevels("<table><tr><td>wrong</td></tr></table>",{nowMs:now}).length,0);
assert.equal(parseBomRecentWaterLevels(table([["06/10/2026 16:15","1.3"]]),{nowMs:now,maxAgeHours:4}).length,0);
const feature=(tidal=true,flood="")=>({id:"bom:540384",properties:{
 location_types:tidal?"water level gauge;tide gauge;":"water level gauge;",
 STORMTRACKER_FLOOD_CLASS:flood,STORMTRACKER_TENDENCY:"rising",
 STORMTRACKER_OBSERVED_TEXT:"6:15 pm Thu 08/10/2026",
 STORMTRACKER_RECENT_DATA_HREF:"/fwo/IDQ65388/IDQ65388.540384.plt.shtml"
}});
assert.ok(recentFloodHistoryCandidate(feature(),{},now));
assert.equal(recentFloodHistoryCandidate(feature(false,"below-minor"),{},now),null);
assert.ok(recentFloodHistoryCandidate(feature(false,"minor"),{},now));
const existing={"bom:540384":[
 {time:now-60*60000,height:1.0},{time:now-15*60000,height:1.6}
]};
assert.equal(recentFloodHistoryCandidate(feature(false,"minor"),existing,now),null);
console.log("Recent BoM table parser checks passed: strict host/product whitelist, AEST time, timestamp uniqueness, conflicting records rejected, 48h bounds and only relevant rising gauge backfill.");
