#!/usr/bin/env python3
"""Package isolated live rainfall-AEP review UI into the existing Pages artifact.
Never modify _site production root or accepted historical QA previews.
Called ONLY after the accepted production build and FTP/AEP overlay complete.
"""
from pathlib import Path
from shutil import copy2, copytree
import sys

site=Path("_site")
source=Path("checked/aep-rainfall-preview/frontend/src/context-layers/significant-rainfall-operational-v1.js")
target=site/"preview/rainfall-aep"
assert (site/"BUILD.txt").read_text().startswith("SEALED StormTracker V10.2.0")
assert source.is_file(), "Missing pinned rainfall review source"
assert "queueIfdLookups" in source.read_text()
assert not target.exists(), "Refusing to overwrite existing preview"

target.mkdir(parents=True)
for item in site.iterdir():
    if item.name=="preview":
        continue
    destination=target/item.name
    if item.is_dir(): copytree(item,destination)
    elif item.is_file(): copy2(item,destination)
copy2(source,target/"src/context-layers/significant-rainfall-operational-v1.js")
page=target/"live3d-operational-v9.html"
html=page.read_text()
html=html.replace("<title>", "<title>Rainfall AEP Test — ",1)
assert "Rainfall AEP Test" in html
page.write_text(html)
(target/"BUILD.txt").write_text(
    "ISOLATED INTERACTIVE RAINFALL AEP TEST — live source, on-demand BoM IFD lookup\n"
    "Maintenance preview only. Production baseline unchanged.\n"
    "GitHub development branch: fix/rainfall-station-ifd-coverage-20261020\n")
assert (target/"src/context-layers/rainfall-ifd-aep-v1.js").is_file()
assert (target/"src/context-layers/severity-marker-layer-v1.js").is_file()
assert (target/"index.html").is_file()
print("AEP_PREVIEW_PACKAGED",target)
