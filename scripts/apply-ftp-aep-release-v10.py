#!/usr/bin/env python3
"""Apply jointly verified FTP/AEP features to an already built sealed V10 site.

Never modify the immutable source pins. Fail if an expected import, control or
asset disappears. Deploy only through a QA-passed workflow.
"""
from pathlib import Path
from shutil import copyfile

site=Path("_site")
assert (site/"BUILD.txt").read_text().startswith("SEALED StormTracker V10.2.0")
for source,target in [
 ("frontend/src/bom-wmts-loop-v2.js","src/bom-wmts-loop-v2.js"),
 ("frontend/src/context-layers/significant-rainfall-source-v1.js","src/context-layers/significant-rainfall-source-v1.js"),
 ("frontend/src/context-layers/significant-rainfall-operational-v1.js","src/context-layers/significant-rainfall-operational-v1.js"),
 ("frontend/src/context-layers/rainfall-ifd-aep-v1.js","src/context-layers/rainfall-ifd-aep-v1.js"),
 ("frontend/src/north-compass-v1.js","src/north-compass-v1.js"),
 ("frontend/src/hires-radar-loop-policy-v1.js","src/hires-radar-loop-policy-v1.js"),
 ("frontend/src/operational-window-choices-v1.js","src/operational-window-choices-v1.js")
]:
    assert Path(source).is_file(),source
    copyfile(source,site/target)

# The degraded individual-site FTP raster adapter is not shipped at all.
# Existing authentic archives remain archived, never playable as live radar.
(site/"src/ftp-reflectivity-operational-v1.js").unlink(missing_ok=True)
app=site/"src/live3d-operational-v9.js"
js=app.read_text()
needle="bom-wmts-loop-v2.js?v=9.18.6-bounded-published-history"
assert js.count(needle)==1, "V10 radar source import contract changed"
js=js.replace(needle,needle+"-ftp-static-original-20261019-native-bom-hires-v1-observed-only")
needle="significant-rainfall-operational-v1.js"
assert js.count(needle)==1
js=js.replace(needle,needle+"?v=rainfall-mm-rarity-24hr-20261020")
# The sealed V10 camera guardian owns orientation. Never call Cesium.camera.setView.
# Amend only the built production artefact; the pinned V10 source is immutable.
core_heading="heading:" + chr(10) + "      Cesium.Math.toRadians(" + chr(10) + "        345" + chr(10) + "      )"
assert js.count(core_heading)==1,"V10 isometric camera baseline changed"
js=js.replace(core_heading,core_heading.replace("345","0"),1)
selected_reset="if (site) mapCamera.setView({...CORE_HOME, longitude:site.longitude, latitude:site.latitude});"
assert js.count(selected_reset)==1,"Primary radar reset anchor changed"
js=js.replace(selected_reset,
  "if (site) mapCamera.setView({...CORE_HOME, longitude:site.longitude, latitude:site.latitude, heading:0});",1)
regional_reset="else mapCamera.setView(REGIONAL_HOME);"
assert js.count(regional_reset)==1
js=js.replace(regional_reset,"else mapCamera.setView({...REGIONAL_HOME,heading:0});",1)
mount="// The verified browser-source QA viewer must never call Cesium.camera.flyTo;"
assert js.count(mount)==1
js=js.replace(mount,
 "mountNorthCompass({cameraController:mapCamera,mapPanel:document.getElementById('mapPanel')});"+chr(10)+mount,1)
js='import {mountNorthCompass} from "./north-compass-v1.js?v=north-up-20261019";'+chr(10)+js

# These replacements target ONLY the sealed v10.2.0 delivered operator runtime.
# A true five-minute, 30-minute loop has six genuine BoM frames. Old low-res
# 512px FTP sources and interpolated temporal frames are NEVER displayed.
js='import {isVerifiedHiResRadarFrame,measuredHiResRainWindow,availableMeasuredHiResLoopMinutes} from "./hires-radar-loop-policy-v1.js?v=observed-only-30-60-90-120-180-20261019";'+chr(10)+js
# The archived source V10 runtime still asks its old interpolation-aware
# helper whether a longer window can play. Use exact measured timestamps
# instead, requiring N genuine frames with no missing 5-minute observation.
before='const rainAvailable = availableRadarLoopMinutes(availableRadarHistoryTimes);'
assert js.count(before)==1,"V10 rain-loop chooser source anchor changed"
js=js.replace(before,
  'const rainAvailable = availableMeasuredHiResLoopMinutes(availableRadarHistoryTimes);',1)
# Source V10 is pinned and still imports the old four-window selector by URL.
# Its six-frame renderer is already overlaid; update only the cache version.
before='operational-window-choices-v1.js?v=9.16-four-windows'
assert js.count(before)==1,"V10 rain chooser import version changed"
js=js.replace(before,
  'operational-window-choices-v1.js?v=20261019-five-observed-rain-windows',1)
before='const plan = buildRadarPlaybackPlan(history);'
assert js.count(before)==1,"V10 radar-summary plan anchor changed"
js=js.replace(before,'const plan = measuredHiResRainWindow(history,"all").plan;',1)
before=': resolveRainHistoryWindow(availableRadarHistoryTimes, loopSelection);'
assert js.count(before)==1,"V10 rain source window anchor changed"
js=js.replace(before,': measuredHiResRainWindow(availableRadarHistoryTimes, loopSelection);',1)
before='displayPlan = resolveRainHistoryWindow('
assert js.count(before)==1,"V10 display plan anchor changed"
js=js.replace(before,'displayPlan = measuredHiResRainWindow(',1)
# Exclude stale low-resolution frames persisted in browser storage from former
# production versions. Genuine BoM national WMTS rasters remain eligible.
before='getRadarFrames(region, cacheCutoff).catch(error => {'
assert js.count(before)==1,"V10 cached-frame adapter changed"
js=js.replace(before,
  'getRadarFrames(region, cacheCutoff).then(frames=>frames.filter(isVerifiedHiResRadarFrame)).catch(error => {',1)
before='radarFrameCache.has(entry.observedUtc)'+chr(10)+'        ? Promise.resolve(radarFrameCache.get(entry.observedUtc))'
assert js.count(before)==1,"V10 live-frame cache anchor changed"
js=js.replace(before,
  'radarFrameCache.has(entry.observedUtc) && isVerifiedHiResRadarFrame(radarFrameCache.get(entry.observedUtc))'+chr(10)+'        ? Promise.resolve(radarFrameCache.get(entry.observedUtc))',1)
app.write_text(js)

page=site/"live3d-operational-v9.html"
html=page.read_text()
assert html.count("<head>")==1
html=html.replace("<head>",'<head>\n<script>globalThis.__STORMTRACKER_NATIONAL_MOSAIC_PRIMARY=true;</script>',1)
start='title="Show BoM rain gauges reporting at least 50 mm"'
assert html.count(start)==1
html=html.replace(start,'title="Show 50+ mm observed rainfall and its local rarity explained"')
# The accepted simple sidebar now includes the complete plain-language
# legend, distinct 50/100mm amounts, annual probabilities and 24-hour view.
assert '●</span> Significant rain</label>' in html
assert 'value="last24Hours"' in html
for item in ('Notable','Unusual','Rare','Very rare','Exceptional',
             '20%','10%','5%','2%','1%',
             '1 in 5','1 in 10','1 in 20','1 in 50','1 in 100'):
    assert item in html, "Rainfall legend missing "+item
needle="src/live3d-operational-v9.js?v="
assert html.count(needle)==1
html=html.replace(needle,needle+"hires-observed-90-20261019-")
page.write_text(html)
entry=site/"index.html"
html=entry.read_text()
needle="live3d-operational-v9.html?v="
assert html.count(needle)==1
entry.write_text(html.replace(needle,needle+"native-bom-hires-20261019-"))
with (site/"BUILD.txt").open("a") as f:
 f.write("RELEASE CANDIDATE: original BoM FTP source archive + independently sourced location-specific IFD/AEP\n")
 f.write("LIVE DIRECT BOM FTP TCP RADAR FALLBACK INDEPENDENT OF GITHUB CRON 2026-10-19\n")
 f.write("TRUE NORTH DEFAULT ISOMETRIC + PRIMARY RADAR RESET + COMPASS 2026-10-19\n")
 f.write("NATIONAL BOM REFLECTIVITY MOSAIC PRIMARY WHEN PROVEN LIVE, AUTHENTIC ORIGINAL FTP BACKUP 2026-10-19\n")
 f.write("VERIFIED CURRENT NATIVE BOM WMTS HIGH-RES DIRECT TILES + XML CORS RELAY 2026-10-19\n")
 f.write("HIRES BOM NATIVE SOURCE ONLY; 30 MINUTES = SIX OBSERVED FRAMES; NO TEMPORAL GAP FILL 2026-10-19\n")
 f.write("MEASURED BROWSER ARCHIVE RAIN WINDOWS: 30/60/90/120/180 MINUTES; 6/12/18/24/36 FRAMES\n")
print("FTP_AEP_V10_RELEASE_PACKAGED",len(list(site.rglob("*.js"))))
