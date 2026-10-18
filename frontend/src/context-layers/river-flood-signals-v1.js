// StormTracker operational flood signals, not BoM-issued flash-flood warnings.
// Severe classifications are authoritative. Rise-rate flags are deliberately
// conservative heuristics and require real successive observed timestamps.
import {gaugeRiseScreeningZone} from "./river-gauge-coastal-screen-v1.js?v=inland-coast-screen-20261018";

export const FLOOD_SIGNAL_STORAGE_KEY = "stormtracker.qld-flood-observations.v1";
export const FLOOD_SIGNAL_HISTORY_MS = 48 * 60 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_AGE_MS = 90 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_INTERVAL_MS = 120 * 60 * 1000;
export const FLOOD_SIGNAL_MIN_INTERVAL_MS = 30 * 60 * 1000;
// MSQ 2026 tidal planes describe COASTAL reference rates, not inland floods.
// Preserve conservative screening for *coastal-uncertain* and unlocated sites.
// Far-inland stations are demonstrably outside the mapped 125 km tidal-risk
// buffer, and must regain the previous sensitive 0.30 m/h rise screening.
// This remains an inferred screening indicator, NOT a BoM flash flood warning.
export const QLD_TIDAL_REFERENCE_MEAN_PEAK_M_PER_H = 0.63;
export const QLD_TIDAL_REFERENCE_UPPER_PEAK_M_PER_H = 1.23;
export const NON_TIDAL_RAPID_RISE_M_PER_H = 0.30;
export const COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H = 1.40;
export const TIDAL_MIN_ANOMALOUS_RISE_M_PER_H = 0.25;
export const TIDAL_ANOMALY_FACTOR = 1.75;
const QLD_UTC_OFFSET_MS = 10 * 60 * 60 * 1000;
const WEEKDAYS = ["sun","mon","tue","wed","thu","fri","sat"];

function finite(v) { return typeof v === "number" && Number.isFinite(v); }

export function parseQueenslandObservationTime(value, nowMs = Date.now()) {
  const text = String(value ?? "").trim();
  const time = text.match(/\b(\d{1,2})[.:](\d{2})\s*(am|pm)?\b/i);
  if (!time || !finite(nowMs)) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  const meridiem = String(time[3] ?? "").toLowerCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
  }
  const local = new Date(nowMs + QLD_UTC_OFFSET_MS);
  let year = local.getUTCFullYear();
  let month = local.getUTCMonth();
  let day = local.getUTCDate();
  const dated = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (dated) {
    day = Number(dated[1]);
    month = Number(dated[2]) - 1;
    year = Number(dated[3]);
    if (year < 100) year += 2000;
    const verify = new Date(Date.UTC(year,month,day));
    if (verify.getUTCFullYear() !== year || verify.getUTCMonth() !== month
       || verify.getUTCDate() !== day) return null;
  } else {
    const weekday = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b/i);
    if (!weekday) return null;
    const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
    const age = (local.getUTCDay() - target + 7) % 7;
    const date = new Date(Date.UTC(year,month,day - age));
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
  }
  let ms = Date.UTC(year,month,day,hour-10,minute);
  if (!dated && ms > nowMs + 5 * 60000) ms -= 7 * 86400000;
  if (ms > nowMs + 5 * 60000 || nowMs-ms > FLOOD_SIGNAL_HISTORY_MS) return null;
  return ms;
}

export function appendGaugeObservation(history, feature, nowMs = Date.now()) {
  const id = String(feature?.id ?? "");
  const p = feature?.properties ?? {};
  const height = p.STORMTRACKER_HEIGHT_METRES;
  const observedAt = parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  if (!id || !finite(height) || !finite(observedAt)) return false;
  const list = Array.isArray(history[id]) ? history[id] : [];
  if (!list.some(s => s.time === observedAt)) {
    list.push({time:observedAt,height});
    list.sort((a,b)=>a.time-b.time);
  }
  history[id] = list.filter(s=>finite(s.time) && finite(s.height) &&
    s.time <= nowMs + 5*60000 && s.time >= nowMs-FLOOD_SIGNAL_HISTORY_MS)
    .slice(-225);
  return true;
}

export function cleanFloodSignalHistory(data,nowMs=Date.now()) {
  const history={};
  if (!data || typeof data!=="object" || Array.isArray(data)) return history;
  for(const [id,items] of Object.entries(data).slice(0,1800)){
    if (!/^(bom|awrc):[a-z0-9_-]+$/i.test(id) || !Array.isArray(items))continue;
    const seen = new Set();
    const filtered=[];
    for(const item of items.slice(-250)){
      if(!finite(item?.time)||!finite(item?.height)||
        item.time < nowMs-FLOOD_SIGNAL_HISTORY_MS || item.time > nowMs+5*60000 ||
        seen.has(item.time))continue;
      seen.add(item.time);
      filtered.push({time:item.time,height:item.height});
    }
    if(filtered.length)history[id]=filtered.sort((a,b)=>a.time-b.time).slice(-225);
  }
  return history;
}

// Source station ID remains the ONLY join key. Tidal identification is a
// separate HYDROLOGICAL screening decision using source metadata and actual
// height observations. No station or locality name-based matches.
export function observedTidalOscillation(samples, nowMs=Date.now()) {
  const data=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time)&&finite(p?.height) &&
    p.time>=nowMs-FLOOD_SIGNAL_HISTORY_MS &&
    p.time<=nowMs+5*60000).sort((a,b)=>a.time-b.time);
  if(data.length<12 || data.at(-1).time-data[0].time<16*3600000)return false;
  const runs=[];
  for(let i=1;i<data.length;i++){
    const dt=data[i].time-data[i-1].time;
    if(dt<10*60000 || dt>120*60000)continue;
    const delta=data[i].height-data[i-1].height;
    // Ignore sensor jitter: a normal tide has sustained material limbs.
    if(Math.abs(delta)<0.035)continue;
    const sign=Math.sign(delta);
    const prev=runs.at(-1);
    if(prev && prev.sign===sign){
      prev.finish=data[i].time;
      prev.change+=Math.abs(delta);
    }else{
      runs.push({sign,start:data[i-1].time,finish:data[i].time,change:Math.abs(delta)});
    }
  }
  const limbs=runs.filter(r=>
    r.finish-r.start>=60*60000 && r.change>=0.18);
  if(limbs.length<4)return false;
  // At least three alternating significant tidal-like reversals, over a
  // sensible time window. A single flash-flood wave cannot establish this.
  for(let i=3;i<limbs.length;i++){
    const tail=limbs.slice(i-3,i+1);
    if(tail.some((r,j)=>j>0 && (r.sign===tail[j-1].sign ||
        r.start-tail[j-1].finish>120*60000)))continue;
    if(tail[3].finish-tail[0].start>=12*3600000)return true;
  }
  return false;
}

function recentTidalReversal(samples,nowMs=Date.now()){
  const pts=(Array.isArray(samples)?samples:[]).filter(p=>finite(p?.time)&&finite(p?.height)&&
    p.time>=nowMs-6*3600000 && p.time<=nowMs+5*60000).sort((a,b)=>a.time-b.time);
  if(pts.length<4)return false;
  let up=false,down=false;
  for(let i=1;i<pts.length;i++){
    const dt=pts[i].time-pts[i-1].time;
    if(dt<10*60000||dt>120*60000)continue;
    const delta=pts[i].height-pts[i-1].height;
    if(delta>0.12)up=true;
    if(delta< -0.12)down=true;
  }
  return up&&down;
}

export function isObservedTidalGauge(feature,samples=[],nowMs=Date.now()){
  const types=String(feature?.properties?.location_types??"").toLowerCase();
  // Source metadata "tide gauge" is decisive; observed tidal oscillation
  // catches river-level stations that are tide affected but not tagged.
  return /tide gauge|tidal|estuar(?:y|ine)|sea level/.test(types) ||
    observedTidalOscillation(samples,nowMs);
}

// Retain longer history only for officially tidal gauges or gauged water
// levels showing source-observed tidal behaviour. Another river stays bounded
// to four hours to preserve mobile storage (1,000+ QLD sites).
// Missing stations preserve their recent history through a partial bulletin.
export function compactFloodHistory(history, features=[], nowMs=Date.now()) {
  const types=new Map((features??[]).map(f=>[
    String(f?.id??""),
    f
  ]));
  const stored={};
  for(const [id,samples] of Object.entries(history??{})) {
    const f=types.get(id);
    const keepTidal=Boolean(f && (isObservedTidalGauge(f,samples,nowMs) ||
      recentTidalReversal(samples,nowMs)));
    const age=keepTidal?FLOOD_SIGNAL_HISTORY_MS:4*3600000;
    const current=Array.isArray(samples) ? samples.filter(p=>
      finite(p?.time) && finite(p?.height) &&
      p.time >= nowMs-age && p.time <= nowMs+5*60000
    ).slice(-225):[];
    if(current.length)stored[id]=current;
  }
  return stored;
}

export function latestRiseRate(samples, nowMs=Date.now()) {
  const sorted=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time) && finite(p?.height)).sort((a,b)=>a.time-b.time);
  if(sorted.length<2)return null;
  const latest=sorted.at(-1);
  if(latest.time>nowMs+5*60000 || nowMs-latest.time>FLOOD_SIGNAL_MAX_AGE_MS)return null;
  const previous=[...sorted].reverse().slice(1).find(p=>
    latest.time-p.time >= FLOOD_SIGNAL_MIN_INTERVAL_MS &&
    latest.time-p.time <= FLOOD_SIGNAL_MAX_INTERVAL_MS
  );
  if(!previous)return null;
  const durationHours=(latest.time-previous.time)/3600000;
  return {rateMetresPerHour:(latest.height-previous.height)/durationHours,
    changeMetres:latest.height-previous.height,intervalMinutes:durationHours*60,
    observedAt:latest.time};
}

function percentile(values,fraction) {
  const s=[...values].sort((a,b)=>a-b);
  if(!s.length)return null;
  return s[Math.min(s.length-1,Math.ceil(s.length*fraction)-1)];
}

// Compare a recent tidal rise only with historical RISING limbs at the same
// station. A single absolute rate cannot distinguish tide from floodwater.
export function tidalRiseBaseline(samples,nowMs=Date.now()){
  const older=(Array.isArray(samples)?samples:[]).filter(p=>
    finite(p?.time)&&finite(p?.height) &&
    p.time>=nowMs-FLOOD_SIGNAL_HISTORY_MS &&
    p.time<=nowMs-3*3600000).sort((a,b)=>a.time-b.time);
  if(older.length<8 || older.at(-1).time-older[0].time<12*3600000)return null;
  const rising=[];
  for(let i=1;i<older.length;i++){
    const deltaMinutes=(older[i].time-older[i-1].time)/60000;
    if(deltaMinutes<10 || deltaMinutes>90)continue;
    const rate=(older[i].height-older[i-1].height)/(deltaMinutes/60);
    if(rate>0 && finite(rate))rising.push(rate);
  }
  if(rising.length<6)return null;
  return percentile(rising,0.90);
}

// Severity is the fresh, explicitly BoM-reported flood classification.
// The original measured rate independently controls ONE blue upward-arrow
// modifier. A rise alone does not prove actual flash flooding.
export function evaluateFloodSignal(feature,history={},nowMs=Date.now()){
  const p=feature?.properties??{};
  const level=String(p.STORMTRACKER_FLOOD_CLASS??"").trim().toLowerCase();
  const samples=history[String(feature?.id??"")]??[];
  const tidal=isObservedTidalGauge(feature,samples,nowMs);
  const tendency=String(p.STORMTRACKER_TENDENCY??"").toLowerCase();
  const recent=latestRiseRate(samples,nowMs);
  const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  const timely=observed!==null && nowMs-observed<=FLOOD_SIGNAL_MAX_AGE_MS &&
    observed<=nowMs+5*60000;
  if(!timely)return {show:false,reason:"Missing or stale current BoM flood observation"};
  const rateMatches=recent && tendency==="rising" &&
    Math.abs(recent.observedAt-observed)<=10*60000;
  // A flood or flash-flood signature cannot be diagnosed from a normal
  // incoming tide. For source-tagged or observation-confirmed tidal sites,
  // suppress this independent rate-only modifier entirely. Original BoM
  // minor/moderate/major classifications still display without restriction.
  const geographicScreen=gaugeRiseScreeningZone(feature);
  const screeningThresholdMetresPerHour=geographicScreen.zone==="inland"
    ? NON_TIDAL_RAPID_RISE_M_PER_H
    : COASTAL_UNCERTAIN_RAPID_RISE_M_PER_H;
  const rapidlyRising=Boolean(rateMatches && !tidal &&
    recent.rateMetresPerHour>=screeningThresholdMetresPerHour);
  const tidalBaseline=tidal?tidalRiseBaseline(samples,nowMs):null;
  if(["minor","moderate","major"].includes(level)){
    return {show:true,state:level,source:"bom-classification",
      reason:level+" flood classification (BoM)"+
        (rapidlyRising?"; measured rapid rise — potential flash-flooding behaviour":""),
      rapidRise:rapidlyRising,tidalScreened:tidal,rise:recent,
      riseScreeningZone:geographicScreen.zone,
      screeningThresholdMetresPerHour,
      tidalBaselineMetresPerHour:tidalBaseline};
  }
  if(rapidlyRising){
    return {show:true,state:"rapid-rise",rapidRise:true,
      source:"local-rate-screen",
      reason:"Measured rapid rise below minor; potential flash flooding, not a confirmed BoM flash-flood warning",
      rise:recent,riseScreeningZone:geographicScreen.zone,
      screeningThresholdMetresPerHour,
      tidalBaselineMetresPerHour:tidalBaseline};
  }
  return {show:false,reason:"Below minor with no verified rapidly rising water"};
}

export function filterOperationalFloodGauges(features,history={},nowMs=Date.now()){
  const selected=[];
  const counts={minor:0,moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
  for(const feature of features??[]){
    const result=evaluateFloodSignal(feature,history,nowMs);
    if(!result.show)continue;
    if(["minor","moderate","major"].includes(result.state))counts[result.state]++;
    if(result.rapidRise)counts.rapidRise++;
    // Tidal behaviour cannot cause a flash-rise marker or anomaly count.
    selected.push({...feature,properties:{
      ...feature.properties,
      STORMTRACKER_DISPLAY_STATE:result.state,
      STORMTRACKER_RAPID_RISE:Boolean(result.rapidRise),
      STORMTRACKER_TIDAL_SCREENED:Boolean(result.tidalScreened),
      STORMTRACKER_ALERT_REASON:result.reason,
      STORMTRACKER_ALERT_SOURCE:result.source,
      STORMTRACKER_RATE_SCREENING_ZONE:result.riseScreeningZone??"",
      STORMTRACKER_RATE_THRESHOLD_M_PER_H:result.screeningThresholdMetresPerHour??null,
      STORMTRACKER_RISE_RATE_M_PER_H:result.rise?.rateMetresPerHour??null,
      STORMTRACKER_RATE_INTERVAL_MINUTES:result.rise?.intervalMinutes??null,
      STORMTRACKER_TIDAL_BASELINE_M_PER_H:result.tidalBaselineMetresPerHour??null,
      STORMTRACKER_TIDAL_CONTEXT:feature.properties?.STORMTRACKER_TIDAL_CONTEXT??""
    }});
  }
  return {features:selected,counts,total:features?.length??0};
}
