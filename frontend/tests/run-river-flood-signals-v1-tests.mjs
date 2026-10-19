import assert from "node:assert/strict";
import {evaluateFloodSignal,filterOperationalFloodGauges,
  FLOOD_SIGNAL_MAX_AGE_MS,NON_TIDAL_RAPID_RISE_M_PER_H,
  parseQueenslandObservationTime} from "../src/context-layers/river-flood-signals-v1.js";
import {reconcileFloodEvents,cleanFloodEvents,
  FLOOD_EVENTS_STORAGE_KEY} from "../src/context-layers/river-flood-events-v1.js";

const now=Date.UTC(2026,9,8,8,30), MIN=60000;
const observed="6:15 pm Thu 08/10/2026";
const make=(id,level,trend="steady",klass="information",time=observed,tidal=false)=>({
  type:"Feature",id,geometry:{type:"Point",coordinates:[149.1,-21.1]},
  properties:{bom_stn_num:id.split(":")[1],name:"Test BoM gauge",
    forecast_site_classification:klass,
    STORMTRACKER_FLOOD_CLASS:level,STORMTRACKER_TENDENCY:trend,
    STORMTRACKER_HEIGHT_METRES:2.5,STORMTRACKER_OBSERVED_TEXT:time,
    location_types:tidal?"water level gauge;tide gauge;":"water level gauge;"}
});
const screen=(f,h={})=>evaluateFloodSignal(f,h,now);
for(const klass of ["data","information","official","",null]){
  for(const level of ["minor","moderate","major"]){
    for(const trend of ["rising","steady","falling"]){
      const x=screen(make("bom:999997",level,trend,klass));
      assert.equal(x.show,true,"Every current classified gauge stays visible");
      assert.equal(x.state,level);
      assert.equal(x.rapidRise,false,"No original rate means no rapid arrow");
      assert.equal(x.source,"bom-classification");
    }
  }
}
for(const level of ["","below-minor"]){
  assert.equal(screen(make("bom:999997",level)).show,false,
    "Below minor has no persistent marker without genuine rate");
}
assert.equal(screen(make("bom:999997","minor","steady","information",
  "6:15 pm Mon 05/10/2026")).show,false,
  "Stale classification cannot be passed off as current flooding");
const recent=make("bom:999997","minor","rising");
const below=make("bom:999998","below-minor","rising");
const measured={
 [recent.id]:[{time:now-75*MIN,height:1.0},{time:now-15*MIN,height:2.5}],
 [below.id]:[{time:now-75*MIN,height:1.0},{time:now-15*MIN,height:2.5}]
};
assert.ok(NON_TIDAL_RAPID_RISE_M_PER_H>0);
const minor=screen(recent,measured);
const blue=screen(below,measured);
assert.equal(minor.state,"minor");
assert.equal(minor.rapidRise,true);
assert.equal(blue.state,"rapid-rise");
assert.equal(blue.rapidRise,true);
assert.equal(screen(make(below.id,"below-minor","falling"),measured).show,false);
for(const level of ["minor","moderate","major"]){
  const f=make(recent.id,level,"rising");
  assert.equal(screen(f,measured).rapidRise,true,
    "Measured blue arrow appears on current BoM severity "+level);
}
const input=[make("bom:1","major","falling"),make("bom:2","moderate"),
  make("bom:3","minor"),below,recent];
const filtered=filterOperationalFloodGauges(input,measured,now);
assert.equal(filtered.features.length,5);
assert.deepEqual(filtered.counts,{minor:2,moderate:1,major:1,rapidRise:2,tidalAnomaly:0});
assert.equal(parseQueenslandObservationTime(observed,now),now-15*MIN);
assert.ok(FLOOD_SIGNAL_MAX_AGE_MS<2*3600000);
const selected=reconcileFloodEvents(input,measured,{
 "bom:999997":{type:"rapid-rise",lastObservedAt:now-15*MIN,activatedAt:now-60*MIN}
},now);
assert.equal(selected.features.length,5);
assert.deepEqual(selected.events,{},"Old rate-based markers must not persist after source changes");
assert.equal(selected.counts.rapidRise,2);
assert.equal(selected.features.find(f=>f.id==="bom:3").properties.STORMTRACKER_RAPID_RISE,false);
assert.equal(selected.features.find(f=>f.id===below.id).properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
const recovered=reconcileFloodEvents(
  [make(recent.id,"minor","falling"),make(below.id,"below-minor","falling")],
  measured,selected.events,now);
assert.equal(recovered.features.length,1,
  "Falling minor remains; falling below-minor is removed");
assert.equal(recovered.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(recovered.features[0].properties.STORMTRACKER_RAPID_RISE,false);
assert.ok(FLOOD_EVENTS_STORAGE_KEY.includes("flood"));
assert.deepEqual(cleanFloodEvents({"garbage":{type:"rapid-rise"}},now),{});
console.log("PASS missing-threshold BoM class fallback: classified minor/moderate/major persistence; measured rise badge; blue below minor; strict stale/recovery clearing; all forecast-site classes.");
