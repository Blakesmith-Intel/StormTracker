import assert from "node:assert/strict";

import {
  historicalPanelLayout
} from "../src/bom-doppler-history-spatial-v1.js";

assert.deepEqual(
  historicalPanelLayout(
    512,
    512
  ),
  {
    panelX:0,
    panelY:0,
    panelSize:512
  }
);

assert.deepEqual(
  historicalPanelLayout(
    524,
    564
  ),
  {
    panelX:6,
    panelY:6,
    panelSize:512
  }
);

assert.deepEqual(
  historicalPanelLayout(
    524,
    524
  ),
  {
    panelX:6,
    panelY:6,
    panelSize:512
  }
);

assert.throws(
  () =>
    historicalPanelLayout(
      400,
      400
    ),
  /Unsupported historical Doppler image size/
);

console.log(
  "4 historical Doppler spatial-layout tests passed."
);
