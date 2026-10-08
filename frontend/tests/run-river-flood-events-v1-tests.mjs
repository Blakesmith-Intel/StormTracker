import assert from "node:assert/strict";
import {
  FLOOD_EVENTS_STORAGE_KEY, cleanFloodEvents,reconcileFloodEvents
} from "../src/context-layers/river-flood-events-v1.js";
const MIN=60000,T0=Date.UTC(2026,9,8,7,0);
const record=(at,height,cls="minor",trend="rising",tidal=false)=>({
  id:"bom:01234",type:"Feature",geometry:{type:"Point",coordinates:[153,-27]},
  properties:{
    STORMTRACKER_OBSERVED_TEXT:new Date(at+10*3600000).toISOString()
      .slice(11,16)+" Thu 08/10/2026",
    STORMTRACKER_HEIGHT_METRES:height,STORMTRACKER_FLOOD_CLASS:cls,
    STORMTRACKER_TENDENCY:trend,
    location_types:tidal?"water level gauge;tide gauge;":"water level gauge;"
  }
});
const history={"bom:01234":[{time:T0,height:1}]};
const run=(feat,at,events)=>reconcileFloodEvents([feat],history,events,at+5*MIN);
history["bom:01234"].push({time:T0+60*MIN,height:2});
let out=run(record(T0+60*MIN,2),T0+60*MIN,{});
assert.equal(out.features.length,1);
assert.equal(out.features[0].properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
assert.equal(out.features[0].properties.STORMTRACKER_ALERT_PERSISTED,false);
assert.equal(out.events["bom:01234"].recoveryCount,0);
assert.ok(FLOOD_EVENTS_STORAGE_KEY.includes("flood"));
const persisted=JSON.parse(JSON.stringify(out.events));
out=run(record(T0+60*MIN,2),T0+60*MIN,persisted);
assert.equal(out.events["bom:01234"].recoveryCount,0,"Duplicate poll cannot count as recovery");
history["bom:01234"].push({time:T0+75*MIN,height:1.98});
out=run(record(T0+75*MIN,1.98,"minor","falling"),T0+75*MIN,out.events);
assert.equal(out.features.length,1,"One falling observation cannot immediately remove hazard marker");
assert.equal(out.events["bom:01234"].recoveryCount,0,"Rate still elevated: not proof of recovery");
history["bom:01234"].push({time:T0+105*MIN,height:1.96});
out=run(record(T0+105*MIN,1.96,"minor","falling"),T0+105*MIN,out.events);
assert.equal(out.events["bom:01234"].recoveryCount,1);
assert.equal(out.features[0].properties.STORMTRACKER_ALERT_PERSISTED,true);
assert.match(out.features[0].properties.STORMTRACKER_ALERT_REASON,/recovery|monitor/i);
let same=run(record(T0+105*MIN,1.96,"minor","falling"),T0+105*MIN,out.events);
assert.equal(same.events["bom:01234"].recoveryCount,1,"Repeated 15-min poll no extra all-clear evidence");
history["bom:01234"].push({time:T0+135*MIN,height:1.94});
out=run(record(T0+135*MIN,1.94,"minor","falling"),T0+135*MIN,same.events);
assert.equal(out.features.length,0,"Two new measured recovering readings clear inferred screen");
assert.deepEqual(out.events,{}, "Cleared event no longer stored");
let t=run(record(T0+60*MIN,2),T0+60*MIN,{});
t=run(record(T0+75*MIN,1.98,"major","falling"),T0+75*MIN,t.events);
assert.equal(t.features[0].properties.STORMTRACKER_DISPLAY_STATE,"major");
assert.deepEqual(t.events,{},"Authoritative BoM major overrides inferred screen");
t=run(record(T0+75*MIN,1.98,"moderate","steady"),T0+75*MIN,{});
assert.equal(t.features[0].properties.STORMTRACKER_DISPLAY_STATE,"moderate");
t=run(record(T0+75*MIN,1.98,"minor","falling"),T0+75*MIN,{});
assert.equal(t.features.length,0,"Moderate clears only after BoM class changes");
const prior={"bom:01234":{type:"tidal-anomaly",activatedAt:T0,
 lastObservedAt:T0+60*MIN,recoveryCount:0,lastHeight:2,lastRecoveryAt:null}};
const tide=run(record(T0+75*MIN,1.98,"","falling",true),T0+75*MIN,prior);
assert.equal(tide.features.length,1,"Tidal screen persists through first smaller observation");
assert.equal(tide.features[0].properties.STORMTRACKER_DISPLAY_STATE,"tidal-anomaly");
const stale=cleanFloodEvents(prior,T0+3*3600000);
assert.deepEqual(stale,{},"Stale inferred events must never remain indefinitely");
assert.deepEqual(cleanFloodEvents({"other":{type:"rapid-rise"}},T0),{});
console.log("Flood persistence passed: no instant dismissal, only two valid and distinct recovering readings clear rapid-rise; duplicates, rising rates and stale data cannot false-clear; official major/moderate priority.");
