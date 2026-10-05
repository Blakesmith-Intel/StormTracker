import { ACTIVE_DOPPLER_RADARS } from './shared-product-timeline-v1.js';

export const LIVE_LOOP_REFRESH_MS = 300000;

// Radar-only playback retains its older reflectivity frames. Doppler context is
// absent outside the genuine shared history, never borrowed from newer images.
export function radarHistoryTimeline(times, shared) {
  const byTime = new Map(shared.entries.map(entry => [entry.observedUtc, entry]));
  const entries = [...new Set(times)].filter(time => Number.isFinite(Date.parse(time)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .map(observedUtc => byTime.get(observedUtc) ?? {
      observedUtc,
      pairings: ACTIVE_DOPPLER_RADARS.map(radarId => ({ radarId, matched: false, candidate: null }))
    });
  return { ...shared, entries, startUtc: entries[0]?.observedUtc ?? null,
    endUtc: entries.at(-1)?.observedUtc ?? null,
    spanMinutes: entries.length > 1
      ? (Date.parse(entries.at(-1).observedUtc) - Date.parse(entries[0].observedUtc)) / 60000 : 0 };
}

// Within-tolerance reuse of yesterday's tail is not a newly published pair.
// Every previously available radar must advance independently.
export function hasNewMatchedProducts(previous, next) {
  if (!next?.endUtc || !next.radarIds.length) return false;
  if (previous && Date.parse(next.endUtc) <= Date.parse(previous.endUtc)) return false;
  const tail = next.entries.at(-1);
  const oldTail = previous?.entries.at(-1);
  const required = previous?.radarIds.length ? previous.radarIds : next.radarIds;
  return required.every(id => {
    const pair = tail?.pairings.find(item => item.radarId === id);
    const old = oldTail?.pairings.find(item => item.radarId === id);
    return next.radarIds.includes(id) && pair?.matched &&
      Number.isFinite(Date.parse(pair.candidate?.observedUtc)) &&
      (!old?.matched || Date.parse(pair.candidate.observedUtc) > Date.parse(old.candidate.observedUtc));
  });
}

export function createLiveLoopRefresh({ refresh, onError, schedule = setTimeout,
  cancel = clearTimeout, interval = LIVE_LOOP_REFRESH_MS }) {
  let timer, active = false, pending = null;
  function arm() {
    if (active) timer = schedule(() => { timer = null; void check(); }, interval);
  }
  async function check() {
    if (!active || pending) return pending;
    if (timer != null) cancel(timer);
    timer = null;
    pending = Promise.resolve().then(refresh).catch(onError);
    try { await pending; } finally { pending = null; arm(); }
  }
  return {
    start() { if (!active) { active = true; arm(); } },
    stop() { active = false; if (timer != null) cancel(timer); timer = null; },
    check
  };
}
