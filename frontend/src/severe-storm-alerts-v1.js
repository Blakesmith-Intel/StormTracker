// Experimental radar evidence alerts. No inferred volume or interpolated frames.
export const DAMAGING_WIND_GUST_REFERENCE_KMH = 90;
export const VERIFIED_DOPPLER_RADARS = Object.freeze(["08", "50", "66"]);
const MAX_PAIRING_MINUTES = 8;
const HOOK_MAX_GAP_MINUTES = 15;
const HOOK_BINS = 24;
const hookBoundsCache = new WeakMap();

function observed(frame) {
  return Boolean(
    frame?.georef?.projection === "EPSG:3857" &&
    frame?.categories?.length === frame.width * frame.height &&
    !frame?.sourceMetadata?.temporalInference
  );
}

function sourceCellId(observation, segmentation) {
  const source = String(segmentation?.radar_id ?? "BOM-MOSAIC");
  const pair = (observation?.source_cells ?? []).find(
    item => String(item[0]) === source
  );
  const id = Number(pair?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function observationForTrack(track, utc) {
  return (track?.history ?? []).find(item => (
    Number.isFinite(Date.parse(item.observed_utc)) &&
    Date.parse(item.observed_utc) === Date.parse(utc)
  )) ?? null;
}

function pixelOf(frame, longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return -1;
  if (Math.abs(latitude) >= 85) return -1;
  const R = 6378137;
  const x = R * longitude * Math.PI / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const g = frame.georef;
  const col = Math.floor((x - g.minX) / (g.maxX - g.minX) * frame.width);
  const row = Math.floor((g.maxY - y) / (g.maxY - g.minY) * frame.height);
  return col < 0 || row < 0 || col >= frame.width || row >= frame.height
    ? -1 : row * frame.width + col;
}

function locationAt(frame, row, col) {
  const g = frame.georef;
  const R = 6378137;
  const x = g.minX + (col + 0.5) * (g.maxX - g.minX) / frame.width;
  const y = g.maxY - (row + 0.5) * (g.maxY - g.minY) / frame.height;
  return {
    longitude: x / R * 180 / Math.PI,
    latitude: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI
  };
}

function longestCircularRun(bins) {
  let best = 0, start = 0, current = 0;
  for (let i = 0; i < bins.length * 2; i++) {
    current = bins[i % bins.length] ? current + 1 : 0;
    if (current > best && current <= bins.length) {
      best = current;
      start = i - current + 1;
    }
  }
  return { length: best, start: ((start % bins.length) + bins.length) % bins.length };
}

// Bounded, deliberately conservative reflectivity-shape research heuristic.
// An incomplete crescent/arc of weaker echo must wrap around a tracked >=40 dBZ
// core. It is NOT a tornado or mesocyclone detector and is not validated yet.
export function findExperimentalHookArc(frame, result, trackId) {
  if (!observed(frame)) return null;
  const seg = result?.segmentations?.[0];
  const track = (result?.tracks ?? []).find(t => t.track_id === trackId);
  const obs = observationForTrack(track, frame.observedUtc);
  const id = sourceCellId(obs, seg);
  if (!id || seg?.labels?.length !== frame.categories.length) return null;
  // Cache one whole-raster scan per segmented frame; rendering many tracked
  // cells must not rescan Queensland-sized imagery for every individual cell.
  let boundsByCell = hookBoundsCache.get(seg);
  if (!boundsByCell) {
    boundsByCell = new Map();
    for (let i = 0; i < seg.labels.length; i++) {
      const label = seg.labels[i];
      if (!label) continue;
      const row = Math.floor(i / frame.width), col = i % frame.width;
      if (!boundsByCell.has(label)) {
        boundsByCell.set(label, {
          sumX:0, sumY:0, count:0,
          left:frame.width, right:0, top:frame.height, bottom:0
        });
      }
      const bounds = boundsByCell.get(label);
      bounds.sumX += col; bounds.sumY += row; bounds.count++;
      bounds.left = Math.min(bounds.left, col);
      bounds.right = Math.max(bounds.right, col);
      bounds.top = Math.min(bounds.top, row);
      bounds.bottom = Math.max(bounds.bottom, row);
    }
    hookBoundsCache.set(seg, boundsByCell);
  }
  const bounds = boundsByCell.get(id);
  if (!bounds || bounds.count < 24) return null;
  const { count, left, right, top, bottom } = bounds;
  const cx = bounds.sumX / count, cy = bounds.sumY / count;
  const labels = seg.labels;
  const halfSize = 31;
  const xmin = Math.max(0, Math.floor(cx - halfSize));
  const xmax = Math.min(frame.width - 1, Math.ceil(cx + halfSize));
  const ymin = Math.max(0, Math.floor(cy - halfSize));
  const ymax = Math.min(frame.height - 1, Math.ceil(cy + halfSize));
  // Exclude oversized/incomplete components and boundary clipping.
  if (right - left > 34 || bottom - top > 34 ||
      cx - halfSize < 0 || cy - halfSize < 0 ||
      cx + halfSize >= frame.width || cy + halfSize >= frame.height) return null;
  const w = xmax - xmin + 1, h = ymax - ymin + 1;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  // Flood-fill weaker reflectivity outward from the tracked core, so unrelated
  // echoes elsewhere in the window cannot create spurious arcs.
  for (let row = ymin; row <= ymax; row++) {
    for (let col = xmin; col <= xmax; col++) {
      if (labels[row * frame.width + col] !== id) continue;
      const p = (row - ymin) * w + col - xmin;
      visited[p] = 1; queue[tail++] = p;
    }
  }
  const bins = Array.from({ length: HOOK_BINS }, () => []);
  const categories = frame.categories;
  while (head < tail) {
    const local = queue[head++];
    const row = ymin + Math.floor(local / w), col = xmin + local % w;
    const i = row * frame.width + col;
    const dx = col - cx, dy = row - cy, radius = Math.hypot(dx, dy);
    const category = categories[i];
    if (category >= 3 && category < 7 && radius >= 9 && radius <= 26) {
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const bin = Math.floor(angle / (Math.PI * 2) * HOOK_BINS);
      bins[bin].push({ row, col, radius });
    }
    for (const [ox, oy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const nx = col + ox, ny = row + oy;
      if (nx < xmin || nx > xmax || ny < ymin || ny > ymax) continue;
      const p = (ny - ymin) * w + nx - xmin;
      if (visited[p] || categories[ny * frame.width + nx] < 3) continue;
      visited[p] = 1; queue[tail++] = p;
    }
  }
  const occupied = bins.map(points => points.length >= 2);
  const total = occupied.filter(Boolean).length;
  const run = longestCircularRun(occupied);
  // Roughly 75-180 degrees of a connected, thinner extension.
  if (total < 5 || total > 12 || run.length < 5 ||
      run.length < total * 0.8 || tail < count + 15) return null;
  const middleBin = (run.start + Math.floor(run.length / 2)) % HOOK_BINS;
  const arcPoints = bins[middleBin];
  if (!arcPoints.length) return null;
  const representative = arcPoints[Math.floor(arcPoints.length / 2)];
  return {
    track_id: trackId,
    observed_utc: frame.observedUtc,
    ...locationAt(frame, representative.row, representative.col),
    arc_degrees: run.length * 360 / HOOK_BINS,
    evidence: "connected 28-40 dBZ reflectivity arc around a measured >=40 dBZ track"
  };
}

function windAlerts(frame, result, dopplerState) {
  const segmentation = result?.segmentations?.[0];
  if (!segmentation?.labels || !observed(frame)) return [];
  const byLocalId = new Map();
  for (const track of result.tracks ?? []) {
    const localId = sourceCellId(observationForTrack(track, frame.observedUtc), segmentation);
    if (localId) byLocalId.set(localId, track.track_id);
  }
  const grouped = new Map();
  for (const record of dopplerState?.records ?? []) {
    const radarId = String(record.radarId ?? "");
    const delta = Math.abs(Date.parse(record.observedUtc) - Date.parse(frame.observedUtc)) / 60000;
    if (!VERIFIED_DOPPLER_RADARS.includes(radarId) ||
        record.velocityRangeVerified !== true ||
        !(record.verifiedRadialRangeKmh >= DAMAGING_WIND_GUST_REFERENCE_KMH) ||
        !(delta <= MAX_PAIRING_MINUTES)) continue;
    for (const sample of record.samples ?? []) {
      const velocity = Number(sample.velocity_kmh);
      if (!Number.isFinite(velocity) || Math.abs(velocity) < DAMAGING_WIND_GUST_REFERENCE_KMH) continue;
      const index = pixelOf(frame, Number(sample.longitude), Number(sample.latitude));
      if (index < 0) continue;
      const trackId = byLocalId.get(segmentation.labels[index]);
      if (!trackId) continue;
      const key = radarId + ":" + trackId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push({ sample, velocity, record, trackId, radarId });
    }
  }
  const alerts = [];
  for (const points of grouped.values()) {
    // Require a local cluster, not three disconnected extreme pixels.
    if (points.length < 3) continue;
    const strongest = points.reduce((a, b) => (
      Math.abs(a.velocity) >= Math.abs(b.velocity) ? a : b
    ));
    const nearStrongest = points.filter(item => {
      const dx = (Number(item.sample.longitude) - Number(strongest.sample.longitude)) *
        Math.cos(Number(strongest.sample.latitude) * Math.PI / 180) * 111.32;
      const dy = (Number(item.sample.latitude) - Number(strongest.sample.latitude)) * 111.32;
      return Number.isFinite(dx) && Number.isFinite(dy) &&
        dx * dx + dy * dy <= 25; // 5 km radius
    });
    if (nearStrongest.length < 3) continue;
    alerts.push({
      id: "wind:" + strongest.radarId + ":" + strongest.trackId,
      type: "wind",
      track_id: strongest.trackId,
      observed_utc: frame.observedUtc,
      source_utc: strongest.record.observedUtc,
      radar_id: strongest.radarId,
      longitude: Number(strongest.sample.longitude),
      latitude: Number(strongest.sample.latitude),
      velocity_kmh: strongest.velocity,
      sample_count: nearStrongest.length,
      title: "High Doppler radial velocity",
      caveat: "Radar radial velocity, NOT a measured surface gust or an official BoM warning."
    });
  }
  return alerts;
}

export function buildSevereStormFrameAlerts({
  frame, result, previousFrame, previousResult, dopplerState,
  enableExperimentalHook = false
}) {
  const windSourceSupported = (dopplerState?.records ?? []).some(record => (
    VERIFIED_DOPPLER_RADARS.includes(String(record.radarId)) &&
    record.velocityRangeVerified === true &&
    record.verifiedRadialRangeKmh >= DAMAGING_WIND_GUST_REFERENCE_KMH
  ));
  const alerts = windAlerts(frame, result, dopplerState);
  if (enableExperimentalHook && observed(frame) && observed(previousFrame) &&
      result && previousResult &&
      Date.parse(frame.observedUtc) > Date.parse(previousFrame.observedUtc) &&
      Date.parse(frame.observedUtc) - Date.parse(previousFrame.observedUtc) <= HOOK_MAX_GAP_MINUTES * 60000) {
    for (const track of result.tracks ?? []) {
      const current = findExperimentalHookArc(frame, result, track.track_id);
      if (!current) continue;
      const prior = findExperimentalHookArc(previousFrame, previousResult, track.track_id);
      if (!prior) continue;
      alerts.push({
        id: "hook:" + track.track_id,
        type: "hook",
        title: "Possible hook-like echo",
        caveat: "Experimental shape candidate only. Not verified rotation or a tornado warning.",
        ...current,
        previous_utc: previousFrame.observedUtc
      });
    }
  }
  return {
    alerts,
    windSourceSupported,
    hookExperimental: true,
    interpretation: "Algorithmic radar evidence only; official BoM warnings take precedence."
  };
}
