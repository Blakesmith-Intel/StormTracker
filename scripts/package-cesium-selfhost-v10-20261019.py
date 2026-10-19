#!/usr/bin/env python3
"""Prepare a SAME-VERSION, FIRST-PARTY Cesium package for the sealed V10 site.

Does not alter radar science, weather feeds, volumetrics or the pinned source.
Run only AFTER the normal site build and AFTER npm installs cesium@1.145.0.
"""
from pathlib import Path
from shutil import copytree
import re

SITE=Path("_site")
SOURCE=Path("node_modules/cesium/Build/Cesium")
REQUIRED=["Cesium.js","Widgets/widgets.css","Assets/Images/ion-credit.png"]
for relative in REQUIRED:
    if not (SOURCE/relative).is_file():
        raise SystemExit("Cesium 1.145.0 package missing: "+relative)
for dirname in ["Workers","ThirdParty","Assets","Widgets"]:
    if not (SOURCE/dirname).is_dir():
        raise SystemExit("Cesium 1.145.0 static directory missing: "+dirname)

dest=SITE/"cesium"
if dest.exists():
    raise SystemExit("Refusing to overwrite existing Cesium deployment directory")
copytree(SOURCE,dest)
html=SITE/"live3d-operational-v9.html"
body=html.read_text(encoding="utf-8")
legacy='https://unpkg.com/cesium@1.145.0/Build/Cesium/'
css=f'{legacy}Widgets/widgets.css'
script=f'{legacy}Cesium.js'
assert body.count(css)==1, "Expected exactly one Cesium CDN stylesheet"
assert body.count(script)==1, "Expected exactly one Cesium CDN JS script"
base='window.CESIUM_BASE_URL = "'+legacy+'";'
assert body.count(base)==1, "Expected Cesium build worker base path exactly once"
body=body.replace(css,"./cesium/Widgets/widgets.css")
body=body.replace(script,"./cesium/Cesium.js")
body=body.replace(base,'window.CESIUM_BASE_URL = new URL("./cesium/", document.baseURI).href;')
assert "unpkg.com/cesium" not in body
html.write_text(body,encoding="utf-8")

# The pinned V10.2.0 runtime deliberately disabled experimental alerts
# with an unconditional return but left a large unreachable function body.
# Remove only its dead body, retaining the original no-op semantics.
engine=SITE/"src/live3d-operational-v9.js"
source=engine.read_text(encoding="utf-8")
old='''function syncSevereStormAlerts(index) {
  // Preserve the research implementation for isolated previews, but do not
  // calculate or display experimental classifications in production.
  return;
  const frame = hybridFrames[index];
  const result = hybridResults[index];
  const previousFrame = hybridFrames[index - 1] ?? null;
  const previousResult = hybridResults[index - 1] ?? null;
  const detection = buildSevereStormFrameAlerts({
    frame, result, previousFrame, previousResult,
    dopplerState: dopplerStateForFrame(index),
    enableExperimentalHook: false
  });
  severeStormAlertOverlay.setFrame({
    alerts: detection.alerts,
    observedFrame: Boolean(frame && result && !frame.sourceMetadata?.temporalInference),
    windSupported: detection.windSourceSupported,
    experimentalHook: false,
    displayedUtc: frame?.observedUtc ?? null,
    atNewestFrame: index === hybridFrames.length - 1
  });
}'''
assert source.count(old)==1, "Could not locate exact disabled production storm alert block"
new='''function syncSevereStormAlerts(_index) {
  // Research-only severe storm classification remains disabled in production.
  // The previous implementation after an unconditional return was unreachable.
  return;
}'''
engine.write_text(source.replace(old,new,1),encoding="utf-8")
with (SITE/"BUILD.txt").open("a",encoding="utf-8") as out:
    out.write("BROWSER QA: first-party, unchanged Cesium 1.145.0 files; remove dead disabled-alert code\\n")
print("FIRST_PARTY_CESIUM_PACKAGED",len(list(dest.rglob("*"))),"files",sum(p.stat().st_size for p in dest.rglob("*") if p.is_file()),"bytes")
