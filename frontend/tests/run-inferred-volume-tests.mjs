import assert from "node:assert/strict";

import {
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "../src/inferred-volume-v1.js";

const model = {
  profiles: [
    {
      low_level_dbz_min: 20,
      low_level_dbz_max: 30,
      levels: [
        {
          altitude_m_amsl: 500,
          occupancy_probability: 0.8,
          median_delta_dbz: -2,
          p25_delta_dbz: -4,
          p75_delta_dbz: 0
        },
        {
          altitude_m_amsl: 1500,
          occupancy_probability: 0.2,
          median_delta_dbz: -8,
          p25_delta_dbz: -10,
          p75_delta_dbz: -6
        }
      ]
    }
  ]
};

assert.equal(
  representativeDbzForCategory(1),
  null
);

assert.equal(
  representativeDbzForCategory(2),
  25.5
);

const inferred =
  inferColumn(
    model,
    25.5,
    {
      occupancyThreshold: 0.35,
      minimumOutputDbz: 20
    }
  );

assert.equal(
  inferred.length,
  1
);

assert.equal(
  inferred[0].altitude_m_amsl,
  500
);

assert.ok(
  Math.abs(
    inferred[0].dbzh
    - 23.5
  ) < 1e-9
);

const frame = {
  width: 2,
  height: 2,
  georef: {
    minX: 0,
    maxX: 2000,
    minY: 0,
    maxY: 2000
  }
};

const centre =
  pixelCentreMercator(
    frame,
    0,
    0
  );

assert.deepEqual(
  centre,
  {
    x: 500,
    y: 1500
  }
);

const geographic =
  webMercatorToDegrees(
    0,
    0
  );

assert.ok(
  Math.abs(
    geographic.longitude
  ) < 1e-12
);

assert.ok(
  Math.abs(
    geographic.latitude
  ) < 1e-12
);

console.log(
  "4 inferred-volume tests passed."
);
