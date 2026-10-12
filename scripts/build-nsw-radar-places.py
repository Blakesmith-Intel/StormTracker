#!/usr/bin/env python3
"""Build a same-origin, public NSW radar-range place-name catalogue.

NSW Spatial Services' historical TopoBaseMap ArcGIS API omits CORS on its
Feature Layer JSON responses. Browser fetch() therefore cannot consume it on
GitHub Pages, although anonymous GitHub Actions may fetch it normally.
This script prepares a small verified JSON *asset* as part of the static site;
there is no runtime proxy, server-side compute, paid account or user tracking.
"""
import argparse
import datetime as dt
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SOURCE = "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer"
LAYERS = ((0,"city"),(1,"town"),(2,"village"),(3,"locality"))
# Original BoM 256 km radar footprint = 128 km from centre to edge;
# up to sqrt(2)*128 km at the far corners of its square source window.
# Include boundary margin so no settlement disappears at raster edges.
IN_RANGE_KM = 194.0
RADARS = (
    ("Brewarrina",-29.96,146.81),("Moree",-29.50,149.85),
    ("Grafton",-29.62,152.97),
    ("Brisbane (Marburg)",-27.60634,152.54004),
    ("Brisbane (Mt Stapylton)",-27.71773,153.24),
    ("Toowoomba",-27.27406,151.993),
    ("Warrego",-26.44018,147.34913),
)
PAGE_SIZE = 1000
def distance_km(lat,lon,other_lat,other_lon):
    r1,r2=math.radians(lat),math.radians(other_lat)
    dlat=r2-r1;dlon=math.radians(other_lon-lon)
    hav=math.sin(dlat/2)**2+math.cos(r1)*math.cos(r2)*math.sin(dlon/2)**2
    return 12742*math.asin(min(1,math.sqrt(hav)))

def in_radar_range(lat,lon):
    return any(distance_km(lat,lon,rlat,rlon)<=IN_RANGE_KM
               for _,rlat,rlon in RADARS)

def read_layer(layer,kind):
    records=[]
    discarded=0
    for page in range(10):
        params={
            "where":"generalname IS NOT NULL","outFields":(
                "objectid,generalname,population" if kind=="town"
                else "objectid,generalname"
            ),
            "returnGeometry":"true","outSR":"4326",
            "orderByFields":"objectid ASC",
            "resultOffset":str(page*PAGE_SIZE),
            "resultRecordCount":str(PAGE_SIZE),"f":"geojson"
        }
        url=f"{SOURCE}/{layer}/query?{urlencode(params)}"
        request=Request(url,headers={
            "Accept":"application/geo+json,application/json",
            "User-Agent":"StormTracker-public-NSW-label-snapshot/1.0"
        })
        with urlopen(request,timeout=45) as response:
            data=json.load(response)
        if data.get("error"):
            raise RuntimeError(f"NSW layer {layer}: {data['error']}")
        features=data.get("features")
        if not isinstance(features,list):
            raise RuntimeError(f"NSW {kind}: invalid FeatureCollection")
        for f in features:
            p=f.get("properties") or {}
            xy=(f.get("geometry") or {}).get("coordinates") or []
            if len(xy)<2 or not all(isinstance(x,(float,int)) for x in xy[:2]):
                discarded+=1
                continue
            lon,lat=xy[:2]
            if not (140.5<=lon<=159.5 and -38<=lat<=-27.0
                    and in_radar_range(lat,lon)):
                continue
            name=str(p.get("generalname") or "").strip()
            source_id=p.get("objectid",f.get("id"))
            if not name or source_id is None:
                continue
            population=p.get("population") if kind=="town" else 0
            population=population if isinstance(population,int) and population>0 else 0
            # Uppercased NSW source is reformatted to match Queensland labels.
            # Do not infer town positions or invent populations.
            records.append({
                "id":f"nsw-{kind}:{source_id}","name":name.title(),
                "longitude":round(lon,7),"latitude":round(lat,7),
                "population":population,"kind":kind
            })
        if len(features)<PAGE_SIZE or data.get("exceededTransferLimit") is False:
            print(f"{kind}: returned {len(records)} radar-range named coordinates "
                  f"({discarded} records without geometry)",flush=True)
            return records
    raise RuntimeError(f"NSW {kind}: exceeded 10-page cap; refusing partial data")

def build(path):
    output=[]
    for layer,kind in LAYERS:
        output.extend(read_layer(layer,kind))
    if len(output)<60:
        raise RuntimeError(f"Unexpectedly few NSW radar-range places: {len(output)}")
    names={p["name"].casefold() for p in output}
    for anchor in ("moree","brewarrina"):
        if anchor not in names:
            raise RuntimeError(f"NSW radar locality {anchor} absent from generated source")
    if "grafton" not in names:
        print("NOTE: Grafton is absent from geocoded City/Town/Locality point datasets; "
              "do not invent a town coordinate from the nearby radar site",flush=True)
    ids=[p["id"] for p in output]
    if len(ids)!=len(set(ids)):raise RuntimeError("Duplicate NSW source IDs")
    payload={
        "schema":"StormTrackerNSWRadarPlacesV1",
        "source":SOURCE,
        "snapshotUtc":dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rangeKm":IN_RANGE_KM,
        "radarIds":["93","53","28","50","66","108","67"],
        "places":sorted(output,key=lambda p:(p["kind"],p["id"]))
    }
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print(f"NSW radar-range snapshot: {len(output)} verified points, "
          f"{path.stat().st_size} bytes; source: {SOURCE}",flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,default=Path("frontend/data/nsw-radar-places-v1.json"))
    args=parser.parse_args()
    build(args.output)
