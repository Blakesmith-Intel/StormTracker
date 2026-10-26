import assert from "node:assert/strict";
import {
  approximateQueenslandCoastDistanceKm,gaugeRiseScreeningZone,
  INLAND_COAST_BUFFER_KM
} from "../src/context-layers/river-gauge-coastal-screen-v1.js";
import {
  evaluateFloodSignal,NON_TIDAL_RAPID_RISE_M_PER_H,
  COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H
} from "../src/context-layers/river-flood-signals-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

const now=Date.UTC(2026,9,8,8,30), H=3600000;
const make=(id,coords,level="below-minor",types="water level gauge;")=>({
  type:"Feature",id,
  ...(coords?{geometry:{type:"Point",coordinates:coords}}:{}),
  properties:{
    bom_stn_num:id.slice(4),location_types:types,
    STORMTRACKER_OBSERVED_TEXT:"6:15 pm Thu 08/10/2026",
    STORMTRACKER_TENDENCY:"rising",STORMTRACKER_FLOOD_CLASS:level,
    STORMTRACKER_HEIGHT_METRES:1.5
  }
});
const observation=(f,rate)=>({[f.id]:[
  {time:now-.75*H,height:1.5-rate*.5},
  {time:now-.25*H,height:1.5}
]});
const evaluate=(f,rate)=>evaluateFloodSignal(f,observation(f,rate),now);
assert.equal(INLAND_COAST_BUFFER_KM,125);
assert.equal(NON_TIDAL_RAPID_RISE_M_PER_H,.30);
assert.equal(COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H,1.40);

// Coordinates represent the TOWN locality, not a claim about an existing BoM
// gauge or the actual 27 March 2025 time series.
const adavale=make("bom:990001",[144.6005,-25.9108]);
assert.equal(gaugeRiseScreeningZone(adavale).zone,"inland");
assert.ok(approximateQueenslandCoastDistanceKm(adavale)>500);
const modest=evaluate(adavale,.40);
assert.equal(modest.show,true,"Adavale-type inland 0.4 m/h rise must show");
assert.equal(modest.state,"rapid-rise");
assert.equal(modest.screeningThresholdMetresPerHour,.30);
assert.equal(modest.riseScreeningZone,"inland");
assert.equal(evaluate(adavale,.29).show,false);
assert.equal(evaluate(adavale,1.8).show,true);
for(const [name,coords] of Object.entries({
  Longreach:[144.25,-23.44],
  MountIsa:[139.49,-20.73],
  Charleville:[146.24,-26.4],
  Roma:[148.79,-26.57]
})){
  const station=make("bom:990002",coords);
  assert.equal(gaugeRiseScreeningZone(station).zone,"inland",name);
  assert.equal(evaluate(station,.40).rapidRise,true,name+" true inland rise");
}

// Coastal ambiguity includes southeast ocean entry and Gulf of Carpentaria.
for(const [name,coords] of Object.entries({
  GoldCoastSeaway:[153.432,-27.95],
  Rockhampton:[150.51,-23.38],
  Cairns:[145.77,-16.92],
  Karumba:[140.84,-17.49]
})){
  const coast=make("bom:990003",coords);
  assert.equal(gaugeRiseScreeningZone(coast).zone,"coastal-uncertain",name);
  assert.equal(evaluate(coast,.50).show,false,
    name+": normal or ambiguous tide cannot produce blue marker");
  assert.equal(evaluate(coast,1.60).rapidRise,true,name);
  assert.equal(evaluate(coast,1.60).screeningThresholdMetresPerHour,1.40);
}
const tagged=make("bom:990004",[144.6005,-25.9108],
  "below-minor","tide gauge;");
assert.equal(evaluate(tagged,2.0).show,false,
  "Explicit measured tidal influence always overrides inland coordinates");
const unknown=make("bom:990005",null);
assert.equal(gaugeRiseScreeningZone(unknown).zone,"unknown");
assert.equal(evaluate(unknown,.40).show,false,
  "Invalid coordinate must NOT silently assume an inland catchment");
for(const level of ["minor","moderate","major"]){
  const west=make("bom:990006",[144.6005,-25.9108],level);
  const coast=make("bom:990007",[153.432,-27.95],level);
  for(const f of [west,coast]){
    const decision=evaluate(f,.35);
    assert.equal(decision.state,level);
    assert.equal(decision.show,true);
  }
  assert.equal(evaluate(west,.35).rapidRise,true);
  assert.equal(evaluate(coast,.35).rapidRise,false);
}
const selected=reconcileFloodEvents([adavale],observation(adavale,.40),{},now);
assert.equal(selected.features.length,1);
assert.equal(selected.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.equal(selected.features[0].properties.STORMTRACKER_RATE_SCREENING_ZONE,"inland");
assert.equal(selected.features[0].properties.STORMTRACKER_RATE_THRESHOLD_M_PER_H,.30);
console.log("PASS synthetic Adavale and western inland 0.30 m/h screening; Gulf/Gold Coast tidal suppression, preserved BoM classes, source-ID isolation.");
