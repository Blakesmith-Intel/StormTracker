import {
  SUPPORTED_LOOP_MINUTES,
  normaliseLoopMinutes
} from "./operational-loop-v1.js";

export const ALL_AVAILABLE_LOOP_VALUE = "all";

export function normaliseRadarHistoryTimes(times = []) {
  return [...new Set(
    (times ?? []).filter(time =>
      Number.isFinite(Date.parse(time))
    )
  )].sort(
    (a, b) => Date.parse(a) - Date.parse(b)
  );
}

export function continuousRadarHistoryTimes(times = []) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return history;

  const cadence = radarHistoryCadenceMinutes(history);
  const maximumAcceptedGap = Math.max(15, cadence * 2);

  for (let index = history.length - 1; index > 0; index--) {
    const gap = (
      Date.parse(history[index])
      - Date.parse(history[index - 1])
    ) / 60000;

    if (!Number.isFinite(gap) || gap <= 0 || gap > maximumAcceptedGap) {
      return history.slice(index);
    }
  }

  return history;
}

export function radarHistorySpanMinutes(times) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return 0;
  return (
    Date.parse(history.at(-1))
    - Date.parse(history[0])
  ) / 60000;
}

export function radarHistoryCadenceMinutes(times) {
  const history = normaliseRadarHistoryTimes(times);
  if (history.length < 2) return 5;

  const gaps = [];
  for (let index = 1; index < history.length; index++) {
    const gap = (
      Date.parse(history[index])
      - Date.parse(history[index - 1])
    ) / 60000;
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }

  if (!gaps.length) return 5;

  // The shortest repeated source interval is the conservative cadence.
  // Missing scans can lengthen a gap; they must not make the source appear to
  // have a slower cadence and thereby legitimise a sparse pseudo-loop.
  return Math.min(...gaps);
}

function selectWindowHistory(history, minutes) {
  const cadence = radarHistoryCadenceMinutes(history);
  const targetSpan = Math.max(0, minutes - cadence);
  const latestEpoch = Date.parse(history.at(-1));
  const cutoff = latestEpoch - targetSpan * 60000;

  let startIndex = history.findIndex(
    time => Date.parse(time) >= cutoff
  );

  if (startIndex < 0) startIndex = history.length - 1;

  // Include the immediately preceding real scan when the requested boundary
  // falls between source timestamps. This keeps the window source-truthful
  // without inventing or interpolating radar frames.
  if (
    startIndex > 0
    && Date.parse(history[startIndex]) > cutoff
  ) {
    startIndex--;
  }

  return {
    cadence,
    targetSpan,
    frames: history.slice(startIndex)
  };
}

function hasContinuousCoverage(frames, cadence) {
  if (frames.length < 2) return false;
  const maximumAcceptedGap = Math.max(15, cadence * 2);

  for (let index = 1; index < frames.length; index++) {
    const gap = (
      Date.parse(frames[index])
      - Date.parse(frames[index - 1])
    ) / 60000;

    if (!Number.isFinite(gap) || gap <= 0 || gap > maximumAcceptedGap) {
      return false;
    }
  }

  return true;
}

export function availableRadarLoopMinutes(times) {
  const history = continuousRadarHistoryTimes(times);
  if (history.length < 2) return [];

  const availableSpan = radarHistorySpanMinutes(history);

  return SUPPORTED_LOOP_MINUTES.filter(minutes => {
    const { cadence, targetSpan, frames } =
      selectWindowHistory(history, minutes);

    return (
      availableSpan >= targetSpan
      && hasContinuousCoverage(frames, cadence)
    );
  });
}

export function selectRadarHistoryTimes(
  times,
  selection,
  { allowPartial = false } = {}
) {
  const history = continuousRadarHistoryTimes(times);
  if (!history.length) return [];

  if (selection === ALL_AVAILABLE_LOOP_VALUE) {
    return history;
  }

  const minutes = normaliseLoopMinutes(selection);
  const available = availableRadarLoopMinutes(history);

  if (!available.includes(minutes)) {
    if (allowPartial) return history;

    throw new RangeError(
      `Radar history cannot currently supply a continuous ${minutes}-minute loop.`
    );
  }

  return selectWindowHistory(history, minutes).frames;
}
