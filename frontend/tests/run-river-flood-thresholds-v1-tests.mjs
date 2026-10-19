import assert from "node:assert/strict";
import {BOM_2026_CLASSIFICATIONS,BOM_2026_DATA_ONLY_STATIONS}
  from "../src/context-layers/river-flood-stages-2026-full-v1.js";
import {BOM_2026_VERIFIED_CLASSIFICATION_COUNT,cleanFloodLevels,
 stationFloodLevels,withStationFloodLevels,observedFloodClass}
 from "../src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

assert.equal(BOM_2026_VERIFIED_CLASSIFICATION_COUNT,1069);
assert.equal(BOM_2026_DATA_ONLY_STATIONS.length,737);
const stages={
 "bom:540610":[98.1,100.7,102.3],
 "bom:540057":[76.2,77.7,79.2],
 "bom:539066":[111.5,115,121],
 "bom:540646":[41.5,42,42.5],
 "bom:540097":[4,5,6],
 "bom:535142":[6,9,12],
 "bom:540319":[1.7,2.4,3.5]
};
for(const [id,levels] of Object.entries(stages)){
 const feature={id,properties:{bom_stn_num:id.slice(4),name:"Test",
   STORMTRACKER_MINOR_FLOOD_METRES:3,
   STORMTRACKER_MODERATE_FLOOD_METRES:6,
   STORMTRACKER_MAJOR_FLOOD_METRES:7.8}};
 const t=stationFloodLevels(feature);
 assert.deepEqual([t.minor,t.moderate,t.major],levels,id+" exact-ID 2026 thresholds");
 const staged=withStationFloodLevels([feature])[0];
 assert.deepEqual([staged.properties.STORMTRACKER_MINOR_FLOOD_METRES,
 staged.properties.STORMTRACKER_MODERATE_FLOOD_METRES,
 staged.properties.STORMTRACKER_MAJOR_FLOOD_METRES],levels);
 assert.equal(staged.properties.STORMTRACKER_THRESHOLD_SOURCE_DATE,"2026-05");
 assert.equal(observedFloodClass(levels[2],t),"major");
 assert.equal(observedFloodClass(levels[2]-0.001,t),"moderate");
}
for(const [id,t] of Object.entries(BOM_2026_CLASSIFICATIONS)){
 const levels=cleanFloodLevels(t);
 assert.ok(levels,id+" classification invalid");
 const tests=[
   ...(levels.minor===null?[]:[[levels.minor,"minor"]]),
   ...(levels.moderate===null?[]:[[levels.moderate,"moderate"]]),
   ...(levels.major===null?[]:[[levels.major,"major"]])
 ];
 for(const [height,stage] of tests)
  assert.equal(observedFloodClass(height,levels),stage,id+" at "+height);
}
assert.deepEqual(cleanFloodLevels({minor:null,moderate:1.1,major:1.2}),
 {minor:null,moderate:1.1,major:1.2});
assert.equal(observedFloodClass(1,{minor:null,moderate:1.1,major:1.2}),undefined);
assert.equal(observedFloodClass(1.1,{minor:null,moderate:1.1,major:1.2}),"moderate");
assert.equal(observedFloodClass(1.2,{minor:null,moderate:1.1,major:1.2}),"major");
assert.equal(stationFloodLevels({id:"bom:533207"}).minor,null);
assert.equal(stationFloodLevels({id:"bom:531039"}).moderate,null);
assert.equal(stationFloodLevels({id:"bom:999999"}),null);
assert.equal(stationFloodLevels({id:"awrc:QLD-1"}),null);
assert.equal(stationFloodLevels({id:BOM_2026_DATA_ONLY_STATIONS[0]}),null);
assert.equal(stationFloodLevels({id:"bom:540610",properties:{bom_stn_num:"540057"}}),null,
 "Contradictory feature ID must not borrow another gauge's flood stage");
const mismatch=withStationFloodLevels([{id:"bom:540610",properties:{
  bom_stn_num:"540057",STORMTRACKER_MAJOR_FLOOD_METRES:7.8}}])[0];
assert.equal(mismatch.properties.STORMTRACKER_MAJOR_FLOOD_METRES,undefined);
assert.match(mismatch.properties.STORMTRACKER_IDENTITY_WARNING,/disagrees/);
assert.equal(stationFloodLevels({id:"bom:540097",properties:{
  bom_stn_num:"540097",name:"Oxley Creek"}}).major,6,
  "New Beith can never inherit the Oxley Creek 540646 stage");
const caution=withStationFloodLevels([{id:"bom:544058",properties:{
  bom_stn_num:"544058"}}])[0];
assert.equal(caution.properties.STORMTRACKER_THRESHOLD_STATUS,"historical-exact-id-caution");
assert.deepEqual(stationFloodLevels(caution),{minor:3,moderate:4,major:5});
const now=Date.UTC(2026,9,19,13,36);
function gauge(id,height,observedText,reported=""){
 return withStationFloodLevels([{id,type:"Feature",
 geometry:{type:"Point",coordinates:[149.56,-25.79]},
 properties:{bom_stn_num:id.slice(4),lat:-25.79,long:149.56,
  location_types:"water level gauge;",
  STORMTRACKER_HEIGHT_METRES:height,
  STORMTRACKER_TENDENCY:"steady",STORMTRACKER_FLOOD_CLASS:reported,
  STORMTRACKER_OBSERVED_TEXT:observedText,
  STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS:"minor",
  STORMTRACKER_LAST_CONFIRMED_FLOOD_AT:now-90*60000}}])[0];
}
for(const [height,state] of [[0.23,null],[5.99,null],[6,"minor"],
 [8.99,"minor"],[9,"moderate"],[12,"major"]]){
 const d=evaluateFloodSignal(gauge("bom:535142",height,"11.15PM Mon"),{},now);
 assert.equal(d.show,state!==null);
 if(state!==null)assert.equal(d.state,state);
}
for(const [height,state] of [[2.99,null],[3,"minor"],[3.99,"minor"],
 [4,"moderate"],[4.25,"moderate"],[4.99,"moderate"],[5,"major"]]){
 const f=gauge("bom:544058",height,"11.16PM Mon");
 const d=evaluateFloodSignal(f,{},now);
 assert.equal(d.show,state!==null);
 if(state!==null)assert.equal(d.state,state);
}
const conflict=gauge("bom:540610",104,"11.15PM Mon","below-minor");
const decision=evaluateFloodSignal(conflict,{},now);
assert.equal(decision.state,"unverified");
assert.equal(decision.source,"bom-datum-conflict");
const result=reconcileFloodEvents([gauge("bom:535142",9,"11.15PM Mon")],
 {},{},now);
assert.equal(result.features[0].properties.STORMTRACKER_DISPLAY_STATE,"moderate");
console.log("PASS 1069 current BoM exact-ID stages, 737 data-only stations, native-level boundaries, source ID safety, historical Warilda disclosure, and neutral datum conflicts.");
