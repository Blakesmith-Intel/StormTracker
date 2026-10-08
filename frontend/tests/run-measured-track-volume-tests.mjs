import assert from "node:assert/strict";

import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend,
  shouldDisplayMeasuredTrackPoint
} from "../src/measured-track-volume-v1.js";

const model = {
  profiles: [
    {
      low_level_dbz_min: 40,
      low_level_dbz_max: 45,
      levels: [
        {
          altitude_m_amsl: 500,
          occupancy_probability: 0.82,
          median_delta_dbz: 0,
          p25_delta_dbz: -1,
          p75_delta_dbz: 2
        },
        {
          altitude_m_amsl: 1500,
          occupancy_probability: 0.76,
          median_delta_dbz: -1,
          p25_delta_dbz: -2,
          p75_delta_dbz: 2
        },
        {
          altitude_m_amsl: 2500,
          occupancy_probability: 0.45,
          median_delta_dbz: -2,
          p25_delta_dbz: -8,
          p75_delta_dbz: 4
        }
      ]
    }
  ]
};

const frame = {
  observedUtc:
    "2026-10-03T00:00:00Z",

  width: 4,
  height: 4,

  georef: {
    projection:
      "EPSG:3857",

    minX: 0,
    maxX: 4000,
    minY: 0,
    maxY: 4000
  },

  categories:
    new Uint8Array([
      0,0,0,0,
      0,7,7,0,
      0,7,7,0,
      0,0,0,0
    ])
};

const segmentation = {
  radar_id:
    "BOM-MOSAIC",

  labels:
    new Uint16Array([
      0,0,0,0,
      0,1,1,0,
      0,1,1,0,
      0,0,0,0
    ])
};

const observation = {
  source_cells: [
    [
      "BOM-MOSAIC",
      1
    ]
  ]
};

const volume =
  buildMeasuredTrackVolume(
    frame,
    segmentation,
    observation,
    model,
    {
      occupancyThreshold: 0.35,
      minimumOutputDbz: 20,
      displayThresholdDbz: 30,
      basePointSize: 3
    }
  );

assert.ok(volume);
assert.equal(volume.measured_pixel_count, 4);
assert.equal(volume.inferred_column_count, 4);
assert.equal(volume.inferred_point_count, 12);
assert.equal(volume.high_support_points, 8);
assert.equal(volume.low_support_points, 4);
assert.equal(volume.high_support_top_40_m_amsl, 1500);

const later = {
  ...volume,
  high_support_top_40_m_amsl:
    2500
};

const trend =
  highSupportTop40Trend(
    volume,
    "2026-10-03T00:00:00Z",
    later,
    "2026-10-03T00:05:00Z"
  );

assert.ok(trend);
assert.equal(trend.change_m, 1000);
assert.equal(trend.metres_per_10_min, 2000);

// Parity guard: drawn track points follow the user display cutoff, but
// the measured cell analysis and 40 dBZ top are unchanged.
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:29.9},30),false);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:30},30),true);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:33},40),false);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:50},40),true);
assert.equal(shouldDisplayMeasuredTrackPoint({dbzh:NaN},30),false);
assert.equal(volume.inferred_point_count,12); // Retains 20 dBZ science.
console.log("14 measured-track-volume checks passed, including rendered dBZ parity.");
