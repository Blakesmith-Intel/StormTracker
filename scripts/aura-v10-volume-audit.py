#!/usr/bin/env python3
"""V10 AURA measured radar research: catalog inventory and limited ODIM HDF5 audit.

Never labels raw radial velocity as measured ground gust or verified tornado.
"""
import argparse, csv, hashlib, io, json, math, os, re, sys, zipfile
from pathlib import Path
from urllib.parse import urljoin
import requests

BASE="https://dapds00.nci.org.au/thredds"
EVENTS={"gympie-2025":("08","2025","20251124"),"goldcoast-2023":("66","2023","20231225"),"marburg-2023":("50","2023","20231225")}

def get(url):
    response=requests.get(url,timeout=35)
    response.raise_for_status()
    return response

def catalog_candidates(radar,year,day):
    # Site numbers may be unpadded in the archive URL even when product filenames are padded.
    for site in (str(int(radar)),radar):
        url=f"{BASE}/catalog/rq0/{site}/{year}/vol/catalog.xml"
        try:
            r=get(url)
            from xml.etree import ElementTree as ET
            root=ET.fromstring(r.content)
            names=[x.attrib.get("name","") for x in root.iter() if x.tag.endswith("dataset")]
            matches=[x for x in names if day in x and x.endswith(".pvol.zip")]
            if matches:return url,matches
        except Exception as exc:
            print(f"Catalog attempt {url}: {type(exc).__name__}: {exc}",file=sys.stderr)
    return None,[]

def decode_volume(payload,filename,sha):
    import h5py, numpy as np
    out={"filename":filename,"sha256":sha,"sweeps":[]}
    with h5py.File(io.BytesIO(payload),"r") as h5:
        what=h5.get("what")
        out["root_what"]={k:str(v) for k,v in (what.attrs.items() if what is not None else [])}
        for key in sorted(h5):
            if not re.fullmatch(r"dataset\d+",key):continue
            ds=h5[key]; scan={"dataset":key,"radial_fields":[]}
            scan["where"]={k:str(v) for k,v in ds["where"].attrs.items()} if "where" in ds else {}
            for field in sorted(ds):
                if not re.fullmatch(r"data\d+",field):continue
                g=ds[field]
                if "what" not in g or "data" not in g:continue
                attrs=g["what"].attrs
                def attr(k,default=None):
                    v=attrs.get(k,default)
                    return v.decode(errors="replace") if isinstance(v,bytes) else (v.item() if hasattr(v,"item") else v)
                q=str(attr("quantity",""))
                if not q.upper().startswith(("VRAD","V")):continue
                gain=float(attr("gain",1));offset=float(attr("offset",0))
                nodata=attr("nodata");undetect=attr("undetect")
                raw=g["data"][:]
                valid=np.isfinite(raw)
                if nodata is not None:valid &= raw!=nodata
                if undetect is not None:valid &= raw!=undetect
                physical=raw[valid].astype("float64")*gain+offset
                physical=physical[np.isfinite(physical)]
                scan["radial_fields"].append({"quantity":q,"count":int(physical.size),
                   "gain":gain,"offset":offset,"nodata":str(nodata),"undetect":str(undetect),
                   "minimum_native_units":float(physical.min()) if physical.size else None,
                   "maximum_native_units":float(physical.max()) if physical.size else None,
                   "velocity_units_assumed":"NOT VERIFIED — require ODIM quantity and site metadata review",
                   "dealiased":False,"circulation_candidate_status":"NOT CLASSIFIED"})
            out["sweeps"].append(scan)
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--event",choices=EVENTS,required=True)
    ap.add_argument("--max-files",type=int,default=3)
    ap.add_argument("--target-utc",default=None,help="HH:MM UTC; prioritise consecutive volumes around event")
    ap.add_argument("--output",default="aura-evidence")
    args=ap.parse_args()
    radar,year,day=EVENTS[args.event]
    dest=Path(args.output);dest.mkdir(parents=True,exist_ok=True)
    report={"event":args.event,"radar":radar,"day":day,"source":"NCI AURA Level 1",
            "archive_confirmed":False,"volume_inspected":False,"scans":[],
            "candidates":[],"warning":"NO TORNADO/WIND DETERMINATION; raw velocity may be aliased"}
    try:
        url,names=catalog_candidates(radar,year,day)
        report["catalog_url"]=url;report["matching_archives"]=names
        if not names:raise RuntimeError("No verified matching archive in accessible THREDDS catalog")
        report["archive_confirmed"]=True
        from xml.etree import ElementTree as ET
        root=ET.fromstring(get(url).content)
        dataset=next((e for e in root.iter() if e.attrib.get("name") in names and "urlPath" in e.attrib),None)
        if dataset is None:raise RuntimeError("No downloadable THREDDS dataset urlPath")
        download=BASE+"/fileServer/"+dataset.attrib["urlPath"].lstrip("/")
        response=get(download)
        # Bound the research job: no large unbounded archive downloads.
        if len(response.content)>500_000_000:raise RuntimeError("Archive exceeds 500 MB research cap")
        report["archive_sha256"]=hashlib.sha256(response.content).hexdigest()
        report["archive_url"]=download
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            members=[n for n in z.namelist() if n.endswith((".pvol.h5",".h5"))]
            if args.target_utc:
                hhmm=args.target_utc.replace(":","")
                if not re.fullmatch(r"[0-2][0-9][0-5][0-9]",hhmm) or int(hhmm[:2])>=24:
                    raise ValueError("--target-utc must be HH:MM in UTC")
                target=int(hhmm[:2])*3600+int(hhmm[2:])*60
                def distance(name):
                    match=re.search(r"_(\\d{6})\\.pvol\\.h5$",name)
                    if not match:return 999999
                    t=match.group(1)
                    seconds=int(t[:2])*3600+int(t[2:4])*60+int(t[4:])
                    return abs(seconds-target)
                members=sorted(members,key=distance)
            else:
                members=sorted(members)
            report["volume_count"]=len(members)
            report["selection_method"]="nearest-observed-UTC" if args.target_utc else "first-by-filename"
            report["target_utc"]=args.target_utc
            for n in members[:max(0,min(args.max_files,5))]:
                data=z.read(n)
                report["scans"].append(decode_volume(data,n,hashlib.sha256(data).hexdigest()))
        report["volume_inspected"]=bool(report["scans"])
    except Exception as exc:
        report["error"]=f"{type(exc).__name__}: {exc}"
    (dest/f"{args.event}.json").write_text(json.dumps(report,indent=2,default=str)+"\n")
    print(json.dumps({k:report.get(k) for k in ("event","archive_confirmed","volume_inspected","error")},indent=2))
    if not report["volume_inspected"]:sys.exit(2)

if __name__=="__main__":main()
