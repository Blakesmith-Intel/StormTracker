import {
  ALL_AVAILABLE_LOOP_VALUE, availableRadarLoopMinutes,
  continuousRadarHistoryTimes, radarHistorySpanMinutes
} from "./radar-history-window-v1.js";

// Source gaps and short BoM retention must not crash the operational player.
// A partially available rain-only loop always uses genuine observations and
// explicitly reports its shorter range while the browser archive accumulates.
export function resolveRainHistoryWindow(observedTimes, requestedMinutes) {
  const minutes = Number(requestedMinutes);
  if (![60,120,180].includes(minutes)) {
    throw new RangeError("Rain-only selection must be 60, 120 or 180 minutes");
  }
  const current = continuousRadarHistoryTimes(observedTimes);
  const complete = availableRadarLoopMinutes(current).includes(minutes);
  return {
    requestedMinutes: minutes,
    actualSpanMinutes: radarHistorySpanMinutes(current),
    effectiveSelection: complete ? String(minutes) : ALL_AVAILABLE_LOOP_VALUE,
    partial: !complete
  };
}
