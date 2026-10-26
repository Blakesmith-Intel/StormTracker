import assert from "node:assert/strict";
import {reconcileFloodEvents,FLOOD_EVENTS_STORAGE_KEY,cleanFloodEvents}
 from "../src/context-layers/river-flood-events-v1.js";
const MIN=60000,now=Date.UTC(2026,9,8,8,30);
const datum=(level="minor",trend="steady",at="6:15 pm Thu 08/10/2026")=>({
 // Mirani Township 533178 official BoM thresholds: minor 2.0m,
 // moderate 14.8m, major 15.8m. Do not ask one fake height to be all three.

 id:"bom:533178",type:"Feature",geometry:{type:"Point",coordinates:[148.9,-21.2]},
 properties:{STORMTRACKER_OBSERVED_TEXT:at,
   STORMTRACKER_HEIGHT_METRES:level==="moderate"?14.8:
     level==="major"?15.8:level==="below-minor"?0.3:2.1,
   STORMTRACKER_FLOOD_CLASS:level,STORMTRACKER_TENDENCY:trend,
   forecast_site_classification:"information",location_types:"water level gauge;"}
});
const history={"bom:533178":[
 {time:now-45*MIN,height:0.3},{time:now-15*MIN,height:2.1}]};
const query=(level,trend,h=history,old={})=>
 reconcileFloodEvents([datum(level,trend)],h,old,now);
let result=query("minor","rising");
assert.equal(result.features.length,1);
assert.equal(result.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(result.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.equal(result.counts.minor,1);
assert.equal(result.counts.rapidRise,1);
assert.deepEqual(result.events,{},"No stale badges are stored");
for(const level of ["minor","moderate","major"]){
 for(const trend of ["steady","falling"]){
  const x=query(level,trend,{},{"bom:533178":{
    type:"rapid-rise",lastObservedAt:now-15*MIN,activatedAt:now-75*MIN
  }});
  assert.equal(x.features.length,1);
  assert.equal(x.features[0].properties.STORMTRACKER_DISPLAY_STATE,level);
  assert.equal(x.features[0].properties.STORMTRACKER_RAPID_RISE,false);
 }
}
const measuredDespiteFalling=query("below-minor","falling");
assert.equal(measuredDespiteFalling.features.length,1,
 "BoM falling tendency cannot hide independently measured rapid rise");
assert.equal(measuredDespiteFalling.features[0].properties.STORMTRACKER_RAPID_RISE,true);
const risingBelow=query("below-minor","rising");
assert.equal(risingBelow.features.length,1);
assert.equal(risingBelow.features[0].properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
assert.equal(risingBelow.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.equal(query("below-minor","steady").features.length,1,
 "A measured rise is recognised independently of the BoM tendency");
assert.equal(query("minor","steady",{}).features.length,1,
 "Missing optional history cannot remove BoM-classified flooding");
assert.equal(reconcileFloodEvents([datum("minor","steady",
 "6:15 pm Mon 05/10/2026")],{}, {},now).features.length,0);
assert.deepEqual(result.events,{});
assert.match(FLOOD_EVENTS_STORAGE_KEY,/flood/);
assert.deepEqual(cleanFloodEvents({"bogus":{type:"rapid-rise"}},now),{});
// REAL 26 October 2026 BoM station 540158: official 12:34 AEST level
// 8.66 m after 8.92 m at 11:39, checked at 14:26 AEST. BoM plot/table
// contains readings, although the LIVE alert freshness window has expired.
const QLD_NOW=Date.UTC(2026,9,26,4,26);
const laidley={id:"bom:540158",type:"Feature",
  geometry:{type:"Point",coordinates:[152.39,-27.64]},
  properties:{
    bom_stn_num:"540158",name:"Showground Weir (Laidley Creek)",
    STORMTRACKER_HEIGHT_METRES:8.66,
    STORMTRACKER_OBSERVED_TEXT:"12.34PM Mon 26/10/2026",
    STORMTRACKER_FLOOD_CLASS:"major",
    STORMTRACKER_TENDENCY:"steady",
    location_types:"water level gauge;"
  }
};
const laidleyH={"bom:540158":[
  {time:Date.UTC(2026,9,26,1,39),height:8.92},
  {time:Date.UTC(2026,9,26,2,34),height:8.66}
]};
const laidleyAlert=reconcileFloodEvents([laidley],laidleyH,{},QLD_NOW);
assert.equal(laidleyAlert.features.length,1);
assert.equal(laidleyAlert.features[0].properties.STORMTRACKER_DISPLAY_STATE,"major");
assert.equal(laidleyAlert.features[0].properties.STORMTRACKER_OBSERVATION_STALE,true);
assert.equal(laidleyAlert.features[0].properties.STORMTRACKER_RAPID_RISE,false,
  "No stale telemetry may create a fresh rapid-rise alert");
assert.equal(laidleyAlert.features[0].properties.STORMTRACKER_RATE_INTERVAL_MINUTES,55);
assert.equal(Number(laidleyAlert.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H.toFixed(2)),-0.28,
  "Historical fall must be visible even though 90-minute rapid-rise cut-off elapsed");

// Coulson Crossing: 27-minute actual latest sampling interval, no fabricated
// 30-minute alert or false 'insufficient observations' information panel.
const coulson={...laidley,id:"bom:540510",properties:{
  ...laidley.properties,bom_stn_num:"540510",
  STORMTRACKER_HEIGHT_METRES:4.6,
  STORMTRACKER_OBSERVED_TEXT:"02.02PM Mon 26/10/2026"
}};
const coulsonH={"bom:540510":[
  {time:Date.UTC(2026,9,26,1,58),height:4.65},
  {time:Date.UTC(2026,9,26,3,35),height:4.65},
  {time:Date.UTC(2026,9,26,4,2),height:4.6}
]};
const coulsonAlert=reconcileFloodEvents([coulson],coulsonH,{},QLD_NOW);
assert.equal(coulsonAlert.features[0].properties.STORMTRACKER_RATE_INTERVAL_MINUTES,27);
assert.equal(Number(coulsonAlert.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H.toFixed(2)),-0.11);
assert.equal(coulsonAlert.features[0].properties.STORMTRACKER_RAPID_RISE,false);
console.log("PASS Mirani Township 533178 authentic 2.0/14.8/15.8m classifications, measured rise modifier and below-minor recovery.");
