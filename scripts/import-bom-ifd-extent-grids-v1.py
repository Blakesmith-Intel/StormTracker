#!/usr/bin/env python3
"""Convert user-obtained official BoM 2016 IFD extent-grid ZIPs to point-cell JSON.

Input must be BoM's permitted Design Rainfall System Extent downloads. Nothing
is scraped; no fabricated/estimated IFD values are introduced. A cell is
eligible only with source-verified complete probabilities and durations.
"""
import argparse, json, re, zipfile
from pathlib import Path

NAME=re.compile(r"(?:.*/)?catchment_depth_(\d+)min_(20000|10000|05000|02000|01000)aep\.txt\.asc$",re.I)
AEP={"20000":"20","10000":"10","05000":"5","02000":"2","01000":"1"}
def asc_cells(text):
    lines=text.splitlines();meta={};i=0
    while i<len(lines):
        parts=lines[i].split()
        if len(parts)<2 or parts[0].lower() not in {"ncols","nrows","xllcorner","xllcenter","yllcorner","yllcenter","cellsize","nodata_value"}:break
        meta[parts[0].lower()]=float(parts[1]);i+=1
    ncols=int(meta["ncols"]);nrows=int(meta["nrows"]);size=meta["cellsize"]
    if ncols<1 or nrows<1 or ncols*nrows>10000 or abs(size-.025)>1e-7:
        raise ValueError("Unexpected BoM 2016 IFD grid dimensions / cell size")
    xorigin=meta.get("xllcenter",meta.get("xllcorner"))
    yorigin=meta.get("yllcenter",meta.get("yllcorner"))
    if xorigin is None or yorigin is None:raise ValueError("Missing grid origin")
    offset=0 if "xllcenter" in meta else 0.5
    yoffset=0 if "yllcenter" in meta else 0.5
    nodata=meta.get("nodata_value",-9999)
    values=[]
    for line in lines[i:]:
        if line.strip():values.extend(line.split())
    if len(values)!=ncols*nrows:raise ValueError("Unexpected IFD grid cell count")
    for index,item in enumerate(values):
        val=float(item)
        if val==nodata:continue
        if not 0<val<5000:raise ValueError("Unphysical IFD design rainfall depth")
        row=index//ncols;col=index%ncols
        lon=xorigin+(col+offset)*size
        lat=yorigin+(nrows-1-row+yoffset)*size
        if not 109<lon<157 or not -46<lat<-8:raise ValueError("IFD grid outside Australia")
        key=f"{round(lat,4):.4f},{round(lon,4):.4f}"
        yield key,round(lat,4),round(lon,4),val

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--zip",dest="zips",action="append",required=True)
    parser.add_argument("--out",required=True)
    args=parser.parse_args();cells={};count=0;source_files=[]
    for name in args.zips:
        with zipfile.ZipFile(name) as archive:
            for filename in archive.namelist():
                match=NAME.fullmatch(filename)
                if not match:continue
                duration,prob=match.groups();duration=int(duration);aep=AEP[prob]
                if duration<1 or duration>1440:continue
                rows=list(asc_cells(archive.read(filename).decode("utf-8-sig")))
                for key,lat,lon,value in rows:
                    entry=cells.setdefault(key,{"latitude":lat,"longitude":lon,"depthsMmByMinutes":{}})
                    table=entry["depthsMmByMinutes"].setdefault(str(duration),{})
                    if aep in table and abs(table[aep]-value)>0.02:
                        raise ValueError("Conflicting overlapping official IFD grid values: "+key)
                    table[aep]=value
                count+=1;source_files.append(filename)
    if not count:raise SystemExit("No official BoM IFD extent ASCII grid files found")
    # Missing probabilities never receive estimated classifications; hold them
    # out until the full source grids are imported.
    valid={}
    for key,node in cells.items():
        depths={duration:probs for duration,probs in node["depthsMmByMinutes"].items()
                if all(p in probs for p in ["20","10","5","2","1"])}
        if depths:node["depthsMmByMinutes"]=depths;valid[key]=node
    if not valid:raise SystemExit("No cells have all five published IFD probabilities")
    result={"schema":"StormTrackerBoM2016IFDCellsV1",
      "source":"Official BoM 2016 Design Rainfall System downloaded extent ASCII grids",
      "sourceUrl":"https://www.bom.gov.au/water/designRainfalls/revised-ifd/",
      "coverage":"Only cells in imported official IFD extent files",
      "sourceFileCount":count,"sourceFiles":sorted(set(source_files)),
      "cells":valid}
    dest=Path(args.out);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,separators=(",",":"))+"\n")
    print(f"IFD_EXTENT_IMPORT_SUCCESS cells={len(valid)} sourceGrids={count} path={dest}")
if __name__=="__main__":main()
