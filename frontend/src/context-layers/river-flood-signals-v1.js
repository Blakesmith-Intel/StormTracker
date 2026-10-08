// StormTracker operational flood signals, not BoM-issued flash-flood warnings.
// Severe classifications are authoritative. Rise-rate flags are deliberately
// conservative heuristics and require real successive observed timestamps.
export const FLOOD_SIGNAL_STORAGE_KEY = "stormtracker.qld-flood-observations.v1";
export const FLOOD_SIGNAL_HISTORY_MS = 48 * 60 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_AGE_MS = 90 * 60 * 1000;
export const FLOOD_SIGNAL_MAX_INTERVAL_MS = 120 * 60 * 1000;
export const FLOOD_SIGNAL_MIN_INTERVAL_MS = 30 * 60 * 1000;
export const NON_TIDAL_RAPID_RISE_M_PER_H = 0.30;
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

export function evaluateFloodSignal(feature, history={},nowMs=Date.now()){
  const p=feature?.properties??{};
  const level=String(p.STORMTRACKER_FLOOD_CLASS??"").trim().toLowerCase();
  const tidal=String(p.location_types??"").toLowerCase().includes("tide gauge");
  const tendency=String(p.STORMTRACKER_TENDENCY??"").toLowerCase();
  const samples=history[String(feature?.id??"")]??[];
  const recent=latestRiseRate(samples,nowMs);
  const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  // Without a dated/current observation a classification cannot safely be
  // presented as an active operational condition.
  const timely=observed!==null && nowMs-observed<=FLOOD_SIGNAL_MAX_AGE_MS;

  if ((level==="moderate"||level==="major") && timely) return {
    show:true,state:level,reason:`${level} flood classification (BoM)`,
    source:"bom-classification",rise:recent
  };
  // A historical rise from local storage is not evidence that a newer
  // bulletin is still rising. Require its timestamp to match the latest data.
  if(!timely || !recent || tendency!=="rising" ||
      Math.abs(recent.observedAt-observed)>10*60000)return {
    show:false,reason:"No verified rapid rise or moderate/major flood classification"
  };
  if(!tidal && level==="minor" &&
    recent.rateMetresPerHour>=NON_TIDAL_RAPID_RISE_M_PER_H)return {
      show:true,state:"rapid-rise",source:"local-rate-screen",
      reason:"Rapid rise at non-tidal gauge currently classified minor flood",
      rise:recent
    };
  if(tidal){
    const baseline=tidalRiseBaseline(samples,nowMs);
    if(baseline!==null &&
      recent.rateMetresPerHour>=TIDAL_MIN_ANOMALOUS_RISE_M_PER_H &&
      recent.rateMetresPerHour>=baseline*TIDAL_ANOMALY_FACTOR)return {
      show:true,state:"tidal-anomaly",source:"local-tide-rate-screen",
      reason:"Rise exceeds observed tidal rate history; investigate flood or surge influence",
      rise:recent,tidalBaselineMetresPerHour:baseline
    };
  }
  return {show:false,reason:tidal?
    "Normal/uncertain tide or insufficient tidal history":
    "Below moderate flood level without verified rapid rise above minor"};
}

export function filterOperationalFloodGauges(features,history={},nowMs=Date.now()) {
  const selected=[];
  const counts={moderate:0,major:0,rapidRise:0,tidalAnomaly:0};
  for(const feature of features??[]){
    const result=evaluateFloodSignal(feature,history,nowMs);
    if(!result.show)continue;
    const name=result.state;
    if(name==="moderate")counts.moderate++;
    else if(name==="major")counts.major++;
    else if(name==="rapid-rise")counts.rapidRise++;
    else if(name==="tidal-anomaly")counts.tidalAnomaly++;
    selected.push({...feature,properties:{
      ...feature.properties,STORMTRACKER_DISPLAY_STATE:name,
      STORMTRACKER_ALERT_REASON:result.reason,
      STORMTRACKER_ALERT_SOURCE:result.source,
      STORMTRACKER_RISE_RATE_M_PER_H:result.rise?.rateMetresPerHour??null,
      STORMTRACKER_RATE_INTERVAL_MINUTES:result.rise?.intervalMinutes??null,
      STORMTRACKER_TIDAL_BASELINE_M_PER_H:result.tidalBaselineMetresPerHour??null
    }});
  }
  return {features:selected,counts,total:features?.length??0};
}
