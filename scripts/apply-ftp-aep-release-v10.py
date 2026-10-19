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
 ("frontend/src/ftp-reflectivity-operational-v1.js","src/ftp-reflectivity-operational-v1.js"),
 ("frontend/src/context-layers/significant-rainfall-source-v1.js","src/context-layers/significant-rainfall-source-v1.js"),
 ("frontend/src/context-layers/significant-rainfall-operational-v1.js","src/context-layers/significant-rainfall-operational-v1.js"),
 ("frontend/src/context-layers/rainfall-ifd-aep-v1.js","src/context-layers/rainfall-ifd-aep-v1.js")
]:
    assert Path(source).is_file(),source
    copyfile(source,site/target)

app=site/"src/live3d-operational-v9.js"
js=app.read_text()
needle="bom-wmts-loop-v2.js?v=9.18.6-bounded-published-history"
assert js.count(needle)==1, "V10 radar source import contract changed"
js=js.replace(needle,needle+"-ftp-static-original-20261019")
needle="significant-rainfall-operational-v1.js"
assert js.count(needle)==1
js=js.replace(needle,needle+"?v=ifd-aep-native-20261019")
app.write_text(js)

page=site/"live3d-operational-v9.html"
html=page.read_text()
assert html.count("<head>")==1
html=html.replace("<head>",'<head>\n<script>globalThis.__STORMTRACKER_FTP_FIRST=true;</script>',1)
start='title="Show BoM rain gauges reporting at least 50 mm"'
assert html.count(start)==1
html=html.replace(start,'title="Show observed BoM rainfall gauges graded against local IFD/AEP"')
old='●</span> Significant rain</label>'
assert html.count(old)==1
html=html.replace(old,'●</span> Rainfall AEP</label>')
old='<span class="significant-orange">●</span> 50–99.9 mm · <span class="significant-red">●</span> ≥100 mm'
assert html.count(old)==1
html=html.replace(old,'<span class="significant-orange">●</span> 5% · <span class="significant-red">●</span> 2% · green 20% · yellow 10% · purple 1% AEP')
needle="src/live3d-operational-v9.js?v="
assert html.count(needle)==1
html=html.replace(needle,needle+"ftp-live-direct-ifd-aep-20261019-")
page.write_text(html)
entry=site/"index.html"
html=entry.read_text()
needle="live3d-operational-v9.html?v="
assert html.count(needle)==1
entry.write_text(html.replace(needle,needle+"ftp-live-direct-ifd-aep-20261019-"))
with (site/"BUILD.txt").open("a") as f:
 f.write("RELEASE CANDIDATE: original BoM FTP source archive + independently sourced location-specific IFD/AEP\n")
 f.write("LIVE DIRECT BOM FTP TCP RADAR FALLBACK INDEPENDENT OF GITHUB CRON 2026-10-19\n")
print("FTP_AEP_V10_RELEASE_PACKAGED",len(list(site.rglob("*.js"))))
