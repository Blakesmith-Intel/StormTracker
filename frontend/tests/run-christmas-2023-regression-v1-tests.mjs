import assert from "node:assert/strict";

import {
  CHRISTMAS_2023_REGRESSION_BASELINE,
  evaluateChristmas2023Regression
} from "../src/christmas-2023-regression-v1.js";

function expectedRun() {
  const scores =
    [
      35,
      60,
      64,
      68,
      70,
      58
    ];

  const categories =
    [
      "MODERATE",
      "HIGH",
      "HIGH",
      "VERY HIGH",
      "VERY HIGH",
      "HIGH"
    ];

  const doppler =
    [
      7,
      9,
      11,
      13,
      15,
      13
    ];

  const times =
    [
      "20:20 AEST",
      "20:25 AEST",
      "20:30 AEST",
      "20:35 AEST",
      "20:40 AEST",
      "20:45 AEST"
    ];

  return {
    scenario: {
      id:
        "christmas-2023-gold-coast-qlcs-v1"
    },

    results:
      scores.map(
        (
          score,
          index
        ) => ({
          frame: {
            local_time:
              times[index]
          },

          globalObservations: [
            {
              multi_radar_confirmed:
                true
            }
          ],

          track: {
            track_id:
              "ST0001",

            motion:
              index === 0
                ? null
                : {
                    speed_kmh:
                      122.45,

                    heading_degrees:
                      112.31
                  }
          },

          assessment: {
            score,

            category:
              categories[index],

            doppler_component_score:
              doppler[index]
          }
        })
      ),

    finalTracks: [
      {
        track_id:
          "ST0001",

        observation_count:
          6
      }
    ]
  };
}

const good =
  evaluateChristmas2023Regression(
    expectedRun()
  );

assert.equal(
  good.passed,
  true
);

assert.equal(
  good.passed_count,
  good.total_count
);

assert.deepEqual(
  good.score_sequence,
  CHRISTMAS_2023_REGRESSION_BASELINE
    .expected_score_sequence
);

const scoringRegression =
  expectedRun();

scoringRegression
  .results[4]
  .assessment
  .score =
    69;

const badScore =
  evaluateChristmas2023Regression(
    scoringRegression
  );

assert.equal(
  badScore.passed,
  false
);

assert.equal(
  badScore.checks
    .find(
      item =>
        item.id
        === "score-baseline"
    )
    .pass,
  false
);

const identityRegression =
  expectedRun();

identityRegression
  .results[3]
  .track
  .track_id =
    "ST0002";

const badIdentity =
  evaluateChristmas2023Regression(
    identityRegression
  );

assert.equal(
  badIdentity.passed,
  false
);

assert.equal(
  badIdentity.checks
    .find(
      item =>
        item.id
        === "persistent-identity"
    )
    .pass,
  false
);

const motionRegression =
  expectedRun();

motionRegression
  .results[2]
  .track
  .motion
  .speed_kmh =
    141;

const badMotion =
  evaluateChristmas2023Regression(
    motionRegression
  );

assert.equal(
  badMotion.passed,
  false
);

assert.equal(
  badMotion.checks
    .find(
      item =>
        item.id
        === "motion-contract"
    )
    .pass,
  false
);

console.log(
  "12 main-product historical-regression contract tests passed."
);
