#!/usr/bin/env python3
"""One-shot live-network cyclone source reachability audit, no data redistribution.

Expected to run from GitHub-hosted CI where FTP egress is permitted.
Do not use an absent live warning product to infer a service outage.
"""
from __future__ import annotations
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FTP = "ftp://ftp.bom.gov.au/anon/"
GML_SLOTS = ("IDQ65248", "IDQ65249", "IDQ65250", "IDQ65252")
ADVICE_SLOTS = ("IDQ20023", "IDQ20026", "IDQ20029")
SAMPLE = FTP + "sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml"
FWO = FTP + "gen/fwo/"
LIMIT = 5_000_000


def curl(url, *, list_only=False):
    args = ["curl", "--silent", "--show-error", "--fail", "--location",
            "--connect-timeout", "12", "--max-time", "35", "--proto", "=ftp",
            "--max-filesize", str(LIMIT)]
    if list_only:
        args.append("--list-only")
    args.append(url)
    try:
        out = subprocess.run(args, capture_output=True, timeout=42)
    except (OSError, subprocess.TimeoutExpired) as error:
        return None, "executor-error:" + type(error).__name__
    if out.returncode != 0:
        return None, "curl-exit-" + str(out.returncode)
    if len(out.stdout) > LIMIT:
        return None, "oversized-output"
    return out.stdout, "ok"


def test_decode(source):
    spec = importlib.util.spec_from_file_location(
        "stormtracker_original_gml", ROOT/"scripts"/"decode-bom-issued-cyclone-gml.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp)/"IDD65401.gml"
        path.write_bytes(source)
        result = module.decode_gml(path)
    p = result["properties"]
    roles = {}
    for feature in result["features"]:
        role = feature["properties"]["role"]
        roles[role] = roles.get(role, 0)+1
    if p["productId"] != "IDD65401" or p["systemName"].lower() != "fina":
        raise ValueError("Expected archived Fina sample original source identity")
    if roles.get("forecast_fix", 0) < 1 or roles.get("uncertainty_area", 0) < 1:
        raise ValueError("Authentic archive missing forecast and uncertainty geometry")
    return {"product":p["productId"],"cyclone":p["systemName"],
            "issueUtc":p["issuedUtc"],"features":len(result["features"]),
            "forecastFixes":roles.get("forecast_fix",0),
            "sourceUncertaintyAreas":roles.get("uncertainty_area",0),
            "sourceBytes":len(source)}


def main():
    report = {}
    source, source_status = curl(SAMPLE)
    report["archivedOriginal"] = {"fetchStatus": source_status}
    if source is not None:
        try:
            report["archivedOriginal"].update(test_decode(source))
            report["archivedOriginal"]["decodeStatus"]="valid"
        except Exception as error:
            report["archivedOriginal"]["decodeStatus"]="rejected:" + type(error).__name__
    listing, list_status = curl(FWO, list_only=True)
    report["currentWarningDirectory"] = {"accessStatus":list_status}
    if listing is not None:
        names = {Path(line.strip()).name for line in
                 listing.decode("utf-8", "replace").splitlines() if line.strip()}
        report["currentWarningDirectory"]["entries"] = len(names)
        report["currentWarningDirectory"]["forecastGmlProductNamesPresent"] = sorted(
            f"{p}.gml" for p in GML_SLOTS if f"{p}.gml" in names)
        report["currentWarningDirectory"]["adviceProductNamesPresent"] = sorted(
            n for n in names if any(
                n == f"{p}.txt" or n == f"{p}.xml" or n == f"{p}.html"
                for p in ADVICE_SLOTS))
        report["currentWarningDirectory"]["note"] = (
            "Files absent from directory are not currently issued; "
            "this does NOT mean live access fails.")
    report["verified"] = (
        report["archivedOriginal"].get("decodeStatus") == "valid" and
        report["currentWarningDirectory"]["accessStatus"] == "ok")
    print("ONE-TIME BOM CYCLONE PRODUCT ACCESS REPORT:")
    print(json.dumps(report, indent=2))
    # No raw BoM source, product bytes or archive geometry are ever uploaded.
    return 0 if report["verified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
