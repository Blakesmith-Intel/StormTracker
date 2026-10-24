import assert from "node:assert/strict";
import {parseBoMStationCrossingHeader,publishedCrossingForFeature,CROSSING_SCHEMA}
 from "../src/context-layers/river-crossing-state-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {buildNotableFloodGaugeReport} from "../src/context-layers/river-gauge-notable-report-v1.js";
import worker from "../../relay/worker.js";

const MIN=60000,now=Date.UTC(2026,9,24,11,8); // 9:08 pm AEST
const html='<html><h1>Latest River Heights for Theresa Creek</h1>'+
 '<p>Station details: Station Number: <b>535162</b> Name: Theresa Creek at Theresa Creek Dam</p>'+
 '<p><b>Crossing Levels:</b> Bridge: 1.71 m</p>'+
 '<p>Data from the previous 14 days.</p>';
const crossing=parseBoMStationCrossingHeader(html,"535162");
assert.equal(crossing.type,"B");
assert.equal(crossing.heightMetres,1.71);
assert.equal(parseBoMStationCrossingHeader(html,"535161"),null,
 "Never transfer a neighbouring station's crossing value");
assert.equal(parseBoMStationCrossingHeader(html.replace("Station Number","Station Id"),"535162"),null);
assert.equal(parseBoMStationCrossingHeader(html.replace("Bridge: 1.71 m","Dam spillway: 1.71 m"),"535162"),null);
const withMany=html.replace("Bridge: 1.71 m","Causeway: 1.52 m, Bridge: 1.71 m");
assert.equal(parseBoMStationCrossingHeader(withMany,"535162").heightMetres,1.52,
 "Lowest published road crossing must win, not a dam or unrelated gauge");
const make=(number,height,at=now-8*MIN,extra={})=>({
 id:"bom:"+number,type:"Feature",geometry:{type:"Point",coordinates:[147.55,-22.85]},
 properties:{name:"Gauge "+number,bom_stn_num:number,location_types:"water level gauge;",
  STORMTRACKER_HEIGHT_METRES:height,
  STORMTRACKER_FLOOD_CLASS:"",
  STORMTRACKER_TENDENCY:"steady",
  STORMTRACKER_OBSERVED_TEXT:"21:00 24/10/2026",
  STORMTRACKER_OFFICIAL_OBSERVED_AT:at,
  ...extra}
});
const th=make("535162",2.80,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing});
const alerts=reconcileFloodEvents([th],{}, {},now);
assert.equal(alerts.features.length,1,
 "535162 above BoM 1.71 m bridge must be mapped without a minor flood threshold or session history");
assert.equal(alerts.features[0].properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(alerts.features[0].properties.STORMTRACKER_RAPID_RISE,false,
 "Crossing reach alone is not proof of an active rapid rise");
assert.equal(alerts.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(alerts.features[0].properties.STORMTRACKER_CROSSING_LEVEL_METRES,1.71);
assert.equal(reconcileFloodEvents([
 make("535162",1.70,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing})
],{}, {},now).features.length,0,"Below an exact published crossing without rapid rise is excluded");
assert.equal(reconcileFloodEvents([
 make("535162",2.80,now-180*MIN,{STORMTRACKER_PLOT_CROSSING:crossing})
],{}, {},now).features.length,0,"Old heights cannot establish a current crossing exceedance");
assert.equal(reconcileFloodEvents([
 make("535162",2.8,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing,bom_stn_num:"535161"})
],{}, {},now).features.length,0,"Mismatched exact station number is rejected");
const other=make("535999",1.85);
assert.equal(reconcileFloodEvents([other],{}, {},now).features.length,0,
 "Do not apply Theresa Creek's bridge to every gauge without a flood class");
const catalog={schema:CROSSING_SCHEMA,entries:{"bom:535999":{
 type:"C",heightMetres:1.8,crossingName:"Published causeway"}}};
assert.equal(reconcileFloodEvents([other],{}, {},now,catalog).features.length,1,
 "All stations with a published Section 5 crossing also appear on the map");
const reported=buildNotableFloodGaugeReport([th],null,now);
assert.equal(reported.total,1,
 "Report must include BoM station-plot bridge even when Section 5 list omits that station");
assert.equal(reported.crossedCount,1);
assert.equal(reported.groups[2].rows[0].crossing.levelMetres,1.71);
assert.equal(publishedCrossingForFeature(th,catalog).heightMetres,1.71,
 "Current exact station table should beat an older catalogue record");

// End-to-end: the existing Worker should publish the crossing from the SAME
// .tbl.shtml station page it already reads for history; no extra BoM request.
const table=html+
 '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
 '<tr><td>24/10/2026 20:00</td><td>2.77</td></tr>'+
 '<tr><td>24/10/2026 21:00</td><td>2.80</td></tr></table></html>';
const oldFetch=globalThis.fetch;
let upstreamCalls=0;
try{
 globalThis.fetch=async url=>{
  assert.match(String(url),/IDQ65392\.535162\.tbl\.shtml$/);
  upstreamCalls++;
  return new Response(table,{status:200,headers:{"Content-Type":"text/html"}});
 };
 const reply=await worker.fetch(new Request(
  "https://relay.invalid/river-recent-history?product=IDQ65392&station=535162",
  {headers:{Origin:"https://blakesmith-intel.github.io"}}),{});
 assert.equal(reply.status,200);
 const payload=await reply.json();
 assert.equal(payload.format,"StormTrackerBomRecentRiverHistoryV1");
 assert.equal(payload.station,"535162");
 assert.equal(payload.crossing?.heightMetres,1.71);
 assert.equal(upstreamCalls,1,"Do not add redundant station page requests");
}finally{globalThis.fetch=oldFetch;}
console.log("PASS BoM exact-ID bridge metadata + relay, 535162 map inclusion, all-station crossings, report, and stale/false-positive guards");
