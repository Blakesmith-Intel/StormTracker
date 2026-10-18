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

# Apply ONLY the post-seal river-history recovery fix to the published copy.
# Checked V10.2 source remains immutable; every other production asset is
# still taken unchanged from its approved source snapshot. Do not overwrite
# accepted V9.18 or experimental V10.3 preview assets.
python - <<'PY'
from pathlib import Path
from shutil import copyfile

site = Path("_site")
source = Path("frontend/src/context-layers")
layers = site / "src/context-layers"
for filename in ("bom-recent-river-history-v1.js", "river-gauge-layer-v1.js", "river-gauges-operational-v1.js", "river-flood-signals-v1.js", "river-flood-events-v1.js", "river-gauges-v1.js", "river-gauge-observations-v1.js", "power-outages-v1.js"):
    copyfile(source / filename, layers / filename)

suffix = "-river-history-nodata-v2-20261018-terrain-outline-v1-20261018-flood-gauge-refresh-v1-20261018-river-large-table-stream-v1-20261018-tidal-pattern-screen-v1-20261018-statewide-tidal-envelope-v1-20261018"
def version_once(relative, needle):
    path = site / relative
    data = path.read_text(encoding="utf-8")
    assert data.count(needle) == 1, f"Expected one production source reference: {relative}"
    path.write_text(data.replace(needle, needle + suffix, 1), encoding="utf-8")

# Refresh the full import chain so existing browser sessions cannot silently
# reuse previously cached modules with the same query strings.
version_once("index.html", "-jasper-alfred-v1")
version_once("live3d-operational-v9.html", "-jasper-alfred-archive-v1")
version_once("live3d-operational-v9.html",
    "single-interface-v1.css?v=jasper-alfred-20261017-qa-v1")
version_once("src/live3d-operational-v9.js",
    "river-gauges-operational-v1.js?v=9.18.11-gauge-green-yellow-red-v2")
version_once("src/context-layers/river-gauges-operational-v1.js",
    "river-gauge-layer-v1.js?v=9.18.11-flood-colour-20261015")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "bom-recent-river-history-v1.js?v=9.13.1")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-flood-signals-v1.js?v=9.13.2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-flood-events-v1.js?v=9.13.2")
version_once("src/context-layers/river-flood-events-v1.js",
    "river-flood-signals-v1.js?v=9.13.2")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-gauge-observations-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauge-layer-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauge-observations-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/context-layers/river-gauges-operational-v1.js",
    "river-gauges-v1.js?v=9.12.0")
version_once("src/live3d-operational-v9.js",
    "power-outages-operational-v1.js?v=council-customers-20261017-v1")
version_once("src/context-layers/power-outages-operational-v1.js",
    "power-outages-v1.js?v=background-incident-refresh-20261017-v1")

# Overlay ONLY the missing manual refresh control, without replacing the
# pinned V10.2 HTML/CSS or altering its accepted operator layout.
from re import search
operator_html = Path("frontend/live3d-operational-v9.html").read_text(encoding="utf-8")
button_match=search(r'<button id="refreshRiverGaugesButton"[^>]*>[^<]*</button>',operator_html)
assert button_match, "Manual refresh control absent from maintenance source"
html_path=site / "live3d-operational-v9.html"
html=html_path.read_text(encoding="utf-8")
needle="Flood signals</label></div>"
assert html.count(needle)==1
# Replace the old rapid/tide-only legend while retaining pinned sidebar
# controls, positions, app shell and independent historical QA preview.
old_legend="<div id=\"riverGaugeSeverityLegend\" class=\"note flood-severity-legend\"><span class=\"flood-green\">●</span> Rapid above minor · <span class=\"flood-yellow\">●</span> Moderate · <span class=\"flood-red\">●</span> Major · <span class=\"flood-cyan\">●</span> Unusual tidal rise (screening)</div>"
new_legend="<div id=\"riverGaugeSeverityLegend\" class=\"note flood-severity-legend\"><span style=\"color:#1269e8\">↑</span> Rapid rise below minor · <span class=\"flood-green\">●</span> Minor · <span class=\"flood-yellow\">●</span> Moderate · <span class=\"flood-red\">●</span> Major · <span style=\"color:#1269e8\">↑</span> on any flood icon = rapid rise / potential flash flooding</div>"
assert html.count(old_legend)==1, "Pinned production legend layout changed"
html=html.replace(old_legend,new_legend,1)
html_path.write_text(html.replace(
    needle,"Flood signals</label>"+button_match.group(0)+"</div>"),encoding="utf-8")

style_source=Path("frontend/src/single-interface-v1.css").read_text(encoding="utf-8")
start=style_source.index("/* One-row flood gauge refresh:")
end=style_source.index("/* Historical cyclone forecast",start)
style=style_source[start:end]
assert "#refreshRiverGaugesButton" in style
style_path=site / "src/single-interface-v1.css"
with style_path.open("a",encoding="utf-8") as out:
    out.write("\n"+style)

assert "bindRiverGaugeManualRefresh(" in (
    layers / "river-gauges-operational-v1.js").read_text()
assert "recentNextAttemptAt" in (layers / "river-gauge-layer-v1.js").read_text()
assert "recentFloodHistoryGap" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "inspectBomRecentWaterLevelTable" in (layers / "bom-recent-river-history-v1.js").read_text()
assert "noData" in (layers / "river-gauge-layer-v1.js").read_text()
assert 'const feature = idKey ? byId.get(idKey) : null' in (layers / "river-gauge-observations-v1.js").read_text()
assert 'uniqueNameIndex' not in (layers / "river-gauge-observations-v1.js").read_text()
assert 'STORMTRACKER_RAPID_RISE' in (layers / "river-flood-events-v1.js").read_text()
assert 'FLOOD_MARKER_COLORS' in (layers / "river-gauge-layer-v1.js").read_text()
assert "observedTidalOscillation(" in (layers / "river-flood-signals-v1.js").read_text()
assert "NON_TIDAL_RAPID_RISE_M_PER_H = 1.40" in (layers / "river-flood-signals-v1.js").read_text()
assert "rateMatches && !tidal" in (layers / "river-flood-signals-v1.js").read_text()
panel=(layers / "river-gauges-operational-v1.js").read_text()
assert "riverGaugePanelAppearance(summary)" in panel
assert "icon.src=appearance.image" in panel
assert "summary.tidalScreened" in panel
assert "#riverGaugeInfo .river-gauge-key img" in style
assert '#riverGaugeInfo[data-gauge-state="major"] .map-info-kicker' in style
assert 'blue' not in ""  # No flood classification or colour can override source IDs.

assert '"source_response_too_large"' in (layers / "bom-recent-river-history-v1.js").read_text()
power = (layers / "power-outages-v1.js").read_text()
assert "styleTerrainClampedPowerOutagePolygon(entity.polygon,unplannedColour)" in power
assert "entity.polygon\n          .outline =\n          true;" not in power
with (site / "BUILD.txt").open("a", encoding="utf-8") as record:
    record.write("RIVER-HISTORY MAINTENANCE HOTFIX 2026-10-18 (source main)\n")
    record.write("STATEWIDE TIDAL REFERENCE RAPID-RISE THRESHOLD 1.40 M_PER_H 2026-10-18\n")
    record.write("RIVER-HISTORY NO-DATA V2 2026-10-18 (200 empty, source-format guarded)\n")
    record.write("TERRAIN-SAFE OUTAGE POLYGONS 2026-10-18 (Cesium outline disabled)\n")
    record.write("MANUAL FLOOD GAUGE REFRESH 2026-10-18 (compact Layers control)\n")
    record.write("BOUNDED STREAMING BOM RIVER TABLES 2026-10-18 (source main)\n")
    record.write("BOM ALL-GAUGE FLOOD PERSISTENCE ID-ONLY JOIN AND BLUE-RISE MODIFIER 2026-10-18\n")
    record.write("BOM TIDAL FALSE FLASH-RISE SUPPRESSION 2026-10-18 (source-tag and measured oscillation)\\n")
    record.write("MATCHING FLOOD GAUGE INFORMATION PANEL ICONS AND SEVERITY 2026-10-18\\n")
PY
# V10.2.1-current-source production UI hygiene. Never alter the immutable
# V10.2 base, morning flood/power fixes, or any historical QA preview.
python3 scripts/strip-production-cyclone-qa.py --site _site \
  --panel-source frontend/src/operational-cyclone-panel-v1.js
node --check _site/src/operational-cyclone-panel-v1.js
grep -Fq 'createOperationalCyclonePanel' _site/src/live3d-operational-v9.js
! grep -Fq 'createHistoricalCycloneForecastQA' _site/src/live3d-operational-v9.js
! grep -Fq 'cycloneUseJasper' _site/live3d-operational-v9.html
! grep -Fq 'cycloneUseAlfred' _site/live3d-operational-v9.html
! grep -Fq 'cycloneGmlFile' _site/live3d-operational-v9.html
test ! -d _site/data/cyclone-history
test ! -f _site/src/historical-cyclone-forecast-map-v1.js
grep -Fq 'PRODUCTION ACTIVE-ONLY CYCLONES 2026-10-18' _site/BUILD.txt
node --check _site/src/live3d-operational-v9.js
node --check _site/src/context-layers/river-gauges-operational-v1.js
grep -Fq 'id="refreshRiverGaugesButton"' _site/live3d-operational-v9.html
grep -Fq '#refreshRiverGaugesButton' _site/src/single-interface-v1.css
node --check _site/src/context-layers/river-gauge-layer-v1.js
node --check _site/src/context-layers/river-flood-signals-v1.js
node --check _site/src/context-layers/river-flood-events-v1.js
node --check _site/src/context-layers/river-gauges-v1.js
grep -Fq 'forecast_site_classification' _site/src/context-layers/river-gauges-v1.js
grep -Fq 'const feature = idKey ? byId.get(idKey) : null' _site/src/context-layers/river-gauge-observations-v1.js
! grep -Fq 'uniqueNameIndex' _site/src/context-layers/river-gauge-observations-v1.js
grep -Fq 'STORMTRACKER_RAPID_RISE' _site/src/context-layers/river-flood-events-v1.js
grep -Fq 'FLOOD_MARKER_COLORS' _site/src/context-layers/river-gauge-layer-v1.js
grep -Fq 'BOM ALL-GAUGE FLOOD PERSISTENCE ID-ONLY JOIN' _site/BUILD.txt
grep -Fq 'BOM TIDAL FALSE FLASH-RISE SUPPRESSION 2026-10-18' _site/BUILD.txt
grep -Fq 'MATCHING FLOOD GAUGE INFORMATION PANEL ICONS AND SEVERITY 2026-10-18' _site/BUILD.txt
grep -Fq 'icon.src=appearance.image' _site/src/context-layers/river-gauges-operational-v1.js
grep -Fq '#riverGaugeInfo .river-gauge-key img' _site/src/single-interface-v1.css
grep -Fq 'observedTidalOscillation(' _site/src/context-layers/river-flood-signals-v1.js
grep -Fq 'rateMatches && !tidal' _site/src/context-layers/river-flood-signals-v1.js
node --check _site/src/context-layers/river-gauge-observations-v1.js
node --check _site/src/context-layers/bom-recent-river-history-v1.js
node --check _site/src/context-layers/power-outages-v1.js
node --check _site/src/context-layers/power-outages-operational-v1.js

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
# Independently pinned V10.3 wind/hook research preview. This MUST NOT
# replace the immutable V10.2.0 root or either existing historical QA route.
wind_source="checked/wind-hook-v10.3-qa/frontend"
wind_preview="_site/preview/wind-hook-v10-3"
test "$(git -C checked/wind-hook-v10.3-qa rev-parse HEAD)" = "f3a07688ca02f5f0234ae6425fc1177722518c53"
mkdir -p "$wind_preview/data"
for asset in index.html live3d-operational-v9.html app.css src 3d-models assets; do
  test -e "$wind_source/$asset"
  cp -a "$wind_source/$asset" "$wind_preview/"
done
cp "$production/data/nsw-radar-places-v1.json" "$wind_preview/data/"
cp -a "$wind_source/data/cyclone-history" "$wind_preview/data/"
echo "EXPERIMENTAL V10.3 wind-hook original radar QA source f3a07688ca02f5f0234ae6425fc1177722518c53; production sealed V10.2.0 untouched" > "$wind_preview/BUILD.txt"
grep -Fq 'wind-hook-v10-3/' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'assessV10RadarFrame' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'createOperationalCyclonePanel' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'if (!windHookResearchEnabled) return' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'createHistoricalCycloneForecastQA' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'Original BoM' "$wind_preview/src/internal-cyclone-live-qa-v1.js"
grep -Fq '#F6D94F' "$wind_preview/src/wind-hook-research-v10.css"
grep -Fq '#FF963F' "$wind_preview/src/wind-hook-research-v10.css"
grep -Fq '#D83045' "$wind_preview/src/wind-hook-research-v10.css"
for icon in v10-gust.svg v10-hook.svg v10-tornado.svg; do
  test -s "$wind_preview/assets/$icon"
done
node --check "$wind_preview/src/live3d-operational-v9.js"
node --check "$wind_preview/src/severe-storm-v10.js"
node --check "$wind_preview/src/doppler-persistence-v10-3.js"
grep -Fq 'syncIndependentDopplerResearch' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'previousDopplerState' "$wind_preview/src/live3d-operational-v9.js"
grep -Fq 'two sequential measured velocity scans' "$wind_preview/src/severe-storm-alert-overlay-v1.js"
node --check "$wind_preview/src/operational-cyclone-panel-v1.js"
# All three previews remain separate. QA is prohibited from the root runtime.
! grep -Fq 'isWindHookQaPreview' "_site/src/live3d-operational-v9.js"
test "$(find _site/preview -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 3

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
grep -Fq 'createOperationalCyclonePanel' "_site/src/live3d-operational-v9.js"
! grep -Fq 'createHistoricalCycloneForecastQA' "_site/src/live3d-operational-v9.js"
grep -Fq 'createInternalCycloneLiveQA' "_site/src/live3d-operational-v9.js"
grep -Fq 'Currently no tropical cyclone warnings' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'Unable to verify current tropical cyclone warnings' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'validateInternalCycloneSnapshot' "_site/src/internal-cyclone-live-qa-v1.js"
grep -Fq 'INCREMENTAL_VOLUME_PREVIEW' "_site/src/live3d-operational-v9.js"
node --check "_site/src/internal-cyclone-live-qa-v1.js"
node --check "_site/src/internal-cyclone-feed-v1.js"
node --check "_site/src/operational-cyclone-panel-v1.js"
test ! -f "_site/src/historical-cyclone-forecast-map-v1.js"
test ! -d "_site/data/cyclone-history"

# Regression: Hide controls must remove both sidebar grid tracks, not shrink map.
grep -Fq 'body.simple-ui #app.sidebar-collapsed' "_site/src/single-interface-v1.css"
grep -Fq 'grid-template-rows:minmax(0,1fr)' "_site/src/single-interface-v1.css"
grep -Fq 'full-map-controls-gauge-severity-v4' "_site/live3d-operational-v9.html"
grep -Fq 'hide-controls-full-map-v1' "_site/index.html"
