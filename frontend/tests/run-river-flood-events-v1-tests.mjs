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
 {time:now-75*MIN,height:0.3},{time:now-15*MIN,height:2.1}]};
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
const cleared=query("below-minor","falling");
assert.equal(cleared.features.length,0);
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
console.log("PASS Mirani Township 533178 authentic 2.0/14.8/15.8m classifications, measured rise modifier and below-minor recovery.");
