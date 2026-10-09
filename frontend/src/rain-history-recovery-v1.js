import {
  availableRadarLoopMinutes, buildRadarPlaybackPlan,
  continuousRadarHistoryTimes, radarHistorySpanMinutes,
  selectRadarHistoryPlan
} from "./radar-history-window-v1.js";

export const RAIN_STARTUP_MINUTES = 30;

// A 30-minute rolling startup view uses only actual recent BoM observations,
// with clearly identified display-only interpolation for intermediate frames.
// It remains the fallback when the chosen longer rain-only archive is incomplete.
// No Doppler scan is ever brought into this rain-only view.
export function resolveRainHistoryWindow(observedTimes, requestedMinutes) {
  const minutes = Number(requestedMinutes);
  if (![60,120,180].includes(minutes)) {
    throw new RangeError("Rain-only selection must be 60, 120 or 180 minutes");
  }
  const current = continuousRadarHistoryTimes(observedTimes);
  const complete = availableRadarLoopMinutes(current).includes(minutes);
  const plan = complete
    ? selectRadarHistoryPlan(current,minutes)
    : buildRadarPlaybackPlan(current);
  const latest = Date.parse(plan.at(-1)?.observedUtc);
  const cutoff = latest - RAIN_STARTUP_MINUTES * 60000;
  return {
    requestedMinutes: minutes,
    actualSpanMinutes: radarHistorySpanMinutes(current),
    plan: complete ? plan : plan.filter(frame =>
      Date.parse(frame.observedUtc) >= cutoff),
    partial: !complete,
    starterMinutes: complete ? null : RAIN_STARTUP_MINUTES
  };
}
