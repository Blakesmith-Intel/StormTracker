// Operational contextual sources must never silently display expired incidents.
// This is the timestamp of the last usable download, not source event time.
export const MAX_CONTEXT_SNAPSHOT_AGE_MS = Object.freeze({
  floodRoadClosures: 30 * 60 * 1000,
  powerOutages: 60 * 60 * 1000
});

export function sourceSnapshotState({lastLoadedAt = 0, maxAgeMs, nowMs = Date.now()} = {}) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new RangeError("Positive snapshot age limit required");
  }
  const checkedAt = Number(lastLoadedAt);
  if (!Number.isFinite(checkedAt) || checkedAt <= 0) {
    return {kind: "unavailable", ageMs: null, expired: false};
  }
  const ageMs = nowMs - checkedAt;
  // Protect against system clock rollback without flagging minor clock jitter.
  if (!Number.isFinite(ageMs) || ageMs < -120000) {
    return {kind: "clock-anomaly", ageMs, expired: true};
  }
  return {kind: ageMs >= maxAgeMs ? "expired" : "current", ageMs,
    expired: ageMs >= maxAgeMs};
}

export function checkedAtAest(loadedAt) {
  if (!Number.isFinite(loadedAt) || loadedAt <= 0) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZoneName: "short"
  }).format(new Date(loadedAt));
}

export function sourceFailureStatus({
  error, lastLoadedAt = 0, maxAgeMs, nowMs = Date.now()
} = {}) {
  const state = sourceSnapshotState({lastLoadedAt, maxAgeMs, nowMs});
  const cause = String(error?.message ?? error ?? "Source unavailable").slice(0, 180);
  const checked = checkedAtAest(Number(lastLoadedAt));
  if (state.expired) {
    return {...state, kind: "error",
      message: `Source unavailable · expired incidents cleared (last checked ${checked || "unknown"}) · ${cause}`};
  }
  if (state.kind === "current") {
    return {...state, kind: "warning",
      message: `Source unavailable · cached incidents UNVERIFIED (last checked ${checked}) · ${cause}`};
  }
  return {...state, kind: "error",
    message: `Source unavailable · no verified incidents · ${cause}`};
}
