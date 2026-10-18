#!/usr/bin/env python3
"""Offline negative and positive checks for official-source cyclone status."""
import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import tempfile

HERE=Path(__file__).resolve().parent
def load(path, name):
    spec=importlib.util.spec_from_file_location(name,HERE/path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
bridge=load("refresh-bom-cyclone-live.py","cyclone_bridge_status")
ingest=bridge.ingest
decoder=ingest.load_decoder()
now=datetime(2026,10,17,4,0,tzinfo=timezone.utc)
names={"TESTFILE%02d.TXT"%i for i in range(30)}
real_html=(b"<main><h2>Tropical cyclone warnings and bulletins</h2>"
           b"<p>Currently no tropical cyclone warnings in New South Wales, "
           b"Victoria, Queensland, Western Australia, South Australia, "
           b"Tasmania, Australian Capital Territory and Northern Territory</p>"
           b"<p>Last updated</p></main>")
assert bridge.confirms_no_warnings(real_html)
qld_html=(b"<h1>Queensland Warnings Summary</h1><p>No Warnings Current.</p>")
assert bridge.confirms_qld_no_warnings(qld_html)
assert not bridge.confirms_qld_no_warnings(b"<h1>Queensland Warnings Summary</h1>"
                                           b"<p>Tropical Cyclone Warning</p>")
assert not bridge.confirms_no_warnings(b"<main>Forecast unavailable</main>")
assert not bridge.confirms_no_warnings(b"<div>Queensland</div>")
assert not bridge.confirms_no_warnings(b"<script>Currently no tropical cyclone "
    b"warnings in Queensland and Northern Territory</script>")
assert bridge.parse_listing(None) is None
assert bridge.parse_listing(b"one\ntwo\n") is None
assert len(bridge.parse_listing(b"".join(n.encode()+b"\n" for n in names)))==30

def no_fetch(*args):
    raise AssertionError("FTP download must not run for absent issue")

clean=bridge.produce(now,decoder,names=names,html_bytes=real_html,
                     downloader=no_fetch)
assert clean["status"]=="no-active-products"
assert clean["complete"] and clean["warningSummaryConfirmed"]
assert clean["sourceDirectoryVerified"] and clean["products"]==[]
fallback=bridge.produce(now,decoder,names=names,html_bytes=None,
                        qld_warnings_html=qld_html,downloader=no_fetch)
assert fallback["status"]=="no-active-products"
for listing,html in [(None,real_html),(names,None),
                     (names,b"<html>Warnings data unavailable</html>"),
                     (names|{"IDQ20023.TXT"},real_html)]:
    result=bridge.produce(now,decoder,names=listing,html_bytes=html,
                          downloader=no_fetch)
    assert result["status"]=="source-unavailable"
    assert result["complete"] is False
    assert result["products"] == []
with tempfile.TemporaryDirectory() as tmp:
    p=Path(tmp)/"IDQ65248.gml"
    p.write_text('''<?xml version="1.0" encoding="UTF-8"?>
<tc:tcData xmlns:tc="http://www.bom.gov.au/dtd/tc" xmlns:gml="http://www.opengis.net/gml">
<tc:issueTime>2026-10-17T03:00:00Z</tc:issueTime>
<tc:fcastTime>2026-10-17T02:00:00Z</tc:fcastTime>
<tc:distId>FAKE-STORM-A</tc:distId><tc:distName>SYNTHETIC TEST</tc:distName><tc:expiryHrs>12</tc:expiryHrs>
<tc:tcFix srsName="EPSG:4283"><tc:fixType>forecast</tc:fixType>
<tc:fixTime>2026-10-17T11:00:00Z</tc:fixTime>
<gml:Point srsName="EPSG:4283"><gml:coordinates>150,-20</gml:coordinates></gml:Point></tc:tcFix>
<tc:tcForecastArea srsName="EPSG:4283"><tc:areaType>Likely Tracks Area</tc:areaType>
<tc:extent>Up to 72 hours</tc:extent>
<gml:Polygon srsName="EPSG:4283"><gml:outerBoundaryIs><gml:LinearRing>
<gml:coordinates>149,-19 151,-19 151,-21 149,-19</gml:coordinates>
</gml:LinearRing></gml:outerBoundaryIs></gml:Polygon></tc:tcForecastArea>
</tc:tcData>''')
    def one(product, folder):
        assert product=="IDQ65248"
        return p,"available"
    active=bridge.produce(now,decoder,names=names|{"IDQ65248.GML"},
                         html_bytes=b"<html>Active weather warnings</html>",
                         downloader=one)
    assert active["status"]=="active" and active["complete"]
    features=active["products"][0]["forecast"]["features"]
    assert any(x["properties"]["role"]=="uncertainty_area" for x in features)
    assert active["warningSummaryConfirmed"] is False
print("PASS original BoM GML source bridge: genuine forecast semantics, official no-warning proof, FTP failure/advice caution")
