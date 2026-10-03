import assert from "node:assert/strict";

import {
  parseBomReceivedAtUtc
} from "../../relay/doppler-time-v1.js";

assert.equal(
  parseBomReceivedAtUtc(
    "Received at:     00:54 UTC Mon 10 Aug 2026"
  ),
  "2026-08-10T00:54:00.000Z"
);

assert.equal(
  parseBomReceivedAtUtc(
    "<div>Received at:&nbsp;&nbsp;06:54 UTC Tue 21 Jul 2026</div>"
  ),
  "2026-07-21T06:54:00.000Z"
);

assert.equal(
  parseBomReceivedAtUtc(
    "Received at: 9:44 UTC Sun 09 Aug 2026"
  ),
  "2026-08-09T09:44:00.000Z"
);

assert.equal(
  parseBomReceivedAtUtc(
    "no timestamp here"
  ),
  null
);

console.log(
  "4 BOM Doppler product timestamp tests passed."
);
