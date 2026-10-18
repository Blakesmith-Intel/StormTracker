import assert from "node:assert/strict";
import {
  observedTidalOscillation, isObservedTidalGauge, compactFloodHistory,
  evaluateFloodSignal,filterOperationalFloodGauges
} from "../src/context-layers/river-flood-signals-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";

const now=Date.UTC(2026,9,8,8,30);
const hour=3600000;
const observed="6:15 pm Thu 08/10/2026";
const point=(time,height)=>({time,height});
const fixture=(id,cls,types="water level gauge;")=>({
  type:"Feature",id,geometry:{type:"Point",coordinates:[153.1,-27.0]},
  properties:{
    bom_stn_num:id.split(":")[1],name:"Original BoM station "+id,
    location_types:types,
    STORMTRACKER_OBSERVED_TEXT:observed,
    STORMTRACKER_HEIGHT_METRES:1.2,
    STORMTRACKER_TENDENCY:"rising",
    STORMTRACKER_FLOOD_CLASS:cls,
  }
});
// This observation time is 15 minutes ago, and the latest observed
// tide normally rises at ~0.4 m/hour: it must NOT become a flash-flood pin.
const tidalHistory=Array.from({length:48},(_,i)=>
  point(now-(47.25-i)*hour,1.4+1.0*Math.sin(i*Math.PI/6)));
const observedTide=tidalHistory.at(-1);
const earlierTide=tidalHistory.at(-2);
assert.ok(observedTide.height>earlierTide.height,
  "Test waveform must be on a natural incoming tide");
assert.ok((observedTide.height-earlierTide.height)>0.3,
  "Normal tide must exceed the ordinary non-tidal rapid-rise threshold");
assert.equal(observedTidalOscillation(tidalHistory,now),true);
const tidalNamed=fixture("bom:540902","below-minor",
 "water level gauge;tide gauge;");
const tideRiver=fixture("bom:540903","below-minor","water level gauge;");
assert.equal(isObservedTidalGauge(tidalNamed,[],now),true);
assert.equal(isObservedTidalGauge(tideRiver,tidalHistory,now),true,
 "A real tide-affected river gauge may have no tide gauge tag");
const history={
 [tidalNamed.id]:tidalHistory,
 [tideRiver.id]:tidalHistory
};
for(const gauge of [tidalNamed,tideRiver]){
  const result=evaluateFloodSignal(gauge,history,now);
  assert.equal(result.show,false,
    "Normal incoming tide must never render a blue flash-rise icon: "+gauge.id);
}
for(const cls of ["minor","moderate","major"]){
  for(const gauge of [tidalNamed,tideRiver]){
    const test={...gauge,properties:{...gauge.properties,
      STORMTRACKER_FLOOD_CLASS:cls}};
    const result=evaluateFloodSignal(test,history,now);
    assert.equal(result.show,true,"Official BoM flood classification remains");
    assert.equal(result.state,cls);
    assert.equal(result.rapidRise,false,
      "No blue rapid-rise modifier from tidal-level change");
    const layer=reconcileFloodEvents([test],history,{},now);
    assert.equal(layer.features.length,1);
    assert.equal(layer.features[0].properties.STORMTRACKER_DISPLAY_STATE,cls);
    assert.equal(layer.features[0].properties.STORMTRACKER_RAPID_RISE,false);
  }
}
const tidalCount=filterOperationalFloodGauges(
 [tidalNamed,tideRiver],history,now);
assert.equal(tidalCount.features.length,0);
assert.equal(tidalCount.counts.rapidRise,0);
assert.equal(tidalCount.counts.tidalAnomaly,0);
const compacted=compactFloodHistory(history,[tidalNamed,tideRiver],now);
assert.ok(compacted[tidalNamed.id].length>=40);
assert.ok(compacted[tideRiver.id].length>=40,
  "A station with observed tidal oscillations must retain its 48h evidence");

// Real non-tidal rapidly rising water must still surface, even if another
// station nearby has tides. Identity and history are always station-ID-scoped.
const river=fixture("bom:533178","below-minor");
const riverHistory=[
 point(now-75*60000,0.35),point(now-15*60000,1.95)
];
const mixed={...history,[river.id]:riverHistory};
assert.equal(isObservedTidalGauge(river,riverHistory,now),false);
const active=evaluateFloodSignal(river,mixed,now);
assert.equal(active.show,true);
assert.equal(active.state,"rapid-rise");
assert.equal(active.rapidRise,true);
const oldWave=tidalHistory.slice(0,47);
assert.equal(observedTidalOscillation(oldWave,now),true);
const stableFlood={...river,properties:{...river.properties,
  STORMTRACKER_TENDENCY:"falling",STORMTRACKER_FLOOD_CLASS:"minor"}};
const slow=evaluateFloodSignal(stableFlood,mixed,now);
assert.equal(slow.state,"minor");
assert.equal(slow.rapidRise,false);
assert.equal(observedTidalOscillation(riverHistory,now),false,
 "Two rapid observations alone do not prove tidal pattern");
console.log("PASS BoM tidal tag + untagged observed tide reject false blue arrow, retain genuine flood colour and non-tidal rapid rise.");
