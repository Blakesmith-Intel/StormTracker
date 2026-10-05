#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

FILE="frontend/src/bom-wmts.js"
RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found."
  exit 1
fi

BACKUP="/tmp/bom-wmts-before-relay-$(date -u +%Y%m%dT%H%M%SZ).js"
cp "$FILE" "$BACKUP"

python - <<'PY'
from pathlib import Path
import re

p = Path("frontend/src/bom-wmts.js")
text = p.read_text()

old_pattern = r'const BOM_WMTS_BASE = "[^"]+";'
new_value = 'const BOM_WMTS_BASE = "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts";'

new_text, count = re.subn(old_pattern, new_value, text, count=1)

if count != 1:
    raise SystemExit("ERROR: Could not uniquely replace BOM_WMTS_BASE.")

# Make the source metadata explicit so diagnostics show the transport path.
new_text = new_text.replace(
    'provider: "Australian Bureau of Meteorology",',
    'provider: "Australian Bureau of Meteorology",\n      transport: "StormTracker Cloudflare relay",\n      relay: "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev",'
)

p.write_text(new_text)
PY

echo "BOM relay wired into StormTracker."
echo "Backup: $BACKUP"
echo

echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Current relay setting:"
grep -n "BOM_WMTS_BASE" frontend/src/bom-wmts.js

echo
echo "Changed files:"
git status --short frontend/src/bom-wmts.js

echo
echo "SUCCESS"
echo
echo "Expected test result: 14 tests passed."
echo
echo "Then run:"
echo 'git add frontend/src/bom-wmts.js'
echo 'git commit -m "Route BOM reflectivity through Cloudflare relay"'
echo 'git push'
echo
echo "After GitHub Pages redeploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/?build=relay-v1"
echo
echo "Then press 'Load latest SEQ reflectivity' and send back the status/error text."
