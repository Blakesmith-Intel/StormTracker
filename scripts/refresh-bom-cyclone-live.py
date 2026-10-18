#!/usr/bin/env python3
"""One-shot BoM anonymous FTP GML ingest with independently confirmed no-warning state.

Output MUST stay outside the public Git checkout. A separate cloud sync uploads
only the validated, short-lived manifest to StormTracker's existing relay KV.
No historical sources, fabricated forecast areas or invented warning status.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("source_ftp_ingest", HERE / "internal-cyclone-ftp-ingest.py")
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)
OFFICIAL_TC = "https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/tropical-cyclone"
ADVICE_IDS = frozenset(("IDQ20023", "IDQ20026", "IDQ20029",
                        "IDQP0004", "IDNP0004", "IDD20150", "IDD20250"))
LIMIT_LIST_BYTES = 1_500_000
LIMIT_HTML_BYTES = 2_000_000
NO_WARNINGS = "currently no tropical cyclone warnings in"

class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.words = []
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"): self.skip = max(0, self.skip-1)
    def handle_data(self, text):
        if not self.skip: self.words.append(text)

def confirms_no_warnings(html_bytes):
    if not html_bytes or len(html_bytes)>LIMIT_HTML_BYTES: return False
    parser = VisibleText()
    try: parser.feed(html_bytes.decode("utf-8", "replace"))
    except (ValueError, UnicodeError): return False
    content = " ".join(" ".join(parser.words).lower().split())
    # Only the explicit BoM national negative AND Queensland inclusion can
    # validate a no-warnings message. Never infer it from an empty warning slot.
    start = content.find(NO_WARNINGS)
    if start < 0: return False
    end = content.find("last updated", start)
    context = content[start : end if end > start else start + 260]
    return "queensland" in context and "northern territory" in context

def curl_bytes(url, *, ftp_list=False, max_size=LIMIT_LIST_BYTES):
    args = ["curl", "--silent", "--show-error", "--fail", "--location",
            "--connect-timeout", "12", "--max-time", "35",
            "--max-filesize", str(max_size)]
    if ftp_list:
        args += ["--proto", "=ftp", "--list-only"]
    else:
        args += ["--proto", "=https", "--header", "Accept: text/html"]
    args.append(url)
    try:
        r = subprocess.run(args, capture_output=True, timeout=42, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout if r.returncode == 0 and 0 < len(r.stdout) <= max_size else None

def parse_listing(raw):
    if raw is None: return None
    names = set()
    for row in raw.decode("utf-8", "replace").splitlines():
        name = row.strip().split("/")[-1].split()[-1] if row.strip() else ""
        if name: names.add(name.upper())
    # A "successful" empty/truncated listing is not affirmative proof.
    return names if len(names) >= 10 else None

def advice_present(names):
    return sorted(x for x in names if any(
        x.startswith(code + ".") for code in ADVICE_IDS
    ))

def produce(now, decoder, *, names, html_bytes, downloader):
    if names is None:
        return {
            "schema":ingest.SCHEMA,"status":"source-unavailable",
            "generatedUtc":ingest.iso(now),"complete":False,
            "products":[],"verifiedProductIds":[],"failedProductIds":list(ingest.PRODUCTS),
            "warningSummaryConfirmed":False,"sourceDirectoryVerified":False,
            "message":"BoM FTP directory listing unavailable"
        }
    in_directory = {p for p in ingest.PRODUCTS if (p + ".GML") in names}
    # Reuse exactly the already-tested original BoM geometry/expiry decoder.
    def fetch_existing(product, folder):
        if product not in in_directory: return None, "missing"
        return downloader(product, folder)
    result = ingest.build_manifest(None, now, decoder, downloader=fetch_existing)
    present_advice = advice_present(names)
    negative_confirmed = confirms_no_warnings(html_bytes)
    result["sourceDirectoryVerified"] = True
    result["warningSummaryConfirmed"] = negative_confirmed
    result["warningAdviceProductNamesPresent"] = present_advice
    result["sourceWarningSummaryUrl"] = OFFICIAL_TC
    if result["status"] == "no-active-products" and (
        present_advice or not negative_confirmed
    ):
        result["status"] = "source-unavailable"
        result["complete"] = False
        result["message"] = ("Cyclone warning state could not be positively verified"
                             if not present_advice else
                             "BoM cyclone advice present without a usable current map")
    # An active partial map may be shown with explicit incomplete-source notice;
    # never substitute a "no warnings" claim.
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir",required=True,type=Path)
    args=parser.parse_args()
    now=datetime.now(timezone.utc)
    names=parse_listing(curl_bytes(ingest.FTP_BASE,ftp_list=True))
    html=curl_bytes(OFFICIAL_TC,max_size=LIMIT_HTML_BYTES)
    result=produce(now,ingest.load_decoder(),names=names,html_bytes=html,
                   downloader=ingest.fetch_original_ftp)
    folder=ingest.safe_destination(args.out_dir)
    ingest.atomic_private_json(folder,result)
    print(json.dumps({"status":result["status"],"complete":result["complete"],
          "productCount":len(result["products"]),
          "warningSummaryConfirmed":result["warningSummaryConfirmed"],
          "ftpDirectoryVerified":result["sourceDirectoryVerified"],
          "failedProductIds":result["failedProductIds"]}))
    # "source unavailable" must still be uploaded to replace the last known
    # data, and the browser must not mistake it for an all-clear.
    return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except (ValueError,OSError,RuntimeError) as e:
        print("Cyclone source refresh failed closed: "+str(e),file=sys.stderr)
        raise SystemExit(2) from e
