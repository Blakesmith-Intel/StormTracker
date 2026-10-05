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

for path in [
    SRC / "live3d-core-v4.js",
    FRONTEND / "live3d-core-v4.html",
    SRC / "live3d-registration-v1.js",
    FRONTEND / "live3d-registration-v1.html",
]:
    require(path)

print("StormTracker — Web Mercator raster registration fix V1")
print()

# ---------------------------------------------------------------------
# 1. Reprojection helper.
# The BOM mosaic pixels are uniformly spaced in EPSG:3857 Y, but Cesium's
# SingleTileImageryProvider stretches an image linearly across latitude.
# Reprojecting the raster rows to linear latitude before display fixes the
# north/south mismatch while leaving source radar data and 3-D point
# coordinates unchanged.
# ---------------------------------------------------------------------
(SRC / "webmercator-raster-reproject-v1.js").write_text(
r'''const WEB_MERCATOR_RADIUS = 6378137;

export function webMercatorYToLatitudeDegrees(
  y
) {
  return (
    (
      2
      * Math.atan(
        Math.exp(
          Number(y)
          / WEB_MERCATOR_RADIUS
        )
      )
      - Math.PI / 2
    )
    * 180
    / Math.PI
  );
}

export function latitudeDegreesToWebMercatorY(
  latitude
) {
  const clamped =
    Math.max(
      -85.05112878,
      Math.min(
        85.05112878,
        Number(latitude)
      )
    );

  return (
    WEB_MERCATOR_RADIUS
    * Math.log(
      Math.tan(
        Math.PI / 4
        + clamped
          * Math.PI
          / 360
      )
    )
  );
}

export function sourceRowToGeographicOutputRow(
  frame,
  sourceRow
) {
  const northLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.maxY
    );

  const southLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.minY
    );

  const sourceFraction =
    (
      Number(sourceRow)
      + 0.5
    )
    / frame.height;

  const sourceMercatorY =
    frame.georef.maxY
    - sourceFraction
      * (
        frame.georef.maxY
        - frame.georef.minY
      );

  const latitude =
    webMercatorYToLatitudeDegrees(
      sourceMercatorY
    );

  return (
    (
      northLatitude
      - latitude
    )
    / (
      northLatitude
      - southLatitude
    )
    * frame.height
    - 0.5
  );
}

export function geographicOutputRowToSourceRow(
  frame,
  outputRow
) {
  const northLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.maxY
    );

  const southLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.minY
    );

  const outputFraction =
    (
      Number(outputRow)
      + 0.5
    )
    / frame.height;

  const latitude =
    northLatitude
    - outputFraction
      * (
        northLatitude
        - southLatitude
      );

  const mercatorY =
    latitudeDegreesToWebMercatorY(
      latitude
    );

  return (
    (
      frame.georef.maxY
      - mercatorY
    )
    / (
      frame.georef.maxY
      - frame.georef.minY
    )
    * frame.height
    - 0.5
  );
}

export function reprojectWebMercatorRgbaToGeographic(
  frame,
  sourceRgba
) {
  const expected =
    frame.width
    * frame.height
    * 4;

  if (
    sourceRgba.length
    !== expected
  ) {
    throw new Error(
      `RGBA length mismatch: expected ${expected}, got ${sourceRgba.length}.`
    );
  }

  const output =
    new Uint8ClampedArray(
      expected
    );

  const rowBytes =
    frame.width
    * 4;

  for (
    let outputRow = 0;
    outputRow < frame.height;
    outputRow++
  ) {
    const sourceRowFloat =
      geographicOutputRowToSourceRow(
        frame,
        outputRow
      );

    const sourceRow =
      Math.max(
        0,
        Math.min(
          frame.height - 1,
          Math.round(
            sourceRowFloat
          )
        )
      );

    const sourceStart =
      sourceRow
      * rowBytes;

    const outputStart =
      outputRow
      * rowBytes;

    output.set(
      sourceRgba.subarray(
        sourceStart,
        sourceStart
        + rowBytes
      ),
      outputStart
    );
  }

  return output;
}
''',
encoding="utf-8"
)

# ---------------------------------------------------------------------
# 2. Core V5: production display fix.
# ---------------------------------------------------------------------
shutil.copy2(
    SRC / "live3d-core-v4.js",
    SRC / "live3d-core-v5.js",
)

shutil.copy2(
    FRONTEND / "live3d-core-v4.html",
    FRONTEND / "live3d-core-v5.html",
)

core_path = SRC / "live3d-core-v5.js"
core = core_path.read_text(encoding="utf-8")

core = replace_once(
    core,
r'''import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";''',
r'''import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";

import {
  reprojectWebMercatorRgbaToGeographic
} from "./webmercator-raster-reproject-v1.js?v=mercator-fix-v1";''',
    "Core V5 reprojection import",
)

core = replace_once(
    core,
r'''  context.putImageData(
    image,
    0,
    0
  );''',
r'''  const geographicRgba =
    reprojectWebMercatorRgbaToGeographic(
      frame,
      image.data
    );

  const geographicImage =
    context.createImageData(
      frame.width,
      frame.height
    );

  geographicImage.data.set(
    geographicRgba
  );

  context.putImageData(
    geographicImage,
    0,
    0
  );''',
    "Core V5 surface reprojection",
)

core_path.write_text(
    core,
    encoding="utf-8"
)

core_html_path = FRONTEND / "live3d-core-v5.html"
core_html = core_html_path.read_text(encoding="utf-8")

core_html = replace_once(
    core_html,
    "StormTracker — Hybrid Storm Volume Core V4",
    "StormTracker — Hybrid Storm Volume Core V5",
    "Core V5 title",
)

core_html = replace_once(
    core_html,
    "atomic same-frame rendering • core V4",
    "atomic same-frame rendering • corrected Web Mercator raster registration • core V5",
    "Core V5 subtitle",
)

core_html = replace_once(
    core_html,
    'src="./src/live3d-core-v4.js"',
    'src="./src/live3d-core-v5.js"',
    "Core V5 script",
)

core_html_path.write_text(
    core_html,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# 3. Registration V2: same corrected surface plus correctly positioned
#    crosshairs on the now geographic-latitude display canvas.
# ---------------------------------------------------------------------
shutil.copy2(
    SRC / "live3d-registration-v1.js",
    SRC / "live3d-registration-v2.js",
)

shutil.copy2(
    FRONTEND / "live3d-registration-v1.html",
    FRONTEND / "live3d-registration-v2.html",
)

reg_path = SRC / "live3d-registration-v2.js"
reg = reg_path.read_text(encoding="utf-8")

reg = replace_once(
    reg,
r'''import {
  selectRegistrationAnchors
} from "./georegistration-v1.js?v=registration-v1";''',
r'''import {
  selectRegistrationAnchors
} from "./georegistration-v1.js?v=registration-v1";

import {
  reprojectWebMercatorRgbaToGeographic,
  sourceRowToGeographicOutputRow
} from "./webmercator-raster-reproject-v1.js?v=mercator-fix-v1";''',
    "Registration V2 reprojection import",
)

reg = replace_once(
    reg,
r'''  context.putImageData(
    image,
    0,
    0
  );''',
r'''  const geographicRgba =
    reprojectWebMercatorRgbaToGeographic(
      frame,
      image.data
    );

  const geographicImage =
    context.createImageData(
      frame.width,
      frame.height
    );

  geographicImage.data.set(
    geographicRgba
  );

  context.putImageData(
    geographicImage,
    0,
    0
  );''',
    "Registration V2 surface reprojection",
)

reg = replace_once(
    reg,
r'''    const y =
      anchor.row + 0.5;''',
r'''    const y =
      sourceRowToGeographicOutputRow(
        frame,
        anchor.row
      ) + 0.5;''',
    "Registration V2 corrected crosshair row",
)

reg_path.write_text(
    reg,
    encoding="utf-8"
)

reg_html_path = FRONTEND / "live3d-registration-v2.html"
reg_html = reg_html_path.read_text(encoding="utf-8")

reg_html = replace_once(
    reg_html,
    "StormTracker — 2-D / 3-D Registration Diagnostic",
    "StormTracker — 2-D / 3-D Registration Diagnostic V2",
    "Registration V2 title",
)

reg_html = replace_once(
    reg_html,
    "source-pixel ground anchors • registration diagnostic",
    "source-pixel ground anchors • corrected Web Mercator raster reprojection • registration V2",
    "Registration V2 subtitle",
)

reg_html = replace_once(
    reg_html,
    'src="./src/live3d-registration-v1.js"',
    'src="./src/live3d-registration-v2.js"',
    "Registration V2 script",
)

reg_html_path.write_text(
    reg_html,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# 4. Numerical tests. Includes the actual StormTracker mosaic bounds so
#    this exact class of north/south registration bug cannot silently return.
# ---------------------------------------------------------------------
(TESTS / "run-webmercator-raster-reprojection-tests.mjs").write_text(
r'''import assert from "node:assert/strict";

import {
  geographicOutputRowToSourceRow,
  reprojectWebMercatorRgbaToGeographic,
  sourceRowToGeographicOutputRow
} from "../src/webmercator-raster-reproject-v1.js";

const actualSeqFrame = {
  width: 768,
  height: 1024,

  georef: {
    projection: "EPSG:3857",
    minX: 16750872.119625352,
    maxX: 17220501.221409474,
    minY: -3401337.457151696,
    maxY: -2775165.3214395326
  }
};

// Around the Logan/Brisbane part of the mosaic, the old linear-latitude
// rendering is displaced by about five source raster rows. That is large
// enough to become visibly obvious when zoomed in.
const sourceRow =
  713;

const correctedOutputRow =
  sourceRowToGeographicOutputRow(
    actualSeqFrame,
    sourceRow
  );

assert.ok(
  correctedOutputRow
  - sourceRow
  > 4
);

assert.ok(
  correctedOutputRow
  - sourceRow
  < 6
);

const roundTrip =
  geographicOutputRowToSourceRow(
    actualSeqFrame,
    correctedOutputRow
  );

assert.ok(
  Math.abs(
    roundTrip
    - sourceRow
  )
  < 1e-8
);

// Check several rows across the full mosaic extent.
for (
  const row
  of [0,128,256,512,768,1023]
) {
  const outputRow =
    sourceRowToGeographicOutputRow(
      actualSeqFrame,
      row
    );

  const restored =
    geographicOutputRowToSourceRow(
      actualSeqFrame,
      outputRow
    );

  assert.ok(
    Math.abs(
      restored
      - row
    )
    < 1e-8
  );
}

// Simple RGBA reprojection shape/content sanity check.
const tiny = {
  width: 2,
  height: 4,

  georef: {
    projection: "EPSG:3857",
    minX: 0,
    maxX: 2000,
    minY: -4000000,
    maxY: -3000000
  }
};

const rgba =
  new Uint8ClampedArray(
    tiny.width
    * tiny.height
    * 4
  );

for (
  let row = 0;
  row < tiny.height;
  row++
) {
  for (
    let column = 0;
    column < tiny.width;
    column++
  ) {
    const i =
      (
        row
        * tiny.width
        + column
      )
      * 4;

    rgba[i] =
      row * 50;

    rgba[i + 3] =
      255;
  }
}

const projected =
  reprojectWebMercatorRgbaToGeographic(
    tiny,
    rgba
  );

assert.equal(
  projected.length,
  rgba.length
);

assert.equal(
  projected[3],
  255
);

console.log(
  "10 Web Mercator raster reprojection tests passed."
);
''',
encoding="utf-8"
)

print("Checking generated JavaScript syntax...")

for file in [
    "frontend/src/webmercator-raster-reproject-v1.js",
    "frontend/src/live3d-core-v5.js",
    "frontend/src/live3d-registration-v2.js",
]:
    subprocess.run(
        ["node", "--check", file],
        cwd=ROOT,
        check=True,
    )

print()
print("Running Web Mercator reprojection tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-webmercator-raster-reprojection-tests.mjs"
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
print("  10 Web Mercator raster reprojection tests passed.")
print("  5 georegistration tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    'git add '
    'frontend/src/webmercator-raster-reproject-v1.js '
    'frontend/src/live3d-core-v5.js '
    'frontend/live3d-core-v5.html '
    'frontend/src/live3d-registration-v2.js '
    'frontend/live3d-registration-v2.html '
    'frontend/tests/run-webmercator-raster-reprojection-tests.mjs'
)
print(
    'git commit -m "Correct Web Mercator radar raster registration"'
)
print("git push")
print()
print("After Pages deploys, FIRST open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-registration-v2.html"
)
print()
print("Press:")
print("  Load latest inferred 3-D")
print("  Top-down registration")
print()
print(
    "The yellow ground marker should now sit on the magenta crosshair."
)
print()
print("If it does, Core V5 is ready at:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v5.html"
)
