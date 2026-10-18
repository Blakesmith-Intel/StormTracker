#!/usr/bin/env python3
"""Strip archived tropical-cyclone QA code and reference data from a built
StormTracker production root. Does not modify source, previews or map science.
Fail closed on an unknown runtime shape.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re

ARCHIVE_ONLY_MODULES = (
    "historical-cyclone-forecast-map-v1.js",
    "historical-cyclone-overlay-v1.js",
    "historical-cyclone-replay-v1.js",
    "bom-historical-forecast-gml-v1.js",
)

def require_replace(source: str, old: str, new: str, label: str) -> str:
    if source.count(old) != 1:
        raise RuntimeError(f"Unknown {label} source contract: expected one match, got {source.count(old)}")
    return source.replace(old, new, 1)

def apply(site: Path, current_module: Path) -> None:
    site = site.resolve()
    app = site / "src/live3d-operational-v9.js"
    html = site / "live3d-operational-v9.html"
    landing = site / "index.html"
    for file in (app, html, landing):
        if not file.is_file():
            raise RuntimeError(f"Missing production input: {file}")
    # Preflight all source shapes BEFORE changing the site.
    original_js = app.read_text(encoding="utf-8")
    historical_import = ('import {createHistoricalCycloneForecastQA} from '
                         '"./historical-cyclone-forecast-map-v1.js?v=issued-fina-20261017-qa-v1";')
    live_import = ('import {createInternalCycloneLiveQA} from '
                   '"./internal-cyclone-live-qa-v1.js?v=internal-original-gml-qa1";')
    if original_js.count(historical_import) != 1 or original_js.count(live_import) != 1:
        raise RuntimeError("Cyclone JS dependency contract changed; review before modifying production")
    mount = re.compile(
        r'if\(window\.location\.pathname\.includes\("/preview/incremental-3d/"\) \|\|\s*'
        r'\(/\\/live3d-operational-v9\\\.html\$\/\.test\(window\.location\.pathname\) &&\s*'
        r'!window\.location\.pathname\.includes\("/preview/"\)\)\) \{\s*'
        r'createHistoricalCycloneForecastQA\(\{Cesium,viewer,documentRef:document,\s*'
        r'cameraController:mapCamera\}\);\s*'
        r'createInternalCycloneLiveQA\(\{Cesium,viewer,documentRef:document,\s*'
        r'cameraController:mapCamera\}\);\s*\}'
    )
    # Literal exact method is clearer for a pinned, unchanged V10.2.0 source.
    old_mount = '''if(window.location.pathname.includes("/preview/incremental-3d/") ||
   (/\\/live3d-operational-v9\\.html$/.test(window.location.pathname) &&
    !window.location.pathname.includes("/preview/"))) {
  createHistoricalCycloneForecastQA({Cesium,viewer,documentRef:document,
    cameraController:mapCamera});
  createInternalCycloneLiveQA({Cesium,viewer,documentRef:document,
    cameraController:mapCamera});
}'''
    if original_js.count(old_mount) != 1:
        raise RuntimeError("Cyclone mount changed; refusing unsafe production modification")
    original_html = html.read_text(encoding="utf-8")
    block = re.compile(
        r'    <div id="historicalCycloneMapStamp"[^\n]*\n'
        r'    <section id="cycloneForecastQaPanel"[^\n]*\n'
        r'.*?    </section>', flags=re.S)
    if len(block.findall(original_html)) != 1:
        raise RuntimeError("Historical cyclone HTML contract changed; review required")
    land = landing.read_text(encoding="utf-8")
    module = current_module.read_text(encoding="utf-8")
    if "export function createOperationalCyclonePanel" not in module:
        raise RuntimeError("Missing current-only cyclone panel module")
    old_cache = "-jasper-alfred-v1"
    old_html_cache = "-jasper-alfred-archive-v1"
    if land.count(old_cache) != 1 or original_html.count(old_html_cache) != 1:
        raise RuntimeError("Cache-key contract changed; refusing stale-browser deployment")
    # Preflight passed: now rewrite current-issue-only browser imports and UI.
    new_import = ('import {createOperationalCyclonePanel} from '
                  '"./operational-cyclone-panel-v1.js?v=active-only-20261018";')
    javascript = require_replace(original_js, historical_import, new_import,
                                 "archived cyclone JS import")
    current_mount = '''const isProductionCyclonePanel =
  !window.location.pathname.includes("/preview/") &&
  (/\\/$|\\/index\\.html$|\\/live3d-operational-v9\\.html$/.test(window.location.pathname));
if (isProductionCyclonePanel) {
  createOperationalCyclonePanel({documentRef:document});
  createInternalCycloneLiveQA({Cesium,viewer,documentRef:document,
    cameraController:mapCamera});
}'''
    javascript = require_replace(javascript, old_mount, current_mount, "cyclone panel mount")
    rendered_html = block.sub(
        '''    <section id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts" hidden>
      <header><div><strong>Tropical cyclone forecasts</strong><small>CURRENT BoM PRODUCTS ONLY</small></div><button id="cycloneForecastQaClose" type="button" aria-label="Close cyclone panel">×</button></header>
    </section>''', original_html, count=1)
    rendered_html = rendered_html.replace(
        old_html_cache, old_html_cache+"-active-cyclones-prod-v1-20261018", 1)
    land = land.replace(old_cache, old_cache+"-active-cyclones-prod-v1-20261018", 1)
    # Refuse any remaining operator-visible archive labels or inputs.
    for marker in ("cycloneUseJasper","cycloneUseAlfred","cycloneGmlFile",
                   "cyclone-qld-cases","Reference case: Fina",
                   "Historical BoM cyclone forecast","historicalCycloneMapStamp"):
        if marker in rendered_html:
            raise RuntimeError("Archived cyclone marker remains in live HTML: "+marker)
    if "createHistoricalCycloneForecastQA" in javascript:
        raise RuntimeError("Historical cyclone initializer remains in live runtime")
    (site/"src/operational-cyclone-panel-v1.js").write_text(module, encoding="utf-8")
    app.write_text(javascript, encoding="utf-8")
    html.write_text(rendered_html, encoding="utf-8")
    landing.write_text(land, encoding="utf-8")
    # None of these are necessary to consume source-current forecast GML/JSON.
    for name in ARCHIVE_ONLY_MODULES:
        (site/"src"/name).unlink(missing_ok=True)
    import shutil
    shutil.rmtree(site/"data/cyclone-history", ignore_errors=True)
    (site/"historicalCycloneMapStamp").unlink(missing_ok=True)
    with (site/"BUILD.txt").open("a", encoding="utf-8") as marker:
        marker.write("PRODUCTION ACTIVE-ONLY CYCLONES 2026-10-18 (no historical replay/sample imports)\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--panel-source", type=Path, required=True)
    args = parser.parse_args()
    apply(args.site, args.panel_source)
