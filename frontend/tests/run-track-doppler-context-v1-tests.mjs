import assert from "node:assert/strict";

import {
  buildTrackDopplerContexts,
  framePixelForLonLat,
  pixelCentreLonLat,
  summariseRadialVelocities
} from "../src/track-doppler-context-v1.js";

const frame = {
  observedUtc:
    "2026-10-04T01:00:00Z",

  width:
    4,

  height:
    4,

  georef: {
    projection:
      "EPSG:3857",

    minX:
      17000000,

    maxX:
      17004000,

    minY:
      -3204000,

    maxY:
      -3200000
  }
};

const labels =
  new Uint16Array(
    16
  );

labels[
  1 * 4 + 1
] =
  2;

labels[
  1 * 4 + 2
] =
  2;

labels[
  2 * 4 + 1
] =
  2;

const segmentation = {
  labels
};

const track = {
  track_id:
    "ST0001",

  history: [
    {
      observed_utc:
        frame.observedUtc,

      source_cells: [
        [
          "BOM-MOSAIC",
          2
        ]
      ]
    }
  ]
};

const p11 =
  pixelCentreLonLat(
    frame,
    1,
    1
  );

const p12 =
  pixelCentreLonLat(
    frame,
    2,
    1
  );

const p21 =
  pixelCentreLonLat(
    frame,
    1,
    2
  );

const outside =
  pixelCentreLonLat(
    frame,
    3,
    3
  );

assert.deepEqual(
  framePixelForLonLat(
    frame,
    p11.longitude,
    p11.latitude
  ),
  {
    column:1,
    row:1,
    index:5
  }
);

assert.deepEqual(
  summariseRadialVelocities(
    [
      -40,
      -20,
      30
    ]
  ),
  {
    sample_count:3,
    strongest_toward_kmh:-40,
    strongest_away_kmh:30,
    radial_span_kmh:70,
    maximum_absolute_kmh:40
  }
);

const result =
  buildTrackDopplerContexts({
    frame,

    segmentation,

    tracks: [
      track
    ],

    dopplerRecords: [
      {
        radarId:
          "66",

        observedUtc:
          "2026-10-04T01:04:00Z",

        timeBasis:
          "test",

        samples: [
          {
            ...p11,
            velocity_kmh:-40
          },
          {
            ...p12,
            velocity_kmh:-20
          },
          {
            ...p21,
            velocity_kmh:30
          },
          {
            ...outside,
            velocity_kmh:70
          }
        ]
      },

      {
        radarId:
          "50",

        observedUtc:
          "2026-10-04T01:30:00Z",

        timeBasis:
          "test",

        samples: [
          {
            ...p11,
            velocity_kmh:-70
          },
          {
            ...p12,
            velocity_kmh:70
          },
          {
            ...p21,
            velocity_kmh:70
          }
        ]
      }
    ]
  });

assert.equal(
  result.tracks_with_doppler,
  1
);

assert.equal(
  result.sourceStatus.length,
  2
);

assert.equal(
  result.sourceStatus[0].time_matched,
  true
);

assert.equal(
  result.sourceStatus[1].time_matched,
  false
);

const context =
  result.contextByTrack.get(
    "ST0001"
  );

assert.ok(
  context
);

assert.equal(
  context.radar_count,
  1
);

assert.equal(
  context.primary.radar_id,
  "66"
);

assert.equal(
  context.primary.sample_count,
  3
);

assert.equal(
  context.primary.strongest_toward_kmh,
  -40
);

assert.equal(
  context.primary.strongest_away_kmh,
  30
);

assert.equal(
  context.primary.radial_span_kmh,
  70
);

console.log(
  "11 Doppler-to-track context tests passed."
);
