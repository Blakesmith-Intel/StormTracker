import assert from "node:assert/strict";

import {
  parseBomRadarLoopFrames,
  radarTimestampToIso
} from "../../relay/doppler-history-v1.js";

import {
  nearestDopplerFrameForTime
} from "../src/bom-doppler-intake-v3.js";

assert.equal(
  radarTimestampToIso(
    "202610040105"
  ),
  "2026-10-04T01:05:00.000Z"
);

assert.equal(
  radarTimestampToIso(
    "202613040105"
  ),
  null
);

const frames =
  parseBomRadarLoopFrames(
    `
      var theImageNames = [
        "/radar/IDR66I.T.202610040054.png",
        "/radar/IDR66I.T.202610040059.png",
        "/radar/IDR66I.T.202610040104.png",
        "/radar/IDR66I.T.202610040104.png"
      ];
    `,
    "IDR66I"
  );

assert.equal(
  frames.length,
  3
);

assert.equal(
  frames[0].filename,
  "IDR66I.T.202610040054.png"
);

assert.equal(
  frames[2].observedUtc,
  "2026-10-04T01:04:00.000Z"
);

const nearest =
  nearestDopplerFrameForTime(
    frames,
    "2026-10-04T01:00:00.000Z",
    8
  );

assert.equal(
  nearest.candidate.filename,
  "IDR66I.T.202610040059.png"
);

assert.equal(
  nearest.deltaMinutes,
  1
);

assert.equal(
  nearest.matched,
  true
);

const noMatch =
  nearestDopplerFrameForTime(
    frames,
    "2026-10-04T01:20:00.000Z",
    8
  );

assert.equal(
  noMatch.deltaMinutes,
  16
);

assert.equal(
  noMatch.matched,
  false
);

console.log(
  "9 Doppler history/frame-pairing tests passed."
);
