import assert from "node:assert/strict";

import {
  BOM_DOPPLER_GIF_LAYOUT,
  BOM_DOPPLER_MAPS,
  centrePixelResidual,
  dopplerMapCoordinateToLonLat,
  lonLatToDopplerMapCoordinate
} from "../src/bom-doppler-georef-v1.js";

const cornerMap = {
  sw: [0, 512],
  nw: [0, 0],
  ne: [512, 0],
  se: [512, 512]
};

function distanceM(
  lon1,
  lat1,
  lon2,
  lat2
) {
  const R =
    6371008.8;

  const toRad =
    value =>
      value
      * Math.PI
      / 180;

  const p1 =
    toRad(
      lat1
    );

  const p2 =
    toRad(
      lat2
    );

  const dp =
    toRad(
      lat2
      - lat1
    );

  const dl =
    toRad(
      lon2
      - lon1
    );

  const a =
    Math.sin(
      dp / 2
    ) ** 2
    + Math.cos(
        p1
      )
      * Math.cos(
          p2
        )
      * Math.sin(
          dl / 2
        ) ** 2;

  return (
    2
    * R
    * Math.atan2(
        Math.sqrt(
          a
        ),
        Math.sqrt(
          1 - a
        )
      )
  );
}

assert.deepEqual(
  BOM_DOPPLER_GIF_LAYOUT,
  {
    width:524,
    height:564,
    panelX:6,
    panelY:6,
    panelSize:512,
    footerY:524
  }
);

for (
  const radarId
  of ["08","50","66"]
) {
  const radar =
    BOM_DOPPLER_MAPS[
      radarId
    ];

  assert.equal(
    radar.projection,
    "Gnomonic"
  );

  for (
    const [
      cornerName,
      [
        column,
        row
      ]
    ]
    of Object.entries(
      cornerMap
    )
  ) {
    const calculated =
      dopplerMapCoordinateToLonLat(
        radarId,
        column,
        row
      );

    const expected =
      radar.corners[
        cornerName
      ];

    assert.ok(
      distanceM(
        calculated.longitude,
        calculated.latitude,
        expected.longitude,
        expected.latitude
      )
      < 1.0,
      `${radarId} ${cornerName} corner residual exceeded 1 m`
    );
  }

  const centreResidual =
    centrePixelResidual(
      radarId
    );

  assert.ok(
    centreResidual.magnitude_px
    < 0.01,
    `${radarId} recovered radar-centre pixel residual exceeded 0.01 px`
  );

  const arbitrary =
    dopplerMapCoordinateToLonLat(
      radarId,
      173.25,
      311.75
    );

  const roundTrip =
    lonLatToDopplerMapCoordinate(
      radarId,
      arbitrary.longitude,
      arbitrary.latitude
    );

  assert.ok(
    Math.abs(
      roundTrip.column
      - 173.25
    )
    < 1e-8
  );

  assert.ok(
    Math.abs(
      roundTrip.row
      - 311.75
    )
    < 1e-8
  );
}

console.log(
  "19 Doppler geolocation V1 tests passed."
);
