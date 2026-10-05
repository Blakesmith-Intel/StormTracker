#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker live radar overlay v1"
echo

for f in \
  frontend/src/app-diagnostics-v1.js \
  frontend/src/cesium-view.js \
  frontend/index.html
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-radar-overlay-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/src/app-diagnostics-v1.js "$BACKUP_DIR/app-diagnostics-v1.js"
cp frontend/src/cesium-view.js "$BACKUP_DIR/cesium-view.js"
cp frontend/index.html "$BACKUP_DIR/index.html"

cp frontend/src/app-diagnostics-v1.js frontend/src/app-radar-overlay-v1.js
cp frontend/src/cesium-view.js frontend/src/cesium-view-radar-overlay-v1.js

python - <<'PY'
from pathlib import Path

# ---------------------------------------------------------------
# Cesium live reflectivity overlay
# ---------------------------------------------------------------
p = Path("frontend/src/cesium-view-radar-overlay-v1.js")
text = p.read_text()

text = text.replace(
    'import { directPoint } from "./geo.js";',
    'import { directPoint } from "./geo.js";\n'
    'import { SOURCE_PALETTES } from "./palette.js?v=radar-overlay-v1";'
)

marker = '  const radarSource = new Cesium.CustomDataSource("radars");'

overlay_code = r'''  let reflectivityLayer = null;

  function webMercatorToDegrees(x, y) {
    const radius = 6378137;

    return {
      longitude: x / radius * 180 / Math.PI,
      latitude:
        (2 * Math.atan(Math.exp(y / radius)) - Math.PI / 2) *
        180 / Math.PI
    };
  }

  function reflectivityRgb(category) {
    return SOURCE_PALETTES.reflectivityRgb.find(
      entry => entry.value === category
    )?.rgb ?? null;
  }

  async function renderReflectivity(frame) {
    if (!frame?.georef || !frame?.categories) {
      throw new Error(
        "Live radar overlay requires a georeferenced reflectivity frame."
      );
    }

    if (frame.georef.projection !== "EPSG:3857") {
      throw new Error(
        `Unsupported radar overlay projection: ${frame.georef.projection}`
      );
    }

    const width = Number(frame.width);
    const height = Number(frame.height);
    const categories = frame.categories;

    if (categories.length !== width * height) {
      throw new Error(
        "Radar overlay category array does not match frame dimensions."
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Browser could not create the live reflectivity overlay canvas."
      );
    }

    const imageData = context.createImageData(width, height);
    const rgba = imageData.data;

    for (let pixel = 0, i = 0; pixel < categories.length; pixel++, i += 4) {
      const category = categories[pixel];

      if (!category) {
        rgba[i + 3] = 0;
        continue;
      }

      const rgb = reflectivityRgb(category);

      if (!rgb) {
        rgba[i + 3] = 0;
        continue;
      }

      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];

      // Slightly stronger opacity for higher-reflectivity echoes.
      rgba[i + 3] = Math.min(
        225,
        105 + category * 8
      );
    }

    context.putImageData(imageData, 0, 0);

    const southWest = webMercatorToDegrees(
      frame.georef.minX,
      frame.georef.minY
    );

    const northEast = webMercatorToDegrees(
      frame.georef.maxX,
      frame.georef.maxY
    );

    const rectangle = Cesium.Rectangle.fromDegrees(
      southWest.longitude,
      southWest.latitude,
      northEast.longitude,
      northEast.latitude
    );

    const provider =
      await Cesium.SingleTileImageryProvider.fromUrl(
        canvas.toDataURL("image/png"),
        { rectangle }
      );

    if (reflectivityLayer) {
      viewer.imageryLayers.remove(
        reflectivityLayer,
        true
      );
    }

    reflectivityLayer =
      new Cesium.ImageryLayer(provider);

    reflectivityLayer.alpha = 0.85;

    viewer.imageryLayers.add(
      reflectivityLayer
    );

    scene.requestRender();
  }

  function clearReflectivity() {
    if (!reflectivityLayer) {
      return;
    }

    viewer.imageryLayers.remove(
      reflectivityLayer,
      true
    );

    reflectivityLayer = null;
    scene.requestRender();
  }

'''

if marker not in text:
    raise SystemExit("ERROR: Could not locate Cesium datasource insertion point.")

text = text.replace(
    marker,
    overlay_code + marker,
    1
)

old_return = '''  return {
    viewer,
    render,
    resetCamera
  };
'''

new_return = '''  return {
    viewer,
    render,
    renderReflectivity,
    clearReflectivity,
    resetCamera
  };
'''

if old_return not in text:
    raise SystemExit("ERROR: Could not locate Cesium return block.")

text = text.replace(
    old_return,
    new_return,
    1
)

p.write_text(text)

# ---------------------------------------------------------------
# App integration
# ---------------------------------------------------------------
p = Path("frontend/src/app-radar-overlay-v1.js")
text = p.read_text()

text = text.replace(
    'import { createCesiumView } from "./cesium-view.js?v=camera-lock-v3";',
    'import { createCesiumView } from "./cesium-view-radar-overlay-v1.js";'
)

text = text.replace(
    'const STORMTRACKER_BUILD = "diagnostics-v1";',
    'const STORMTRACKER_BUILD = "radar-overlay-v1";'
)

old = '''  const frame = await loadLatestBomReflectivityMosaic();

  const result = await worker.processFrameBucket({
'''

new = '''  const frame = await loadLatestBomReflectivityMosaic();

  await view.renderReflectivity(frame);

  const result = await worker.processFrameBucket({
'''

if old not in text:
    raise SystemExit("ERROR: Could not locate live BOM load block.")

text = text.replace(
    old,
    new,
    1
)

old_status = '''    `${result.active_track_ids?.length ?? 0} active storm tracks.`,
'''

new_status = '''    `${result.active_track_ids?.length ?? 0} active storm tracks; ` +
    `live reflectivity displayed on map.`,
'''

if old_status not in text:
    raise SystemExit("ERROR: Could not locate live status block.")

text = text.replace(
    old_status,
    new_status,
    1
)

old_reset = '''  view.render({tracks:[],active_track_ids:[]});
'''

new_reset = '''  view.render({tracks:[],active_track_ids:[]});
  view.clearReflectivity();
'''

if old_reset not in text:
    raise SystemExit("ERROR: Could not locate reset rendering block.")

text = text.replace(
    old_reset,
    new_reset,
    1
)

p.write_text(text)

# ---------------------------------------------------------------
# New entry point filename to avoid stale-cache ambiguity
# ---------------------------------------------------------------
p = Path("frontend/index.html")
text = p.read_text()

old_script = '<script type="module" src="./src/app-diagnostics-v1.js"></script>'

if old_script not in text:
    raise SystemExit(
        "ERROR: Expected diagnostics-v1 entry point was not found."
    )

text = text.replace(
    old_script,
    '<script type="module" src="./src/app-radar-overlay-v1.js"></script>',
    1
)

text = text.replace(
    'Browser-native reconstruction • 08 / 50 / 66 • DIAGNOSTICS V1',
    'Browser-native reconstruction • 08 / 50 / 66 • RADAR OVERLAY V1'
)

text = text.replace(
    'Load latest SEQ reflectivity — DIAGNOSTICS',
    'Load latest SEQ reflectivity — SHOW ON MAP'
)

p.write_text(text)
PY

echo
echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Verification:"
grep -n "RADAR OVERLAY V1" frontend/index.html
grep -n "app-radar-overlay-v1.js" frontend/index.html
grep -n "renderReflectivity" frontend/src/app-radar-overlay-v1.js
grep -n "SingleTileImageryProvider" frontend/src/cesium-view-radar-overlay-v1.js

echo
echo "SUCCESS"
echo "Expected regression result: 14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/index.html frontend/src/app-radar-overlay-v1.js frontend/src/cesium-view-radar-overlay-v1.js'
echo 'git commit -m "Display live BOM reflectivity on Cesium map"'
echo 'git push'
echo
echo "After GitHub Pages redeploys:"
echo "  1. Open StormTracker."
echo "  2. Confirm RADAR OVERLAY V1 is visible."
echo "  3. Press 'Load latest SEQ reflectivity — SHOW ON MAP'."
echo "  4. Send back a screenshot of the map and the full status line."
