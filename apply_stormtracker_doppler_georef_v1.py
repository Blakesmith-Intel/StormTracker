from pathlib import Path
import subprocess

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

for path in [
    SRC / "bom-doppler-intake-v1.js",
    SRC / "bom-doppler-decoder-v1.js",
    SRC / "geo.js",
]:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

print("StormTracker — exact Doppler geolocation diagnostic V1")
print()

(SRC / "bom-doppler-georef-v1.js").write_text(
r'''import {
  inverseGnomonic
} from "./geo.js?v=doppler-georef-v1";

export const BOM_DOPPLER_GIF_LAYOUT =
  Object.freeze({
    width: 524,
    height: 564,
    panelX: 6,
    panelY: 6,
    panelSize: 512,
    footerY: 524
  });

export const BOM_DOPPLER_MAPS =
  Object.freeze({
    "08": Object.freeze({
      id: "08",
      product: "IDR08I",
      map: "IDR083.map",
      projection: "Gnomonic",
      latitude: -25.967000,
      longitude: 152.582990,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -27.106450,
          longitude: 151.295640
        }),

        nw: Object.freeze({
          latitude: -24.807200,
          longitude: 151.320560
        }),

        ne: Object.freeze({
          latitude: -24.807130,
          longitude: 153.853680
        }),

        se: Object.freeze({
          latitude: -27.106370,
          longitude: 153.878770
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 255.165,
          row: 257.023
        })
    }),

    "50": Object.freeze({
      id: "50",
      product: "IDR50I",
      map: "IDR503.map",
      projection: "Gnomonic",
      latitude: -27.608000,
      longitude: 152.539000,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -28.748160,
          longitude: 151.233090
        }),

        nw: Object.freeze({
          latitude: -26.447760,
          longitude: 151.260240
        }),

        ne: Object.freeze({
          latitude: -26.447660,
          longitude: 153.829700
        }),

        se: Object.freeze({
          latitude: -28.748040,
          longitude: 153.857090
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 254.811,
          row: 256.903
        })
    }),

    "66": Object.freeze({
      id: "66",
      product: "IDR66I",
      map: "IDR663.map",
      projection: "Gnomonic",
      latitude: -27.718100,
      longitude: 153.240010,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -28.857650,
          longitude: 151.930950
        }),

        nw: Object.freeze({
          latitude: -26.556400,
          longitude: 151.958280
        }),

        ne: Object.freeze({
          latitude: -26.556320,
          longitude: 154.531130
        }),

        se: Object.freeze({
          latitude: -28.857550,
          longitude: 154.558670
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 255.065,
          row: 257.123
        })
    })
  });

const R =
  6371008.8;

const DEG =
  Math.PI / 180;

function toRad(
  value
) {
  return (
    Number(value)
    * DEG
  );
}

export function forwardGnomonic(
  longitude,
  latitude,
  longitude0,
  latitude0
) {
  const lambda =
    toRad(
      longitude
    );

  const phi =
    toRad(
      latitude
    );

  const lambda0 =
    toRad(
      longitude0
    );

  const phi0 =
    toRad(
      latitude0
    );

  const deltaLambda =
    lambda
    - lambda0;

  const cosC =
    Math.sin(
      phi0
    )
    * Math.sin(
        phi
      )
    + Math.cos(
        phi0
      )
      * Math.cos(
          phi
        )
      * Math.cos(
          deltaLambda
        );

  if (
    cosC <= 0
  ) {
    throw new Error(
      "Point is outside the visible hemisphere of the Gnomonic projection."
    );
  }

  return {
    x:
      R
      * Math.cos(
          phi
        )
      * Math.sin(
          deltaLambda
        )
      / cosC,

    y:
      R
      * (
          Math.cos(
            phi0
          )
          * Math.sin(
              phi
            )
          - Math.sin(
              phi0
            )
            * Math.cos(
                phi
              )
            * Math.cos(
                deltaLambda
              )
        )
      / cosC
  };
}

function projectedCorner(
  radar,
  corner
) {
  return forwardGnomonic(
    corner.longitude,
    corner.latitude,
    radar.longitude,
    radar.latitude
  );
}

export function projectedBoundsForRadar(
  radarId
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const sw =
    projectedCorner(
      radar,
      radar.corners.sw
    );

  const nw =
    projectedCorner(
      radar,
      radar.corners.nw
    );

  const ne =
    projectedCorner(
      radar,
      radar.corners.ne
    );

  const se =
    projectedCorner(
      radar,
      radar.corners.se
    );

  return {
    west:
      (
        sw.x
        + nw.x
      ) / 2,

    east:
      (
        ne.x
        + se.x
      ) / 2,

    south:
      (
        sw.y
        + se.y
      ) / 2,

    north:
      (
        nw.y
        + ne.y
      ) / 2
  };
}

export function dopplerMapCoordinateToLonLat(
  radarId,
  column,
  row
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const bounds =
    projectedBoundsForRadar(
      radarId
    );

  const size =
    BOM_DOPPLER_GIF_LAYOUT
      .panelSize;

  const x =
    bounds.west
    + (
        Number(
          column
        )
        / size
      )
      * (
        bounds.east
        - bounds.west
      );

  const y =
    bounds.north
    - (
        Number(
          row
        )
        / size
      )
      * (
        bounds.north
        - bounds.south
      );

  return inverseGnomonic(
    x,
    y,
    radar.longitude,
    radar.latitude
  );
}

export function dopplerPixelCentreToLonLat(
  radarId,
  column,
  row
) {
  return dopplerMapCoordinateToLonLat(
    radarId,
    Number(
      column
    ) + 0.5,
    Number(
      row
    ) + 0.5
  );
}

export function lonLatToDopplerMapCoordinate(
  radarId,
  longitude,
  latitude
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const bounds =
    projectedBoundsForRadar(
      radarId
    );

  const projected =
    forwardGnomonic(
      longitude,
      latitude,
      radar.longitude,
      radar.latitude
    );

  const size =
    BOM_DOPPLER_GIF_LAYOUT
      .panelSize;

  return {
    column:
      (
        projected.x
        - bounds.west
      )
      / (
        bounds.east
        - bounds.west
      )
      * size,

    row:
      (
        bounds.north
        - projected.y
      )
      / (
        bounds.north
        - bounds.south
      )
      * size
  };
}

export function gifPixelToDopplerPanelPixel(
  x,
  y
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  return {
    column:
      Number(
        x
      )
      - layout.panelX,

    row:
      Number(
        y
      )
      - layout.panelY
  };
}

export function dopplerPanelPixelToGifPixel(
  column,
  row
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  return {
    x:
      Number(
        column
      )
      + layout.panelX,

    y:
      Number(
        row
      )
      + layout.panelY
  };
}

export function centrePixelResidual(
  radarId
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  const calculated =
    lonLatToDopplerMapCoordinate(
      radarId,
      radar.longitude,
      radar.latitude
    );

  return {
    calculated,

    recovered:
      radar.recoveredCentrePixel,

    column_error_px:
      calculated.column
      - radar
        .recoveredCentrePixel
        .column,

    row_error_px:
      calculated.row
      - radar
        .recoveredCentrePixel
        .row,

    magnitude_px:
      Math.hypot(
        calculated.column
        - radar
          .recoveredCentrePixel
          .column,

        calculated.row
        - radar
          .recoveredCentrePixel
          .row
      )
  };
}
''',
encoding="utf-8"
)

(SRC / "bom-doppler-spatial-v1.js").write_text(
r'''import {
  decodeBureauDopplerPanel,
  locateExactBureauVelocityPalette
} from "./bom-doppler-decoder-v1.js?v=spatial-v1";

import {
  BOM_DOPPLER_GIF_LAYOUT,
  dopplerPixelCentreToLonLat
} from "./bom-doppler-georef-v1.js?v=spatial-v1";

export function decodeGeoreferencedDoppler(
  radarId,
  imageData
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  if (
    imageData.width
      !== layout.width
    || imageData.height
      !== layout.height
  ) {
    throw new Error(
      `Unexpected Bureau Doppler GIF size: ` +
      `${imageData.width}x${imageData.height}; ` +
      `expected ${layout.width}x${layout.height}.`
    );
  }

  const palette =
    locateExactBureauVelocityPalette(
      imageData
    );

  // The existing decoder intentionally works on the top-left square
  // 524x524 panel, because that was enough to validate the palette.
  // Spatial sampling uses the recovered native 512x512 map panel inside
  // that GIF: x/y 6..517 inclusive.
  const velocityByRgb =
    new Map(
      palette.swatches.map(
        swatch => [
          `${swatch.rgb[0]},${swatch.rgb[1]},${swatch.rgb[2]}`,
          swatch.velocity_kmh
        ]
      )
    );

  const velocities =
    new Float32Array(
      layout.panelSize
      * layout.panelSize
    );

  velocities.fill(
    Number.NaN
  );

  let validPixelCount =
    0;

  let nonZeroPixelCount =
    0;

  for (
    let row = 0;
    row < layout.panelSize;
    row++
  ) {
    for (
      let column = 0;
      column < layout.panelSize;
      column++
    ) {
      const gifX =
        column
        + layout.panelX;

      const gifY =
        row
        + layout.panelY;

      const sourceIndex =
        (
          gifY
          * imageData.width
          + gifX
        )
        * 4;

      const key =
        `${
          imageData.data[
            sourceIndex
          ]
        },${
          imageData.data[
            sourceIndex + 1
          ]
        },${
          imageData.data[
            sourceIndex + 2
          ]
        }`;

      if (
        !velocityByRgb.has(
          key
        )
      ) {
        continue;
      }

      const velocity =
        velocityByRgb.get(
          key
        );

      velocities[
        row
        * layout.panelSize
        + column
      ] =
        velocity;

      validPixelCount++;

      if (
        velocity !== 0
      ) {
        nonZeroPixelCount++;
      }
    }
  }

  return {
    radarId:
      String(
        radarId
      ),

    width:
      layout.panelSize,

    height:
      layout.panelSize,

    velocities,

    palette,

    validPixelCount,

    nonZeroPixelCount
  };
}

export function geolocatedDopplerSamples(
  decoded,
  {
    stride = 1,
    includeZero = false
  } = {}
) {
  const samples = [];

  for (
    let row = 0;
    row < decoded.height;
    row += stride
  ) {
    for (
      let column = 0;
      column < decoded.width;
      column += stride
    ) {
      const velocity =
        decoded.velocities[
          row
          * decoded.width
          + column
        ];

      if (
        Number.isNaN(
          velocity
        )
      ) {
        continue;
      }

      if (
        !includeZero
        && velocity === 0
      ) {
        continue;
      }

      const position =
        dopplerPixelCentreToLonLat(
          decoded.radarId,
          column,
          row
        );

      samples.push({
        column,
        row,
        velocity_kmh:
          velocity,

        longitude:
          position.longitude,

        latitude:
          position.latitude
      });
    }
  }

  return samples;
}
''',
encoding="utf-8"
)

(FRONTEND / "doppler-georef-v1.html").write_text(
r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Geolocation V1
</title>

<link
  href="https://unpkg.com/cesium@1.145.0/Build/Cesium/Widgets/widgets.css"
  rel="stylesheet"
>

<script
  src="https://unpkg.com/cesium@1.145.0/Build/Cesium/Cesium.js"
></script>

<style>
  * {
    box-sizing:border-box;
  }

  html,
  body,
  #app {
    width:100%;
    height:100%;
    margin:0;
  }

  body {
    overflow:hidden;
    background:#0b141a;
    color:#eef5f8;
    font-family:
      Inter,
      system-ui,
      sans-serif;
  }

  #app {
    display:grid;
    grid-template-columns:
      330px 1fr;
  }

  aside {
    overflow:auto;
    padding:12px;
    background:#0d1920;
    border-right:
      1px solid #30424d;
  }

  #cesiumContainer {
    width:100%;
    height:100%;
  }

  h1 {
    margin:0 0 4px;
    font-size:20px;
  }

  .note {
    color:#a9bbc4;
    font-size:11px;
    line-height:1.45;
  }

  button {
    width:100%;
    margin-top:8px;
    padding:9px;
    border:1px solid #496473;
    border-radius:6px;
    background:#1a2d38;
    color:#fff;
    cursor:pointer;
  }

  .card {
    margin-top:10px;
    padding:10px;
    border:1px solid #30424d;
    border-radius:8px;
    background:#111e26;
  }

  .metric {
    display:grid;
    grid-template-columns:
      155px 1fr;
    gap:4px 7px;
    font-size:11px;
  }

  .metric span:nth-child(odd) {
    color:#9fb2bc;
  }

  #status {
    white-space:pre-wrap;
    font:
      10px/1.4
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }

  .legend {
    display:grid;
    grid-template-columns:
      repeat(
        2,
        1fr
      );
    gap:4px;
    font-size:10px;
    margin-top:7px;
  }

  .towards {
    color:#70c8ff;
  }

  .away {
    color:#ffd12a;
  }

  @media (
    max-width:800px
  ) {
    #app {
      grid-template-columns:
        1fr;
      grid-template-rows:
        44% 56%;
    }
  }
</style>
</head>

<body>
<div id="app">
  <aside>
    <h1>
      StormTracker Doppler geolocation V1
    </h1>

    <div class="note">
      Uses the recovered Bureau 128-km Gnomonic map metadata for IDR083,
      IDR503 and IDR663. The public 524×564 GIF contains a native 512×512
      radar map at x/y 6…517. Zero-velocity white pixels are omitted from
      this diagnostic so map/annotation ambiguity cannot dominate the view.
    </div>

    <div class="card">
      <button data-radar="66">
        Load Mt Stapylton 66
      </button>

      <button data-radar="50">
        Load Marburg 50
      </button>

      <button data-radar="08">
        Load Gympie 08
      </button>
    </div>

    <div class="card">
      <div class="metric">
        <span>Radar</span>
        <strong id="radar">—</strong>

        <span>Native panel</span>
        <strong>512 × 512</strong>

        <span>Decoded Doppler pixels</span>
        <strong id="valid">—</strong>

        <span>Non-zero Doppler pixels</span>
        <strong id="nonzero">—</strong>

        <span>Rendered samples</span>
        <strong id="samples">—</strong>

        <span>Recovered centre residual</span>
        <strong id="residual">—</strong>
      </div>

      <div class="legend">
        <strong class="towards">
          Blue/cyan = toward radar
        </strong>

        <strong class="away">
          Yellow/red = away radar
        </strong>
      </div>
    </div>

    <div class="card">
      <strong>Status</strong>
      <div id="status">
        Ready.
      </div>
    </div>
  </aside>

  <div id="cesiumContainer"></div>
</div>

<script type="module">
import {
  loadDopplerDiagnostic
} from "./src/bom-doppler-intake-v1.js?v=georef-v1";

import {
  BOM_DOPPLER_MAPS,
  centrePixelResidual
} from "./src/bom-doppler-georef-v1.js?v=georef-v1";

import {
  decodeGeoreferencedDoppler,
  geolocatedDopplerSamples
} from "./src/bom-doppler-spatial-v1.js?v=georef-v1";

const $ =
  id =>
    document.getElementById(
      id
    );

const viewer =
  new Cesium.Viewer(
    "cesiumContainer",
    {
      animation:false,
      timeline:false,
      geocoder:false,
      homeButton:false,
      sceneModePicker:false,
      baseLayerPicker:false,
      navigationHelpButton:false,
      fullscreenButton:false,
      infoBox:false,
      selectionIndicator:false,
      terrainProvider:
        new Cesium.EllipsoidTerrainProvider(),
      baseLayer:false,
      requestRenderMode:true,
      maximumRenderTimeChange:
        Infinity
    }
  );

viewer.imageryLayers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({
    url:
      "https://tile.openstreetmap.org/"
  })
);

const scene =
  viewer.scene;

scene.fog.enabled =
  false;

const points =
  scene.primitives.add(
    new Cesium.PointPrimitiveCollection()
  );

const radarSource =
  new Cesium.CustomDataSource(
    "doppler-radar"
  );

viewer.dataSources.add(
  radarSource
);

function velocityColour(
  velocity
) {
  if (
    velocity < 0
  ) {
    const strength =
      Math.min(
        1,
        Math.abs(
          velocity
        ) / 70
      );

    return Cesium.Color.fromHsl(
      0.56,
      0.95,
      0.72
        - strength * 0.32,
      0.82
    );
  }

  const strength =
    Math.min(
      1,
      velocity / 70
    );

  return Cesium.Color.fromHsl(
    0.13
      - strength * 0.12,
    0.95,
    0.62
      - strength * 0.18,
    0.82
  );
}

function sourceImageData(
  canvas
) {
  return canvas
    .getContext(
      "2d",
      {
        willReadFrequently:true
      }
    )
    .getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
}

async function loadRadar(
  radarId
) {
  $("status").textContent =
    `Loading radar ${radarId}…`;

  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const decoded =
    decodeGeoreferencedDoppler(
      radarId,
      sourceImageData(
        source.canvas
      )
    );

  const samples =
    geolocatedDopplerSamples(
      decoded,
      {
        stride:1,
        includeZero:false
      }
    );

  points.removeAll();
  radarSource.entities.removeAll();

  const radar =
    BOM_DOPPLER_MAPS[
      radarId
    ];

  radarSource.entities.add({
    position:
      Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        0
      ),

    point: {
      pixelSize:10,
      color:
        Cesium.Color.WHITE,
      outlineColor:
        Cesium.Color.BLACK,
      outlineWidth:2
    },

    label: {
      text:
        `${radarId} radar`,
      font:
        "12px sans-serif",
      pixelOffset:
        new Cesium.Cartesian2(
          0,
          -16
        ),
      fillColor:
        Cesium.Color.WHITE,
      showBackground:true,
      backgroundColor:
        Cesium.Color.BLACK
          .withAlpha(
            0.65
          )
    },

    ellipse: {
      semiMajorAxis:
        128000,
      semiMinorAxis:
        128000,
      material:
        Cesium.Color.WHITE
          .withAlpha(
            0.015
          ),
      outline:true,
      outlineColor:
        Cesium.Color.WHITE
          .withAlpha(
            0.35
          ),
      height:0
    }
  });

  for (
    const sample
    of samples
  ) {
    points.add({
      position:
        Cesium.Cartesian3.fromDegrees(
          sample.longitude,
          sample.latitude,
          120
        ),

      color:
        velocityColour(
          sample.velocity_kmh
        ),

      pixelSize:
        2.5,

      disableDepthTestDistance:
        Number.POSITIVE_INFINITY
    });
  }

  const residual =
    centrePixelResidual(
      radarId
    );

  $("radar").textContent =
    `${radarId} — ${radar.product}`;

  $("valid").textContent =
    decoded.validPixelCount
      .toLocaleString();

  $("nonzero").textContent =
    decoded.nonZeroPixelCount
      .toLocaleString();

  $("samples").textContent =
    samples.length
      .toLocaleString();

  $("residual").textContent =
    `${residual.magnitude_px.toFixed(3)} px`;

  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        420000
      ),

    orientation: {
      heading:0,
      pitch:
        -Cesium.Math.PI_OVER_TWO,
      roll:0
    }
  });

  scene.requestRender();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +
    `${samples.length} non-zero radial-velocity pixels positioned using ` +
    `${radar.map}. Compare the plotted velocity field with the underlying ` +
    `Brisbane/SEQ geography before storm-object integration.`;
}

for (
  const button
  of document.querySelectorAll(
    "[data-radar]"
  )
) {
  button.addEventListener(
    "click",
    () =>
      loadRadar(
        button.dataset.radar
      ).catch(
        error => {
          console.error(
            error
          );

          $("status").textContent =
            `ERROR — ${error.message}`;
        }
      )
  );
}
</script>
</body>
</html>
''',
encoding="utf-8"
)

(TESTS / "run-doppler-georef-v1-tests.mjs").write_text(
r'''import assert from "node:assert/strict";

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
''',
encoding="utf-8"
)

print("Checking generated JavaScript syntax...")

for file in [
    "frontend/src/bom-doppler-georef-v1.js",
    "frontend/src/bom-doppler-spatial-v1.js",
]:
    subprocess.run(
        [
            "node",
            "--check",
            file
        ],
        cwd=ROOT,
        check=True
    )

print()
print("Running Doppler geolocation tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-georef-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Doppler decoder tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-decoder-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running existing StormTracker tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  19 Doppler geolocation V1 tests passed.")
print("  12 Doppler decoder V1 tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    'git add '
    'frontend/doppler-georef-v1.html '
    'frontend/src/bom-doppler-georef-v1.js '
    'frontend/src/bom-doppler-spatial-v1.js '
    'frontend/tests/run-doppler-georef-v1-tests.mjs'
)
print(
    'git commit -m "Add exact public BOM Doppler geolocation"'
)
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-georef-v1.html"
)
print()
print("Press:")
print("  Load Mt Stapylton 66")
print()
print(
    "Send one screenshot showing the geolocated Doppler field over the "
    "SEQ basemap."
)
