import assert from "node:assert/strict";
import {evaluateFloodSignal,filterOperationalFloodGauges,
  FLOOD_SIGNAL_MAX_AGE_MS,NON_TIDAL_RAPID_RISE_M_PER_H,
  parseQueenslandObservationTime,latestRiseRate,latestMeasuredRiseRate,
  isVerifiedNonTidalGauge,isObservedTidalGauge} from "../src/context-layers/river-flood-signals-v1.js";
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
// Rates use actual SAME-STATION observation separation (30–120 minutes),
// including the sparse BoM telemetry that previously disappeared from panels.
for (const [minutes,start,end,expected] of [
  [30,1.0,1.3,0.60],
  [60,1.0,2.0,1.00],
  [90,2.0,1.1,-0.60],
  [120,1.2,1.2,0]
]) {
  const rate=latestRiseRate([
    {time:now-(15+minutes)*MIN,height:start},
    {time:now-15*MIN,height:end}
  ],now);
  assert.ok(rate,minutes+"-minute authentic records must supply a measured rate");
  assert.equal(rate.intervalMinutes,minutes);
  assert.equal(Number(rate.rateMetresPerHour.toFixed(2)),expected);
  assert.equal(rate.baselineHeight,start);
}
const sparse=latestRiseRate([
 {time:now-75*MIN,height:1.0},{time:now-15*MIN,height:2.0}],now);
assert.equal(sparse.rateMetresPerHour,1);
assert.equal(sparse.intervalMinutes,60);
const nearest=latestRiseRate([
 {time:now-115*MIN,height:0.2},
 {time:now-55*MIN,height:1.0},
 {time:now-35*MIN,height:1.4},
 {time:now-15*MIN,height:1.8}],now);
assert.equal(nearest.intervalMinutes,40,
  "Use the nearest eligible older measurement rather than interpolating 30 minutes");
assert.equal(nearest.baselineHeight,1.0);
assert.ok(Math.abs(nearest.rateMetresPerHour-1.2)<1e-9);
assert.equal(latestRiseRate([
 {time:now-140*MIN,height:1.0},{time:now-15*MIN,height:2.0}],now),null,
 "125-minute gap must not be silently accepted");
assert.equal(latestRiseRate([
 {time:now-40*MIN,height:1.0},{time:now-15*MIN,height:2.0}],now),null,
 "25-minute gap must not trigger rapid rise");
assert.equal(latestRiseRate([
 {time:now-150*MIN,height:1.0},{time:now-100*MIN,height:2.0}],now),null,
 "Stale gauges must not supply a current rate");
// Live Laidley Creek at Showground Weir (BoM 540158), 26 Oct 2026:
// the last valid reading at 12:34 AEST was older than the 90-minute ALERT
// freshness deadline, but 225 true station observations were available.
const laidleyNow=Date.UTC(2026,9,26,4,26); // 14:26 AEST
const laidleySamples=[
 {time:Date.UTC(2026,9,26,1,39),height:8.92}, // 11:39 AEST
 {time:Date.UTC(2026,9,26,2,34),height:8.66}  // 12:34 AEST
];
assert.equal(latestRiseRate(laidleySamples,laidleyNow),null,
  "Stale BoM history MUST NOT trigger a live rapid-rise arrow");
const historic=latestMeasuredRiseRate(laidleySamples,laidleyNow);
assert.ok(historic,"Informational rise/fall survives the 90-minute alert cutoff");
assert.equal(historic.intervalMinutes,55);
assert.equal(Number(historic.rateMetresPerHour.toFixed(2)),-0.28);
assert.equal(historic.observedAt,Date.UTC(2026,9,26,2,34));

// A station reporting its next reading 27 minutes later (Coulson Crossing)
// can still show a truthful measured trend. The blue rapid-rise alert itself
// remains restricted to confirmed 30–120-minute observation comparisons.
const coulsonSamples=[
 {time:Date.UTC(2026,9,26,1,58),height:4.65},
 {time:Date.UTC(2026,9,26,3,35),height:4.65},
 {time:Date.UTC(2026,9,26,4,2),height:4.60}
];
assert.equal(latestRiseRate(coulsonSamples,laidleyNow),null,
  "27-minute latest gap and 124-minute older gap must not trigger rapid rise");
const coulsonRate=latestMeasuredRiseRate(coulsonSamples,laidleyNow);
assert.equal(coulsonRate.intervalMinutes,27);
assert.equal(Number(coulsonRate.rateMetresPerHour.toFixed(2)),-0.11);
assert.equal(latestMeasuredRiseRate([coulsonSamples[2]],laidleyNow),null,
  "Never fabricate a comparison from only one timestamp");
assert.equal(latestMeasuredRiseRate([
 {time:laidleyNow-10*60000,height:1},
 {time:laidleyNow-10*60000,height:2}],laidleyNow),null,
 "Duplicate timestamps must not create a divided-by-zero rate");

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
 [recent.id]:[{time:now-45*MIN,height:1.0},{time:now-15*MIN,height:2.5}],
 [below.id]:[{time:now-45*MIN,height:1.0},{time:now-15*MIN,height:2.5}]
};
assert.ok(NON_TIDAL_RAPID_RISE_M_PER_H>0);
// Exact-ID BoM-reviewed non-tidal station near the coast: genuine +0.40 m/h
// must qualify without lowering the existing 1.40 m/h rule elsewhere.
// Source: Laidley Creek at Warrego Highway, station 540529.
const warrego=make("bom:540529","minor","rising");
warrego.geometry.coordinates=[152.389,-27.553];
warrego.properties.STORMTRACKER_HEIGHT_METRES=4.94;
const warregoHistory={
 [warrego.id]:[{time:now-45*MIN,height:4.74},{time:now-15*MIN,height:4.94}]
};
assert.equal(isVerifiedNonTidalGauge(warrego),true,
  "Only a positively reviewed exact-ID station can override coastal uncertainty");
const warregoDecision=screen(warrego,warregoHistory);
assert.equal(warregoDecision.state,"minor");
assert.equal(warregoDecision.rapidRise,true,
  "A genuine +0.40 m/hour at reviewed non-tidal Warrego Highway adds blue arrow");
assert.equal(warregoDecision.riseScreeningZone,"verified-non-tidal");
assert.equal(warregoDecision.screeningThresholdMetresPerHour,0.30);
const uncertainCoastal=make("bom:999996","minor","rising");
uncertainCoastal.geometry.coordinates=[152.389,-27.553];
uncertainCoastal.properties.STORMTRACKER_HEIGHT_METRES=4.94;
const uncertainHistory={
 [uncertainCoastal.id]:warregoHistory[warrego.id]
};
assert.equal(isVerifiedNonTidalGauge(uncertainCoastal),false);
assert.equal(screen(uncertainCoastal,uncertainHistory).rapidRise,false,
  "Unreviewed coastal gauges retain conservative 1.40 m/hour screening");
assert.equal(screen(uncertainCoastal,uncertainHistory).screeningThresholdMetresPerHour,1.40);
const declaredTidal=structuredClone(warrego);
declaredTidal.properties.location_types="water level gauge;tide gauge;";
assert.equal(isVerifiedNonTidalGauge(declaredTidal),false,
  "Official tidal metadata overrides a prior non-tidal review");
assert.equal(isObservedTidalGauge(declaredTidal,warregoHistory[warrego.id],now),true);
assert.equal(screen(declaredTidal,warregoHistory).rapidRise,false,
  "Verified tidal gauges remain protected against tide-based blue arrows");
const mismatchedStation=structuredClone(warrego);
mismatchedStation.properties.bom_stn_num="540528";
assert.equal(isVerifiedNonTidalGauge(mismatchedStation),false,
  "Never apply reviewed non-tidal screening to a different source station ID");
assert.equal(screen(mismatchedStation,warregoHistory).rapidRise,false,
  "Conflicting station ID does not inherit the lower non-tidal threshold");

const minor=screen(recent,measured);
const blue=screen(below,measured);
assert.equal(minor.state,"minor");
assert.equal(minor.rapidRise,true);
assert.equal(blue.state,"rapid-rise");
assert.equal(blue.rapidRise,true);
// BoM tendency is retained as information, never used to gate a measured rate.
for(const tendency of ["rising","steady","falling",""]){
 const source=make(below.id,"below-minor",tendency);
 const result=screen(source,measured);
 assert.equal(result.rapidRise,true,
   "Measured fast rise triggers without BoM tendency approval: "+tendency);
 const selected=reconcileFloodEvents([source],measured,{},now);
 assert.equal(selected.features[0].properties.STORMTRACKER_TENDENCY,tendency,
   "Existing source tendency is retained for the information panel");
}
// Once the measured rate slows, no rapid-rise arrow remains, even if BoM
// continues to say 'rising'. Severity colours and post-rise monitoring persist.
const later=now+60*MIN, laterText="7:15 pm Thu 08/10/2026";
for(const level of ["minor","moderate","major"]){
 const stillFlooding=make(recent.id,level,"rising","information",laterText);
 stillFlooding.properties.STORMTRACKER_HEIGHT_METRES=2.55;
 const selected=reconcileFloodEvents([stillFlooding],{
  [recent.id]:[...measured[recent.id],{time:now+15*MIN,height:2.52},{time:now+45*MIN,height:2.55}]
 },{},later);
 assert.equal(selected.features.length,1,level+" base flood marker persists");
 assert.equal(selected.features[0].properties.STORMTRACKER_DISPLAY_STATE,level);
 assert.equal(selected.features[0].properties.STORMTRACKER_RAPID_RISE,false,
   level+" blue arrow clears when the measured rate slows");
 assert.equal(selected.features[0].properties.STORMTRACKER_TENDENCY,"rising",
   "BoM tendency remains published separately from the measured rate");
}
const firstBelow=reconcileFloodEvents([below],measured,{},now);
const stillElevated=make(below.id,"below-minor","rising","information",laterText);
stillElevated.properties.STORMTRACKER_HEIGHT_METRES=2.55;
const followUp=reconcileFloodEvents([stillElevated],{
 [below.id]:[...measured[below.id],{time:now+15*MIN,height:2.52},{time:now+45*MIN,height:2.55}]
},firstBelow.events,later);
assert.equal(followUp.features.length,1,"Post-rise monitoring marker persists");
assert.equal(followUp.features[0].properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(followUp.features[0].properties.STORMTRACKER_RAPID_RISE,false,
 "Post-rise monitoring icon sheds the blue rapid-rise arrow");
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
assert.ok(selected.events[below.id],"Unclassified gauge retains its exact pre-rise level for recovery monitoring");
assert.equal(selected.events[below.id].baselineHeight,1.0);
assert.equal(selected.counts.rapidRise,2);
assert.equal(selected.features.find(f=>f.id==="bom:3").properties.STORMTRACKER_RAPID_RISE,false);
assert.equal(selected.features.find(f=>f.id===below.id).properties.STORMTRACKER_DISPLAY_STATE,"rapid-rise");
const recedingMinor=make(recent.id,"minor","falling","information",laterText);
const recedingBelow=make(below.id,"below-minor","falling","information",laterText);
recedingMinor.properties.STORMTRACKER_HEIGHT_METRES=2.55;
recedingBelow.properties.STORMTRACKER_HEIGHT_METRES=2.55;
const recovered=reconcileFloodEvents(
  [recedingMinor,recedingBelow],
  {[recent.id]:[...measured[recent.id],{time:now+15*MIN,height:2.52},{time:now+45*MIN,height:2.55}],
   [below.id]:[...measured[below.id],{time:now+15*MIN,height:2.52},{time:now+45*MIN,height:2.55}]},
  selected.events,later);
assert.equal(recovered.features.length,2,
  "Official minor persists; threshold-free gauge stays monitored while still 1.5m above its own pre-rise level");
assert.equal(recovered.features.find(f=>f.id===recent.id).properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(recovered.features.find(f=>f.id===below.id).properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(recovered.features.find(f=>f.id===below.id).properties.STORMTRACKER_RAPID_RISE,false);
assert.ok(FLOOD_EVENTS_STORAGE_KEY.includes("flood"));
assert.deepEqual(cleanFloodEvents({"garbage":{type:"rapid-rise"}},now),{});
console.log("PASS missing-threshold BoM class fallback: classified minor/moderate/major persistence; measured rise badge; blue below minor; strict stale/recovery clearing; all forecast-site classes.");
