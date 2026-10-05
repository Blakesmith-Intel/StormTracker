#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

RADAR="66"
DATE="2014-11-27"
STAMP="20141127"
TARGET_TIME="063000"

BASE_DIR="data/aura/reference/${RADAR}/${DATE}"
ARCHIVE="${BASE_DIR}/${RADAR}_${STAMP}.pvol.zip"
RAW_DIR="${BASE_DIR}/raw"
MANIFEST="${BASE_DIR}/reference_source_manifest.json"

URL="https://thredds.nci.org.au/thredds/fileServer/rq0/${RADAR}/2014/vol/${RADAR}_${STAMP}.pvol.zip"

echo "StormTracker — recover validated historical AURA reference source"
echo "Radar:  ${RADAR} — Mt Stapylton"
echo "Date:   ${DATE}"
echo "Target: approximately 06:30 UTC, 13 consecutive volumes"
echo

mkdir -p "$BASE_DIR" "$RAW_DIR"

# This is build/reference data only. Never push the daily archive into Git.
if ! grep -qxF "data/aura/reference/" .gitignore 2>/dev/null; then
  printf '\n# StormTracker build-time AURA reference archive\ndata/aura/reference/\n' >> .gitignore
fi

echo "Checking NCI AURA source..."
echo "  $URL"
echo

HEADERS="$(mktemp)"
trap 'rm -f "$HEADERS"' EXIT

if ! curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --connect-timeout 20 \
  --max-time 60 \
  --head \
  --output /dev/null \
  --dump-header "$HEADERS" \
  "$URL"
then
  echo
  echo "ERROR: Codespaces could not reach the historical AURA file."
  echo "No project files were changed except the safe .gitignore entry."
  exit 1
fi

CONTENT_LENGTH="$(
  awk 'BEGIN{IGNORECASE=1}
       /^content-length:/ {gsub("\r","",$2); value=$2}
       END {print value}' "$HEADERS"
)"

if [ -n "${CONTENT_LENGTH:-}" ] && [[ "$CONTENT_LENGTH" =~ ^[0-9]+$ ]]; then
  python3 - "$CONTENT_LENGTH" <<'PY'
import sys
n = int(sys.argv[1])
print(f"Remote archive size: {n:,} bytes ({n/1024/1024:.2f} MiB)")
PY
else
  echo "Remote archive size: server did not provide Content-Length."
fi

echo
echo "Free disk space:"
df -h "$ROOT" | tail -n 1
echo

if [ ! -f "$ARCHIVE" ]; then
  echo "Downloading the AURA daily archive."
  echo "The download is resumable if the Codespace connection drops."
  echo

  curl \
    --fail \
    --show-error \
    --location \
    --retry 4 \
    --retry-delay 3 \
    --continue-at - \
    --output "${ARCHIVE}.part" \
    "$URL"

  mv "${ARCHIVE}.part" "$ARCHIVE"
else
  echo "Archive already exists; reusing:"
  echo "  $ARCHIVE"
fi

echo
echo "Validating ZIP structure..."
python3 - "$ARCHIVE" <<'PY'
import sys
import zipfile

path = sys.argv[1]

with zipfile.ZipFile(path) as zf:
    bad = zf.testzip()
    if bad:
        raise SystemExit(f"ERROR: ZIP CRC failure in {bad}")
    print(f"ZIP validation: PASS ({len(zf.infolist())} members)")
PY

echo
echo "SHA256:"
sha256sum "$ARCHIVE"
echo

echo "Selecting the 13 volumes nearest 06:30 UTC and inspecting ODIM metadata..."

python3 - "$ARCHIVE" "$RAW_DIR" "$MANIFEST" <<'PY'
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

archive = Path(sys.argv[1])
raw_dir = Path(sys.argv[2])
manifest_path = Path(sys.argv[3])

DATE = dt.date(2014, 11, 27)
TARGET = dt.datetime(2014, 11, 27, 6, 30, tzinfo=dt.timezone.utc)
COUNT = 13

# AURA member names have varied over time. Search for YYYYMMDD followed by
# HHMM or HHMMSS rather than assuming one exact filename convention.
patterns = [
    re.compile(r"(?P<date>20141127)[T_.-]?(?P<time>\d{6})(?!\d)"),
    re.compile(r"(?P<date>20141127)[T_.-]?(?P<time>\d{4})(?!\d)"),
]

def member_time(name: str):
    base = Path(name).name
    for pattern in patterns:
        match = pattern.search(base)
        if not match:
            continue
        t = match.group("time")
        if len(t) == 4:
            t += "00"
        try:
            return dt.datetime(
                2014, 11, 27,
                int(t[0:2]),
                int(t[2:4]),
                int(t[4:6]),
                tzinfo=dt.timezone.utc,
            )
        except ValueError:
            pass
    return None

with zipfile.ZipFile(archive) as zf:
    candidates = []
    for info in zf.infolist():
        if info.is_dir():
            continue
        when = member_time(info.filename)
        if when is None:
            continue
        candidates.append((when, info))

    if len(candidates) < COUNT:
        sample = "\n".join(
            f"  {item.filename}"
            for item in zf.infolist()[:40]
        )
        raise SystemExit(
            "ERROR: Could not identify at least 13 timestamped AURA volumes "
            f"inside the archive. Found {len(candidates)}.\n"
            "First archive members:\n" + sample
        )

    # Pick nearest 13 to 06:30, then put them back in chronological order.
    selected = sorted(
        sorted(
            candidates,
            key=lambda item: (
                abs((item[0] - TARGET).total_seconds()),
                item[0],
            ),
        )[:COUNT],
        key=lambda item: item[0],
    )

    raw_dir.mkdir(parents=True, exist_ok=True)

    records = []

    for index, (when, info) in enumerate(selected):
        target = raw_dir / Path(info.filename).name

        if not target.exists() or target.stat().st_size != info.file_size:
            with zf.open(info) as source, target.open("wb") as destination:
                shutil.copyfileobj(source, destination)

        records.append({
            "frame_index": index,
            "scan_time_from_filename": when.isoformat().replace("+00:00", "Z"),
            "archive_member": info.filename,
            "extracted_path": str(target),
            "size_bytes": info.file_size,
        })

manifest = {
    "format": "StormTrackerAuraReferenceSourceV1",
    "radar": {
        "id": "66",
        "name": "Brisbane / Mt Stapylton",
    },
    "date": DATE.isoformat(),
    "selection": {
        "target_time_utc": TARGET.isoformat().replace("+00:00", "Z"),
        "frame_count": COUNT,
        "method": "13 timestamped archive members nearest 06:30 UTC, chronological after selection",
    },
    "source_archive": {
        "path": str(archive),
        "url": (
            "https://thredds.nci.org.au/thredds/fileServer/"
            "rq0/66/2014/vol/66_20141127.pvol.zip"
        ),
    },
    "frames": records,
}

manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print()
print("Selected sequence:")
for record in records:
    print(
        f"  {record['frame_index']:02d}  "
        f"{record['scan_time_from_filename']}  "
        f"{Path(record['extracted_path']).name}  "
        f"{record['size_bytes']/1024/1024:.2f} MiB"
    )

print()
print(f"Reference source manifest: {manifest_path}")
PY

echo
echo "Checking Python HDF5 reader..."

if ! python3 - <<'PY' >/dev/null 2>&1
import h5py
PY
then
  echo "h5py is not installed in this Codespace; installing it as a build-time tool only..."
  python3 -m pip install --user --quiet h5py
fi

python3 - "$MANIFEST" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

import h5py

manifest_path = Path(sys.argv[1])
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

def as_text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)

def attrs(group):
    return {str(k): as_text(v) for k, v in group.attrs.items()}

reports = []

for frame in manifest["frames"]:
    path = Path(frame["extracted_path"])

    with h5py.File(path, "r") as h5:
        root_where = attrs(h5["where"]) if "where" in h5 else {}
        root_what = attrs(h5["what"]) if "what" in h5 else {}
        conventions = as_text(h5.attrs.get("Conventions", ""))

        datasets = sorted(
            key for key in h5.keys()
            if key.startswith("dataset")
        )

        sweep_reports = []
        quantities = set()

        for dataset_name in datasets:
            ds = h5[dataset_name]
            where = attrs(ds["where"]) if "where" in ds else {}
            how = attrs(ds["how"]) if "how" in ds else {}

            sweep_quantities = []

            for key in ds.keys():
                if not key.startswith("data"):
                    continue
                group = ds[key]
                if "what" not in group:
                    continue
                quantity = as_text(group["what"].attrs.get("quantity", "")).upper()
                if quantity:
                    sweep_quantities.append(quantity)
                    quantities.add(quantity)

            sweep_reports.append({
                "dataset": dataset_name,
                "elangle": where.get("elangle"),
                "nbins": where.get("nbins"),
                "nrays": where.get("nrays"),
                "rstart": where.get("rstart"),
                "rscale": where.get("rscale"),
                "has_startazA": "startazA" in how,
                "has_stopazA": "stopazA" in how,
                "has_startelA": "startelA" in how,
                "has_stopelA": "stopelA" in how,
                "quantities": sorted(set(sweep_quantities)),
            })

        report = {
            "frame_index": frame["frame_index"],
            "file": str(path),
            "conventions": conventions,
            "object": root_what.get("object"),
            "date": root_what.get("date"),
            "time": root_what.get("time"),
            "radar": {
                "longitude": root_where.get("lon"),
                "latitude": root_where.get("lat"),
                "height_m": root_where.get("height"),
            },
            "sweep_count": len(datasets),
            "quantities": sorted(quantities),
            "sweeps": sweep_reports,
        }

        reports.append(report)

manifest["odim_inspection"] = reports
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print()
print("ODIM inspection:")
for report in reports:
    elevations = [
        sweep.get("elangle")
        for sweep in report["sweeps"]
        if sweep.get("elangle") is not None
    ]

    print(
        f"  frame {report['frame_index']:02d}: "
        f"{report['sweep_count']} sweeps; "
        f"quantities={','.join(report['quantities'])}; "
        f"radar=({report['radar']['latitude']}, "
        f"{report['radar']['longitude']}, "
        f"{report['radar']['height_m']} m)"
    )

    if report["frame_index"] == 0 and elevations:
        print("    elevations:", ", ".join(str(v) for v in elevations))

first = reports[0]

if first["sweep_count"] < 2:
    raise SystemExit("ERROR: Selected AURA file is not a multi-elevation volume.")

if "DBZH" not in first["quantities"]:
    raise SystemExit("ERROR: DBZH was not found in the selected AURA volume.")

if not ({"VRADH", "VRAD"} & set(first["quantities"])):
    raise SystemExit("ERROR: radial velocity VRADH/VRAD was not found.")

print()
print("TRUE-3D SOURCE INTAKE: PASS")
print("The selected historical source contains multi-elevation measured reflectivity and radial velocity.")
PY

echo
echo "Current extracted reference size:"
du -sh "$BASE_DIR"
echo

echo "Git safety check:"
git status --short .gitignore
git check-ignore -v "$ARCHIVE" || true
echo

echo "DONE"
echo
echo "Send me the terminal output from:"
echo "  'Selected sequence:'"
echo "through:"
echo "  'TRUE-3D SOURCE INTAKE: PASS'"
echo
echo "Do not commit the AURA archive or raw volumes."
