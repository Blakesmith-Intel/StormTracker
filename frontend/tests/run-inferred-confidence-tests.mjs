import assert from "node:assert/strict";

import {
  inferredIqrDbz,
  styleForInferredPoint,
  supportBandForPoint
} from "../src/inferred-confidence-v1.js";

const high = {
  dbzh: 45,
  confidence: 0.80,
  p25_dbzh: 42,
  p75_dbzh: 49
};

assert.equal(
  inferredIqrDbz(high),
  7
);

assert.equal(
  supportBandForPoint(
    high,
    {
      displayThresholdDbz: 40
    }
  ),
  "high"
);

const medium = {
  dbzh: 44,
  confidence: 0.60,
  p25_dbzh: 35,
  p75_dbzh: 48
};

assert.equal(
  supportBandForPoint(
    medium,
    {
      displayThresholdDbz: 40
    }
  ),
  "medium"
);

const low = {
  dbzh: 43,
  confidence: 0.38,
  p25_dbzh: 29,
  p75_dbzh: 49
};

assert.equal(
  supportBandForPoint(
    low,
    {
      displayThresholdDbz: 40
    }
  ),
  "low"
);

const styledHigh =
  styleForInferredPoint(
    high,
    {
      displayThresholdDbz: 40,
      basePointSize: 4
    }
  );

const styledLow =
  styleForInferredPoint(
    low,
    {
      displayThresholdDbz: 40,
      basePointSize: 4
    }
  );

assert.ok(
  styledHigh.alpha
  > styledLow.alpha
);

assert.ok(
  styledHigh.pixelSize
  > styledLow.pixelSize
);

console.log(
  "5 inferred-confidence tests passed."
);
