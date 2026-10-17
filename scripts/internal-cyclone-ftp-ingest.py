#!/usr/bin/env python3
"""Private, opt-in BoM cyclone GML ingestion for authorised internal operations.

Fetch ONLY documented BoM anonymous FTP forecast-map products, or read original
GML files already obtained through an approved internal channel. Decode using
StormTracker's existing independent source-true GML parser. Never store data
in the public GitHub Pages tree or source repository.

Run once under a private internal scheduler; there is intentionally NO
background job, network listener, public relay endpoint or embedded credential.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
DECODER = REPO / "scripts" / "decode-bom-issued-cyclone-gml.py"
# These are documented forecast GML product *slots*, NOT storm/advice IDs.
PRODUCTS = ("IDQ65248", "IDQ65249", "IDQ65250", "IDQ65252", "IDD65409")
FTP_BASE = "ftp://ftp.bom.gov.au/anon/gen/fwo/"
MAX_BYTES = 3_000_000
MAX_FUTURE_SECONDS = 300
SCHEMA = "stormtracker-internal-cyclone-source-v1"


def load_decoder():
    spec = importlib.util.spec_from_file_location("stormtracker_original_bom_cyclone", DECODER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Existing original BoM cyclone decoder is missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def utc(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("Timestamp without UTC timezone")
    return parsed.astimezone(timezone.utc)


def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_destination(folder):
    # Under GitHub Pages / frontend / checkout is ALWAYS unsafe, regardless
    # of operator declaration that the live service is for internal use.
    folder = Path(folder).expanduser().absolute()
    if folder.is_symlink():
        raise ValueError("Refusing symlinked destination")
    if folder.resolve() == REPO or REPO in folder.resolve().parents:
        raise ValueError("Internal BoM data must NOT be written inside the repository")
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    if folder.is_symlink():
        raise ValueError("Refusing symlinked destination")
    # Not readable by other users, even if the parent's umask is permissive.
    os.chmod(folder, 0o700)
    return folder


def fetch_original_ftp(product, folder):
    """Return local path, 'missing' or 'failed'. No arbitrary FTP URLs."""
    if product not in PRODUCTS:
        raise ValueError("Product not allowlisted")
    target = folder / (product + ".gml")
    cmd = ["curl", "--silent", "--show-error", "--fail", "--location",
           "--proto", "=ftp", "--max-time", "30", "--connect-timeout", "10",
           "--output", str(target), FTP_BASE + product + ".gml"]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=38, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None, "failed"
    if result.returncode == 78:  # curl CURLE_REMOTE_FILE_NOT_FOUND
        return None, "missing"
    if result.returncode != 0 or not target.is_file():
        return None, "failed"
    if target.stat().st_size > MAX_BYTES:
        return None, "failed"
    return target, "available"


def collect_one(product, path, now, decoder):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Oversized source GML")
    forecast = decoder.decode_gml(path)
    props = forecast["properties"]
    if props["productId"] != product or not any(
        f["properties"].get("role") in ("forecast_fix", "forecast_track")
        for f in forecast["features"]
    ):
        raise ValueError("Product identity or authentic issued forecast geometry missing")
    issued = utc(props["issuedUtc"])
    if issued > now + timedelta(seconds=MAX_FUTURE_SECONDS):
        raise ValueError("Source issue UTC is in the future")
    expires = issued + timedelta(hours=props["expiresAfterHours"])
    if expires <= now:
        return None  # Original bulletin expired; never publish it as live.
    source_bytes = path.read_bytes()
    return {
        "productId": product,
        "systemId": props["systemId"],
        "name": props["systemName"],
        "issueUtc": iso(issued),
        "expiresUtc": iso(expires),
        "sourceUrl": FTP_BASE + product + ".gml",
        "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
        "forecast": forecast,
    }


def build_manifest(input_dir, now, decoder, downloader=fetch_original_ftp):
    if input_dir is not None and not input_dir.is_dir():
        raise ValueError("Missing original-GML input directory")
    failed, seen, issues = [], [], {}
    with tempfile.TemporaryDirectory(prefix="stormtracker-cyclone-") as workdir:
        work = Path(workdir)
        for product in PRODUCTS:
            if input_dir is None:
                path, state = downloader(product, work)
            else:
                path = input_dir / (product + ".gml")
                state = "available" if path.is_file() else "missing"
            if state == "missing":
                continue
            if state != "available" or path is None:
                failed.append(product)
                continue
            try:
                issue = collect_one(product, path, now, decoder)
            except (OSError, ValueError, decoder.SourceError, Exception) as exc:
                # A corrupted/mismatched file must NOT be silently interpreted
                # as a verified "no cyclone" advisory.
                failed.append(product)
                print(f"Source {product} rejected: {type(exc).__name__}", file=sys.stderr)
                continue
            seen.append(product)
            if issue is None:
                continue
            key = issue["systemId"]
            old = issues.get(key)
            if old is None or issue["issueUtc"] > old["issueUtc"]:
                issues[key] = issue
    state = ("active" if issues else
             "source-unavailable" if failed else "no-active-products")
    return {
        "schema": SCHEMA,
        "status": state,
        "generatedUtc": iso(now),
        "complete": not failed,
        "failedProductIds": failed,
        "verifiedProductIds": seen,
        "products": sorted(issues.values(), key=lambda p: p["systemId"]),
        "notice": "AUTHORISED INTERNAL USE ONLY · Original BoM issues · NOT an emergency warning replacement",
    }


def atomic_private_json(folder, manifest):
    payload = json.dumps(manifest, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    name = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".cyclone-", suffix=".tmp",
                                         dir=folder, delete=False) as temp:
            name = temp.name
            os.fchmod(temp.fileno(), 0o600)
            temp.write(payload)
            temp.flush()
            os.fsync(temp.fileno())
        os.replace(name, folder / "cyclones.json")
        os.chmod(folder / "cyclones.json", 0o600)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--fetch-ftp", action="store_true",
                      help="Fetch exact documented BoM product IDs via anonymous FTP")
    mode.add_argument("--input-dir", type=Path,
                      help="Read ORIGINAL BoM GML already acquired internally")
    parser.add_argument("--out-dir", type=Path, required=True,
                        help="Private output directory OUTSIDE the checkout/Pages build")
    parser.add_argument("--at-utc", help="Regression-test clock (only with --input-dir)")
    args = parser.parse_args()
    if args.at_utc and args.fetch_ftp:
        parser.error("--at-utc is only for local/offline regression tests")
    out = safe_destination(args.out_dir)
    now = utc(args.at_utc) if args.at_utc else datetime.now(timezone.utc)
    result = build_manifest(args.input_dir, now, load_decoder())
    atomic_private_json(out, result)
    print(json.dumps({"status": result["status"],
                      "activeCyclones": len(result["products"]),
                      "verifiedProductIds": result["verifiedProductIds"],
                      "failedProductIds": result["failedProductIds"],
                      "manifest": str(out / "cyclones.json")}))
    return 2 if result["status"] == "source-unavailable" or not result["complete"] else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print("Refusing internal BoM cyclone ingestion: " + str(error), file=sys.stderr)
        raise SystemExit(2) from error
