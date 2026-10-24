// Flood-stage and rate-based lifecycle, keyed exclusively by source station ID.
// A published minor threshold is authoritative; absent thresholds cannot be
// invented from neighbouring gauges or inferred using rainfall.
import {
 evaluateFloodSignal,parseQueenslandObservationTime,
 latestRiseRate,isObservedTidalGauge,FLOOD_SIGNAL_MAX_AGE_MS
} from "./river-flood-signals-v1.js?v=9.13.2";
import {stationFloodLevels} from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";
import {publishedCrossingForFeature} from "./river-crossing-state-v1.js?v=20261024-crossing-coverage-v1";

export const FLOOD_EVENTS_STORAGE_KEY="stormtracker.qld-flood-events.v1";
export const FLOOD_EVENT_RECOVERY_COUNT=2;
const RECOVERY_MIN_GAP_MS=15*60000;
const EVENT_STALE_LIMIT_MS=48*3600000;
const eventId=id=>/^(bom|awrc):[a-z0-9_-]+$/i.test(String(id??""));
const isNumber=x=>typeof x==="number"&&Number.isFinite(x);
const officialStates=new Set(["minor","moderate","major"]);
const fresh=(observed,now)=>isNumber(observed)&&observed>0&&
 observed<=now+5*60000&&now-observed<=FLOOD_SIGNAL_MAX_AGE_MS;
function observationTime(feature,now){
 const p=feature?.properties??{},stored=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
 return isNumber(stored)&&stored>0&&stored<=now+5*60000
  ?stored:parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
}
// A reference is established only from THIS station's actual measured water
// height immediately before a measured rapid rise. This is a pre-rise level,
// not a fabricated BoM minor stage or climatological normal.
export function preRiseReference(samples,now=Date.now()){
 const rise=latestRiseRate(samples,now);
 if(!rise||rise.rateMetresPerHour<=0)return null;
 const sorted=(Array.isArray(samples)?samples:[]).filter(p=>
   isNumber(p?.time)&&isNumber(p?.height)).sort((a,b)=>a.time-b.time);
 const latest=sorted.findLast(p=>p.time===rise.observedAt);
 const before=[...sorted].reverse().find(p=>
   p.time<rise.observedAt &&
   rise.observedAt-p.time>=30*60000 &&
   rise.observedAt-p.time<=120*60000);
 if(!latest||!before||latest.height<=before.height)return null;
 // Avoid arbitrary absolute river levels; guard sensor jitter relative to
 // the actual measured event amplitude.
 const margin=Math.max(0.05,Math.min(0.20,
   Math.round((latest.height-before.height)*0.1*100)/100));
 return {baselineHeight:before.height,peakHeight:latest.height,
   recoveryMarginMetres:margin,observedAt:latest.time};
}
function validRecord(record,now){
 if(!record||record.type!=="rapid-rise"||
    !isNumber(record.activatedAt)||!isNumber(record.lastObservedAt)||
    !isNumber(record.lastHeight)||!isNumber(record.baselineHeight)||
    !isNumber(record.peakHeight)||!isNumber(record.recoveryMarginMetres)||
    record.recoveryMarginMetres<0.05||record.recoveryMarginMetres>0.20||
    record.activatedAt>now+5*60000||
    record.lastObservedAt>now+5*60000||
    now-record.lastObservedAt>EVENT_STALE_LIMIT_MS||
    record.peakHeight<record.baselineHeight)return null;
 return {type:"rapid-rise",activatedAt:record.activatedAt,
   lastObservedAt:record.lastObservedAt,lastHeight:record.lastHeight,
   baselineHeight:record.baselineHeight,peakHeight:record.peakHeight,
   recoveryMarginMetres:record.recoveryMarginMetres,
   recoveryCount:Math.max(0,Math.min(1,Math.floor(Number(record.recoveryCount)||0))),
   lastRecoveryAt:isNumber(record.lastRecoveryAt)?record.lastRecoveryAt:null};
}
export function cleanFloodEvents(input,now=Date.now()){
 const out={};
 if(!input||typeof input!=="object"||Array.isArray(input))return out;
 for(const [id,record] of Object.entries(input).slice(0,1800)){
  if(!eventId(id))continue;
  const valid=validRecord(record,now);
  if(valid)out[id]=valid;
 }
 return out;
}
function showFeature(feature,decision,{state=decision.state,
 persisted=false,recoveryCount=0,baseline=null,stale=decision.stale??false,
 rapidRise=decision.rapidRise??false,reason=decision.reason,source=decision.source}={}){
 const p=feature.properties??{};
 return {...feature,properties:{...p,
  STORMTRACKER_DISPLAY_STATE:state,
  STORMTRACKER_RAPID_RISE:Boolean(rapidRise),
  STORMTRACKER_TIDAL_SCREENED:Boolean(decision.tidalScreened),
  STORMTRACKER_ALERT_REASON:reason??"",
  STORMTRACKER_ALERT_SOURCE:source??"",
  STORMTRACKER_OBSERVATION_STALE:Boolean(stale),
  STORMTRACKER_CLASSIFICATION_UNVERIFIED:Boolean(decision.classificationUnverified),
  STORMTRACKER_OFFICIAL_OBSERVED_AT:decision.lastObservedAt??
   p.STORMTRACKER_OFFICIAL_OBSERVED_AT??null,
  STORMTRACKER_ALERT_PERSISTED:persisted,
  STORMTRACKER_RECOVERY_READINGS:recoveryCount,
  STORMTRACKER_RECOVERY_BASELINE_METRES:baseline,
  STORMTRACKER_RATE_SCREENING_ZONE:decision.riseScreeningZone??"",
  STORMTRACKER_RATE_THRESHOLD_M_PER_H:decision.screeningThresholdMetresPerHour??null,
  STORMTRACKER_RISE_RATE_M_PER_H:decision.rise?.rateMetresPerHour??null,
  STORMTRACKER_RATE_INTERVAL_MINUTES:decision.rise?.intervalMinutes??null,
  STORMTRACKER_TIDAL_BASELINE_M_PER_H:decision.tidalBaselineMetresPerHour??null,
  STORMTRACKER_TIDAL_CONTEXT:p.STORMTRACKER_TIDAL_CONTEXT??""
 }};
}
// A BoM stage remains on-screen while at/above minor; a fresh BELOW-minor
// verified height removes the stage even if an earlier flood class lingers.
// A threshold-free event stays visible while above its original measured
// pre-rise reference, including steady or falling water; only two fresh,
// distinct observations at the reference confirm recovery.
export function reconcileFloodEvents(features,history={},oldEvents={},now=Date.now(),crossingCatalogue=null){
 const prior=cleanFloodEvents(oldEvents,now),events={};
 const selected=[],counts={minor:0,moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
 const seen=new Set();
 for(const feature of features??[]){
  const id=String(feature?.id??""),p=feature?.properties??{};
  if(!eventId(id)||seen.has(id))continue;
  seen.add(id);
  const decision=evaluateFloodSignal(feature,history,now);
  const observation=observationTime(feature,now);
  const height=p.STORMTRACKER_HEIGHT_METRES;
  const isFresh=fresh(observation,now)&&isNumber(height);
  const noMinor=stationFloodLevels(feature)?.minor==null;
  const crossing=publishedCrossingForFeature(feature,crossingCatalogue);
  // Only a fresh SAME-station current river height can confirm a crossing.
  const crossingReached=Boolean(isFresh&&crossing&&height>=crossing.heightMetres);
  const tidal=isObservedTidalGauge(feature,history[id]??[],now);
  let event=prior[id];
  // Never carry a rate-only alert through published flood-stage gauges,
  // the tidal screen, or an authoritative current flood class.
  if(!noMinor||tidal||officialStates.has(decision.state))event=null;
  const newlyRapid=decision.show&&decision.state==="rapid-rise"&&
    Boolean(decision.rapidRise)&&!tidal&&noMinor&&isFresh;
  if(newlyRapid){
   if(!event){
    const reference=preRiseReference(history[id],now);
    if(reference && reference.observedAt===observation){
     event={type:"rapid-rise",activatedAt:observation,
       lastObservedAt:observation,lastHeight:height,
       baselineHeight:reference.baselineHeight,
       peakHeight:Math.max(reference.peakHeight,height),
       recoveryMarginMetres:reference.recoveryMarginMetres,
       recoveryCount:0,lastRecoveryAt:null};
    }
   }else if(observation>event.lastObservedAt){
    event={...event,lastObservedAt:observation,lastHeight:height,
      peakHeight:Math.max(event.peakHeight,height),recoveryCount:0,lastRecoveryAt:null};
   }
  }
  let kept=decision.show?showFeature(feature,decision):null;
  if(crossingReached&&!kept){
   // Crossing references are independent of BoM minor/moderate/major stages.
   // The existing blue elevated marker is suitable; no invented flood colour.
   kept=showFeature(feature,decision,{state:"elevated",rapidRise:false,
    stale:false,source:"bom-published-crossing",
    reason:"Measured water level "+height.toFixed(2)+" m is at/above published "+
      crossing.crossingName+" ("+crossing.heightMetres.toFixed(2)+" m). "+
      "Crossing reference is not an official flood classification."});
  }
  if(event){
   if(isFresh && observation>event.lastObservedAt){
    const reached=height<=event.baselineHeight+event.recoveryMarginMetres &&
      !decision.rapidRise &&
      String(p.STORMTRACKER_TENDENCY??"").toLowerCase()!=="rising";
    const confirming=reached &&
      (event.lastRecoveryAt===null||
       observation-event.lastRecoveryAt>=RECOVERY_MIN_GAP_MS);
    const recoveryCount=confirming?event.recoveryCount+1:
      reached?event.recoveryCount:0;
    if(recoveryCount>=FLOOD_EVENT_RECOVERY_COUNT){
     // Two separate, current source readings back at the pre-rise level:
     // terminate the event and remove the marker, not a stale warning.
     event=null;
     if(!decision.show)kept=null;
    }else event={...event,lastObservedAt:observation,lastHeight:height,
      peakHeight:Math.max(event.peakHeight,height),
      recoveryCount,lastRecoveryAt:confirming?observation:
        reached?event.lastRecoveryAt:null};
   }
   if(event){
    if(!newlyRapid && !officialStates.has(decision.state)){
     const stale=!isFresh;
     const pendingRecovery=event.recoveryCount>0;
     kept=showFeature(feature,decision,{
      state:"elevated",rapidRise:false,stale,persisted:true,
      recoveryCount:event.recoveryCount,baseline:event.baselineHeight,
      source:"measured-pre-rise-reference",
      reason:"Water remains under post-rise observation relative to this gauge's measured pre-rise level "+
       event.baselineHeight.toFixed(2)+" m"+
       (pendingRecovery?"; recovery confirmation "+event.recoveryCount+"/2":"")+
       (stale?"; latest height is stale, recovery not verified":"")+
       ". Not an official BoM flood threshold."
     });
    }
    events[id]=event;
   }
  }
  if(!kept)continue;
  if(crossing){
   kept={...kept,properties:{...kept.properties,
    STORMTRACKER_CROSSING_LEVEL_METRES:crossing.heightMetres,
    STORMTRACKER_CROSSING_NAME:crossing.crossingName,
    STORMTRACKER_CROSSING_SOURCE:crossing.source,
    STORMTRACKER_CROSSING_REACHED:crossingReached}};
  }
  const state=kept.properties.STORMTRACKER_DISPLAY_STATE;
  if(officialStates.has(state))counts[state]++;
  if(kept.properties.STORMTRACKER_RAPID_RISE){
   counts.rapidRise++;
   if(String(p.location_types??"").toLowerCase().includes("tide gauge"))
    counts.tidalAnomaly++;
  }
  selected.push(kept);
 }
 // Preserve the event record through a partial source update without
 // fabricating a visible station reading or discarding its earlier baseline.
 for(const [id,event] of Object.entries(prior))
  if(!seen.has(id))events[id]=event;
 return {features:selected,events,counts,total:features?.length??0};
}
