import { distanceKm, initialBearingDegrees } from "./geo.js";

function equivalentRadiusKm(areaKm2) {
  return areaKm2 > 0 ? Math.sqrt(areaKm2 / Math.PI) : 0;
}

export function geodesicMotion(older, newer) {
  const dtSeconds = (Date.parse(newer.observed_utc) - Date.parse(older.observed_utc)) / 1000;
  if (!(dtSeconds > 0)) return null;
  const distance_km = distanceKm(
    older.centroid_longitude, older.centroid_latitude,
    newer.centroid_longitude, newer.centroid_latitude
  );
  return {
    speed_kmh: distance_km / (dtSeconds / 3600),
    heading_degrees: initialBearingDegrees(
      older.centroid_longitude, older.centroid_latitude,
      newer.centroid_longitude, newer.centroid_latitude
    ),
    distance_km,
    elapsed_seconds: dtSeconds
  };
}

function dedupRadiusKm(a, b) {
  const radiusSum = equivalentRadiusKm(a.sampled_area_km2) + equivalentRadiusKm(b.sampled_area_km2);
  return Math.min(20, Math.max(6, 1.25 * radiusSum + 4));
}

function canMergeRadarCells(a, b, timeToleranceSeconds) {
  if (a.radar_id === b.radar_id) return false;
  const dt = Math.abs(Date.parse(a.observed_utc) - Date.parse(b.observed_utc)) / 1000;
  if (dt > timeToleranceSeconds) return false;
  if (Math.abs(a.maximum_category - b.maximum_category) > 4) return false;
  return distanceKm(a.centroid_longitude, a.centroid_latitude, b.centroid_longitude, b.centroid_latitude) <= dedupRadiusKm(a, b);
}

function globalFromMembers(members) {
  const weights = members.map(m => Math.max(m.sampled_area_km2, 0.01));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const centroid_longitude = members.reduce((s, m, i) => s + m.centroid_longitude * weights[i], 0) / weightSum;
  const centroid_latitude = members.reduce((s, m, i) => s + m.centroid_latitude * weights[i], 0) / weightSum;
  const strongest = members.reduce((a, b) => b.maximum_category > a.maximum_category ? b : a);
  const source_radars = [...new Set(members.map(m => m.radar_id))].sort();
  const source_cells = members.map(m => [m.radar_id, m.local_cell_id]).sort((a,b) => a[0].localeCompare(b[0]) || a[1]-b[1]);
  const newest = members.reduce((a,b) => Date.parse(b.observed_utc) > Date.parse(a.observed_utc) ? b : a);
  return {
    observed_utc: newest.observed_utc,
    centroid_longitude,
    centroid_latitude,
    sampled_area_km2: Math.max(...members.map(m => m.sampled_area_km2)),
    maximum_category: strongest.maximum_category,
    maximum_dbzh_lower_bound: strongest.maximum_dbzh_lower_bound,
    maximum_dbzh_upper_bound: strongest.maximum_dbzh_upper_bound,
    min_longitude: Math.min(...members.map(m => m.min_longitude)),
    max_longitude: Math.max(...members.map(m => m.max_longitude)),
    min_latitude: Math.min(...members.map(m => m.min_latitude)),
    max_latitude: Math.max(...members.map(m => m.max_latitude)),
    source_radars,
    source_cells,
    multi_radar_confirmed: source_radars.length >= 2,
    merge_method: source_radars.length >= 2 ? "cross-radar-centroid-area" : "single-radar"
  };
}

export function deduplicateRadarCells(observations, timeToleranceSeconds = 180) {
  if (!observations.length) return [];
  const parent = observations.map((_, i) => i);
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let i=0;i<observations.length;i++) for (let j=i+1;j<observations.length;j++) {
    if (canMergeRadarCells(observations[i], observations[j], timeToleranceSeconds)) union(i,j);
  }
  const groups = new Map();
  observations.forEach((obs,i) => { const r=find(i); if(!groups.has(r)) groups.set(r,[]); groups.get(r).push(obs); });
  const output = [];
  for (const members of groups.values()) {
    const counts = new Map();
    for (const m of members) counts.set(m.radar_id, (counts.get(m.radar_id) ?? 0) + 1);
    if ([...counts.values()].some(n => n > 1)) {
      for (const m of members) output.push(globalFromMembers([m]));
    } else output.push(globalFromMembers(members));
  }
  output.sort((a,b) => Date.parse(a.observed_utc)-Date.parse(b.observed_utc) || b.maximum_category-a.maximum_category || b.sampled_area_km2-a.sampled_area_km2 || a.centroid_latitude-b.centroid_latitude || a.centroid_longitude-b.centroid_longitude);
  return output;
}

function associationScore(previous, current, maximumSpeedKmh) {
  const motion = geodesicMotion(previous, current);
  if (!motion || motion.speed_kmh > maximumSpeedKmh) return null;
  const previousRadius = equivalentRadiusKm(previous.sampled_area_km2);
  const currentRadius = equivalentRadiusKm(current.sampled_area_km2);
  const adaptiveDistanceKm = Math.min(45, Math.max(10, previousRadius + currentRadius + 12));
  if (motion.distance_km > adaptiveDistanceKm) return null;
  const areaRatio = Math.min(previous.sampled_area_km2, current.sampled_area_km2) / Math.max(previous.sampled_area_km2, current.sampled_area_km2, 0.01);
  const categoryDifference = Math.abs(previous.maximum_category - current.maximum_category);
  const radarOverlap = previous.source_radars.some(r => current.source_radars.includes(r));
  const score = 0.65 * (motion.distance_km / adaptiveDistanceKm) + 0.20 * (1 - areaRatio) + 0.15 * Math.min(categoryDifference / 6, 1) - (radarOverlap ? 0.10 : 0);
  return { score, motion };
}

export function associateFrame(tracks, observations, maximumSpeedKmh = 140, maximumGapMinutes = 12) {
  if (!observations.length) return { mapping: new Map(), unmatched: [] };
  const candidates = [];
  tracks.forEach((track, ti) => {
    if (!track.observations.length) return;
    const previous = track.observations.at(-1);
    observations.forEach((obs, oi) => {
      const gapMinutes = (Date.parse(obs.observed_utc) - Date.parse(previous.observed_utc)) / 60000;
      if (!(gapMinutes > 0 && gapMinutes <= maximumGapMinutes)) return;
      const result = associationScore(previous, obs, maximumSpeedKmh);
      if (result) candidates.push([result.score, ti, oi]);
    });
  });
  candidates.sort((a,b) => a[0]-b[0]);
  const assignedTracks = new Set(), assignedObs = new Set(), mapping = new Map();
  for (const [,ti,oi] of candidates) {
    if (assignedTracks.has(ti) || assignedObs.has(oi)) continue;
    assignedTracks.add(ti); assignedObs.add(oi); mapping.set(oi,ti);
  }
  return { mapping, unmatched: observations.map((_,i)=>i).filter(i=>!assignedObs.has(i)) };
}

export function updateTracks(tracks, observations, nextTrackNumber, maximumSpeedKmh = 140, maximumGapMinutes = 12) {
  const { mapping, unmatched } = associateFrame(tracks, observations, maximumSpeedKmh, maximumGapMinutes);
  for (const [oi,ti] of mapping.entries()) tracks[ti].observations.push(observations[oi]);
  for (const oi of unmatched) {
    tracks.push({ track_id: `ST${String(nextTrackNumber).padStart(4,"0")}`, observations: [observations[oi]] });
    nextTrackNumber++;
  }
  return nextTrackNumber;
}

export function trackConfidence(track) {
  const count = track.observations.length;
  if (count >= 4) return track.observations.some(o => o.multi_radar_confirmed) ? "high" : "medium";
  if (count >= 2) return "medium";
  return "low";
}

export function trackToDict(track) {
  const latest = track.observations.at(-1) ?? null;
  const motion = track.observations.length >= 2 ? geodesicMotion(track.observations.at(-2), latest) : null;
  return {
    track_id: track.track_id,
    observation_count: track.observations.length,
    first_observed_utc: track.observations[0]?.observed_utc ?? null,
    last_observed_utc: latest?.observed_utc ?? null,
    multi_radar_observation_count: track.observations.filter(o => o.multi_radar_confirmed).length,
    algorithmic_confidence: trackConfidence(track),
    motion,
    latest,
    history: track.observations.slice()
  };
}

export function activeTracks(tracks, referenceTime, activeMinutes = 12) {
  const cutoff = Date.parse(referenceTime) - activeMinutes * 60000;
  return tracks.filter(t => t.observations.length && Date.parse(t.observations.at(-1).observed_utc) >= cutoff);
}

export function cellsToRadarObservations(radarId, observedUtc, cells) {
  return cells.map(cell => ({
    radar_id: String(radarId),
    observed_utc: new Date(observedUtc).toISOString(),
    local_cell_id: cell.local_cell_id,
    centroid_longitude: cell.centroid_longitude,
    centroid_latitude: cell.centroid_latitude,
    sampled_area_km2: cell.sampled_area_km2,
    maximum_category: cell.maximum_category,
    maximum_dbzh_lower_bound: cell.maximum_dbzh_lower_bound,
    maximum_dbzh_upper_bound: cell.maximum_dbzh_upper_bound,
    min_longitude: cell.min_longitude,
    max_longitude: cell.max_longitude,
    min_latitude: cell.min_latitude,
    max_latitude: cell.max_latitude
  }));
}
