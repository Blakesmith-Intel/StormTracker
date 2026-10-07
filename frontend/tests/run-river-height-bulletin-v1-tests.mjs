import assert from "node:assert/strict";

import {
  parseRiverHeightBulletin,
  parseRiverHeightTable,
  parseRiverHeightText
} from "../src/context-layers/river-height-bulletin-v1.js";

const html = `
<html>
<body>
<table>
  <tr>
    <th>Station Name</th>
    <th>Time/Day</th>
    <th>Height</th>
    <th>Tendency</th>
    <th>Flood Class</th>
    <th>Recent Data</th>
  </tr>
  <tr>
    <td>Nerang River at Carrara</td>
    <td>10.16am Tue</td>
    <td>0.58 m</td>
    <td>Rising</td>
    <td>Below Minor</td>
    <td><a href="/fwo/IDQ60285/station?id=040123">Plot</a></td>
  </tr>
  <tr>
    <td>Bremer River at Ipswich</td>
    <td>10.20am Tue</td>
    <td>7.25</td>
    <td>Falling</td>
    <td>Moderate Flood</td>
    <td><a href="/recent?station=040101">Table</a></td>
  </tr>
  <tr>
    <td>Brisbane River at City Gauge</td>
    <td>10.22am Tue</td>
    <td>1.10</td>
    <td>Steady</td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>The river height observations are real-time operational data and are supplied for flood warning purposes.</td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td>Tingalpa Creek at Leslie Harrison Dam</td>
    <td>10.23am Tue</td>
    <td>1.25</td>
    <td>Rising</td>
    <td></td>
    <td><a href="/fwo/IDQ65388/IDQ65388.540384.plt.shtml">Plot</a></td>
  </tr>
</table>
</body>
</html>
`;

const observations =
  parseRiverHeightTable(
    html,
    "IDQ60285"
  );

assert.equal(
  observations.length,
  4,
  "Narrative/footer rows without a numeric river height must not be emitted as observations."
);

assert.deepEqual(
  observations[0],
  {
    stationName:
      "Nerang River at Carrara",
    stationId:
      "040123",
    heightMetres:
      0.58,
    tendency:
      "rising",
    floodClass:
      "below-minor",
    observedText:
      "10.16am Tue",
    recentDataHref:
      "/fwo/IDQ60285/station?id=040123",
    sourceProduct:
      "IDQ60285"
  }
);

assert.equal(
  observations[1]
    .heightMetres,
  7.25
);

assert.equal(
  observations[1]
    .tendency,
  "falling"
);

assert.equal(
  observations[1]
    .floodClass,
  "moderate"
);

assert.equal(
  observations[1]
    .stationId,
  "040101"
);

assert.equal(
  observations[2]
    .tendency,
  "steady"
);

assert.equal(
  observations[2]
    .floodClass,
  ""
);

assert.equal(
  observations[3]
    .stationId,
  "540384",
  "BoM recent-data plot links must yield the embedded gauge station number, not the IDQ product number."
);

const flat =
  parseRiverHeightText(
    `
Latest River Heights:
Nerang River at Carrara,0.58,rising,10:16 am Tue 19/05/26
Nerang River at Evandale,0.51,falling,10:14 am Tue 19/05/26,Minor Flood
Not a data line
    `,
    "IDQ60285"
  );

assert.equal(
  flat.length,
  2
);

assert.deepEqual(
  flat[0],
  {
    stationName:
      "Nerang River at Carrara",
    stationId:
      "",
    heightMetres:
      0.58,
    tendency:
      "rising",
    floodClass:
      "",
    observedText:
      "10:16 am Tue 19/05/26",
    recentDataHref:
      "",
    sourceProduct:
      "IDQ60285"
  }
);

assert.equal(
  flat[1]
    .floodClass,
  "minor"
);

assert.deepEqual(
  parseRiverHeightBulletin({
    html,
    sourceProduct:
      "IDQ60285"
  }),
  observations
);

assert.deepEqual(
  parseRiverHeightBulletin({
    text:
      "Test River,1.23,steady,2:30 pm Wed",
    sourceProduct:
      "IDQ60290"
  }),
  [
    {
      stationName:
        "Test River",
      stationId:
        "",
      heightMetres:
        1.23,
      tendency:
        "steady",
      floodClass:
        "",
      observedText:
        "2:30 pm Wed",
      recentDataHref:
        "",
      sourceProduct:
        "IDQ60290"
    }
  ]
);

console.log(
  "River-height bulletin checks passed: BoM table and flat-text observations preserve height, tendency, flood class, observation text and station IDs without inferred hazards."
);
