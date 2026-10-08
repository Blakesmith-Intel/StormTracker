import assert from "node:assert/strict";
import {
  FLOOD_SIGNAL_STORAGE_KEY,
  FLOOD_SIGNAL_MAX_AGE_MS,
  NON_TIDAL_RAPID_RISE_M_PER_H,
  parseQueenslandObservationTime,
  appendGaugeObservation,
  cleanFloodSignalHistory,
  compactFloodHistory,
  latestRiseRate,
  tidalRiseBaseline,
  evaluateFloodSignal,
  filterOperationalFloodGauges
} from "../src/context-layers/river-flood-signals-v1.js";

const now=Date.UTC(2026,9,8,8,30); // Thu 18:30 AEST
const hour=3600000;
const sample=(time,height)=>({time,height});
const station=(id, cls="", tendency="rising", tidal=false, observedText="6:15 pm Thu 08/10/2026")=>({
  type:"Feature",id,properties:{
    location_types:tidal?"water level gauge;tide gauge;":"water level gauge;",
    STORMTRACKER_FLOOD_CLASS:cls,
    STORMTRACKER_TENDENCY:tendency,
    STORMTRACKER_HEIGHT_METRES:2.5,
    STORMTRACKER_OBSERVED_TEXT:observedText
  }
});

assert.match(FLOOD_SIGNAL_STORAGE_KEY,/flood-observations/);
assert.equal(parseQueenslandObservationTime("6:15 pm Thu 08/10/2026",now),now-15*60000);
assert.equal(parseQueenslandObservationTime("6.15pm Thu",now),now-15*60000);
assert.equal(parseQueenslandObservationTime("18:15 Thu",now),now-15*60000);
assert.equal(parseQueenslandObservationTime("6:15 am Thu",now),now-12.25*hour);
assert.equal(parseQueenslandObservationTime("18:15 Wed",now),now-24.25*hour);
assert.equal(parseQueenslandObservationTime("18:15",now),null,"Unknown day cannot support inferred rates");
assert.equal(parseQueenslandObservationTime("16:44 Thu 08/10/2026",now),now-(106*60000));
assert.equal(parseQueenslandObservationTime("19:15 Thu 08/10/2026",now),null,"Future observations rejected");
assert.equal(parseQueenslandObservationTime("6:15 pm Thu 39/10/2026",now),null,"Invalid date rejected");
const h={};
const recent=station("bom:040111","minor");
assert.equal(appendGaugeObservation(h,recent,now),true);
assert.equal(appendGaugeObservation(h,recent,now),true,"Same timestamp de-duplicates");
assert.equal(h[recent.id].length,1);
assert.equal(appendGaugeObservation(h,station("bom:040111","minor","rising",false,"5:15 pm Thu 08/10/2026"),now),true);
assert.equal(h[recent.id].length,2);
assert.equal(latestRiseRate(h[recent.id],now).rateMetresPerHour,0,
  "Two identical recorded heights must never create a rapid-rise alert");
h[recent.id]=[sample(now-hour,1.7),sample(now-15*60000,2.5)];
assert.ok(latestRiseRate(h[recent.id],now).rateMetresPerHour>0.3);
assert.equal(evaluateFloodSignal(recent,h,now).state,"rapid-rise");
assert.equal(evaluateFloodSignal(station("bom:040111","below-minor"),h,now).show,false);
assert.equal(evaluateFloodSignal(station("bom:040111","minor","steady"),h,now).show,false);
assert.equal(evaluateFloodSignal(station("bom:040111","minor","falling"),h,now).show,false);
assert.equal(evaluateFloodSignal(station("bom:040111","minor","rising",false,"10:15 am Thu 08/10/2026"),h,now).show,false,
  "A stale bulletin cannot support the current rapid rise");
assert.equal(evaluateFloodSignal(station("bom:other","minor"),{},now).show,false,
  "A rising tendency alone is not a measured rate");
assert.equal(evaluateFloodSignal(station("bom:major","major","falling"),{},now).state,"major");
assert.equal(evaluateFloodSignal(station("bom:moderate","moderate","steady"),{},now).state,"moderate");
assert.equal(evaluateFloodSignal(station("bom:minor","minor","falling"),{},now).show,false,
  "Minor flooding without rapid rise should not show");
assert.equal(evaluateFloodSignal(station("bom:expired","major","steady",false,"6:15 pm Mon 05/10/2026"),{},now).show,false,
  "Stale flood classifications should not produce operational markers");
assert.equal(evaluateFloodSignal(station("bom:tidal","", "rising", true),{"bom:tidal":h[recent.id]},now).show,false,
  "Tidal gauges cannot trip on raw rate without site tidal baseline");

const tidalId="bom:tidal";
const tidal=[];
for(let i=0;i<46;i++) {
  const time=now-43*hour+i*hour*0.85;
  tidal.push(sample(time,1.2+0.75*Math.sin(i*Math.PI/7)));
}
assert.ok(tidalRiseBaseline(tidal,now)>0,"Historical tidal upward limbs should calibrate baseline");
const base=tidalRiseBaseline(tidal,now);
const lastTime=now-15*60000;
const prepared=tidal.filter(p=>p.time<now-3*hour).concat([
  sample(now-hour-15*60000,1.0),
  sample(lastTime,1.0+Math.max(0.50,base*2))
]);
const tidalOutcome=evaluateFloodSignal(station(tidalId,"","rising",true),{[tidalId]:prepared},now);
assert.equal(tidalOutcome.state,"tidal-anomaly",
  "A measured exceedance of station historical flood-tide rise rates surfaces");
const normal=tidal.filter(p=>p.time<now-3*hour).concat([
  sample(now-hour-15*60000,1.0),sample(lastTime,1.0+base*0.9)
]);
assert.equal(evaluateFloodSignal(station(tidalId,"","rising",true),{[tidalId]:normal},now).show,false);
const cleaned=cleanFloodSignalHistory({
  [tidalId]:[sample(now-30*hour,0.7),sample(now-30*hour,0.8),sample(now+hour,10)],
  "INVALID":[],"__proto__":[]
},now);
assert.equal(cleaned[tidalId].length,1);
assert.equal(cleaned[tidalId][0].height,0.7);
const histories = compactFloodHistory({
  "bom:tidal":[sample(now-40*hour,0.4),sample(now-2*hour,1.4)],
  "bom:river":[sample(now-40*hour,0.4),sample(now-2*hour,1.4)],
  "bom:missing":[sample(now-10*hour,0.9)]
},[station("bom:tidal","","rising",true),station("bom:river","minor")],now);
assert.equal(histories["bom:tidal"].length,2,
  "Tidal stations retain 48h baseline");
assert.equal(histories["bom:river"].length,1,
  "Non-tidal stations retain only rates necessary for recent rise");
assert.equal(histories["bom:missing"].length,1,
  "Partial bulletin must not erase another gauge's prior tidal baseline");
assert.ok(FLOOD_SIGNAL_MAX_AGE_MS<2*hour);
const result=filterOperationalFloodGauges([
  station("bom:moderate","moderate"),station("bom:major","major","falling"),
  station("bom:minor","minor","falling"),station(tidalId,"","rising",true),
  recent
],{...h,[tidalId]:prepared},now);
assert.deepEqual(result.counts,{moderate:1,major:1,rapidRise:1,tidalAnomaly:1});
assert.equal(result.features.length,4);
assert.equal(result.features.find(f=>f.id===tidalId).properties.STORMTRACKER_DISPLAY_STATE,"tidal-anomaly");
assert.equal(result.features.find(f=>f.id===recent.id).properties.STORMTRACKER_ALERT_SOURCE,"local-rate-screen");
assert.ok(NON_TIDAL_RAPID_RISE_M_PER_H>0);
console.log("Flood signal tests passed: authentic AEST timestamps, stale/future exclusion, moderate/major flood priority, only above-minor non-tidal rapid rise, tide-baseline anomaly, storage hygiene, no ambiguous/unverified alerts.");
