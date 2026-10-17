#!/usr/bin/env python3
"""Optional end-to-end native browser DOMParser check against original Fina.

Original BoM GML downloaded to an ephemeral, local-only HTTP server, never
checked in, mirrored, persisted as a test artifact or exposed on public Pages.
Not run on each ordinary CI build.
"""
import json
import pathlib
import shutil
import subprocess
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT=pathlib.Path(__file__).resolve().parents[1]
FILENAME="IDD65401.gml"
FTP=("ftp://ftp.bom.gov.au/anon/sample/catalogue/"
     "Warnings/Tropical_Cyclone_Warning/"+FILENAME)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass


def main():
    binary=next((path for name in ("google-chrome","google-chrome-stable","chromium","chromium-browser")
        if (path:=shutil.which(name))),None)
    if not binary:
        raise SystemExit("No installed headless Chrome/Chromium for original browser QA")
    with tempfile.TemporaryDirectory(prefix="stormtracker-bom-forecast-browser-") as td:
        root=pathlib.Path(td)
        shutil.copyfile(ROOT/"frontend/src/bom-historical-forecast-gml-v1.js",
                        root/"decoder.js")
        subprocess.run(["curl","--fail","--silent","--show-error","--location",
            "--max-time","30","--output",str(root/FILENAME),FTP],
            check=True,timeout=36)
        if (root/FILENAME).stat().st_size < 120_000:
            raise AssertionError("Original BoM Fina GML too small")
        page=r"""<!doctype html><html><head><meta charset="utf-8"></head>
<body>TEST RUNNING<script type="module">
import {decodeHistoricalBomCycloneGml,cycloneForecastSummary} from "./decoder.js";
try{
 const xml=await(await fetch("./IDD65401.gml")).text();
 const out=decodeHistoricalBomCycloneGml(xml,{filename:"IDD65401.gml"});
 const s=cycloneForecastSummary(out);
 const size=h=>{
  const features=out.features.filter(f=>f.role==="uncertainty_area"&&f.areaKey===h);
  return features.reduce((n,f)=>n+f.geometry.coordinates.reduce((sum,ring)=>sum+ring.length,0),0);
 };
 if(out.cycloneName!=="Fina" || out.issueUtc!=="2025-11-20T06:53:03.000Z"
   || s.forecastFixes!==10 || s.forecastTracks!==1 ||
   s.uncertainty72!==1 || s.uncertainty120!==1 ||
   size("72")!==422 || size("120")!==728)
   throw Error("Unexpected original BoM feature counts: "+JSON.stringify({s,issued:out.issueUtc,size72:size("72"),size120:size("120")}));
 document.body.textContent="AUTHENTIC_BOM_DOMPARSER_PASS";
}catch(error){
 document.body.textContent="AUTHENTIC_BOM_DOMPARSER_FAIL "+String(error);
}
</script></body></html>"""
        (root/"index.html").write_text(page,encoding="utf-8")
        handler=lambda *a,**kw:QuietHandler(*a,directory=str(root),**kw)
        server=ThreadingHTTPServer(("127.0.0.1",0),handler)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            url=f"http://127.0.0.1:{server.server_address[1]}/"
            run=subprocess.run([binary,"--headless=new","--no-sandbox",
              "--disable-dev-shm-usage","--disable-gpu","--no-first-run",
              "--disable-extensions","--virtual-time-budget=15000","--dump-dom",url],
              capture_output=True,text=True,timeout=55)
            html=run.stdout
            if "AUTHENTIC_BOM_DOMPARSER_PASS" not in html:
                raise AssertionError("Native browser parse FAILED: "+
                  html[-2000:]+" STDERR "+run.stderr[-1200:])
            print("PASS actual browser parsed original BoM Fina 2025 GML: "
                  "10 forecast fixes + original 422/728-vertex likely-track polygons.")
        finally:
            server.shutdown();server.server_close()


if __name__=="__main__":
    main()
