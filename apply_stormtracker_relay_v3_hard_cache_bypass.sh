#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker relay v3 hard cache bypass"

for f in frontend/index.html frontend/src/app.js frontend/src/bom-wmts.js; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-relay-v3-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/index.html "$BACKUP_DIR/index.html"
cp frontend/src/app.js "$BACKUP_DIR/app.js"
cp frontend/src/bom-wmts.js "$BACKUP_DIR/bom-wmts.js"

cp frontend/src/bom-wmts.js frontend/src/bom-wmts-relay-v3.js
cp frontend/src/app.js frontend/src/app-relay-v3.js

python - <<'PY'
from pathlib import Path

p = Path("frontend/src/bom-wmts-relay-v3.js")
text = p.read_text()
text = text.replace('import { decodeReflectivityImageData, SOURCE_PALETTES } from "./palette.js?v=live-bom-v1";', 'import { decodeReflectivityImageData, SOURCE_PALETTES } from "./palette.js?v=relay-v3";')
text = text.replace('import { fetchReadableImage } from "./radar-source.js?v=live-bom-v1";', 'import { fetchReadableImage } from "./radar-source.js?v=relay-v3";')

old = """    throw new Error(
      `Unable to read BOM reflectivity through StormTracker relay ` +
      `(relay-v2: stormtracker-bom-relay.stormtracker-bom-relay.workers.dev). ` +
      `${lastError.message}`
    );"""
new = """    throw new Error(
      `RELAY V3 ACTIVE — unable to fetch readable BOM reflectivity via ` +
      `stormtracker-bom-relay.stormtracker-bom-relay.workers.dev. ` +
      `${lastError.message}`
    );"""
if old not in text:
    raise SystemExit("ERROR: Expected relay-v2 diagnostic block not found in bom-wmts.js")
text = text.replace(old, new, 1)
p.write_text(text)

p = Path("frontend/src/app-relay-v3.js")
text = p.read_text()
text = text.replace('import { RadarWorkerClient } from "./worker-client.js?v=live-bom-v1";', 'import { RadarWorkerClient } from "./worker-client.js?v=relay-v3";')
text = text.replace('import { SOURCE_PALETTES } from "./palette.js?v=live-bom-v1";', 'import { SOURCE_PALETTES } from "./palette.js?v=relay-v3";')
text = text.replace('import { reflectivityFromFile, reflectivityFromUrl } from "./radar-source.js?v=live-bom-v1";', 'import { reflectivityFromFile, reflectivityFromUrl } from "./radar-source.js?v=relay-v3";')
text = text.replace('import { loadLatestBomReflectivityMosaic } from "./bom-wmts.js?v=relay-v2";', 'import { loadLatestBomReflectivityMosaic } from "./bom-wmts-relay-v3.js";')
text = text.replace('const worker = new RadarWorkerClient();', 'const worker = new RadarWorkerClient();\nconst STORMTRACKER_BUILD = "relay-v3";', 1)
text = text.replace('setStatus("Loading latest public BOM reflectivity mosaic…");', 'setStatus(`Loading latest public BOM reflectivity mosaic… (${STORMTRACKER_BUILD})`);', 1)
p.write_text(text)

p = Path("frontend/index.html")
text = p.read_text()
text = text.replace('<div class="subtitle">Browser-native reconstruction • 08 / 50 / 66</div>', '<div class="subtitle">Browser-native reconstruction • 08 / 50 / 66 • RELAY V3</div>')
text = text.replace('<button id="liveBomButton">Load latest SEQ reflectivity</button>', '<button id="liveBomButton">Load latest SEQ reflectivity — V3</button>')
old_scripts = [
    '<script type="module" src="./src/app.js?v=relay-v2"></script>',
    '<script type="module" src="./src/app.js?v=live-bom-v1"></script>',
    '<script type="module" src="./src/app.js"></script>',
]
replaced = False
for old_script in old_scripts:
    if old_script in text:
        text = text.replace(old_script, '<script type="module" src="./src/app-relay-v3.js"></script>', 1)
        replaced = True
        break
if not replaced:
    raise SystemExit("ERROR: Could not locate the app module script tag in index.html")
p.write_text(text)
PY

echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo "Verifying relay v3 files..."
grep -n "RELAY V3" frontend/index.html
grep -n "app-relay-v3.js" frontend/index.html
grep -n "bom-wmts-relay-v3.js" frontend/src/app-relay-v3.js
grep -n "RELAY V3 ACTIVE" frontend/src/bom-wmts-relay-v3.js

echo "Changed/new files:"
git status --short frontend

echo "SUCCESS"
echo "Expected test result: 14 tests passed."
echo "Then run:"
echo 'git add frontend/index.html frontend/src/app-relay-v3.js frontend/src/bom-wmts-relay-v3.js'
echo 'git commit -m "Use unique relay v3 modules to bypass stale browser cache"'
echo 'git push'

echo "After Pages deploys, open the normal StormTracker page."
echo "You MUST see RELAY V3 in the subtitle and the button label ending in V3."
echo "Then click the V3 button. If it fails, send the red error."
