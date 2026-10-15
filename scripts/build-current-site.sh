#!/usr/bin/env bash
set -euo pipefail

# Source pins checked out by CI in checked/accepted-v9.18 and checked/production-v9.18.0.
# Exactly the same deterministic package is built in PR dry-runs and Pages deploys.
set -euo pipefail
python checked/production-v9.18.0/scripts/build-nsw-radar-places.py \
  --output checked/production-v9.18.0/frontend/data/nsw-radar-places-v1.json
python - <<'PY'
import json
from pathlib import Path
p=Path("checked/production-v9.18.0/frontend/data/nsw-radar-places-v1.json")
data=json.loads(p.read_text(encoding="utf-8"))
assert data.get("schema")=="StormTrackerNSWRadarPlacesV1"
assert len(data.get("places",[]))>=500
assert p.stat().st_size<300000
PY

set -euo pipefail
production="checked/production-v9.18.0/frontend"
accepted="checked/accepted-v9.18/frontend"
preview="_site/preview/radar-history-fix"
mkdir -p _site "$preview/data" "_site/data"

# Sealed root is always generated from its immutable release.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "$production/$asset" "_site/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "_site/data/"
printf 'SEALED StormTracker V9.18.0 source %s\n' \
  '66d3da447ef7a4df53e7df49aa1ac06f86cb5afd' > _site/BUILD.txt

# Identical recipe to the previously accepted QA preview:
# main frontend supplies path-activated rescue guards, accepted SHA
# overlays the tested radar, 3-D, basemap and river corrections.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$preview/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$preview/data/"
for filename in power-outages-operational-v1.js river-gauges-operational-v1.js flood-road-closures-operational-v1.js; do
  cp "$accepted/src/context-layers/$filename" "$preview/src/context-layers/"
  grep -Fq 'suppressHoverGpuPicking' "$preview/src/context-layers/$filename"
done
for filename in river-gauge-layer-v1.js basemap-manager-v1.js; do
  cp "$accepted/src/context-layers/$filename" "$preview/src/context-layers/"
done
for filename in storm-track-trail-visibility-v1.js multi-radar-display-v9.js radar-imagery-handover-v1.js supplemental-radar-volume-v1.js live3d-operational-v9.js; do
  cp "$accepted/src/$filename" "$preview/src/"
done
cp "$accepted/index.html" "$preview/"
cp "$accepted/live3d-operational-v9.html" "$preview/"
# Retain the accepted QA's original cone and networking code even after the
# next-baseline candidate advances these files on the maintenance branch.
for filename in adaptive-threat-cone-v1.js radar-source.js; do
  cp "$accepted/src/$filename" "$preview/src/"
done
cp "$accepted/src/operational-dashboard-v9-1.css" "$preview/src/"
printf 'ACCEPTED V9.18 diagnostic source %s\n' \
  'acfa0ebd3717a793369e3e887e2d1a54785620b7' > "$preview/BUILD.txt"

grep -Fq 'for(const target of candidates)' "$preview/src/context-layers/river-gauge-layer-v1.js"
grep -Fq 'adoptPrepared(entry.layer' "$preview/src/multi-radar-display-v9.js"
grep -Fq 'SUPPLEMENTAL_VOLUME_MAX_GLYPHS=1500' "$preview/src/supplemental-radar-volume-v1.js"
grep -Fq 'BOUNDED_RADAR_RECOVERY_QA' "$preview/src/live3d-operational-v9.js"
grep -Fq '/preview/radar-history-fix/' "$preview/src/radar-source.js"
grep -Fq '9.18.11-serial-gateway' "$preview/src/context-layers/river-gauges-operational-v1.js"
grep -Fq 'pixeltrack-prod-r1' "_site/index.html"
node --check "$preview/src/live3d-operational-v9.js"
node --check "_site/src/live3d-operational-v9.js"
test -s "$preview/data/nsw-radar-places-v1.json"
test -s "_site/data/nsw-radar-places-v1.json"
# Separately staged NEXT production candidate; root and accepted are sealed.
# It intentionally contains the observed-boundary cone update, a collapsible
# sidebar, and continuous supplemental coverage over bounded inferred gaps.
candidate="_site/preview/next-baseline"
mkdir -p "$candidate/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$candidate/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$candidate/data/"
# The candidate uses its reviewed satellite, context interaction and
# recoloured flood gauge modules. The gauge layer on the branch was based on
# the accepted serial BoM history implementation; do NOT replace it with the
# old accepted marker colours when staging the candidate.
grep -Fq 'for(const target of candidates)' "$candidate/src/context-layers/river-gauge-layer-v1.js"
grep -Fq '"#e53935"' "$candidate/src/context-layers/river-gauge-layer-v1.js"
grep -Fq '"#2db76f"' "$candidate/src/context-layers/river-gauge-layer-v1.js"
grep -Fq 'shouldPrepareSupplementalForPlayback' "$candidate/src/live3d-operational-v9.js"
grep -Fq '"/preview/next-baseline/"' "$candidate/src/context-layers/power-outages-operational-v1.js"
grep -Fq '"/preview/next-baseline/"' "$candidate/src/context-layers/flood-road-closures-operational-v1.js"
grep -Fq '"/preview/next-baseline/"' "$candidate/src/context-layers/river-gauges-operational-v1.js"
grep -Fq 'Keep all currently visible satellite layers' "$candidate/src/context-layers/basemap-manager-v1.js"
printf 'CANDIDATE StormTracker next baseline source %s\\n' "$(git rev-parse HEAD)" > "$candidate/BUILD.txt"
grep -Fq 'supplementalObservedAnchor' "$candidate/src/live3d-operational-v9.js"
grep -Fq 'observedExitMarginKm:0.5' "$candidate/src/live3d-operational-v9.js"
grep -Fq 'id="sidebarToggle"' "$candidate/live3d-operational-v9.html"
grep -Fq '/preview/next-baseline/' "$candidate/src/radar-source.js"
grep -Fq 'SUPPLEMENTAL_VOLUME_MAX_GLYPHS=1500' "$candidate/src/supplemental-radar-volume-v1.js"
node --check "$candidate/src/live3d-operational-v9.js"
node --check "$candidate/src/supplemental-observed-anchor-v1.js"
test -s "$candidate/data/nsw-radar-places-v1.json"
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 2
