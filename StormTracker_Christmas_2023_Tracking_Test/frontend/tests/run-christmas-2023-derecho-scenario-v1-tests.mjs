import assert from "node:assert/strict";

import {
  CHRISTMAS_2023_GOLD_COAST_SCENARIO,
  runChristmas2023TrackingScenario
} from "../src/christmas-2023-derecho-scenario-v1.js";

const run =
  runChristmas2023TrackingScenario();

assert.equal(
  CHRISTMAS_2023_GOLD_COAST_SCENARIO
    .frames
    .length,
  6
);

assert.equal(
  run.results.length,
  6
);

const identities =
  new Set(
    run.results.map(
      result =>
        result.track.track_id
    )
  );

assert.deepEqual(
  [...identities],
  [
    "ST0001"
  ]
);

assert.equal(
  run.finalTracks.length,
  1
);

assert.equal(
  run.finalTracks[0]
    .observation_count,
  6
);

for (
  const result
  of run.results
) {
  assert.equal(
    result.globalObservations.length,
    1
  );

  assert.equal(
    result.globalObservations[0]
      .multi_radar_confirmed,
    true
  );

  assert.equal(
    result.assessment.track_id,
    "ST0001"
  );

  assert.equal(
    result.assessment.doppler_integrated,
    true
  );

  assert.equal(
    result.assessment.doppler_radar_id,
    "66"
  );
}

for (
  const result
  of run.results.slice(
    1
  )
) {
  assert.ok(
    result.track.motion
      .speed_kmh
      <= 140
  );

  assert.ok(
    result.track.motion
      .speed_kmh
      >= 100
  );

  assert.ok(
    result.track.motion
      .heading_degrees
      >= 105
  );

  assert.ok(
    result.track.motion
      .heading_degrees
      <= 120
  );
}

assert.ok(
  run.results.some(
    result =>
      result.assessment.category
      === "VERY HIGH"
  )
);

const destructiveWarningFrame =
  run.results.find(
    result =>
      result.frame.local_time
      === "20:40 AEST"
  );

assert.ok(
  destructiveWarningFrame
);

assert.equal(
  destructiveWarningFrame
    .assessment
    .doppler_component_score,
  15
);

assert.equal(
  destructiveWarningFrame
    .assessment
    .category,
  "VERY HIGH"
);

assert.equal(
  destructiveWarningFrame
    .track
    .track_id,
  "ST0001"
);

console.log(
  "18 Christmas 2023 severe-storm tracking scenario tests passed."
);
