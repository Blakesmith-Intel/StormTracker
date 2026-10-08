#!/usr/bin/env python3
"""Make bounded research previews and real-scan diagnostics from AURA ODIM H5.

Uses only actual Level 1 observations; not a tornado or wind-gust detector.
Run on extracted Gympie 24-Nov-2025 scan artefact (NOT in production browser).
"""
import csv
import json
import math
import sys
from pathlib import Path

import h5py
import numpy as np
from PIL import Image, ImageDraw

RGB = np.asarray([
    [245,245,255],[180,180,255],[120,120,255],[20,20,255],
    [0,216,195],[0,150,144],[0,102,102],[255,255,0],
    [255,200,0],[255,150,0],[255,100,0],[255,0,0],
    [200,0,0],[120,0,0],[40,0,0]
],dtype=np.uint8)
BOUNDS = np.asarray([12,23,28,31,34,37,40,43,46,49,52,55,58,61,64],dtype=float)

def number(value, default=0):
    try:
        return float(np.asarray(value).reshape(-1)[0])
    except (ValueError,TypeError,IndexError):
        return default

def decode_raw_data(group):
    raw=np.asarray(group["data"])
    attrs=group["what"].attrs
    no_data=number(attrs.get("nodata"),-999999)
    undetect=number(attrs.get("undetect"),-999998)
    gain=number(attrs.get("gain"),1)
    offset=number(attrs.get("offset"),0)
    out=raw.astype(np.float32)*gain+offset
    out[(raw==no_data)|(raw==undetect)]=np.nan
    return out

def field_name(group):
    name=group["what"].attrs.get("quantity",b"")
    if isinstance(name,(bytes,np.bytes_)):return name.decode(errors="replace")
    return str(name)

def dataset_names(root):
    return sorted((key for key in root if key.startswith("dataset") and key[7:].isdigit()),
                  key=lambda key:int(key[7:]))

def fields_by_sweep(root):
    for key in dataset_names(root):
        group=root[key]
        if "where" not in group:continue
        el=number(group["where"].attrs.get("elangle"),99)
        fields={}
        for dk in group:
            if dk.startswith("data") and dk[4:].isdigit() and "data" in group[dk] and "what" in group[dk]:
                fields[field_name(group[dk]).upper()]=group[dk]
        yield el, key, group, fields

def first_sweep(root):
    choices=[]
    for el,key,ds,fields in fields_by_sweep(root):
        reflect=next((fields[p] for p in ("DBZH","TH","DBZ","DBZT","DBTH") if p in fields),None)
        if reflect is None:continue
        vel=next((fields[p] for p in ("VRADH","VRAD","VRADHC","VEL") if p in fields),None)
        choices.append((el,key,ds,reflect,vel,sorted(fields)))
    if not choices:return None
    return sorted(choices,key=lambda row:row[0])[0]

def render_sweep(ref, vel, ds, stamp, output):
    size=430
    radius_m=128000
    where=ds["where"].attrs
    nrays,nbins=ref.shape
    rscale=number(where.get("rscale"),250)
    rstart=number(where.get("rstart"),0)*1000
    az=np.linspace(0,2*np.pi,nrays,endpoint=False,dtype=np.float32)
    if "how" in ds and "startazA" in ds["how"].attrs:
        observed_az=np.asarray(ds["how"].attrs["startazA"])
        if observed_az.size==nrays:az=np.deg2rad(observed_az.astype(np.float32))
    ranges=rstart+(np.arange(nbins,dtype=np.float32)+0.5)*rscale
    x=np.sin(az[:,None])*ranges[None,:]
    y=np.cos(az[:,None])*ranges[None,:]
    col=np.rint((x/radius_m*0.5+0.5)*(size-1)).astype(np.int32)
    row=np.rint((0.5-y/radius_m*0.5)*(size-1)).astype(np.int32)
    onmap=(col>=0)&(col<size)&(row>=0)&(row<size)

    base=np.full((size,size,3),[15,24,31],dtype=np.uint8)
    reflect_valid=onmap&np.isfinite(ref)&(ref>=12)
    if reflect_valid.any():
        classes=np.searchsorted(BOUNDS,np.maximum(ref[reflect_valid],12),side="right")-1
        classes=np.clip(classes,0,14)
        base[row[reflect_valid],col[reflect_valid]]=RGB[classes]
    panel=Image.fromarray(base,"RGB")

    wind=np.full((size,size,3),[15,24,31],dtype=np.uint8)
    if vel is not None and vel.shape==ref.shape:
        velocity_valid=onmap&np.isfinite(vel)&(np.abs(vel)<160)
        velocity_vals=vel[velocity_valid]
        strength=np.clip(np.abs(velocity_vals)/45.0,0,1)
        # Blue toward and orange away: RADAR radial speed in m/s, not gust.
        blues=np.stack([40+30*strength,120+70*strength,145+105*strength],axis=1)
        oranges=np.stack([240*strength+15,145*strength+18,65*strength+30],axis=1)
        rgb=np.where((velocity_vals<0)[:,None],blues,oranges).clip(0,255).astype(np.uint8)
        wind[row[velocity_valid],col[velocity_valid]]=rgb
    panelWind=Image.fromarray(wind,"RGB")
    canvas=Image.new("RGB",(size*2,size+46),(9,17,23))
    canvas.paste(panel,(0,40))
    canvas.paste(panelWind,(size,40))
    pen=ImageDraw.Draw(canvas)
    pen.text((10,10),stamp+" UTC | observed lowest-elevation reflectivity",fill=(240,245,250))
    pen.text((size+10,10),"Measured radial velocity, if present",fill=(240,245,250))
    pen.text((size-160,size+21),"Not a confirmed tornado signature",fill=(255,180,105))
    canvas.save(output,optimize=True)

def inspect(path, previews):
    with h5py.File(path,"r") as h5:
        chosen=first_sweep(h5)
        if chosen is None:
            return {"file":path.name,"error":"No available reflectivity field"}
        angle,name,ds,rgroup,vgroup,field_names=chosen
        reflect=decode_raw_data(rgroup)
        vel=decode_raw_data(vgroup) if vgroup is not None else None
        stamp=path.name.split("_")[2][:6]
        utc_time=stamp[:2]+":"+stamp[2:4]+":"+stamp[4:6]
        render_sweep(reflect,vel,ds,utc_time,previews/(path.stem+".png"))
        rvalid=reflect[np.isfinite(reflect)]
        vvalid=vel[np.isfinite(vel)] if vel is not None else np.empty(0)
        return {
            "file":path.name,"utc_time":utc_time,"sweep":name,
            "lowest_elangle_deg":round(angle,3),
            "fields":field_names,
            "reflectivity_cells":int(rvalid.size),
            "maximum_raw_dbz":round(float(np.max(rvalid)),1) if rvalid.size else None,
            "velocity_cells":int(vvalid.size),
            "maximum_abs_raw_radial_kmh":round(float(np.max(np.abs(vvalid))*3.6),1) if vvalid.size else None,
            "caveat":"Raw Level1 radial samples may be folded, noisy or uncorrected; maximum is not a surface gust."
        }

def main(scan_dir, output):
    output.mkdir(parents=True,exist_ok=True)
    previews=output/"observed_scan_previews"
    previews.mkdir(exist_ok=True)
    results=[]
    scans=sorted(scan_dir.glob("*.pvol.h5"))
    if not scans:raise RuntimeError("No extracted genuine ODIM H5 scans")
    for p in scans:
        try:result=inspect(p,previews)
        except Exception as error:result={"file":p.name,"error":str(error)}
        results.append(result)
        print("SCAN",result.get("utc_time","?"),p.name,
              "dbz",result.get("maximum_raw_dbz"),
              "VRAD",result.get("maximum_abs_raw_radial_kmh"),
              "err",result.get("error",""),flush=True)
    (output/"scan_meteorology.json").write_text(json.dumps(results,indent=2)+"\n")
    with (output/"scan_summary.csv").open("w",newline="") as f:
        cols=["file","utc_time","sweep","lowest_elangle_deg","reflectivity_cells",
              "maximum_raw_dbz","velocity_cells","maximum_abs_raw_radial_kmh","error"]
        writer=csv.DictWriter(f,fieldnames=cols,extrasaction="ignore")
        writer.writeheader();writer.writerows(results)
    successes=[r for r in results if not r.get("error")]
    print("Successfully analysed",len(successes),"/",len(results),"genuine HDF5 volumes")
    if not successes:
        raise RuntimeError("No radar volume decoded; do not report an event detection.")
    (output/"README.txt").write_text(
        "Authentic Gympie 24 November 2025 AURA Level 1 lowest elevation radar research previews.\n"
        "Radar archive: https://dapds00.nci.org.au/thredds/fileServer/rq0/8/2025/vol/8_20251124.pvol.zip\n"
        "Source licence CC BY 4.0; Soderholm et al. (2019), DOI:10.25914/508X-9A12.\n"
        "These are uncorrected radar volumes, spatially sampled into exploratory graphics.\n"
        "Reflectivity (dBZ) and radial Doppler (if present) are measured fields.\n"
        "A radial velocity is not a surface gust; displayed maxima may be aliased/cluttered.\n"
        "This does NOT confirm a hook echo, mesocyclone or tornado. Independent ground truth required.\n"
    )

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: summarize-aura-gympie-2025.py INPUT_DIR OUTPUT_DIR")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
