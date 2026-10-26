import assert from "node:assert/strict";
import {reconcileFloodEvents,cleanFloodEvents,FLOOD_EVENT_RECOVERY_COUNT,
 preRiseReference} from "../src/context-layers/river-flood-events-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
import {riverGaugePanelAppearance} from "../src/context-layers/river-gauges-operational-v1.js";
import {floodIconPriority} from "../src/context-layers/severity-marker-layer-v1.js";

const MIN=60000,base=Date.UTC(2026,9,24,1,0);
const ts=n=>base+n*MIN;
const qldTime=at=>{
 const d=new Date(at+10*3600000);
 const f=x=>String(x).padStart(2,"0");
 return `${f(d.getUTCHours())}:${f(d.getUTCMinutes())} ${f(d.getUTCDate())}/${f(d.getUTCMonth()+1)}/${d.getUTCFullYear()}`;
};
const measure=(id,observedAt,height,trend="falling",klass="",tidal=false)=>({
 type:"Feature",id,geometry:{type:"Point",coordinates:[149,-21]},
 properties:{bom_stn_num:id.slice(4),location_types:tidal?
  "water level gauge;tide gauge;":"water level gauge;",
  STORMTRACKER_OBSERVED_TEXT:qldTime(observedAt),
  STORMTRACKER_OFFICIAL_OBSERVED_AT:observedAt,
  STORMTRACKER_HEIGHT_METRES:height,STORMTRACKER_TENDENCY:trend,
  STORMTRACKER_FLOOD_CLASS:klass}
});
const id="bom:999991",first=measure(id,ts(-15),2.4,"rising");
let history={[id]:[{time:ts(-45),height:1.0},{time:ts(-15),height:2.4}]};
const ref=preRiseReference(history[id],base);
assert.equal(ref.baselineHeight,1.0);
assert.equal(ref.peakHeight,2.4);
assert(ref.recoveryMarginMetres>=0.05 && ref.recoveryMarginMetres<=0.20);
let state=reconcileFloodEvents([first],history,{},base);
assert.equal(state.features.length,1);
assert.equal(state.features[0].properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
assert.equal(state.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.equal(state.events[id].baselineHeight,1.0,"Baseline is the same station's pre-rise level");
assert.equal(FLOOD_EVENT_RECOVERY_COUNT,2);
const next=(at,height,tendency="falling")=>{
 history[id]=[...history[id],{time:at,height}];
 state=reconcileFloodEvents([measure(id,at,height,tendency)],history,
    cleanFloodEvents(state.events,at+15*MIN),at+15*MIN);
 return state.features[0]?.properties??null;
};
let p=next(ts(15),1.6);
assert.equal(p.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(p.STORMTRACKER_RAPID_RISE,false,
 "No blue arrow after the rapid rise stops");
assert.equal(p.STORMTRACKER_ALERT_PERSISTED,true);
assert.equal(p.STORMTRACKER_RECOVERY_BASELINE_METRES,1);
assert.equal(state.events[id].baselineHeight,1);
const appearance=riverGaugePanelAppearance({displayState:"elevated",rapidRise:false});
assert.equal(appearance.rapidRise,false);
assert.match(appearance.category,/POST-RISE ELEVATED/);
assert.equal(floodIconPriority("elevated"),floodIconPriority("rapid-rise"));
p=next(ts(45),1.12);
assert.equal(p.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(p.STORMTRACKER_RECOVERY_READINGS,1);
assert.equal(state.events[id].recoveryCount,1);
// Replaying the same source timestamp must not count as a second reading.
let repeated=reconcileFloodEvents(
 [measure(id,ts(45),1.12)],history,state.events,ts(65));
assert.equal(repeated.events[id].recoveryCount,1);
assert.equal(repeated.features.length,1);
state=repeated;
p=next(ts(75),1.1);
assert.equal(p,null,"Remove once TWO distinct readings return to pre-rise level");
assert.equal(state.events[id],undefined);
assert.equal(state.features.length,0);
assert.deepEqual(cleanFloodEvents({[id]:{
 type:"rapid-rise",activatedAt:ts(-15),lastObservedAt:ts(-15),
 lastHeight:2.4,peakHeight:2.4,baselineHeight:1,
 recoveryMarginMetres:0.14,recoveryCount:0,lastRecoveryAt:null
}},base+49*3600000),{},"A source outage must not keep an old marker forever");

const stage="bom:533178";
// Mirani is 2.0m minor in the actual 2026 BoM station catalogue.
// A fresh 0.30m observation overrides a stale published "minor" label.
const receding=measure(stage,ts(-15),0.30,"falling","minor");
assert.equal(evaluateFloodSignal(receding,{},base).show,false,
 "Measured below-minor recovery must not become a permanent unverified pin");
const recovered=reconcileFloodEvents([receding],{}, {},base);
assert.equal(recovered.features.length,0);
assert.equal(recovered.events[stage],undefined);
// Missing verified site stages do not confer a made-up 2.0m threshold.
assert.equal(reconcileFloodEvents([
 measure("bom:999992",ts(-15),1.6,"steady")
],{}, {},base).features.length,0);
// Tidal level changes never create a threshold-free flash-rise event.
const tidal="bom:999993";
const tideHistory={[tidal]:[{time:ts(-45),height:1},
 {time:ts(-15),height:2.5}]};
const tide=reconcileFloodEvents([
 measure(tidal,ts(-15),2.5,"rising","",true)
],tideHistory,{},base);
assert.equal(tide.features.length,0);
assert.deepEqual(tide.events,{});
// Stale repeat data cannot qualify as confirmed recovery.
let stale=reconcileFloodEvents([
 measure(id,ts(-15),2.4,"steady")
],history,{[id]:{type:"rapid-rise",activatedAt:ts(-15),
 lastObservedAt:ts(-15),lastHeight:2.4,peakHeight:2.4,
 baselineHeight:1,recoveryMarginMetres:0.14,recoveryCount:0,lastRecoveryAt:null}},base+120*MIN);
assert.equal(stale.features.length,1);
assert.equal(stale.features[0].properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(stale.features[0].properties.STORMTRACKER_OBSERVATION_STALE,true);
assert.equal(stale.features[0].properties.STORMTRACKER_RECOVERY_READINGS,0);

console.log("PASS below-minor removal, verified station pre-rise recovery, no-threshold persistence, two source readings, tidal screen and stale safety");
