#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker live reflectivity diagnostics"
echo

for f in frontend/src/app-relay-v3.js frontend/src/bom-wmts-relay-v3.js frontend/index.html; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-reflectivity-diagnostics-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/src/app-relay-v3.js "$BACKUP_DIR/app-relay-v3.js"
cp frontend/src/bom-wmts-relay-v3.js "$BACKUP_DIR/bom-wmts-relay-v3.js"
cp frontend/index.html "$BACKUP_DIR/index.html"

cp frontend/src/app-relay-v3.js frontend/src/app-diagnostics-v1.js
cp frontend/src/bom-wmts-relay-v3.js frontend/src/bom-wmts-diagnostics-v1.js

python - <<'PY'
from pathlib import Path

# BOM loader diagnostics
p = Path("frontend/src/bom-wmts-diagnostics-v1.js")
text = p.read_text()

text = text.replace(
    'import { decodeReflectivityImageData, SOURCE_PALETTES } from "./palette.js?v=relay-v3";',
    'import { decodeReflectivityImageData, SOURCE_PALETTES, REFLECTIVITY_CLASSES } from "./palette.js?v=diagnostics-v1";'
)

text = text.replace(
    'import { fetchReadableImage } from "./radar-source.js?v=relay-v3";',
    'import { fetchReadableImage } from "./radar-source.js?v=diagnostics-v1";'
)

old = '''  let colouredPixelCount = 0;
  let strongPixelCount = 0;

  for (const value of categories) {
    if (value > 0) colouredPixelCount++;
    if (value >= 7) strongPixelCount++;
  }
'''

new = '''  let colouredPixelCount = 0;
  let strongPixelCount = 0;
  let maxCategory = 0;
  const categoryHistogram = Array(16).fill(0);

  for (const value of categories) {
    if (value > 0) {
      colouredPixelCount++;
      categoryHistogram[value]++;
      if (value > maxCategory) maxCategory = value;
    }
    if (value >= 7) strongPixelCount++;
  }

  const [maxDbzLowerBound, maxDbzUpperBound] =
    REFLECTIVITY_CLASSES[maxCategory] ?? [null, null];
'''

if old not in text:
    raise SystemExit("ERROR: Could not locate pixel-count block.")
text = text.replace(old, new, 1)

old = '''      colouredPixelCount,
      strongPixelCount,
      volumeStatus: "live-2d-only"
'''

new = '''      colouredPixelCount,
      strongPixelCount,
      maxCategory,
      maxDbzLowerBound,
      maxDbzUpperBound,
      categoryHistogram,
      volumeStatus: "live-2d-only"
'''

if old not in text:
    raise SystemExit("ERROR: Could not locate source metadata block.")
text = text.replace(old, new, 1)

p.write_text(text)

# App diagnostics
p = Path("frontend/src/app-diagnostics-v1.js")
text = p.read_text()

text = text.replace(
    'import { loadLatestBomReflectivityMosaic } from "./bom-wmts-relay-v3.js";',
    'import { loadLatestBomReflectivityMosaic } from "./bom-wmts-diagnostics-v1.js";'
)

text = text.replace(
    'const STORMTRACKER_BUILD = "relay-v3";',
    'const STORMTRACKER_BUILD = "diagnostics-v1";'
)

old = '''  setStatus(
    `Live BOM reflectivity ${frame.observedUtc}; ` +
    `${meta.strongPixelCount ?? 0} pixels at ≥40 dBZ; ` +
    `${result.active_track_ids?.length ?? 0} active storm tracks. ` +
    `Source is the public 2-D BOM mosaic; true volumetric mode remains separate.`,
    "ok"
  );
'''

new = '''  const maxReflectivity = meta.maxCategory
    ? `category ${meta.maxCategory} (>=${meta.maxDbzLowerBound} dBZ)`
    : "none";

  setStatus(
    `Live BOM reflectivity ${frame.observedUtc}; ` +
    `${meta.colouredPixelCount ?? 0} decoded reflectivity pixels; ` +
    `maximum ${maxReflectivity}; ` +
    `${meta.strongPixelCount ?? 0} pixels at >=40 dBZ; ` +
    `${result.active_track_ids?.length ?? 0} active storm tracks.`,
    "ok"
  );
'''

if old not in text:
    raise SystemExit("ERROR: Could not locate live BOM status block.")
text = text.replace(old, new, 1)

p.write_text(text)

# New app filename so restrictive caches cannot reuse an older module.
p = Path("frontend/index.html")
text = p.read_text()

old = '<script type="module" src="./src/app-relay-v3.js"></script>'
if old not in text:
    raise SystemExit("ERROR: Current app-relay-v3 script tag not found.")

text = text.replace(
    old,
    '<script type="module" src="./src/app-diagnostics-v1.js"></script>',
    1
)

text = text.replace(
    'Browser-native reconstruction • 08 / 50 / 66 • RELAY V3',
    'Browser-native reconstruction • 08 / 50 / 66 • DIAGNOSTICS V1'
)

text = text.replace(
    'Load latest SEQ reflectivity — V3',
    'Load latest SEQ reflectivity — DIAGNOSTICS'
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
echo "Verifying diagnostics build..."
grep -n "DIAGNOSTICS V1" frontend/index.html
grep -n "app-diagnostics-v1.js" frontend/index.html
grep -n "maxCategory" frontend/src/bom-wmts-diagnostics-v1.js

echo
echo "SUCCESS"
echo "Expected result: 14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/index.html frontend/src/app-diagnostics-v1.js frontend/src/bom-wmts-diagnostics-v1.js'
echo 'git commit -m "Add live reflectivity decode diagnostics"'
echo 'git push'
echo
echo "After Pages deploys, reload StormTracker and press the DIAGNOSTICS button."
echo "Send back the full green status line."
