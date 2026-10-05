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
