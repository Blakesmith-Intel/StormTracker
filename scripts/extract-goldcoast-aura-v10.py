#!/usr/bin/env python3
"""Measured AURA Level-1 Christmas 2023 Gold Coast replay data extraction.

Uses HTTP byte-range access to a daily archive and only downloads real selected
ODIM HDF5 scans. No synthetic imagery, storm history, or surface gust inference.
NOT part of browser production. Each radar is analysed independently.
"""
from __future__ import annotations
from pathlib import Path
import datetime as dt
import json
import math
import re
import runpy
import sys
import numpy as np
import h5py
from remotezip import RemoteZip

HERE=Path(__file__).resolve().parent
HELP=runpy.run_path(str(HERE/"summarize-aura-gympie-2025.py"))
first_sweep=HELP["first_sweep"]
decode=HELP["decode_raw_data"]
number=HELP["number"]
BOUNDS=np.asarray([12,23,28,31,34,37,40,43,46,49,52,55,58,61,64],dtype=np.float32)
EARTH_R=6378137.0
RADAR_SITES={"66":(-27.71773,153.24),"50":(-27.60634,152.54004)}
CENTER_LAT=-27.80
CENTER_LON=153.08
SIZE=512
SPAN=128000/math.cos(math.radians(CENTER_LAT))
X0=EARTH_R*math.radians(CENTER_LON)
Y0=EARTH_R*math.log(math.tan(math.pi/4+math.radians(CENTER_LAT)/2))
GEOREF={"projection":"EPSG:3857","minX":X0-SPAN,"maxX":X0+SPAN,
    "minY":Y0-SPAN,"maxY":Y0+SPAN}
COLUMNS=np.arange(SIZE,dtype=np.float32)
ROWS=np.arange(SIZE,dtype=np.float32)
XPIX=GEOREF["minX"]+(COLUMNS+.5)*(GEOREF["maxX"]-GEOREF["minX"])/SIZE
YPIX=GEOREF["maxY"]-(ROWS+.5)*(GEOREF["maxY"]-GEOREF["minY"])/SIZE
# Report the genuine archive date/local window, not an interpolated timeline.
WINDOW_START="093000"
WINDOW_END="120000"
MAX_SCANS_PER_RADAR=36


def parse_timestamp(info,radar):
    match=re.search(rf"(?:^|/){radar}_20231225_(\d{{6}})\.pvol\.h5$",info.filename,re.I)
    return match.group(1) if match else None


def select_scans(members,radar):
    stamped=sorted((parse_timestamp(x,radar),x) for x in members if parse_timestamp(x,radar))
    within=[(stamp,entry) for stamp,entry in stamped if WINDOW_START<=stamp<=WINDOW_END]
    # Native source timestamps remain unchanged; no approximation to 5 min.
    chosen=within[:MAX_SCANS_PER_RADAR]
    if len(chosen)<8:raise RuntimeError(f"Too few authentic {radar} archive scans in Christmas event: {len(chosen)}")
    return chosen,len(stamped)


def regrid(radar,filename,h5):
    selected=first_sweep(h5)
    if selected is None:raise ValueError("No reflectivity sweep")
    elev,ds_name,group,ref_group,velocity_group,fields=selected
    if velocity_group is None:raise ValueError("No same-elevation velocity field")
    dbz=decode(ref_group)
    wind=decode(velocity_group)
    if dbz.shape!=wind.shape:raise ValueError("Reflectivity and radial velocity sweeps differ in dimensions")
    rays,bins=dbz.shape
    attrs=group["where"].attrs
    step=number(attrs.get("rscale"),250)
    start=number(attrs.get("rstart"),0)*1000
    if step<=0:raise ValueError("Invalid native radar range resolution")
    native_lat,native_lon=RADAR_SITES[radar]
    if "where" in h5:
        native_lat=number(h5["where"].attrs.get("lat"),native_lat)
        native_lon=number(h5["where"].attrs.get("lon"),native_lon)
    # Meter-scale Mercator grid, converted to approximate horizontal physical
    # offsets at each radar's latitude. Identical projection for both sources.
    mx=EARTH_R*math.radians(native_lon)
    my=EARTH_R*math.log(math.tan(math.pi/4+math.radians(native_lat)/2))
    local_cos=math.cos(math.radians(native_lat))
    e=(XPIX-mx)[None,:]*local_cos
    n=(YPIX-my)[:,None]*local_cos
    bearing=(np.degrees(np.arctan2(e,n))%360).astype(np.float32)
    ground_dist=np.hypot(e,n)
    az=np.linspace(0,360,rays,endpoint=False,dtype=np.float32)
    if "how" in group and "startazA" in group["how"].attrs:
        observed_az=np.asarray(group["how"].attrs["startazA"])
        if observed_az.size==rays:az=observed_az.astype(np.float32).ravel()
    sorted_idx=np.argsort(az)
    sorted_az=az[sorted_idx]
    sorted_idx=sorted_idx[np.argsort(sorted_az)]
    sorted_az=np.sort(sorted_az)
    extended=np.concatenate([sorted_az[-1:]-360,sorted_az,sorted_az[:1]+360])
    mapped=np.concatenate([sorted_idx[-1:],sorted_idx,sorted_idx[:1]])
    flat=bearing.ravel()
    pos=np.clip(np.searchsorted(extended,flat),1,len(extended)-1)
    left=pos-1
    closest=np.where(abs(flat-extended[left])<=abs(flat-extended[pos]),left,pos)
    ray=mapped[closest].reshape((SIZE,SIZE))
    slant=ground_dist/math.cos(math.radians(elev))
    gate=np.rint((slant-start)/step-.5).astype(np.int32)
    valid=(gate>=0)&(gate<bins)
    gate=np.clip(gate,0,bins-1)
    reflect=dbz[ray,gate]
    radial=wind[ray,gate]*3.6
    measured=valid&np.isfinite(reflect)&(reflect>=12)&(reflect<100)
    categories=np.zeros((SIZE,SIZE),dtype=np.uint8)
    categories[measured]=np.searchsorted(BOUNDS,reflect[measured],side="right").astype(np.uint8)
    # Strict raw radar gate QC for research-scale radial samples. Raw velocities
    # beyond public-image range cannot be interpreted as ground-level gusts.
    good=valid&np.isfinite(reflect)&(reflect>=40)&np.isfinite(radial)&(
      np.abs(radial)<=70)&(radial!=0)
    sampled=np.zeros((SIZE,SIZE),dtype=bool)
    sampled[::2,::2]=True
    yy,xx=np.nonzero(good&sampled)
    samples=[]
    xs=XPIX[xx];ys=YPIX[yy]
    lons=xs/EARTH_R*180/math.pi
    lats=(2*np.arctan(np.exp(ys/EARTH_R))-math.pi/2)*180/math.pi
    for i in range(len(yy)):
        samples.append({
          "latitude":round(float(lats[i]),6),
          "longitude":round(float(lons[i]),6),
          "velocity_kmh":round(float(radial[yy[i],xx[i]]),2)
        })
    clock=parse_timestamp(type("Item",(),{"filename":filename}),radar)
    if clock is None:raise ValueError("Timestamp not found in native ODIM file")
    observed=f"2023-12-25T{clock[:2]}:{clock[2:4]}:{clock[4:]}Z"
    meta={"observedUtc":observed,"width":SIZE,"height":SIZE,"georef":GEOREF,
      "sourceMetadata":{"provider":"AURA Level-1 measured ODIM",
        "sourceFilename":Path(filename).name,
        "spatialMethod":"nearest actual polar radar gate"},
      "statistics":{"sampled_40_dbz_pixels":int(np.count_nonzero(categories>=7)),
        "radial_sample_count":len(samples),
        "lowest_elevation_degrees":float(elev),"native_radar_latitude":native_lat,
        "native_radar_longitude":native_lon}}
    return categories, {"radarId":radar,"observedUtc":observed,"samples":samples,
      "timeBasis":"AURA original ODIM timestamp",
      "quality_control":{"minReflectivityDbz":40,"maxAbsRawRadialKmh":70,
        "nearestGateSpatialSampling":True,"dealiasing":False,"surfaceGust":False,
        "samplePixelStride":2}},meta


def main(destination,radars):
    destination.mkdir(parents=True,exist_ok=True)
    manifest=[]
    for radar in radars:
        if radar not in RADAR_SITES:raise RuntimeError("Unsupported radar "+radar)
        source=f"https://dapds00.nci.org.au/thredds/fileServer/rq0/{radar}/2023/vol/{radar}_20231225.pvol.zip"
        where=destination/radar
        where.mkdir(exist_ok=True)
        with RemoteZip(source) as archive:
            selected,total=select_scans(archive.infolist(),radar)
            frames=[]
            for stamp,entry in selected:
                path=where/Path(entry.filename).name
                # Materialize one real HDF5 volume at a time, avoiding whole-day download.
                with archive.open(entry) as stream,open(path,"wb") as target:
                    import shutil
                    shutil.copyfileobj(stream,target,1024*1024)
                try:
                    with h5py.File(path,"r") as h5:
                        categories,record,meta=regrid(radar,path.name,h5)
                finally:
                    path.unlink(missing_ok=True)
                filename=path.name+".categories.bin"
                (where/filename).write_bytes(categories.tobytes())
                (where/(path.name+".doppler.json")).write_text(json.dumps(record,separators=(",",":"))+"\n")
                frames.append({**meta,"categoriesFile":filename})
                print("MEASURED_GOLDCOAST",radar,meta["observedUtc"],
                      "40dBZ",meta["statistics"]["sampled_40_dbz_pixels"],
                      "velocity_gates",len(record["samples"]),flush=True)
            (where/"observed_frame_index.json").write_text(json.dumps(frames,indent=2)+"\n")
            manifest.append({
              "radar":radar,"source":source,"available_day_scans":total,
              "event_replay_scans":len(frames),
              "first":frames[0]["observedUtc"],"last":frames[-1]["observedUtc"],
              "files":[x["sourceMetadata"]["sourceFilename"] for x in frames],
              "licence":"AURA Level 1 CC BY 4.0; Soderholm et al (2019)",
              "limitations":"Uncorrected lowest elevation source, velocity aliases possible. Not a surface gust or tornado proof."
            })
    (destination/"source_manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("GOLDCOAST_MEASURED_SOURCE_MANIFEST",json.dumps([
      {k:v for k,v in x.items() if k!="files"} for x in manifest]),flush=True)


if __name__=="__main__":
    if len(sys.argv)<3:raise SystemExit("Usage: extract-goldcoast-aura-v10.py OUT RADAR_ID [RADAR_ID...]")
    main(Path(sys.argv[1]),sys.argv[2:])
