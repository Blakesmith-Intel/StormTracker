#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker radar visibility v2"
echo

for f in \
  frontend/src/app-radar-overlay-v1.js \
  frontend/src/cesium-view-radar-overlay-v1.js \
  frontend/index.html
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-radar-visibility-v2-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/src/app-radar-overlay-v1.js "$BACKUP_DIR/app-radar-overlay-v1.js"
cp frontend/src/cesium-view-radar-overlay-v1.js "$BACKUP_DIR/cesium-view-radar-overlay-v1.js"
cp frontend/index.html "$BACKUP_DIR/index.html"

cp frontend/src/app-radar-overlay-v1.js frontend/src/app-radar-overlay-v2.js
cp frontend/src/cesium-view-radar-overlay-v1.js frontend/src/cesium-view-radar-overlay-v2.js

python - <<'PY'
from pathlib import Path

# ------------------------------------------------------------------
# Cesium display: enhanced visual palette only.
# Scientific category decoding remains unchanged.
# ------------------------------------------------------------------
p = Path("frontend/src/cesium-view-radar-overlay-v2.js")
text = p.read_text()

# Keep source palette import for reference, but introduce a display-only palette.
insert_after = 'import { SOURCE_PALETTES } from "./palette.js?v=radar-overlay-v1";'

display_palette = r'''

// DISPLAY ONLY: stronger contrast than the BOM source RGBs so weak echoes
// remain visible over the basemap. Scientific categories and dBZ thresholds
// are unchanged and continue to come from the decoded BOM pixels.
const DISPLAY_REFLECTIVITY_RGB = Object.freeze({
  1: [170, 215, 255],
  2: [115, 175, 255],
  3: [70, 130, 255],
  4: [25, 75, 255],
  5: [0, 225, 190],
  6: [0, 170, 120],
  7: [0, 115, 75],
  8: [255, 245, 0],
  9: [255, 205, 0],
  10: [255, 155, 0],
  11: [255, 95, 0],
  12: [255, 0, 0],
  13: [205, 0, 0],
  14: [130, 0, 0],
  15: [75, 0, 75]
});
'''

if display_palette.strip() not in text:
    if insert_after not in text:
        raise SystemExit("ERROR: Could not locate radar palette import.")
    text = text.replace(insert_after, insert_after + display_palette, 1)

old_fn = '''  function reflectivityRgb(category) {
    return SOURCE_PALETTES.reflectivityRgb.find(
      entry => entry.value === category
    )?.rgb ?? null;
  }
'''

new_fn = '''  function reflectivityRgb(category) {
    return DISPLAY_REFLECTIVITY_RGB[category] ?? null;
  }
'''

if old_fn not in text:
    raise SystemExit("ERROR: Could not locate reflectivityRgb function.")
text = text.replace(old_fn, new_fn, 1)

old_alpha = '''      rgba[i + 3] = Math.min(
        225,
        105 + category * 8
      );
'''

new_alpha = '''      rgba[i + 3] = Math.min(
        255,
        185 + category * 4
      );
'''

if old_alpha not in text:
    raise SystemExit("ERROR: Could not locate pixel alpha block.")
text = text.replace(old_alpha, new_alpha, 1)

text = text.replace(
    'reflectivityLayer.alpha = 0.85;',
    'reflectivityLayer.alpha = 1.0;',
    1
)

# Add a compact legend panel to the map.
marker = '  let reflectivityLayer = null;'

legend_code = r'''  const radarLegend = document.createElement("div");
  radarLegend.className = "stormtracker-radar-legend";
  radarLegend.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Reflectivity</div>
    <div style="font-size:10px;margin-bottom:6px">Enhanced display colours — dBZ categories unchanged</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">
      ${[
        [1,"12+"],[4,"31+"],[6,"37+"],[7,"40+"],[8,"43+"],
        [9,"46+"],[10,"49+"],[11,"52+"],[12,"55+"],[13,"58+"],
        [14,"61+"],[15,"64+"]
      ].map(([category,label]) => {
        const rgb = DISPLAY_REFLECTIVITY_RGB[category];
        return `<div style="display:flex;align-items:center;gap:3px;font-size:9px">
          <span style="width:10px;height:10px;background:rgb(${rgb.join(",")});display:inline-block;border:1px solid rgba(255,255,255,.35)"></span>
          <span>${label}</span>
        </div>`;
      }).join("")}
    </div>
  `;

  Object.assign(radarLegend.style, {
    position: "absolute",
    left: "10px",
    bottom: "28px",
    zIndex: "850",
    padding: "8px",
    borderRadius: "8px",
    background: "rgba(11,17,22,.88)",
    color: "#eef5f8",
    border: "1px solid rgba(255,255,255,.18)",
    pointerEvents: "none",
    maxWidth: "290px"
  });

  mapPanel?.appendChild(radarLegend);
'''

if legend_code.strip() not in text:
    if marker not in text:
        raise SystemExit("ERROR: Could not locate reflectivity layer marker.")
    text = text.replace(marker, marker + "\n" + legend_code, 1)

p.write_text(text)

# ------------------------------------------------------------------
# App: point to the new display module and make the build obvious.
# ------------------------------------------------------------------
p = Path("frontend/src/app-radar-overlay-v2.js")
text = p.read_text()

text = text.replace(
    'import { createCesiumView } from "./cesium-view-radar-overlay-v1.js";',
    'import { createCesiumView } from "./cesium-view-radar-overlay-v2.js";'
)

text = text.replace(
    'const STORMTRACKER_BUILD = "radar-overlay-v1";',
    'const STORMTRACKER_BUILD = "radar-overlay-v2";'
)

p.write_text(text)

# ------------------------------------------------------------------
# HTML: unique entry filename + visible build label.
# ------------------------------------------------------------------
p = Path("frontend/index.html")
text = p.read_text()

old_script = '<script type="module" src="./src/app-radar-overlay-v1.js"></script>'
if old_script not in text:
    raise SystemExit("ERROR: Expected radar overlay v1 script tag not found.")

text = text.replace(
    old_script,
    '<script type="module" src="./src/app-radar-overlay-v2.js"></script>',
    1
)

text = text.replace(
    'Browser-native reconstruction • 08 / 50 / 66 • RADAR OVERLAY V1',
    'Browser-native reconstruction • 08 / 50 / 66 • RADAR OVERLAY V2'
)

text = text.replace(
    'Load latest SEQ reflectivity — SHOW ON MAP',
    'Load latest SEQ reflectivity — HIGH CONTRAST'
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
echo "Verifying V2 display build..."
grep -n "RADAR OVERLAY V2" frontend/index.html
grep -n "app-radar-overlay-v2.js" frontend/index.html
grep -n "DISPLAY_REFLECTIVITY_RGB" frontend/src/cesium-view-radar-overlay-v2.js
grep -n "stormtracker-radar-legend" frontend/src/cesium-view-radar-overlay-v2.js

echo
echo "SUCCESS"
echo "Expected regression result: 14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/index.html frontend/src/app-radar-overlay-v2.js frontend/src/cesium-view-radar-overlay-v2.js'
echo 'git commit -m "Improve live radar overlay visibility"'
echo 'git push'
echo
echo "After Pages deploys:"
echo "  1. Confirm RADAR OVERLAY V2 is visible."
echo "  2. Press 'Load latest SEQ reflectivity — HIGH CONTRAST'."
echo "  3. Send a screenshot and status line."
