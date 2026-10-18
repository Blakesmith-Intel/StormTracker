// Browser-only event lifecycle for inferred flood screening markers.
// BoM moderate/major classifications remain authoritative on each bulletin.
// A rate-based marker requires TWO distinct, fresh, consecutive non-qualifying
// observations before it clears, never merely a slower single reading.
import {
  evaluateFloodSignal,
  parseQueenslandObservationTime,
  FLOOD_SIGNAL_MAX_AGE_MS
} from "./river-flood-signals-v1.js?v=9.13.2";

export const FLOOD_EVENTS_STORAGE_KEY="stormtracker.qld-flood-events.v1";
export const FLOOD_EVENT_RECOVERY_COUNT=2;
const RECOVERY_MIN_GAP_MS=15*60000;
const RECOVERY_MAX_RISE_M_PER_H=0.05;
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
      now-p.lastObservedAt>FLOOD_SIGNAL_MAX_AGE_MS)continue;
    out[id]={
      type:p.type,activatedAt:p.activatedAt,lastObservedAt:p.lastObservedAt,
      recoveryCount:Math.max(0,Math.min(1,Math.floor(Number(p.recoveryCount)||0))),
      lastHeight:Number.isFinite(p.lastHeight)?p.lastHeight:null,
      lastRecoveryAt:Number.isFinite(p.lastRecoveryAt)?p.lastRecoveryAt:null
    };
  }
  return out;
}

// Current official flood class is persistent at ALL stations. The optional
// rise screen is a modifier only; historical rise events must NEVER override
// a new below-minor observation or colour an above-minor icon blue.
export function reconcileFloodEvents(features,history={},oldEvents={},now=Date.now()){
  const events={}; // Retire cached old rapid-rise badges on the next refresh.
  const selected=[], counts={minor:0,moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
  for(const feature of features??[]){
    const id=String(feature?.id??"");
    const p=feature?.properties??{};
    const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
    if(!id||!fresh(observed,now))continue;
    const decision=evaluateFloodSignal(feature,history,now);
    if(!decision.show)continue;
    if(["minor","moderate","major"].includes(decision.state))
      counts[decision.state]++;
    if(decision.rapidRise){
      counts.rapidRise++;
      if(String(p.location_types??"").toLowerCase().includes("tide gauge"))
        counts.tidalAnomaly++;
    }
    selected.push({...feature,properties:{
      ...p,
      STORMTRACKER_DISPLAY_STATE:decision.state,
      STORMTRACKER_RAPID_RISE:Boolean(decision.rapidRise),
      STORMTRACKER_TIDAL_SCREENED:Boolean(decision.tidalScreened),
      STORMTRACKER_ALERT_REASON:decision.reason,
      STORMTRACKER_ALERT_SOURCE:decision.source,
      STORMTRACKER_ALERT_PERSISTED:false,
      STORMTRACKER_RECOVERY_READINGS:0,
      STORMTRACKER_RATE_SCREENING_ZONE:decision.riseScreeningZone??"",
      STORMTRACKER_RATE_THRESHOLD_M_PER_H:decision.screeningThresholdMetresPerHour??null,
      STORMTRACKER_RISE_RATE_M_PER_H:decision.rise?.rateMetresPerHour??null,
      STORMTRACKER_RATE_INTERVAL_MINUTES:decision.rise?.intervalMinutes??null,
      STORMTRACKER_TIDAL_BASELINE_M_PER_H:decision.tidalBaselineMetresPerHour??null,
      STORMTRACKER_TIDAL_CONTEXT:p.STORMTRACKER_TIDAL_CONTEXT??""
    }});
  }
  return {features:selected,events,counts,total:features?.length??0};
}
