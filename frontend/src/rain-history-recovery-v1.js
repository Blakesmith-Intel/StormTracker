import {
  availableRadarLoopMinutes, buildRadarPlaybackPlan,
  continuousRadarHistoryTimes, radarHistorySpanMinutes,
  selectRadarHistoryPlan
} from "./radar-history-window-v1.js";

export const RAIN_STARTUP_MINUTES = 30;

// Respect native source timestamps. The 30-minute standard can run with a
// shorter initial scan set; archive windows 60/120/180 are enabled only after
// source-history validation, with an honest 30-minute recovery on load races.
// Inferred gap-fill remains marked as display-only by the existing timeline.
export function resolveRainHistoryWindow(observedTimes, requestedMinutes) {
  const minutes = Number(requestedMinutes);
  if (![30,60,120,180].includes(minutes)) {
    throw new RangeError("Rain-only selection must be 30, 60, 120 or 180 minutes");
  }
  const current = continuousRadarHistoryTimes(observedTimes);
  const complete = availableRadarLoopMinutes(current).includes(minutes);
  const plan = complete
    ? selectRadarHistoryPlan(current,minutes)
    : buildRadarPlaybackPlan(current);
  const latest = Date.parse(plan.at(-1)?.observedUtc);
  const cutoff = latest - RAIN_STARTUP_MINUTES * 60000;
  return {
    requestedMinutes:minutes,
    actualSpanMinutes:radarHistorySpanMinutes(current),
    plan: complete ? plan : plan.filter(frame =>
      Date.parse(frame.observedUtc) >= cutoff),
    partial: !complete
  };
}
