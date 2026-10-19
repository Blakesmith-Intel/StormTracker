#!/usr/bin/env python3
"""Discover observed BoM radar frames over anonymous FTP; publish metadata only.
No imagery is copied/redistributed. Fail closed on stale/missing observations.
"""
import argparse, datetime as dt, ftplib, json, re
from pathlib import Path

SITES=("08","50","66","28","53","93")
PAT=re.compile(r"^IDR(\\d{2})([1-4])\\.T\\.(\\d{12})\\.png$")
UTC=dt.timezone.utc

def discover(names, now, sites=SITES, max_age_minutes=45):
    frames={}; missing=[]
    for site in sites:
        found=[]
        for item in names:
            name=item.rsplit("/",1)[-1];m=PAT.fullmatch(name)
            if not m or m.group(1)!=site or m.group(2)!="3":continue
            try: at=dt.datetime.strptime(m.group(3),"%Y%m%d%H%M").replace(tzinfo=UTC)
            except ValueError:continue
            age=(now-at).total_seconds()/60
            if -5 <=age<=max_age_minutes:
                found.append((at,name))
        found.sort()
        if not found:missing.append(site);continue
        frames[site]=[{"observedUtc":at.isoformat().replace("+00:00","Z"),"filename":name,
          "imageUrl":"https://www.bom.gov.au/radar/"+name,
          "mapFile":"IDR"+site+"3.map"} for at,name in found[-12:]]
    return {"schema":"StormTrackerBoMFtpReflectivityManifestV1",
       "generatedUtc":now.isoformat().replace("+00:00","Z"),
       "siteFrameHistory":frames,"missingOrStaleSites":missing,
       "source":"ftp.bom.gov.au:/anon/gen/radar",
       "sourceKind":"filename-discovery-only","maxSourceAgeMinutes":max_age_minutes}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",required=True);p.add_argument("--listing")
    args=p.parse_args()
    if args.listing:names=Path(args.listing).read_text().splitlines()
    else:
        with ftplib.FTP("ftp.bom.gov.au",timeout=25) as ftp:
            ftp.login("anonymous","stormtracker-data@example.com")
            ftp.cwd("/anon/gen/radar")
            names=ftp.nlst()
    manifest=discover(names,dt.datetime.now(UTC))
    if not manifest["siteFrameHistory"]:
        raise SystemExit("No fresh source frames: refusing to publish empty radar manifest")
    dest=Path(args.out);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({"generatedUtc":manifest["generatedUtc"],
      "sites":{site:len(v) for site,v in manifest["siteFrameHistory"].items()},
      "missing":manifest["missingOrStaleSites"]}))
if __name__=="__main__":main()
