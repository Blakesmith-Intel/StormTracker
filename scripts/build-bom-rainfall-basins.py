#!/usr/bin/env python3
"""Build a read-only BoM rainfall-station -> river-basin registry for the QA preview.

Exact station ID and published coordinates only. No guesswork from flood-map
regions or names. This is a separate static asset, not a new live data service.
"""
import argparse
import datetime
import html.parser
import json
import math
import re
import urllib.request
from pathlib import Path

SOURCE = "https://www.bom.gov.au/qld/flood/networks/section1.shtml"
SCHEMA = "StormTrackerBoMQldRainfallBasinsV1"
LINE = re.compile(
    r"^\s*(\d{6,7})\s+(.+?)\s{2,}([A-Z][A-Z0-9 /&'().-]*?)\s{2,}"
    r"(\d{6}[NS])\s+(\d{7}[EW])\s*$")

class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
    def handle_starttag(self, tag, attrs):
        if tag in ("br", "p", "tr"):
            self.parts.append("\n")

def dms(value):
    direction = value[-1]
    degrees = int(value[:-5])
    minutes = int(value[-5:-3])
    seconds = int(value[-3:-1])
    if minutes > 60 or seconds > 60:
        raise ValueError("Invalid BoM DMS coordinates: " + value)
    number = degrees + (minutes + seconds / 60) / 60
    return round(number if direction in "NE" else -number, 6)

def normalise_basin(raw):
    return raw.title().replace("-", "–")

def parse_registry(markup):
    parser = Text()
    parser.feed(markup)
    lines = "".join(parser.parts).splitlines()
    result = {}
    conflicts = set()
    for line in lines:
        match = LINE.fullmatch(line.rstrip())
        if not match:
            continue
        id_, name, basin, lat, lon = match.groups()
        latitude, longitude = dms(lat), dms(lon)
        if not (-30.5 < latitude < -9 and 137 < longitude < 155):
            continue
        record = dict(name=name.strip(), basin=normalise_basin(basin.strip()),
                      latitude=latitude, longitude=longitude)
        if id_ in result and result[id_] != record:
            conflicts.add(id_)
        elif id_ not in conflicts:
            result[id_] = record
    for id_ in conflicts:
        result.pop(id_, None)
    return result, conflicts

def main():
    args = argparse.ArgumentParser()
    args.add_argument("--out", required=True)
    args = args.parse_args()
    req = urllib.request.Request(SOURCE, headers={
        "User-Agent": "Mozilla/5.0 (compatible; StormTracker-public-station-lookup)",
        "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=35) as response:
        if response.status != 200:
            raise RuntimeError(f"BoM register returned HTTP {response.status}")
        size = response.headers.get("Content-Length")
        if size and int(size) > 2_500_000:
            raise ValueError("BoM station register unexpectedly large")
        raw = response.read(2_500_001)
        if len(raw) > 2_500_000:
            raise ValueError("BoM station register unexpectedly large")
    stations, conflicts = parse_registry(raw.decode("utf-8", "replace"))
    assert len(stations) >= 500, f"Only {len(stations)} station rows extracted"
    kingull = stations.get("543013")
    assert kingull and kingull["basin"] == "Condamine–Balonne", (
        "Kingull BoM station/basin verification failed")
    assert abs(kingull["latitude"] - (-26.4094)) < .005
    assert abs(kingull["longitude"] - 148.655) < .005
    data = dict(schema=SCHEMA, source=SOURCE, sourceAsAt="2022-01-05",
                generatedUtc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                stations=stations, excludedConflictingIds=sorted(conflicts))
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("BOM_RAINFALL_BASIN_REGISTRY", len(stations),
          "conflictingIds", len(conflicts), "Kingull", kingull["basin"])

if __name__ == "__main__":
    main()
