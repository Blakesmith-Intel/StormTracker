#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker relay cache-bust fix"
echo

for f in frontend/index.html frontend/src/app.js frontend/src/bom-wmts.js; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-relay-cachefix-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/index.html "$BACKUP_DIR/index.html"
cp frontend/src/app.js "$BACKUP_DIR/app.js"
cp frontend/src/bom-wmts.js "$BACKUP_DIR/bom-wmts.js"

python - <<'PY'
from pathlib import Path
import re

p = Path("frontend/index.html")
text = p.read_text()
text = re.sub(
    r'<script type="module" src="\./src/app\.js(?:\?[^"]*)?"></script>',
    '<script type="module" src="./src/app.js?v=relay-v2"></script>',
    text
)
p.write_text(text)

p = Path("frontend/src/app.js")
text = p.read_text()
text = re.sub(
    r'import \{ loadLatestBomReflectivityMosaic \} from "\./bom-wmts\.js(?:\?[^"]*)?";',
    'import { loadLatestBomReflectivityMosaic } from "./bom-wmts.js?v=relay-v2";',
    text
)
p.write_text(text)

p = Path("frontend/src/bom-wmts.js")
text = p.read_text()

old = (
    '    throw new Error(\n'
    '      `Unable to read BOM reflectivity WMTS from this browser. ${lastError.message}`\n'
    '    );'
)

new = (
    '    throw new Error(\n'
    '      `Unable to read BOM reflectivity through StormTracker relay ` +\n'
    '      `(relay-v2: stormtracker-bom-relay.stormtracker-bom-relay.workers.dev). ` +\n'
    '      `${lastError.message}`\n'
    '    );'
)

if old in text:
    text = text.replace(old, new)
elif "relay-v2: stormtracker-bom-relay" not in text:
    raise SystemExit("ERROR: Could not locate the expected BOM error block.")

p.write_text(text)
PY

echo "Cache-bust patch installed."
echo

echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Verification:"
grep -n "app.js?v=relay-v2" frontend/index.html
grep -n "bom-wmts.js?v=relay-v2" frontend/src/app.js
grep -n "relay-v2:" frontend/src/bom-wmts.js

echo
echo "Changed files:"
git status --short frontend/index.html frontend/src/app.js frontend/src/bom-wmts.js

echo
echo "SUCCESS"
echo
echo "Expected test result: 14 tests passed."
echo
echo "Then run:"
echo 'git add frontend/index.html frontend/src/app.js frontend/src/bom-wmts.js'
echo 'git commit -m "Force browser to load relay-backed BOM module"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/?build=relay-v2"
echo
echo "Then press 'Load latest SEQ reflectivity'."
echo
echo "If it fails, the error MUST contain 'relay-v2'."
