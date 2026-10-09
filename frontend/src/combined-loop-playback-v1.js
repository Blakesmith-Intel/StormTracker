// Keep original BoM observations and their timestamps intact while avoiding
// redundant Cesium work on Doppler-only playback events.
export function isDopplerOnlyPlaybackStep(previousFrame, nextFrame, combined, radarVisible) {
  // Repeated schedule events reference the SAME genuine radar frame object.
  // Matching timestamps alone are insufficient when a source has been refreshed.
  return Boolean(combined && radarVisible && previousFrame && nextFrame &&
    previousFrame === nextFrame);
}

// A combined pass contains both source clocks: target the same wall-clock
// duration as one radar-only pass rather than playing each timestamp for a
// full radar dwell. Keep a floor for responsive browser rendering.
export function sourceAlignedPlaybackDelayMs(radarDelayMs, schedule = [], combined = false) {
  if (!Number.isFinite(radarDelayMs) || radarDelayMs <= 0) {
    throw new RangeError("Playback delay must be positive");
  }
  if (!combined || !Array.isArray(schedule) || !schedule.length) return radarDelayMs;
  const genuineRadarTimes = new Set(schedule.map(step => step?.radarObservedUtc)
    .filter(value => typeof value === "string" && Number.isFinite(Date.parse(value))));
  if (!genuineRadarTimes.size) return radarDelayMs;
  return Math.max(80, Math.min(radarDelayMs,
    Math.round(radarDelayMs * genuineRadarTimes.size / schedule.length)));
}
