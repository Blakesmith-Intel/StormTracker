#!/usr/bin/env python3
"""One-off research extraction of genuine AURA Gympie 2025-11-24 radar volumes.

Does not run in the browser or production; no large radar ZIP is committed.
Source: NCI AURA Level 1 radar 8, CC BY 4.0.
"""
import csv
import datetime as dt
import json
import re
import sys
import zipfile
from pathlib import Path

ARCHIVE_URL = "https://dapds00.nci.org.au/thredds/fileServer/rq0/8/2025/vol/8_20251124.pvol.zip"
STAMP = re.compile(r"8_20251124_(\d{6})\.pvol\.h5$", re.I)
TARGET_HOURS = (5, 10)  # UTC, 15:00–20:00 AEST
MAX_SELECTED = 32

def main(archive, output):
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zin:
        members = []
        for entry in zin.infolist():
            name = Path(entry.filename).name
            match = STAMP.search(name)
            if match:
                members.append((match.group(1), entry))
        members.sort(key=lambda pair: pair[0])
        if not members:
            raise RuntimeError("ZIP contained no 8_20251124_HHMMSS.pvol.h5 files; do not fabricate fixtures.")
        with (output / "all_volume_index.csv").open("w", newline="") as f:
            writer=csv.writer(f)
            writer.writerow(["utc_timestamp","aest_timestamp","archive_member","compressed_bytes","uncompressed_bytes"])
            for clock, entry in members:
                utc=dt.datetime.strptime("20251124"+clock,"%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
                writer.writerow([
                    utc.isoformat(), (utc + dt.timedelta(hours=10)).isoformat(),
                    entry.filename,entry.compress_size,entry.file_size
                ])
        eligible=[(clock,e) for clock,e in members if TARGET_HOURS[0] <= int(clock[:2]) <= TARGET_HOURS[1]]
        if len(eligible)<3:
            raise RuntimeError("Insufficient observed Gympie volumes in 05–10 UTC window.")
        # Retain several genuinely sequential scans across the afternoon
        # for hook-shape continuity checks, plus broad reference samples.
        desired=[
            "050000","053000","054500","055000","055500",
            "060000","060500","063000","064500","065000","065500",
            "070000","070500","073000","074500","075000","075500",
            "080000","080500","083000","084500","085000","085500",
            "090000","090500","093000","100000","103000"
        ]
        selected=[]
        seen=set()
        for target in desired:
            # Choose the closest *actual* scan within six minutes.
            best=min(eligible,key=lambda item:abs(int(item[0][:2])*3600+int(item[0][2:4])*60+int(item[0][4:])-
                (int(target[:2])*3600+int(target[2:4])*60+int(target[4:]))))
            delta=abs(int(best[0][:2])*3600+int(best[0][2:4])*60+int(best[0][4:])-
                (int(target[:2])*3600+int(target[2:4])*60+int(target[4:])))
            if delta<=360 and best[0] not in seen:
                seen.add(best[0]);selected.append(best)
        selected=sorted(selected,key=lambda pair:pair[0])[:MAX_SELECTED]
        for clock, entry in selected:
            filename=Path(entry.filename).name
            # Stream one volume at a time, avoiding 1.19 GB in memory.
            with zin.open(entry) as stream, (output / filename).open("wb") as dest:
                import shutil
                shutil.copyfileobj(stream,dest,1024*1024)
            print("Extracted observed radar volume",clock,"UTC",filename,"bytes",entry.file_size,flush=True)
        manifest={
            "format":"StormTrackerHistoricalAURAResearchV1",
            "source_url":ARCHIVE_URL,
            "radar_id_archive":"8",
            "radar_id_stormtracker":"08",
            "radar_name":"Gympie (Mt Kanigan)",
            "date_utc":"2025-11-24",
            "date_aest":"2025-11-24",
            "event_classification":"Suspected tornadic storm; not official tornado ground truth",
            "archive_volume_count":len(members),
            "afternoon_window_utc":["2025-11-24T05:00:00Z","2025-11-24T11:00:00Z"],
            "selected_volume_count":len(selected),
            "selected_members":[{"utc":"2025-11-24T"+clock[:2]+":"+clock[2:4]+":"+clock[4:]+"Z",
               "filename":Path(entry.filename).name,"bytes":entry.file_size} for clock,entry in selected],
            "license":"AURA Level 1 CC BY 4.0. Soderholm et al (2019), DOI 10.25914/508X-9A12",
            "limitations":"ODIM Level 1 uncorrected radar; not directly comparable to BoM web imagery. No tornado confirmation or alert calibration."
        }
        (output / "source_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
        print("Archived volumes",len(members),"extracted",len(selected),
              "raw selected total bytes",sum(x[1].file_size for x in selected),flush=True)

if __name__ == "__main__":
    if len(sys.argv)!=3:
        raise SystemExit("Usage: extract-aura-gympie-2025.py ARCHIVE.zip OUTPUT_DIR")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
