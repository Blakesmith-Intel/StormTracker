import assert from "node:assert/strict";

import {
  ALL_AVAILABLE_LOOP_VALUE,
  availableRadarLoopMinutes,
  normaliseRadarHistoryTimes,
  radarHistoryCadenceMinutes,
  radarHistorySpanMinutes,
  selectRadarHistoryTimes
} from "../src/radar-history-window-v1.js";

const stamp = minute =>
  new Date(Date.UTC(2026, 9, 7, 5, minute)).toISOString();

const fiveMinuteHistory =
  Array.from({ length: 9 }, (_, index) => stamp(10 + index * 5));

assert.equal(radarHistorySpanMinutes(fiveMinuteHistory), 40);
assert.equal(radarHistoryCadenceMinutes(fiveMinuteHistory), 5);
assert.deepEqual(availableRadarLoopMinutes(fiveMinuteHistory), [30]);
assert.equal(selectRadarHistoryTimes(fiveMinuteHistory, 30).length, 6);
assert.deepEqual(
  selectRadarHistoryTimes(fiveMinuteHistory, ALL_AVAILABLE_LOOP_VALUE),
  fiveMinuteHistory
);

const ninetyFiveMinutes =
  Array.from({ length: 20 }, (_, index) => stamp(index * 5));
assert.deepEqual(
  availableRadarLoopMinutes(ninetyFiveMinutes),
  [30, 60, 90]
);
assert.equal(selectRadarHistoryTimes(ninetyFiveMinutes, 90).length, 18);

const tenMinuteCadence =
  Array.from({ length: 7 }, (_, index) => stamp(index * 10));
assert.equal(radarHistoryCadenceMinutes(tenMinuteCadence), 10);
assert.deepEqual(availableRadarLoopMinutes(tenMinuteCadence), [30, 60]);
assert.equal(selectRadarHistoryTimes(tenMinuteCadence, 60).length, 6);

const gappy = [
  stamp(0), stamp(5), stamp(10), stamp(15),
  stamp(60), stamp(65), stamp(70), stamp(75), stamp(80)
];
assert.deepEqual(availableRadarLoopMinutes(gappy), [30]);
assert.throws(
  () => selectRadarHistoryTimes(gappy, 60),
  /cannot currently supply/
);

assert.deepEqual(
  normaliseRadarHistoryTimes([
    stamp(10), "invalid", stamp(5), stamp(10)
  ]),
  [stamp(5), stamp(10)]
);

console.log(
  "Dynamic radar-history checks passed: source span/cadence, supported windows, all-available mode and gap rejection."
);
