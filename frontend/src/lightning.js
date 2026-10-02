import { FRESHNESS } from "./config.js";

function component(name, score, maximum, available, detail) {
  return { name, score, maximum, available, detail };
}

export function freshness(observedUtc, referenceTime = new Date()) {
  const ageMinutes = (referenceTime.getTime() - new Date(observedUtc).getTime()) / 60000;
  let state, operationalLive;
  if (ageMinutes < -FRESHNESS.futureToleranceMinutes) { state = "clock-anomaly"; operationalLive = false; }
  else if (ageMinutes <= FRESHNESS.liveMinutes) { state = "live"; operationalLive = true; }
  else if (ageMinutes <= FRESHNESS.degradedMinutes) { state = "degraded"; operationalLive = false; }
  else { state = "stale"; operationalLive = false; }
  return { state, operational_live: operationalLive, age_minutes: ageMinutes };
}

export function reflectivityComponent(category) {
  const c = Number(category);
  const score = c >= 14 ? 30 : c >= 12 ? 26 : c >= 11 ? 22 : c >= 10 ? 17 : c >= 9 ? 12 : c >= 7 ? 7 : 0;
  return component("reflectivity-core", score, 30, true, `Strongest categorical BOM reflectivity class = ${c}.`);
}

export function persistenceComponent(count) {
  const n = Number(count);
  const score = n >= 6 ? 10 : n >= 4 ? 8 : n >= 3 ? 6 : n >= 2 ? 4 : 1;
  return component("storm-persistence", score, 10, true, `Track contains ${n} associated radar observations.`);
}

export function growthComponents(history) {
  if (history.length < 2) {
    const detail = "Previous track observation unavailable.";
    return [component("footprint-growth",0,15,false,detail), component("reflectivity-intensification",0,10,false,detail)];
  }
  const oldObs = history.at(-2), newObs = history.at(-1);
  const gap = (Date.parse(newObs.observed_utc)-Date.parse(oldObs.observed_utc))/60000;
  if (!(gap > 0 && gap <= 12)) {
    const detail = `Observation gap ${gap.toFixed(1)} min unsuitable for short-term trend.`;
    return [component("footprint-growth",0,15,false,detail), component("reflectivity-intensification",0,10,false,detail)];
  }
  const oldArea = Number(oldObs.sampled_area_km2 || 0), newArea = Number(newObs.sampled_area_km2 || 0);
  let area;
  if (oldArea > 0) {
    const pct = (newArea-oldArea)/oldArea*100;
    const score = pct >= 75 ? 15 : pct >= 40 ? 12 : pct >= 20 ? 8 : pct >= 5 ? 4 : 0;
    area = component("footprint-growth",score,15,true,`>=40 dBZ sampled footprint change ${pct>=0?"+":""}${pct.toFixed(1)}% over ${gap.toFixed(1)} min.`);
  } else area = component("footprint-growth",0,15,false,"Previous sampled footprint area unavailable.");
  const change = Number(newObs.maximum_category||0)-Number(oldObs.maximum_category||0);
  const intensityScore = change >= 3 ? 10 : change === 2 ? 7 : change === 1 ? 4 : 0;
  const intensity = component("reflectivity-intensification",intensityScore,10,true,`Strongest reflectivity category change ${change>=0?"+":""}${change} over ${gap.toFixed(1)} min.`);
  return [area,intensity];
}

export function dopplerComponent(values, nodata = -32768) {
  const valid = Array.from(values ?? []).filter(v => v !== nodata && Number.isFinite(v)).map(Number);
  if (!valid.length) return component("doppler-dynamics",0,15,false,"No valid time-matched Doppler pixels.");
  const maxAbs = Math.max(...valid.map(v=>Math.abs(v)));
  const negative = valid.filter(v=>v<0), positive = valid.filter(v=>v>0);
  let score = maxAbs >= 80 ? 8 : maxAbs >= 60 ? 6 : maxAbs >= 40 ? 4 : maxAbs >= 20 ? 2 : 0;
  let span = null;
  if (negative.length && positive.length) {
    span = Math.max(...positive) - Math.min(...negative);
    score += span >= 120 ? 7 : span >= 80 ? 5 : span >= 50 ? 3 : 0;
  }
  score = Math.min(score,15);
  const spanText = span == null ? "" : `; toward-to-away class span ${span.toFixed(0)} km/h`;
  return component("doppler-dynamics",score,15,true,`Maximum absolute decoded Doppler display class ${maxAbs.toFixed(0)} km/h${spanText}. This supports convective context only; it is not a rotation diagnosis or horizontal storm motion.`);
}

export function category(score) {
  if (score >= 65) return "VERY HIGH";
  if (score >= 45) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

export function buildTrackLikelihood(track, { dopplerValues = [], referenceTime = new Date(), himawari = null, officialWarning = null } = {}) {
  const latest = track.latest;
  const history = track.history ?? [];
  const [areaGrowth, intensityGrowth] = growthComponents(history);
  const multi = component(
    "multi-radar-confirmation",
    latest?.multi_radar_confirmed ? 5 : 0,
    5,
    true,
    latest?.multi_radar_confirmed ? "Current footprint is represented by multiple radars." : "Current footprint is not cross-radar confirmed."
  );
  const components = [
    reflectivityComponent(latest?.maximum_category ?? 0),
    persistenceComponent(track.observation_count ?? history.length),
    areaGrowth,
    intensityGrowth,
    dopplerComponent(dopplerValues),
    multi,
    himawari ?? component("himawari-cloud-top-trend",0,10,false,"Optional public Himawari trend adapter not yet connected."),
    officialWarning ?? component("official-bom-warning-context",0,5,false,"Optional public severe-thunderstorm warning intersection not yet connected.")
  ];
  const score = components.reduce((s,c)=>s+c.score,0);
  const coverage = components.filter(c=>c.available).reduce((s,c)=>s+c.maximum,0);
  const fresh = freshness(latest.observed_utc, referenceTime);
  const label = category(score);
  const count = track.observation_count ?? history.length;
  const confidence = coverage >= 80 && count >= 4 ? "high" : coverage >= 60 && count >= 2 ? "medium" : "low";
  return {
    track_id: track.track_id,
    score,
    category: label,
    display_category: fresh.operational_live ? label : `${label} — ${fresh.state.toUpperCase()} DATA`,
    confidence,
    evidence_coverage_percent: coverage,
    freshness: fresh,
    observed_utc: latest.observed_utc,
    centroid_longitude: latest.centroid_longitude,
    centroid_latitude: latest.centroid_latitude,
    components,
    direct_strike_detected: false,
    interpretation: "Ordinal inferred lightning likelihood. Not a strike observation and not a calibrated probability."
  };
}
