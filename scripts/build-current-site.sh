#!/usr/bin/env bash
set -euo pipefail

# Source pins checked out by CI: accepted V10.2.0, sealed V9.20.2 rollback and immutable V9.18 QA. Never build root implicitly from main.
# Exactly the same deterministic package is built in PR dry-runs and Pages deploys.
set -euo pipefail
python checked/production-v10.2.0/scripts/build-nsw-radar-places.py \
  --output checked/production-v10.2.0/frontend/data/nsw-radar-places-v1.json
python - <<'PY'
import json
from pathlib import Path
p=Path("checked/production-v10.2.0/frontend/data/nsw-radar-places-v1.json")
data=json.loads(p.read_text(encoding="utf-8"))
assert data.get("schema")=="StormTrackerNSWRadarPlacesV1"
assert len(data.get("places",[]))>=500
assert p.stat().st_size<300000
PY

set -euo pipefail
production="checked/production-v10.2.0/frontend"
accepted="checked/accepted-v9.18/frontend"
preview="_site/preview/radar-history-fix"
mkdir -p _site "$preview/data" "_site/data"

# Sealed root is always generated from its immutable V10.2.0 release source.
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "$production/$asset" "_site/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "_site/data/"
printf 'SEALED StormTracker V10.2.0 source %s\n' \
  '047b3bd1c66b0ed5f070d2298202f46d0cd8dae2' > _site/BUILD.txt

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
# V10.2.0 is now the public baseline. Do not keep a mutable candidate
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
# immutable V10.2.0 production root. Archived V9.19.0 remains recoverable.
delta="_site/preview/incremental-3d"
mkdir -p "$delta/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models; do
  cp -a "frontend/$asset" "$delta/$asset"
done
cp "$production/data/nsw-radar-places-v1.json" "$delta/data/"
# Genuine BoM/Qld historical Koji and Yasi records are QA-only. NEVER
# publish them in the source-pinned live app as a current warning layer.
test -s "frontend/data/cyclone-history/koji-2026.json"
test -s "frontend/data/cyclone-history/yasi-2011.json"
for cyclone in alfred-2025 narelle-2026 jasper-2023; do
  test -s "frontend/data/cyclone-history/$cyclone.json"
done
cp -a "frontend/data/cyclone-history" "$delta/data/"
printf 'EXPERIMENTAL incremental 3-D QA source %s; separate from pinned V9.20.2 production\n' "$(git rev-parse HEAD)" > "$delta/BUILD.txt"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
grep -Fq 'createIncrementalVolumeRenderer' "$delta/src/incremental-volume-renderer-v1.js"
grep -Fq 'incremental:INCREMENTAL_VOLUME_PREVIEW' "$delta/src/live3d-operational-v9.js"
node --check "$delta/src/incremental-volume-renderer-v1.js"
node --check "$delta/src/supplemental-radar-volume-v1.js"
node --check "$delta/src/live3d-operational-v9.js"
test -s "$delta/data/nsw-radar-places-v1.json"
test -s "$delta/data/cyclone-history/koji-2026.json"
test -s "$delta/data/cyclone-history/yasi-2011.json"
for cyclone in alfred-2025 narelle-2026 jasper-2023; do
  test -s "$delta/data/cyclone-history/$cyclone.json"
done
grep -Fq 'Koji 2026' "$delta/data/cyclone-history/koji-2026.json"
grep -Fq 'Yasi 2011' "$delta/data/cyclone-history/yasi-2011.json"
node --check "$delta/src/historical-cyclone-overlay-v1.js"
node --check "$delta/src/historical-cyclone-replay-v1.js"
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 2

# Exact accepted V10.2.0 optimised renderer and memory bounds are deployed
# from the PINNED source, never from the evolving maintenance/QA branch.
grep -Fq 'const INCREMENTAL_VOLUME_PREVIEW =' "_site/src/live3d-operational-v9.js"
grep -Fq 'incrementalVolumeRenderer.upsert(pixelIndex,category,nextSpecs' "_site/src/live3d-operational-v9.js"
grep -Fq 'const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'const retainedVolume=INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
grep -Fq 'function upsert(key,category,specs,create,patch)' "_site/src/incremental-volume-renderer-v1.js"
grep -Fq 'function pruneSites(selectedIds=[])' "_site/src/supplemental-radar-volume-v1.js"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/index.html"
grep -Fq 'v9.20.0-optimised-3d-prod' "_site/live3d-operational-v9.html"
node --check "_site/src/incremental-volume-renderer-v1.js"
node --check "_site/src/supplemental-radar-volume-v1.js"
node --check "_site/src/volume-display-opacity-v1.js"

# V10.2.0 preserves secondary-site volumetric display, real BoM >=40 dBZ only.
grep -Fq 'selectSupplementalVolumeSampleIndices' "_site/src/supplemental-radar-volume-v1.js"
grep -Fq 'hashSupplementalPixel' "_site/src/supplemental-volume-sampling-v1.js"
grep -Fq 'secondarySiteGlyphs' "_site/src/live3d-operational-v9.js"
grep -Fq 'v9.20.1-secondary-3d-fix' "_site/live3d-operational-v9.html"
grep -Fq 'v9.20.1-secondary-3d-fix' "_site/index.html"
node --check "_site/src/supplemental-volume-sampling-v1.js"

# V10.2.0 retains accepted QLD/NSW satellite continuity and quality lock.
grep -Fq 'GLOBAL_SATELLITE_FALLBACK' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'createGlobalSatelliteFallbackProvider' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'streetLayer.show=true' "_site/src/context-layers/basemap-manager-v1.js"
grep -Fq 'global-satellite-blue-gap-20261016-v1' "_site/src/live3d-operational-v9.js"
grep -Fq 'satellite-blue-gap-qa-v1' "_site/live3d-operational-v9.html"
grep -Fq 'satellite-blue-gap-qa-v1' "_site/index.html"
grep -Fq 'createVolumeCategoryProfileCache' "_site/src/live3d-operational-v9.js"
grep -Fq 'stageTotalBudgetMs' "_site/src/multi-radar-display-v9.js"
node --check "_site/src/context-layers/basemap-manager-v1.js"
node --check "_site/src/volume-category-profile-cache-v1.js"

# V10 accepted operator controls and genuine secondary-site native Doppler.
grep -Fq 'id="multiRadarDopplerStatus"' "_site/live3d-operational-v9.html"
grep -Fq 'single-interface-v1.css' "_site/live3d-operational-v9.html"
grep -Fq 'multisite-native-wind-v1' "_site/index.html"
grep -Fq 'createSupplementalDopplerDisplay' "_site/src/live3d-operational-v9.js"
grep -Fq 'MAX_SECONDARY_WIND_OFFSET_MINUTES=8' "_site/src/multi-doppler-display-v1.js"
node --check "_site/src/multi-doppler-display-v1.js"

# V10.2.0 source-clock atomic multi-site Doppler: the same prepare-then-
# commit boundary as rain radar, original BoM site UTC and Brewarrina IDR93I.
grep -Fq 'supplementalDopplerDisplay.prepare(source.observedUtc)' "_site/src/live3d-operational-v9.js"
grep -Fq 'supplementalDopplerDisplay.commit(source.observedUtc)' "_site/src/live3d-operational-v9.js"
grep -Fq 'function commit(utc)' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'SECONDARY_WIND_FRAME_SYNC_WAIT_MS=350' "_site/src/multi-doppler-display-v1.js"
grep -Fq 'IDR93I' "_site/src/border-radar-sites-v1.js"

# V10.2.0 original source-issued cyclone forecast panel is deployed opt-in,
# with strictly separate "no cyclone" and "unable to verify" status.
grep -Fq 'id="openCycloneForecastQa"' "_site/live3d-operational-v9.html"
grep -Fq 'id="cycloneForecastQaPanel"' "_site/live3d-operational-v9.html"
grep -Fq 'createHistoricalCycloneForecastQA' "_site/src/live3d-operational-v9.js"
grep -Fq 'createInternalCycloneLiveQA' "_site/src/live3d-operational-v9.js"
grep -Fq 'Currently no tropical cyclone warnings' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'Unable to verify current tropical cyclone warnings' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'validateInternalCycloneSnapshot' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
node --check "_site/src/internal-cyclone-live-qa-v1.js"
node --check "_site/src/internal-cyclone-feed-v1.js"
node --check "_site/src/historical-cyclone-forecast-map-v1.js"

# Regression: Hide controls must remove both sidebar grid tracks, not shrink map.
grep -Fq 'body.simple-ui #app.sidebar-collapsed' "_site/src/single-interface-v1.css"
grep -Fq 'grid-template-rows:minmax(0,1fr)' "_site/src/single-interface-v1.css"
grep -Fq 'full-map-toggle-20261017-v2' "_site/live3d-operational-v9.html"
grep -Fq 'hide-controls-full-map-v1' "_site/index.html"
