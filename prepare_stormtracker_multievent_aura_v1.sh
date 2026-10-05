#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — multi-event AURA intake v1"
echo

BASE="data/aura/multievent"
mkdir -p "$BASE"

if ! grep -qxF "data/aura/multievent/" .gitignore 2>/dev/null; then
  printf '\n# StormTracker multi-event AURA calibration data\ndata/aura/multievent/\n' >> .gitignore
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import h5py
import numpy
PY
then
  echo "Installing build-time Python dependencies..."
  python3 -m pip install --user --quiet h5py numpy
fi

cat > /tmp/stormtracker_multievent_select.py <<'PY'
from __future__ import annotations

import io
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

import h5py
import numpy as np

archive = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
event_label = sys.argv[3]
date_text = sys.argv[4]

stamp = date_text.replace("-", "")
patterns = [
    re.compile(rf"(?P<date>{stamp})[T_.-]?(?P<time>\d{{6}})(?!\d)"),
    re.compile(rf"(?P<date>{stamp})[T_.-]?(?P<time>\d{{4}})(?!\d)"),
]

def member_time(name: str):
    base = Path(name).name
    for pattern in patterns:
        m = pattern.search(base)
        if not m:
            continue
        t = m.group("time")
        if len(t) == 4:
            t += "00"
        hh, mm, ss = int(t[:2]), int(t[2:4]), int(t[4:6])
        if hh < 24 and mm < 60 and ss < 60:
            return f"{date_text}T{hh:02d}:{mm:02d}:{ss:02d}Z"
    return None

def as_text(v):
    if isinstance(v, bytes):
        return v.decode("utf-8", errors="replace")
    return str(v)

def decode_data(group):
    raw = np.asarray(group["data"][...])
    what = group["what"]
    gain = float(np.asarray(what.attrs.get("gain", 1.0)).reshape(-1)[0])
    offset = float(np.asarray(what.attrs.get("offset", 0.0)).reshape(-1)[0])
    nodata = what.attrs.get("nodata", None)
    undetect = what.attrs.get("undetect", None)
    valid = np.ones(raw.shape, dtype=bool)
    if nodata is not None:
        valid &= raw != np.asarray(nodata).reshape(-1)[0]
    if undetect is not None:
        valid &= raw != np.asarray(undetect).reshape(-1)[0]
    values = raw.astype(np.float32) * gain + offset
    values[~valid] = np.nan
    return values

def score_member(blob: bytes):
    with h5py.File(io.BytesIO(blob), "r") as h5:
        score = 0
        max_dbzh = None
        sweep_count = 0
        quantities = set()

        for dataset_name in sorted(k for k in h5.keys() if k.startswith("dataset")):
            dataset = h5[dataset_name]
            sweep_count += 1

            for key in sorted(k for k in dataset.keys() if k.startswith("data")):
                group = dataset[key]
                if "what" not in group or "data" not in group:
                    continue

                quantity = as_text(
                    group["what"].attrs.get("quantity", "")
                ).upper()

                if quantity:
                    quantities.add(quantity)

                if quantity != "DBZH":
                    continue

                values = decode_data(group)
                finite = values[np.isfinite(values)]

                if not finite.size:
                    continue

                local_max = float(np.max(finite))
                max_dbzh = local_max if max_dbzh is None else max(max_dbzh, local_max)

                # Rank whole-volume storm intensity while still allowing
                # heavy-rain events to be selected.
                score += int(np.count_nonzero(finite >= 30.0))
                score += 4 * int(np.count_nonzero(finite >= 40.0))
                score += 12 * int(np.count_nonzero(finite >= 50.0))
                score += 30 * int(np.count_nonzero(finite >= 60.0))

        return {
            "score": int(score),
            "max_dbzh": max_dbzh,
            "sweep_count": int(sweep_count),
            "quantities": sorted(quantities),
        }

with zipfile.ZipFile(archive) as zf:
    members = []

    for info in zf.infolist():
        if info.is_dir():
            continue
        when = member_time(info.filename)
        if when is None:
            continue
        members.append((when, info))

    members.sort(key=lambda item: item[0])

    if len(members) < 13:
        raise SystemExit(
            f"ERROR: only {len(members)} timestamped volumes found in {archive.name}"
        )

    print(f"Scanning {len(members)} volumes to locate the strongest 13-scan window...")

    scored = []

    for index, (when, info) in enumerate(members, start=1):
        blob = zf.read(info)
        metrics = score_member(blob)

        scored.append({
            "when": when,
            "info": info,
            **metrics,
        })

        if index % 30 == 0 or index == len(members):
            print(f"  scanned {index}/{len(members)}")

    peak_index = max(
        range(len(scored)),
        key=lambda i: (
            scored[i]["score"],
            scored[i]["max_dbzh"] if scored[i]["max_dbzh"] is not None else -999.0,
        )
    )

    start = max(0, peak_index - 6)
    end = start + 13

    if end > len(scored):
        end = len(scored)
        start = end - 13

    selected = scored[start:end]

    raw_dir = out_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    records = []

    for frame_index, item in enumerate(selected):
        target = raw_dir / Path(item["info"].filename).name

        if not target.exists() or target.stat().st_size != item["info"].file_size:
            with zf.open(item["info"]) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst)

        records.append({
            "frame_index": frame_index,
            "scan_time": item["when"],
            "archive_member": item["info"].filename,
            "extracted_path": str(target),
            "size_bytes": item["info"].file_size,
            "selection_score": item["score"],
            "max_dbzh": item["max_dbzh"],
            "sweep_count": item["sweep_count"],
            "quantities": item["quantities"],
        })

manifest = {
    "format": "StormTrackerAuraMultiEventReferenceV1",
    "radar": {
        "id": "66",
        "name": "Brisbane / Mt Stapylton",
    },
    "event_label": event_label,
    "date": date_text,
    "selection": {
        "method": "13 consecutive scans centred on maximum whole-volume convective score",
        "score_definition": "N>=30 + 4*N>=40 + 12*N>=50 + 30*N>=60 across DBZH gates",
        "peak_scan_time": scored[peak_index]["when"],
        "peak_score": scored[peak_index]["score"],
        "peak_max_dbzh": scored[peak_index]["max_dbzh"],
    },
    "frames": records,
}

manifest_path = out_dir / "reference_source_manifest.json"
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

print()
print(f"EVENT: {event_label}")
print(f"DATE:  {date_text}")
print(f"PEAK:  {manifest['selection']['peak_scan_time']}")
print(f"SCORE: {manifest['selection']['peak_score']:,}")
print(
    "MAX:   "
    + (
        f"{manifest['selection']['peak_max_dbzh']:.1f} dBZ"
        if manifest["selection"]["peak_max_dbzh"] is not None
        else "n/a"
    )
)
print(
    f"WINDOW: {records[0]['scan_time']} -> {records[-1]['scan_time']}"
)

for record in records:
    quantities = set(record["quantities"])
    if record["sweep_count"] < 2:
        raise SystemExit(
            f"ERROR: selected frame {record['frame_index']} is not volumetric"
        )
    if "DBZH" not in quantities:
        raise SystemExit(
            f"ERROR: selected frame {record['frame_index']} has no DBZH"
        )
    if not ({"VRADH", "VRAD"} & quantities):
        raise SystemExit(
            f"ERROR: selected frame {record['frame_index']} has no VRADH/VRAD"
        )

print("AURA EVENT INTAKE: PASS")
print(f"MANIFEST: {manifest_path}")
PY

EVENTS=(
  "2013-11-10|severe-hail-logan"
  "2013-11-16|severe-hail-sunshine-coast"
  "2015-05-02|east-coast-low-heavy-rain"
  "2015-11-29|severe-hail-brisbane"
)

SUCCESS_COUNT=0

for EVENT in "${EVENTS[@]}"; do
  DATE="${EVENT%%|*}"
  LABEL="${EVENT#*|}"
  YEAR="${DATE:0:4}"
  STAMP="${DATE//-/}"

  OUT_DIR="$BASE/66/$DATE"
  ARCHIVE="$OUT_DIR/66_${STAMP}.pvol.zip"
  URL="https://thredds.nci.org.au/thredds/fileServer/rq0/66/${YEAR}/vol/66_${STAMP}.pvol.zip"

  mkdir -p "$OUT_DIR"

  echo
  echo "============================================================"
  echo "$DATE — $LABEL"
  echo "============================================================"
  echo "$URL"
  echo

  if [ ! -f "$ARCHIVE" ]; then
    echo "Downloading daily AURA archive (resumable)..."

    if ! curl \
      --fail \
      --show-error \
      --location \
      --retry 4 \
      --retry-delay 3 \
      --continue-at - \
      --output "${ARCHIVE}.part" \
      "$URL"
    then
      echo
      echo "WARNING: AURA archive unavailable for $DATE; skipping this event."
      rm -f "${ARCHIVE}.part"
      continue
    fi

    mv "${ARCHIVE}.part" "$ARCHIVE"
  else
    echo "Reusing existing archive:"
    echo "  $ARCHIVE"
  fi

  echo
  echo "Checking ZIP..."
  python3 - "$ARCHIVE" <<'PY'
import sys, zipfile
path=sys.argv[1]
with zipfile.ZipFile(path) as zf:
    bad=zf.testzip()
    if bad:
        raise SystemExit(f"ZIP CRC failure: {bad}")
    print(f"ZIP PASS: {len(zf.infolist())} members")
PY

  echo
  python3 /tmp/stormtracker_multievent_select.py \
    "$ARCHIVE" \
    "$OUT_DIR" \
    "$LABEL" \
    "$DATE"

  SUCCESS_COUNT=$((SUCCESS_COUNT+1))
done

echo
echo "============================================================"
echo "MULTI-EVENT INTAKE SUMMARY"
echo "============================================================"
echo "Additional event sequences recovered: $SUCCESS_COUNT / ${#EVENTS[@]}"
echo "Existing validated event retained:   2014-11-27"
echo "Total candidate event sequences:     $((SUCCESS_COUNT+1))"
echo
echo "Disk usage:"
du -sh data/aura/multievent 2>/dev/null || true
echo
echo "Git safety:"
git check-ignore -v data/aura/multievent/66/*/*.pvol.zip 2>/dev/null | head -n 5 || true
echo
echo "MULTI-EVENT AURA INTAKE: COMPLETE"
echo
echo "Send me the final MULTI-EVENT INTAKE SUMMARY plus each EVENT/PEAK/MAX/WINDOW/PASS block."
echo "Do not commit the downloaded AURA data."
