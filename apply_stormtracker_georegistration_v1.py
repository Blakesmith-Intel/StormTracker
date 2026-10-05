from pathlib import Path
import shutil
import subprocess

ROOT = Path("/workspaces/StormTracker")
frontend = ROOT / "frontend"
src = frontend / "src"
tests = frontend / "tests"

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label} block, found {count}."
        )
    return text.replace(old, new, 1)

for path in [
    src / "live3d-core-v4.js",
    frontend / "live3d-core-v4.html",
    src / "inferred-volume-v1.js",
]:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

print("StormTracker — 2-D / 3-D georegistration diagnostic V1")
print()

georeg_module = r'''import {
  pixelCentreMercator,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=registration-v1";

const WEB_MERCATOR_RADIUS = 6378137;

export function degreesToWebMercator(
  longitude,
  latitude
) {
  const lon = Number(longitude);

  const lat = Math.max(
    -85.05112878,
    Math.min(
      85.05112878,
      Number(latitude)
    )
  );

  return {
    x:
      WEB_MERCATOR_RADIUS
      * lon
      * Math.PI
      / 180,

    y:
      WEB_MERCATOR_RADIUS
      * Math.log(
        Math.tan(
          Math.PI / 4
          + lat
            * Math.PI
            / 360
        )
      )
  };
}

export function geographicToPixel(
  frame,
  longitude,
  latitude
) {
  const mercator =
    degreesToWebMercator(
      longitude,
      latitude
    );

  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  return {
    column:
      (
        mercator.x
        - frame.georef.minX
      )
      / dx
      - 0.5,

    row:
      (
        frame.georef.maxY
        - mercator.y
      )
      / dy
      - 0.5
  };
}

export function registrationResidualPixels(
  frame,
  column,
  row
) {
  const mercator =
    pixelCentreMercator(
      frame,
      column,
      row
    );

  const geographic =
    webMercatorToDegrees(
      mercator.x,
      mercator.y
    );

  const roundTrip =
    geographicToPixel(
      frame,
      geographic.longitude,
      geographic.latitude
    );

  return {
    column_error_px:
      roundTrip.column
      - column,

    row_error_px:
      roundTrip.row
      - row,

    magnitude_px:
      Math.hypot(
        roundTrip.column
        - column,

        roundTrip.row
        - row
      )
  };
}

export function selectRegistrationAnchors(
  frame,
  {
    count = 3,
    minimumCategory = 2,
    minimumSeparationPx = 40
  } = {}
) {
  const candidates = [];

  for (
    let row = 0;
    row < frame.height;
    row++
  ) {
    for (
      let column = 0;
      column < frame.width;
      column++
    ) {
      const category =
        Number(
          frame.categories[
            row * frame.width
            + column
          ]
        );

      if (
        category
        < minimumCategory
      ) {
        continue;
      }

      candidates.push({
        row,
        column,
        category
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.category
      - a.category
  );

  const selected = [];

  for (const candidate of candidates) {
    const tooClose =
      selected.some(
        existing =>
          Math.hypot(
            candidate.column
            - existing.column,

            candidate.row
            - existing.row
          )
          < minimumSeparationPx
      );

    if (tooClose) {
      continue;
    }

    const mercator =
      pixelCentreMercator(
        frame,
        candidate.column,
        candidate.row
      );

    const geographic =
      webMercatorToDegrees(
        mercator.x,
        mercator.y
      );

    const residual =
      registrationResidualPixels(
        frame,
        candidate.column,
        candidate.row
      );

    selected.push({
      id:
        `A${selected.length + 1}`,

      ...candidate,

      longitude:
        geographic.longitude,

      latitude:
        geographic.latitude,

      residual_px:
        residual.magnitude_px
    });

    if (
      selected.length
      >= count
    ) {
      break;
    }
  }

  return selected;
}
'''

(src / "georegistration-v1.js").write_text(
    georeg_module,
    encoding="utf-8"
)

shutil.copy2(
    src / "live3d-core-v4.js",
    src / "live3d-registration-v1.js",
)

shutil.copy2(
    frontend / "live3d-core-v4.html",
    frontend / "live3d-registration-v1.html",
)

js_path = src / "live3d-registration-v1.js"
js = js_path.read_text(encoding="utf-8")

js = replace_once(
    js,
    r'''import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";''',
    r'''import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";

import {
  selectRegistrationAnchors
} from "./georegistration-v1.js?v=registration-v1";''',
    "georegistration import",
)

js = replace_once(
    js,
    r'''let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;''',
    r'''let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;

const registrationSource =
  new Cesium.CustomDataSource(
    "registration-anchors"
  );

viewer.dataSources.add(
  registrationSource
);

let registrationAnchors = [];''',
    "registration state",
)

js = replace_once(
    js,
    r'''async function renderSurface(
  frame,
  renderToken = null
) {''',
    r'''async function renderSurface(
  frame,
  renderToken = null,
  anchors = []
) {''',
    "renderSurface signature",
)

js = replace_once(
    js,
    r'''  context.putImageData(
    image,
    0,
    0
  );''',
    r'''  context.putImageData(
    image,
    0,
    0
  );

  for (const anchor of anchors) {
    const x =
      anchor.column + 0.5;

    const y =
      anchor.row + 0.5;

    context.save();

    context.strokeStyle =
      "rgba(255,0,255,1)";

    context.fillStyle =
      "rgba(255,0,255,1)";

    context.lineWidth =
      2;

    context.beginPath();
    context.moveTo(
      x - 8,
      y
    );
    context.lineTo(
      x + 8,
      y
    );
    context.moveTo(
      x,
      y - 8
    );
    context.lineTo(
      x,
      y + 8
    );
    context.stroke();

    context.beginPath();
    context.arc(
      x,
      y,
      2.5,
      0,
      Math.PI * 2
    );
    context.fill();

    context.restore();
  }''',
    "source crosshair drawing",
)

registration_functions = r'''
function registrationTopAltitude(
  frame,
  anchor
) {
  const category =
    frame.categories[
      anchor.row
      * frame.width
      + anchor.column
    ];

  const inputDbzh =
    representativeDbzForCategory(
      category
    );

  if (inputDbzh == null) {
    return 1000;
  }

  const inferred =
    inferColumn(
      model,
      inputDbzh,
      {
        occupancyThreshold:
          Number(
            $("occupancyThreshold").value
          ),

        minimumOutputDbz:
          Number(
            $("minimumDbzh").value
          )
      }
    );

  if (!inferred.length) {
    return 1000;
  }

  return Math.max(
    ...inferred.map(
      point =>
        Number(
          point.altitude_m_amsl
        )
    )
  );
}

function renderRegistrationAnchors(
  frame
) {
  registrationSource.entities.suspendEvents();

  try {
    registrationSource.entities.removeAll();

    for (
      const anchor
      of registrationAnchors
    ) {
      const topAltitude =
        registrationTopAltitude(
          frame,
          anchor
        );

      const ground =
        Cesium.Cartesian3.fromDegrees(
          anchor.longitude,
          anchor.latitude,
          20
        );

      const top =
        Cesium.Cartesian3.fromDegrees(
          anchor.longitude,
          anchor.latitude,
          displayAltitude(
            topAltitude
          )
        );

      registrationSource.entities.add({
        id:
          `registration-ground-${anchor.id}`,

        position:
          ground,

        point: {
          pixelSize:
            12,

          color:
            Cesium.Color.YELLOW,

          outlineColor:
            Cesium.Color.BLACK,

          outlineWidth:
            2,

          disableDepthTestDistance:
            Number.POSITIVE_INFINITY
        },

        label: {
          text:
            `${anchor.id} ground`,

          font:
            "12px sans-serif",

          pixelOffset:
            new Cesium.Cartesian2(
              0,
              -18
            ),

          fillColor:
            Cesium.Color.YELLOW,

          showBackground:
            true,

          backgroundColor:
            Cesium.Color.BLACK
              .withAlpha(0.70),

          disableDepthTestDistance:
            Number.POSITIVE_INFINITY
        }
      });

      registrationSource.entities.add({
        id:
          `registration-line-${anchor.id}`,

        polyline: {
          positions: [
            ground,
            top
          ],

          width:
            3,

          material:
            Cesium.Color.MAGENTA
              .withAlpha(0.90),

          clampToGround:
            false
        }
      });

      registrationSource.entities.add({
        id:
          `registration-top-${anchor.id}`,

        position:
          top,

        point: {
          pixelSize:
            10,

          color:
            Cesium.Color.MAGENTA,

          outlineColor:
            Cesium.Color.WHITE,

          outlineWidth:
            1
        }
      });
    }

  } finally {
    registrationSource.entities.resumeEvents();
  }

  $("registrationAnchorCount").textContent =
    String(
      registrationAnchors.length
    );

  const maximum =
    registrationAnchors.length
      ? Math.max(
          ...registrationAnchors.map(
            anchor =>
              anchor.residual_px
          )
        )
      : null;

  $("registrationResidual").textContent =
    maximum == null
      ? "—"
      : `${maximum.toExponential(2)} px`;

  scene.requestRender();
}

function setRegistrationTopDownView() {
  const anchor =
    registrationAnchors[0];

  if (!anchor) {
    setStatus(
      "Load a radar frame before opening the top-down registration view.",
      "error"
    );

    return;
  }

  navigationLocked =
    true;

  viewer.camera.lookAt(
    Cesium.Cartesian3.fromDegrees(
      anchor.longitude,
      anchor.latitude,
      0
    ),

    new Cesium.HeadingPitchRange(
      0,
      -Cesium.Math.PI_OVER_TWO,
      60000
    )
  );

  viewer.camera.lookAtTransform(
    Cesium.Matrix4.IDENTITY
  );

  takeCameraSnapshot();
  applyNavigationLock();

  scene.requestRender();

  setStatus(
    "REGISTRATION VIEW: each yellow ground dot should sit directly on its magenta crosshair in the 2-D radar layer. Magenta lines rise vertically from the same source pixels.",
    "ok"
  );
}

'''

js = replace_once(
    js,
    "function estimateCandidateColumns(frame) {",
    registration_functions
    + "function estimateCandidateColumns(frame) {",
    "registration renderer",
)

js = replace_once(
    js,
    r'''  latestFrame =
    frame;

  $("hybridFrameSlider").value =''',
    r'''  latestFrame =
    frame;

  registrationAnchors =
    selectRegistrationAnchors(
      frame
    );

  $("hybridFrameSlider").value =''',
    "sequence anchor selection",
)

js = replace_once(
    js,
    r'''  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken
    );''',
    r'''  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken,
      registrationAnchors
    );''',
    "sequence surface render",
)

js = replace_once(
    js,
    r'''  renderInferredVolume(
    frame
  );

  applyHybridVolumeMode(''',
    r'''  renderInferredVolume(
    frame
  );

  renderRegistrationAnchors(
    frame
  );

  applyHybridVolumeMode(''',
    "sequence registration render",
)

js = replace_once(
    js,
    r'''  latestFrame = frame;

  const renderToken =''',
    r'''  latestFrame = frame;

  registrationAnchors =
    selectRegistrationAnchors(
      frame
    );

  const renderToken =''',
    "latest anchor selection",
)

js = replace_once(
    js,
    r'''  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken
    );''',
    r'''  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken,
      registrationAnchors
    );''',
    "latest surface render",
)

js = replace_once(
    js,
    r'''  renderInferredVolume(
    frame
  );

  $("sourceTime").textContent =''',
    r'''  renderInferredVolume(
    frame
  );

  renderRegistrationAnchors(
    frame
  );

  $("sourceTime").textContent =''',
    "latest registration render",
)

js = replace_once(
    js,
    r'''$("resetButton").addEventListener(
  "click",''',
    r'''$("registrationTopDownButton").addEventListener(
  "click",
  () =>
    setRegistrationTopDownView()
);

$("registrationObliqueButton").addEventListener(
  "click",
  () => {
    resetView();

    navigationLocked =
      true;

    applyNavigationLock();

    setStatus(
      "Returned to standard oblique view. Compare elevated points against the magenta vertical anchor lines.",
      "ok"
    );
  }
);

$("resetButton").addEventListener(
  "click",''',
    "registration listeners",
)

js_path.write_text(js, encoding="utf-8")

html_path = frontend / "live3d-registration-v1.html"
html = html_path.read_text(encoding="utf-8")

html = html.replace(
    "StormTracker — Hybrid Storm Volume Core V4",
    "StormTracker — 2-D / 3-D Registration Diagnostic",
)

html = html.replace(
    "atomic same-frame rendering • core V4",
    "source-pixel ground anchors • vertical registration diagnostic",
)

html = html.replace(
    'src="./src/live3d-core-v4.js"',
    'src="./src/live3d-registration-v1.js"',
)

registration_card = r'''    <section class="card">
      <h2>
        2-D / 3-D registration check
      </h2>

      <div class="metric">
        <span>Registration anchors</span>
        <strong id="registrationAnchorCount">—</strong>

        <span>Coordinate round-trip residual</span>
        <strong id="registrationResidual">—</strong>
      </div>

      <div
        style="
          display:flex;
          gap:6px;
          margin-top:8px
        "
      >
        <button
          id="registrationTopDownButton"
          style="flex:1"
        >
          Top-down registration
        </button>

        <button
          id="registrationObliqueButton"
          style="flex:1"
        >
          Oblique view
        </button>
      </div>

      <div
        style="
          margin-top:8px;
          color:#aebdc6;
          font-size:10px;
          line-height:1.45
        "
      >
        Magenta crosshairs are burned directly into the source 2-D radar
        canvas. Yellow dots are independent Cesium ground coordinates derived
        from those exact source pixels. Magenta lines rise vertically from the
        same coordinates. In top-down view each yellow dot must sit on its
        magenta crosshair. If it does, any apparent displacement aloft in the
        oblique view is perspective/parallax rather than a horizontal
        georegistration error.
      </div>
    </section>

'''

html = replace_once(
    html,
    r'''    <section class="card">
      <h2>
        Five-event cross-validation
      </h2>''',
    registration_card
    + r'''    <section class="card">
      <h2>
        Five-event cross-validation
      </h2>''',
    "registration card",
)

html_path.write_text(html, encoding="utf-8")

test_text = r'''import assert from "node:assert/strict";

import {
  geographicToPixel,
  registrationResidualPixels,
  selectRegistrationAnchors
} from "../src/georegistration-v1.js";

const frame = {
  width: 100,
  height: 80,

  georef: {
    projection: "EPSG:3857",
    minX: 1000000,
    maxX: 1100000,
    minY: -3000000,
    maxY: -2920000
  },

  categories:
    new Uint8Array(
      100 * 80
    )
};

frame.categories[
  20 * frame.width
  + 25
] = 8;

frame.categories[
  60 * frame.width
  + 75
] = 7;

frame.categories[
  22 * frame.width
  + 27
] = 9;

const residual =
  registrationResidualPixels(
    frame,
    25,
    20
  );

assert.ok(
  residual.magnitude_px
  < 1e-8
);

const anchors =
  selectRegistrationAnchors(
    frame,
    {
      count: 2,
      minimumCategory: 2,
      minimumSeparationPx: 20
    }
  );

assert.equal(
  anchors.length,
  2
);

assert.equal(
  anchors[0].category,
  9
);

assert.equal(
  anchors[1].category,
  7
);

const pixel =
  geographicToPixel(
    frame,
    anchors[0].longitude,
    anchors[0].latitude
  );

assert.ok(
  Math.abs(
    pixel.column
    - anchors[0].column
  )
  < 1e-8
);

assert.ok(
  Math.abs(
    pixel.row
    - anchors[0].row
  )
  < 1e-8
);

console.log(
  "5 georegistration tests passed."
);
'''

(tests / "run-georegistration-tests.mjs").write_text(
    test_text,
    encoding="utf-8",
)

print("Checking JavaScript syntax...")
subprocess.run(
    ["node", "--check", "frontend/src/georegistration-v1.js"],
    cwd=ROOT,
    check=True,
)
subprocess.run(
    ["node", "--check", "frontend/src/live3d-registration-v1.js"],
    cwd=ROOT,
    check=True,
)

print()
print("Running georegistration tests...")
subprocess.run(
    ["node", "frontend/tests/run-georegistration-tests.mjs"],
    cwd=ROOT,
    check=True,
)

print()
print("Running existing StormTracker tests...")
subprocess.run(
    ["node", "frontend/tests/run-node-tests.mjs"],
    cwd=ROOT,
    check=True,
)

print()
print("SUCCESS")
print("Expected:")
print("  5 georegistration tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    'git add frontend/live3d-registration-v1.html '
    'frontend/src/live3d-registration-v1.js '
    'frontend/src/georegistration-v1.js '
    'frontend/tests/run-georegistration-tests.mjs'
)
print('git commit -m "Add 2-D to 3-D registration diagnostic"')
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-registration-v1.html"
)
print()
print("Press:")
print("  Load latest inferred 3-D")
print("then:")
print("  Top-down registration")
print()
print(
    "Send one screenshot showing the magenta crosshairs "
    "and yellow ground dots."
)
