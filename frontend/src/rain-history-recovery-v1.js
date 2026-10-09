import {
  availableRadarLoopMinutes,continuousRadarHistoryTimes,
  radarHistorySpanMinutes,selectRadarHistoryTimes
} from "./radar-history-window-v1.js";

export const RAIN_STARTUP_MINUTES = 30;

// The playback plan consists entirely of actual BoM observations; missing
// measurements stay missing. Source gaps are never filled by new imagery.
export function resolveRainHistoryWindow(observedTimes,requestedMinutes) {
  const minutes=Number(requestedMinutes);
  if(![30,60,120,180].includes(minutes))
    throw new RangeError("Rain-only selection must be 30, 60, 120 or 180 minutes");
  const continuous=continuousRadarHistoryTimes(observedTimes);
  const complete=availableRadarLoopMinutes(continuous).includes(minutes);
  const latest=Date.parse(continuous.at(-1));
  const selection=complete
    ? selectRadarHistoryTimes(continuous,minutes)
    : continuous.filter(utc=>Date.parse(utc)>=latest-RAIN_STARTUP_MINUTES*60000);
  return {
    requestedMinutes:minutes,
    actualSpanMinutes:radarHistorySpanMinutes(continuous),
    plan:selection.map(observedUtc=>({kind:"observed",observedUtc})),
    partial:!complete
  };
}
