from pathlib import Path
import shutil
import subprocess

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

def require(path):
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label} block, found {count}."
        )
    return text.replace(old, new, 1)

def function_slice(text, function_name):
    markers = [
        f"async function {function_name}",
        f"function {function_name}",
    ]

    starts = [
        text.find(marker)
        for marker in markers
        if text.find(marker) >= 0
    ]

    if not starts:
        raise SystemExit(
            f"ERROR: function {function_name} not found."
        )

    start = min(starts)

    next_function = text.find("\nfunction ", start + 1)
    next_async = text.find("\nasync function ", start + 1)

    ends = [
        value
        for value in (next_function, next_async)
        if value >= 0
    ]

    end = min(ends) if ends else len(text)

    return start, end

def replace_once_in_function(
    text,
    function_name,
    old,
    new,
    label
):
    start, end = function_slice(
        text,
        function_name
    )

    body = text[start:end]
    count = body.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label} block "
            f"inside {function_name}(), found {count}."
        )

    body = body.replace(
        old,
        new,
        1
    )

    return (
        text[:start]
        + body
        + text[end:]
    )

for path in [
    SRC / "live3d-core-v4.js",
    FRONTEND / "live3d-core-v4.html",
    SRC / "inferred-volume-v1.js",
]:
    require(path)

print("StormTracker — 2-D / 3-D georegistration diagnostic V1.1")
print("Rebuilding diagnostic files from clean Core V4 sources...")
print()

# Always recreate diagnostic files from the stable Core V4 files.
# This makes the patch safe to rerun after a previous failed attempt.
shutil.copy2(
    SRC / "live3d-core-v4.js",
    SRC / "live3d-registration-v1.js",
)

shutil.copy2(
    FRONTEND / "live3d-core-v4.html",
    FRONTEND / "live3d-registration-v1.html",
)

# ---------------------------------------------------------------------
# Registration math helper.
# ---------------------------------------------------------------------
(SRC / "georegistration-v1.js").write_text(
r'''import {
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
''',
encoding="utf-8"
)

# ---------------------------------------------------------------------
# Patch diagnostic JavaScript.
# We deliberately DO NOT modify renderSurface(). The magenta source-pixel
# markers are a separate transparent imagery layer with the exact same frame
# georeference. This avoids the duplicate renderSurface call that broke V1.
# ---------------------------------------------------------------------
js_path = SRC / "live3d-registration-v1.js"
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
    "registration import",
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

let registrationLayer = null;
let registrationAnchors = [];''',
    "registration state",
)

registration_code = r'''
function registrationRectangle(
  frame
) {
  const southWest =
    webMercatorToDegrees(
      frame.georef.minX,
      frame.georef.minY
    );

  const northEast =
    webMercatorToDegrees(
      frame.georef.maxX,
      frame.georef.maxY
    );

  return Cesium.Rectangle.fromDegrees(
    southWest.longitude,
    southWest.latitude,
    northEast.longitude,
    northEast.latitude
  );
}

async function renderRegistrationPixelOverlay(
  frame
) {
  if (registrationLayer) {
    viewer.imageryLayers.remove(
      registrationLayer,
      true
    );

    registrationLayer = null;
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    frame.width;

  canvas.height =
    frame.height;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "Unable to create registration overlay canvas."
    );
  }

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (
    const anchor
    of registrationAnchors
  ) {
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
  }

  const provider =
    await Cesium
      .SingleTileImageryProvider
      .fromUrl(
        canvas.toDataURL(
          "image/png"
        ),
        {
          rectangle:
            registrationRectangle(
              frame
            )
        }
      );

  registrationLayer =
    new Cesium.ImageryLayer(
      provider
    );

  registrationLayer.alpha =
    1.0;

  viewer.imageryLayers.add(
    registrationLayer
  );

  scene.requestRender();
}

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

function renderRegistrationEntities(
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
          25
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
            14,

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
              .withAlpha(
                0.72
              ),

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
              .withAlpha(
                0.90
              ),

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

  $("registrationAnchorCount")
    .textContent =
      String(
        registrationAnchors.length
      );

  const maximumResidual =
    registrationAnchors.length
      ? Math.max(
          ...registrationAnchors.map(
            anchor =>
              anchor.residual_px
          )
        )
      : null;

  $("registrationResidual")
    .textContent =
      maximumResidual == null
        ? "—"
        : `${maximumResidual.toExponential(2)} px`;

  scene.requestRender();
}

async function refreshRegistrationDiagnostic(
  frame
) {
  registrationAnchors =
    selectRegistrationAnchors(
      frame,
      {
        count:
          3,

        minimumCategory:
          2,

        minimumSeparationPx:
          40
      }
    );

  await renderRegistrationPixelOverlay(
    frame
  );

  renderRegistrationEntities(
    frame
  );
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
    "REGISTRATION VIEW: yellow ground dots must sit on the magenta source-pixel crosshairs. Magenta lines rise vertically from those exact coordinates.",
    "ok"
  );
}

'''

js = replace_once(
    js,
    "function estimateCandidateColumns(frame) {",
    registration_code
    + "function estimateCandidateColumns(frame) {",
    "registration diagnostic functions",
)

# The previous script failed because this same block exists in more than one
# function. These replacements are explicitly scoped by function name.
js = replace_once_in_function(
    js,
    "showHybridFrame",
r'''  renderInferredVolume(
    frame
  );''',
r'''  renderInferredVolume(
    frame
  );

  await refreshRegistrationDiagnostic(
    frame
  );''',
    "sequence registration refresh",
)

js = replace_once_in_function(
    js,
    "loadLatest",
r'''  renderInferredVolume(
    frame
  );''',
r'''  renderInferredVolume(
    frame
  );

  await refreshRegistrationDiagnostic(
    frame
  );''',
    "latest registration refresh",
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
      "Returned to the standard oblique view. Compare elevated points with the magenta vertical anchor lines.",
      "ok"
    );
  }
);

$("resetButton").addEventListener(
  "click",''',
    "registration button listeners",
)

# Internal structure checks before writing anything deployable.
refresh_signature = "await refreshRegistrationDiagnostic(\n    frame\n  );"

if js.count(refresh_signature) != 2:
    raise SystemExit(
        "ERROR: internal verification failed: "
        "expected exactly two scoped registration refresh calls."
    )

if js.count("async function renderSurface(") != 1:
    raise SystemExit(
        "ERROR: internal verification failed: renderSurface definition changed unexpectedly."
    )

js_path.write_text(
    js,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# Diagnostic HTML page.
# ---------------------------------------------------------------------
html_path = FRONTEND / "live3d-registration-v1.html"
html = html_path.read_text(encoding="utf-8")

html = html.replace(
    "StormTracker — Hybrid Storm Volume Core V4",
    "StormTracker — 2-D / 3-D Registration Diagnostic",
)

html = html.replace(
    "atomic same-frame rendering • core V4",
    "source-pixel ground anchors • registration diagnostic",
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
        Magenta crosshairs are drawn at exact source radar pixels using a
        transparent overlay with the same frame georeference. Yellow dots are
        independently calculated Cesium ground coordinates from those pixels.
        In top-down view they must coincide. Magenta lines then show the true
        vertical above each source pixel.
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

html_path.write_text(
    html,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# Focused numerical tests.
# ---------------------------------------------------------------------
(TESTS / "run-georegistration-tests.mjs").write_text(
r'''import assert from "node:assert/strict";

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
''',
encoding="utf-8"
)

print("Checking JavaScript syntax...")

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/georegistration-v1.js"
    ],
    cwd=ROOT,
    check=True,
)

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/live3d-registration-v1.js"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("Running georegistration tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-georegistration-tests.mjs"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("Running existing StormTracker tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
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
print(
    'git commit -m "Add 2-D to 3-D registration diagnostic"'
)
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
