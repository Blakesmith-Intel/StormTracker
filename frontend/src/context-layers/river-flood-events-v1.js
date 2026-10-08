// Browser-only event lifecycle for inferred flood screening markers.
// BoM moderate/major classifications remain authoritative on each bulletin.
// A rate-based marker requires TWO distinct, fresh, consecutive non-qualifying
// observations before it clears, never merely a slower single reading.
import {
  evaluateFloodSignal,
  parseQueenslandObservationTime,
  latestRiseRate,
  FLOOD_SIGNAL_MAX_AGE_MS
} from "./river-flood-signals-v1.js?v=9.13.2";

export const FLOOD_EVENTS_STORAGE_KEY="stormtracker.qld-flood-events.v1";
export const FLOOD_EVENT_RECOVERY_COUNT=2;
const RECOVERY_MIN_GAP_MS=10*60000;
const EVENT_MAX_LIFETIME_MS=6*3600000;
const eventTypes=new Set(["rapid-rise","tidal-anomaly"]);
const fresh = (observed,now) => Number.isFinite(observed) &&
  observed<=now+5*60000 && now-observed<=FLOOD_SIGNAL_MAX_AGE_MS;

export function cleanFloodEvents(input,now=Date.now()){
  const out={};
  if(!input||typeof input!=="object"||Array.isArray(input))return out;
  for(const [id,p] of Object.entries(input).slice(0,1800)){
    if(!/^(bom|awrc):[a-z0-9_-]+$/i.test(id) ||
      !p || !eventTypes.has(p.type) ||
      !Number.isFinite(p.activatedAt) ||
      !Number.isFinite(p.lastObservedAt) ||
      p.activatedAt>now+5*60000 ||
      now-p.lastObservedAt>FLOOD_SIGNAL_MAX_AGE_MS ||
      now-p.activatedAt>EVENT_MAX_LIFETIME_MS)continue;
    out[id]={
      type:p.type,activatedAt:p.activatedAt,lastObservedAt:p.lastObservedAt,
      recoveryCount:Math.max(0,Math.min(1,Math.floor(Number(p.recoveryCount)||0)))
    };
  }
  return out;
}

export function reconcileFloodEvents(features,history={},oldEvents={},now=Date.now()){
  const events={};
  const selected=[];
  const counts={moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
  const previous=cleanFloodEvents(oldEvents,now);
  for(const feature of features??[]){
    const id=String(feature?.id??"");
    const p=feature?.properties??{};
    const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
    if(!id||!fresh(observed,now))continue;
    const decision=evaluateFloodSignal(feature,history,now);
    const official=decision.show && ["moderate","major"].includes(decision.state);
    if(official){
      // Official flood status overrides and terminates an inferred event.
      counts[decision.state]++;
      selected.push({...feature,properties:{
        ...p,STORMTRACKER_DISPLAY_STATE:decision.state,
        STORMTRACKER_ALERT_REASON:decision.reason,
        STORMTRACKER_ALERT_SOURCE:decision.source,
        STORMTRACKER_ALERT_PERSISTED:false,
        STORMTRACKER_RECOVERY_READINGS:0,
        STORMTRACKER_RISE_RATE_M_PER_H:decision.rise?.rateMetresPerHour??null,
        STORMTRACKER_RATE_INTERVAL_MINUTES:decision.rise?.intervalMinutes??null,
        STORMTRACKER_TIDAL_BASELINE_M_PER_H:null
      }});
      continue;
    }

    const isFreshRate=decision.show && eventTypes.has(decision.state);
    const prior=previous[id];
    let event=null;
    let held=false;
    let rate=decision.rise??latestRiseRate(history[id]??[],now);
    let reason=decision.reason;
    let baseline=decision.tidalBaselineMetresPerHour??null;
    if(isFreshRate){
      event={type:decision.state,activatedAt:
        prior?.type===decision.state?prior.activatedAt:observed,
        lastObservedAt:observed,recoveryCount:0};
    }else if(prior && fresh(prior.lastObservedAt,now) &&
      observed>=prior.lastObservedAt){
      // A repeated bulletin cannot count as the next recovery observation.
      let recoveryCount=prior.recoveryCount;
      if(observed-prior.lastObservedAt>=RECOVERY_MIN_GAP_MS){
        recoveryCount++;
      }
      if(recoveryCount<FLOOD_EVENT_RECOVERY_COUNT){
        event={...prior,lastObservedAt:observed,recoveryCount};
        held=true;
        reason=`Recent ${prior.type==="tidal-anomaly"?"unusual tidal rise":"rapid river rise"}; ${recoveryCount}/2 successive observations below alert threshold. Continue monitoring.`;
      }
    }
    if(!event)continue;
    events[id]=event;
    const state=event.type;
    if(state==="rapid-rise")counts.rapidRise++;
    else counts.tidalAnomaly++;
    selected.push({...feature,properties:{
      ...p,
      STORMTRACKER_DISPLAY_STATE:state,
      STORMTRACKER_ALERT_REASON:reason,
      STORMTRACKER_ALERT_SOURCE:held?"recent-rate-event":decision.source,
      STORMTRACKER_ALERT_PERSISTED:held,
      STORMTRACKER_RECOVERY_READINGS:event.recoveryCount,
      STORMTRACKER_RISE_RATE_M_PER_H:rate?.rateMetresPerHour??null,
      STORMTRACKER_RATE_INTERVAL_MINUTES:rate?.intervalMinutes??null,
      STORMTRACKER_TIDAL_BASELINE_M_PER_H:baseline,
      STORMTRACKER_TIDAL_CONTEXT:state==="tidal-anomaly"
        ? "Unusual tidal rise screening only; not a confirmed flood"
        : p.STORMTRACKER_TIDAL_CONTEXT??""
    }});
  }
  return {features:selected,events,counts,total:features?.length??0};
}
