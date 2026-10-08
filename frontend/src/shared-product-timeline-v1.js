import { nearestDopplerFrameForTime } from './bom-doppler-intake-v3.js';

export const ACTIVE_DOPPLER_RADARS = Object.freeze(['66', '50', '08']);

// Clip to real source bounds; the matching tolerance never extends history.
// The current GIF remains eligible ONLY at the original newest radar time.
export function buildSharedProductTimeline(reflectivityTimes, histories, latestRecords = new Map(), radarIds = ACTIVE_DOPPLER_RADARS) {
  const times = [...new Set(reflectivityTimes)]
    .filter(time => Number.isFinite(Date.parse(time)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const newestReflectivityUtc = times.at(-1);
  const sources = radarIds.map(radarId => {
    const history = (histories.get(radarId)?.frames ?? [])
      .filter(frame => frame.filename && Number.isFinite(Date.parse(frame.observedUtc)))
      .map(frame => ({ ...frame, source_kind: 'history' }));
    const latest = latestRecords.get(radarId);
    const candidates = [...history];
    if (latest?.observedUtc && Number.isFinite(Date.parse(latest.observedUtc))) {
      candidates.push({ filename: latest.filename, observedUtc: latest.observedUtc, source_kind: 'latest' });
    }
    // An outage is reported, rather than masquerading as a zero-length history.
    return { radarId, history, candidates, available: history.length > 0 };
  });
  const availableSources = sources.filter(source => source.available);
  const unavailableRadarIds = sources.filter(source => !source.available).map(source => source.radarId);
  if (!times.length || !availableSources.length) {
    return { entries: [], unavailableRadarIds, radarIds: [], startUtc: null, endUtc: null, spanMinutes: 0 };
  }
  const startEpoch = Math.max(Date.parse(times[0]), ...availableSources.map(source =>
    Math.min(...source.history.map(frame => Date.parse(frame.observedUtc)))));
  const endEpoch = Math.min(Date.parse(newestReflectivityUtc), ...availableSources.map(source =>
    Math.max(...source.candidates.map(frame => Date.parse(frame.observedUtc)))));
  const entries = [];
  for (const observedUtc of times) {
    const epoch = Date.parse(observedUtc);
    if (epoch < startEpoch || epoch > endEpoch) continue;
    const pairings = sources.map(source => ({
      radarId: source.radarId,
      ...nearestDopplerFrameForTime(
        source.available
          ? source.candidates.filter(frame => frame.source_kind === 'history' || observedUtc === newestReflectivityUtc)
          : [],
        observedUtc,
        8
      )
    }));
    if (pairings.filter(pair => availableSources.some(source => source.radarId === pair.radarId))
      .every(pair => pair.matched)) entries.push({ observedUtc, pairings });
  }
  return {
    entries, unavailableRadarIds,
    radarIds: availableSources.map(source => source.radarId),
    startUtc: entries[0]?.observedUtc ?? null,
    endUtc: entries.at(-1)?.observedUtc ?? null,
    spanMinutes: entries.length > 1
      ? (Date.parse(entries.at(-1).observedUtc) - Date.parse(entries[0].observedUtc)) / 60000 : 0
  };
}


// The operational display must not be clipped to the Doppler FTP history,
// which can arrive late, be incomplete, or temporarily fail. This is a
// *left join*: every genuine reflectivity time remains available, with null
// Doppler where no source reading is confirmed. The historical strict shared
// timeline above is retained for independent comparison/diagnostic contracts.
export function buildRadarPrimaryProductTimeline(
  reflectivityTimes,
  histories,
  latestRecords = new Map(),
  radarIds = ACTIVE_DOPPLER_RADARS,
  maxDeltaMinutes = 3
) {
  const times = [...new Set(reflectivityTimes ?? [])]
    .filter(time => Number.isFinite(Date.parse(time)))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const endUtc = times.at(-1) ?? null;
  const ids = [...new Set(radarIds.map(String))];
  const unavailableRadarIds = ids.filter(id =>
    !(histories.get(id)?.frames ?? []).some(record =>
      record.filename && Number.isFinite(Date.parse(record.observedUtc))
    )
  );
  const sources = ids.map(id => {
    const history = (histories.get(id)?.frames ?? [])
      .filter(record => record.filename && Number.isFinite(Date.parse(record.observedUtc)))
      .map(record => ({ ...record, source_kind: "history" }));
    const newest = latestRecords.get(id);
    return {
      id, history,
      latest: newest?.observedUtc && Number.isFinite(Date.parse(newest.observedUtc))
        ? { ...newest, source_kind: "latest" }
        : null
    };
  });
  const entries = times.map(observedUtc => ({
    observedUtc,
    pairings: sources.map(source => {
      const candidates = [...source.history];
      // Do not put a current unversioned GIF into past frame playback.
      if (source.latest && observedUtc === endUtc)
        candidates.push(source.latest);
      const pairing = nearestDopplerFrameForTime(
        candidates, observedUtc, maxDeltaMinutes
      );
      // Candidates outside the valid time window are diagnostics, not data.
      return { radarId: source.id, ...pairing };
    })
  }));
  const observedPairCount = entries.reduce((sum, entry) =>
    sum + entry.pairings.filter(pair => pair.matched).length, 0
  );
  return {
    entries, unavailableRadarIds, radarIds: ids,
    requestedRadarIds: ids,
    startUtc: times[0] ?? null,
    endUtc,
    spanMinutes: times.length > 1
      ? (Date.parse(endUtc) - Date.parse(times[0])) / 60000 : 0,
    matchedPairCount: observedPairCount,
    possiblePairCount: entries.length * ids.length,
    mode: "reflectivity-primary"
  };
}
