#!/usr/bin/env python3
"""Stage genuine BoM FTP observations on a metadata-and-PNG-only feed branch.

Never request a guessed scan. Never use www.bom.gov.au/radar HTTPS.
Original PNG bytes are preserved unchanged, size/PNG/IHDR checked. Frames and
the manifest are staged atomically for the publisher workflow.
"""
import argparse
import datetime as dt
import ftplib
import hashlib
import json
import re
import shutil
import struct
from pathlib import Path

URL="https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/"
UTC=dt.timezone.utc
NAME=re.compile(r"^IDR(\d{2,3})3\.T\.(\d{12})\.png$")
PNG=b"\x89PNG\r\n\x1a\n"

def inspect(blob, filename):
    if len(blob)<100 or len(blob)>1_000_000 or blob[:8]!=PNG:
        raise ValueError("Invalid authentic radar PNG: "+filename)
    if blob[12:16]!=b"IHDR":
        raise ValueError("Missing PNG IHDR: "+filename)
    width,height=struct.unpack(">II",blob[16:24])
    if (width,height)!=(512,512):
        raise ValueError("Unexpected radar image dimensions: "+filename)
    return hashlib.sha256(blob).hexdigest()

def stage(manifest, out, now, ftp, reuse_dir=None, prior_manifest=None):
    # Immutable authentic source frames already byte-verified in our archive
    # are reused instead of re-downloading all seven observations per radar.
    # Their saved digest is independently rechecked before being trusted.
    prior_manifest=prior_manifest or {}
    prior_hashes={
        rec["filename"]:rec["sha256"]
        for group in prior_manifest.get("siteFrameHistory",{}).values()
        for rec in group if rec.get("sha256") and rec.get("filename")
    }
    reused=0
    downloaded=0
    site_frames={}
    missing=set(manifest.get("missingOrStaleSites",[]))
    for site,records in manifest["siteFrameHistory"].items():
        valid=[]
        if not manifest.get("siteGeoreference",{}).get(site,{}).get("controlPoints"):
            missing.add(site);continue
        for item in records[-7:]:
            name=item["filename"]
            match=NAME.fullmatch(name)
            if not match or match.group(1)!=site:continue
            at=dt.datetime.strptime(match.group(2),"%Y%m%d%H%M").replace(tzinfo=UTC)
            age=(now-at).total_seconds()/60
            if not -5<=age<=45:continue
            try:
                blob=None
                if reuse_dir and name in prior_hashes:
                    archived=Path(reuse_dir)/name
                    if archived.is_file():
                        candidate=archived.read_bytes()
                        if inspect(candidate,name)==prior_hashes[name]:
                            blob=candidate
                            reused+=1
                if blob is None:
                    fragments=[]
                    ftp.retrbinary("RETR "+name,fragments.append,blocksize=65536)
                    blob=b"".join(fragments)
                    downloaded+=1
                sha=inspect(blob,name)
            except (ftplib.all_errors,ValueError,TimeoutError,EOFError) as err:
                print("FTP_IMAGE_UNAVAILABLE",site,name,type(err).__name__,str(err)[:180])
                continue
            target=out/"frames"/name
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(blob)
            valid.append({"filename":name,
              "observedUtc":item["observedUtc"],
              "imageUrl":URL+"frames/"+name,
              "sha256":sha,
              "sourceFile":"/anon/gen/radar/"+name,
              "mapFile":item["mapFile"]})
        if valid:site_frames[site]=valid
        else:missing.add(site)
    if len(site_frames)<3:
        raise RuntimeError("No verified multi-site radar PNG coverage; refusing to publish")
    manifest["siteFrameHistory"]=site_frames
    manifest["missingOrStaleSites"]=sorted(missing)
    manifest["sourceKind"]="ftp-original-png-byte-identical-static-archive"
    manifest["imageDelivery"]="raw.githubusercontent.com, no BoM HTTPS mirror"
    manifest["stagedUtc"]=now.isoformat().replace("+00:00","Z")
    (out/"manifest.json").write_text(json.dumps(manifest,separators=(",",":"))+"\n")
    print("FTP_PNG_STAGE_PASS",json.dumps({"sites":{site:len(frames) for site,frames in site_frames.items()},
      "files":sum(map(len,site_frames.values())),
      "totalBytes":sum(p.stat().st_size for p in (out/"frames").glob("*.png")),
      "missing":sorted(missing),"reusedByteVerified":reused,
      "newFtpDownloads":downloaded}))
    return manifest

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",required=True)
    p.add_argument("--out",required=True)
    p.add_argument("--reuse-dir")
    p.add_argument("--prior-manifest")
    a=p.parse_args()
    out=Path(a.out)
    if out.exists():shutil.rmtree(out)
    out.mkdir(parents=True)
    manifest=json.loads(Path(a.manifest).read_text())
    if manifest.get("schema")!="StormTrackerBoMFtpReflectivityManifestV1":
        raise ValueError("Unexpected source discovery schema")
    with ftplib.FTP("ftp.bom.gov.au",timeout=25) as ftp:
        ftp.login("anonymous","stormtracker-feed@example.com")
        ftp.cwd("/anon/gen/radar")
        prior=json.loads(Path(a.prior_manifest).read_text()) if a.prior_manifest else {}
        stage(manifest,out,dt.datetime.now(UTC),ftp,
              reuse_dir=Path(a.reuse_dir) if a.reuse_dir else None,
              prior_manifest=prior)

if __name__=="__main__":main()
