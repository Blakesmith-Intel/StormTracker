import assert from "node:assert/strict";

import {
  buildFootprintRestrictedTrackAssessment,
  strictDopplerValuesFromTrackContext
} from "../src/track-assessment-v2.js";

const track = {
  track_id:
    "ST0007",

  observation_count:
    4,

  latest: {
    observed_utc:
      "2026-10-04T01:15:00.000Z",

    centroid_longitude:
      153.10,

    centroid_latitude:
      -27.60,

    sampled_area_km2:
      80,

    maximum_category:
      12,

    multi_radar_confirmed:
      true
  },

  history: [
    {
      observed_utc:
        "2026-10-04T01:00:00.000Z",

      sampled_area_km2:
        40,

      maximum_category:
        10,

      multi_radar_confirmed:
        false
    },
    {
      observed_utc:
        "2026-10-04T01:05:00.000Z",

      sampled_area_km2:
        50,

      maximum_category:
        10,

      multi_radar_confirmed:
        false
    },
    {
      observed_utc:
        "2026-10-04T01:10:00.000Z",

      sampled_area_km2:
        60,

      maximum_category:
        11,

      multi_radar_confirmed:
        true
    },
    {
      observed_utc:
        "2026-10-04T01:15:00.000Z",

      sampled_area_km2:
        80,

      maximum_category:
        12,

      multi_radar_confirmed:
        true
    }
  ]
};

const dopplerContext = {
  primary: {
    radar_id:
      "66",

    source_time_utc:
      "2026-10-04T01:14:00.000Z",

    time_delta_minutes:
      1,

    sample_count:
      42,

    strongest_toward_kmh:
      -60,

    strongest_away_kmh:
      40,

    radial_span_kmh:
      100,

    maximum_absolute_kmh:
      60
  },

  radars: [
    {
      radar_id:"66"
    },
    {
      radar_id:"50",
      strongest_toward_kmh:-70,
      strongest_away_kmh:70
    }
  ]
};

assert.deepEqual(
  strictDopplerValuesFromTrackContext(
    dopplerContext
  ),
  [
    -60,
    40
  ]
);

const original =
  JSON.stringify(
    track
  );

const withDoppler =
  buildFootprintRestrictedTrackAssessment(
    track,
    dopplerContext,
    {
      referenceTime:
        new Date(
          "2026-10-04T01:15:00.000Z"
        )
    }
  );

const withoutDoppler =
  buildFootprintRestrictedTrackAssessment(
    track,
    null,
    {
      referenceTime:
        new Date(
          "2026-10-04T01:15:00.000Z"
        )
    }
  );

assert.equal(
  withDoppler.doppler_integrated,
  true
);

assert.equal(
  withDoppler.doppler_radar_id,
  "66"
);

assert.equal(
  withDoppler.doppler_sample_count,
  42
);

assert.equal(
  withDoppler.doppler_component_score,
  11
);

assert.equal(
  withDoppler.score
    - withoutDoppler.score,
  11
);

assert.equal(
  withoutDoppler.doppler_integrated,
  false
);

assert.equal(
  JSON.stringify(
    track
  ),
  original
);

console.log(
  "8 footprint-restricted track-assessment tests passed."
);
