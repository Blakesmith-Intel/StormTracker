import assert from "node:assert/strict";
import {
  evaluateFloodSignal,NON_TIDAL_RAPID_RISE_M_PER_H,
  QLD_TIDAL_REFERENCE_MEAN_PEAK_M_PER_H,
  QLD_TIDAL_REFERENCE_UPPER_PEAK_M_PER_H
} from "../src/context-layers/river-flood-signals-v1.js";

// MSQ 2026 tidal planes: representative standard-port spring tide highs/lows.
// A sinusoid gives an *illustrative* peak water-level rise: pi * range /
// tidal period. This is not a measured tidal-flow velocity or a BoM alert.
const semi=[
  [1.53,.22], [2.22,.42], [2.94,.61], [4.01,.77],
  [4.28,.67], [5.86,.99], [5.35,.79], [3.17,.83], [2.67,.82]
];
const diurnal=[[3.01,.77],[3.91,.42],[3.12,.71]];
const values=[
  ...semi.map(([high,low])=>(high-low)*Math.PI/12.42),
  ...diurnal.map(([high,low])=>(high-low)*Math.PI/24.84)
];
const mean=values.reduce((a,b)=>a+b,0)/values.length;
const max=Math.max(...values);
assert.ok(Math.abs(mean-QLD_TIDAL_REFERENCE_MEAN_PEAK_M_PER_H)<.015);
assert.ok(Math.abs(max-QLD_TIDAL_REFERENCE_UPPER_PEAK_M_PER_H)<.015);
assert.ok(NON_TIDAL_RAPID_RISE_M_PER_H>max,
  "Conservative alert floor must clear estimated spring-tide peaks");
const now=Date.UTC(2026,9,8,8,30),minute=60000;
const make=(id,level,tidal=false)=>({
  type:"Feature",id,geometry:{type:"Point",coordinates:[153.4,-27.95]},
  properties:{bom_stn_num:id.slice(4),location_types:tidal?
    "water level gauge;tide gauge;":"water level gauge;",
    STORMTRACKER_OBSERVED_TEXT:"6:15 pm Thu 08/10/2026",
    STORMTRACKER_TENDENCY:"rising", STORMTRACKER_FLOOD_CLASS:level,
    STORMTRACKER_HEIGHT_METRES:2.5}
});
const decide=(level,rate,tidal=false)=>{
  const f=make("bom:60050",level,tidal);
  return evaluateFloodSignal(f,{[f.id]:[
    {time:now-75*minute,height:2.5-rate},
    {time:now-15*minute,height:2.5}
  ]},now);
};
for(const normal of [.30,.50,.75,1.0,1.23,1.30]){
  assert.equal(decide("below-minor",normal).show,false,
    "Ordinary or high-end spring tidal rise should not create blue pin: "+normal);
  for(const cls of ["minor","moderate","major"]){
    const result=decide(cls,normal);
    assert.equal(result.show,true,"Official BoM flooding is persistent");
    assert.equal(result.state,cls);
    assert.equal(result.rapidRise,false,"No spurious blue arrow at "+normal);
  }
}
const unusual=decide("below-minor",1.60);
assert.equal(unusual.state,"rapid-rise");
assert.equal(unusual.rapidRise,true);
assert.equal(decide("major",1.60).rapidRise,true);
assert.equal(decide("below-minor",2.3,true).show,false,
  "Explicitly tidal station requires independent evidence, not just height rate");
assert.equal(decide("moderate",2.3,true).state,"moderate",
  "Source-issued flood severity survives even an extreme coastal level rise");
console.log("PASS MSQ statewide reference tidal envelope, no ordinary tide false-blue pins, preserved official flood levels and exceptional unclassified rise.");
