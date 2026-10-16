#!/usr/bin/env bash
set -euo pipefail

# Source pins checked out by CI: approved production V9.20.0, immutable accepted V9.18 QA. Never build root implicitly from main.
# Exactly the same deterministic package is built in PR dry-runs and Pages deploys.
set -euo pipefail
python checked/production-v9.20.0/scripts/build-nsw-radar-places.py \
  --output checked/production-v9.20.0/frontend/data/nsw-radar-places-v1.json
python - <<'PY'
import json
from pathlib import Path
p=Path("checked/production-v9.20.0/frontend/data/nsw-radar-places-v1.json")
data=json.loads(p.read_text(encoding="utf-8"))
assert data.get("schema")=="StormTrackerNSWRadarPlacesV1"
assert len(data.get("places",[]))>=500
assert p.stat().st_size<300000
PY

set -euo pipefail
production="checked/production-v9.20.0/frontend"
accepted="checked/accepted-v9.18/frontend"
preview="_site/preview/radar-history-fix"
mkdir -p _site "$preview/data" "_site/data"

# Sealed root is always generated from its immutable V9.20.0 release source.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "$production/$asset" "_site/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "_site/data/"
printf 'SEALED StormTracker V9.20.0 source %s\n' \
  'aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1' > _site/BUILD.txt

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
# V9.20.0 is now the public baseline. Do not keep a mutable candidate
# preview alongside the sealed root; historical accepted V9.18 QA stays.
grep -Fq 'PUBLISHED_PRODUCTION_RUNTIME' "_site/src/live3d-operational-v9.js"
grep -Fq 'persistentSatelliteCoverage:' "_site/src/live3d-operational-v9.js"
grep -Fq 'credibleMeasuredMotionAtObservation' "_site/src/adaptive-threat-cone-v1.js"
grep -Fq 'shouldPrepareSupplementalForPlayback' "_site/src/live3d-operational-v9.js"
grep -Fq 'minimumMeasuredReanchorKm:0.15' "_site/src/live3d-operational-v9.js"
grep -Fq 'id="sidebarToggle"' "_site/live3d-operational-v9.html"
grep -Fq 'id="trackLabelsScopeNote"' "_site/live3d-operational-v9.html"
grep -Fq '"#e53935"' "_site/src/context-layers/river-gauge-layer-v1.js"
grep -Fq '"#2db76f"' "_site/src/context-layers/river-gauge-layer-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/power-outages-operational-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/flood-road-closures-operational-v1.js"
grep -Fq 'const suppressHoverGpuPicking' "_site/src/context-layers/river-gauges-operational-v1.js"
grep -Fq 'isNetworkGuardPreview' "_site/src/radar-source.js"
node --check "_site/src/live3d-operational-v9.js"
node --check "_site/src/context-layers/basemap-manager-v1.js"
node --check "_site/src/radar-source.js"
node --check "_site/src/adaptive-threat-cone-v1.js"
# Optional ongoing delta-preview test route, independent of the
# immutable V9.20.0 production root. Archived V9.19.0 remains recoverable.
delta="_site/preview/incremental-3d"
mkdir -p "$delta/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$delta/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$delta/data/"
printf 'EXPERIMENTAL incremental 3-D QA source %s; separate from pinned V9.20.0 production\n' "$(git rev-parse HEAD)" > "$delta/BUILD.txt"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
grep -Fq 'createIncrementalVolumeRenderer' "$delta/src/incremental-volume-renderer-v1.js"
grep -Fq 'incremental:INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
node --check "$delta/src/incremental-volume-renderer-v1.js"
node --check "$delta/src/supplemental-radar-volume-v1.js"
node --check "$delta/src/live3d-operational-v9.js"
test -s "$delta/data/nsw-radar-places-v1.json"
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 2

# Exact accepted V9.20.0 optimised renderer and memory bounds are deployed
# from the PINNED source, never from the evolving maintenance/QA branch.
grep -Fq 'const INCREMENTAL_VOLUME_PREVIEW =' "_site/src/live3d-operational-v9.js"
grep -Fq 'incrementalVolumeRenderer.upsert(pixelIndex,category,nextSpecs' "_site/src/live3d-operational-v9.js"
grep -Fq 'const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'const retainedVolume=INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'Memory diagnostics' "_site/src/live3d-operational-v9.js"
grep -Fq 'function upsert(key,category,specs,create,patch)' "_site/src/incremental-volume-renderer-v1.js"
grep -Fq 'function pruneSites(selectedIds=[])' "_site/src/supplemental-radar-volume-v1.js"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/index.html"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/live3d-operational-v9.html"
node --check "_site/src/incremental-volume-renderer-v1.js"
node --check "_site/src/supplemental-radar-volume-v1.js"
node --check "_site/src/volume-display-opacity-v1.js"
