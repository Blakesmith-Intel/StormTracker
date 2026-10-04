export const CHRISTMAS_2023_REGRESSION_BASELINE =
  Object.freeze({
    id:
      "christmas-2023-regression-v1",

    scenario_id:
      "christmas-2023-gold-coast-qlcs-v1",

    expected_track_id:
      "ST0001",

    expected_frame_count:
      6,

    expected_score_sequence:
      [
        35,
        60,
        64,
        68,
        70,
        58
      ],

    expected_category_sequence:
      [
        "MODERATE",
        "HIGH",
        "HIGH",
        "VERY HIGH",
        "VERY HIGH",
        "HIGH"
      ],

    expected_doppler_sequence:
      [
        7,
        9,
        11,
        13,
        15,
        13
      ],

    peak_local_time:
      "20:40 AEST",

    expected_peak_score:
      70,

    expected_peak_doppler:
      15,

    minimum_motion_kmh:
      122.0,

    maximum_motion_kmh:
      123.0,

    minimum_heading_degrees:
      112.0,

    maximum_heading_degrees:
      112.6
  });

function check(
  id,
  label,
  pass,
  detail
) {
  return {
    id,
    label,
    pass:
      Boolean(
        pass
      ),
    detail:
      String(
        detail
      )
  };
}

function sameSequence(
  actual,
  expected
) {
  return (
    actual.length
    === expected.length
    && actual.every(
      (
        value,
        index
      ) =>
        value
        === expected[
          index
        ]
    )
  );
}

export function evaluateChristmas2023Regression(
  run,
  baseline =
    CHRISTMAS_2023_REGRESSION_BASELINE
) {
  const results =
    run?.results
    ?? [];

  const checks =
    [];

  checks.push(
    check(
      "scenario-id",
      "Scenario identity",
      run?.scenario?.id
        === baseline.scenario_id,
      `actual ${run?.scenario?.id ?? "missing"}`
    )
  );

  checks.push(
    check(
      "frame-count",
      "Six 5-minute validation frames",
      results.length
        === baseline.expected_frame_count,
      `actual ${results.length}`
    )
  );

  const trackIds =
    results.map(
      result =>
        result?.track?.track_id
        ?? null
    );

  checks.push(
    check(
      "persistent-identity",
      "Persistent ST0001 identity",
      (
        trackIds.length
        === baseline.expected_frame_count
        && trackIds.every(
          id =>
            id
            === baseline.expected_track_id
        )
      ),
      `actual ${trackIds.join(", ")}`
    )
  );

  const finalTracks =
    run?.finalTracks
    ?? [];

  checks.push(
    check(
      "single-final-track",
      "No fragmentation into extra tracks",
      (
        finalTracks.length
        === 1
        && finalTracks[0]
          ?.track_id
        === baseline.expected_track_id
        && finalTracks[0]
          ?.observation_count
        === baseline.expected_frame_count
      ),
      `tracks ${finalTracks.length}; observations ${finalTracks[0]?.observation_count ?? 0}`
    )
  );

  const allMultiRadar =
    results.every(
      result =>
        result
          ?.globalObservations
          ?.length
        === 1
        && result
          .globalObservations[0]
          ?.multi_radar_confirmed
        === true
    );

  checks.push(
    check(
      "cross-radar-dedupe",
      "50/66 observations deduplicate to one multi-radar object",
      allMultiRadar,
      allMultiRadar
        ? "all frames cross-radar confirmed"
        : "one or more frames failed cross-radar deduplication"
    )
  );

  const motions =
    results
      .slice(
        1
      )
      .map(
        result =>
          result?.track?.motion
      );

  const motionPass =
    motions.length
      === baseline.expected_frame_count - 1
    && motions.every(
      motion =>
        motion
        && motion.speed_kmh
          >= baseline.minimum_motion_kmh
        && motion.speed_kmh
          <= baseline.maximum_motion_kmh
        && motion.heading_degrees
          >= baseline.minimum_heading_degrees
        && motion.heading_degrees
          <= baseline.maximum_heading_degrees
    );

  checks.push(
    check(
      "motion-contract",
      "Observed centroid motion remains southeast and association-safe",
      motionPass,
      motions
        .map(
          motion =>
            motion
              ? (
                  `${motion.speed_kmh.toFixed(1)} km/h @ ` +
                  `${motion.heading_degrees.toFixed(1)}°`
                )
              : "missing"
        )
        .join(" | ")
    )
  );

  const scoreSequence =
    results.map(
      result =>
        Number(
          result?.assessment?.score
        )
    );

  checks.push(
    check(
      "score-baseline",
      "Assessment score sequence unchanged",
      sameSequence(
        scoreSequence,
        baseline.expected_score_sequence
      ),
      `actual ${scoreSequence.join(" / ")}; baseline ${baseline.expected_score_sequence.join(" / ")}`
    )
  );

  const categorySequence =
    results.map(
      result =>
        result?.assessment?.category
        ?? null
    );

  checks.push(
    check(
      "category-baseline",
      "Assessment category sequence unchanged",
      sameSequence(
        categorySequence,
        baseline.expected_category_sequence
      ),
      `actual ${categorySequence.join(" / ")}`
    )
  );

  const dopplerSequence =
    results.map(
      result =>
        Number(
          result
            ?.assessment
            ?.doppler_component_score
        )
    );

  checks.push(
    check(
      "doppler-baseline",
      "Footprint Doppler contribution sequence unchanged",
      sameSequence(
        dopplerSequence,
        baseline.expected_doppler_sequence
      ),
      `actual ${dopplerSequence.join(" / ")}`
    )
  );

  const peak =
    results.find(
      result =>
        result?.frame?.local_time
        === baseline.peak_local_time
    );

  checks.push(
    check(
      "destructive-warning-peak",
      "20:40 destructive-warning frame remains VERY HIGH with 15/15 Doppler",
      (
        peak?.track?.track_id
          === baseline.expected_track_id
        && peak?.assessment?.score
          === baseline.expected_peak_score
        && peak?.assessment?.category
          === "VERY HIGH"
        && peak?.assessment?.doppler_component_score
          === baseline.expected_peak_doppler
      ),
      peak
        ? (
            `${peak.assessment.category} ${peak.assessment.score}/100; ` +
            `Doppler ${peak.assessment.doppler_component_score}/15`
          )
        : "20:40 frame missing"
    )
  );

  const passed =
    checks.filter(
      item =>
        item.pass
    )
      .length;

  return {
    baseline_id:
      baseline.id,

    passed:
      passed
      === checks.length,

    passed_count:
      passed,

    total_count:
      checks.length,

    checks,

    score_sequence:
      scoreSequence,

    category_sequence:
      categorySequence,

    doppler_sequence:
      dopplerSequence
  };
}
