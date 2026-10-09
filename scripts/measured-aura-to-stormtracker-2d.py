#!/usr/bin/env python3
"""Reproject 2025 Gympie *measured* Level 1 low-level DBZH to 2-D
reflectivity classes for an exploratory replay of the live StormTracker hook
heuristic. No temporal frames or velocity estimates are inferred.
"""
from pathlib import Path
import json,math,runpy,sys
import h5py,numpy as np
helpers=runpy.run_path(str(Path(__file__).with_name("summarize-aura-gympie-2025.py")))
first_sweep=helpers["first_sweep"]
decode_raw_data=helpers["decode_raw_data"]
number=helpers["number"]
BOUNDS=np.asarray([12,23,28,31,34,37,40,43,46,49,52,55,58,61,64],dtype=np.float32)
EARTH_R=6378137.0
LAT=-25.95733
LON=152.57692
SIZE=512
COSLAT=math.cos(math.radians(LAT))
SPAN=128000.0/COSLAT
X0=EARTH_R*math.radians(LON)
Y0=EARTH_R*math.log(math.tan(math.pi/4+math.radians(LAT)/2))
GEOREF=dict(projection="EPSG:3857",minX=X0-SPAN,maxX=X0+SPAN,minY=Y0-SPAN,maxY=Y0+SPAN)
east=(np.arange(SIZE,dtype=np.float32)+.5-SIZE/2)*(2*SPAN/SIZE)*COSLAT
north=(SIZE/2-np.arange(SIZE,dtype=np.float32)-.5)*(2*SPAN/SIZE)*COSLAT
E,N=np.meshgrid(east,north)
BEARING=(np.degrees(np.arctan2(E,N))%360).astype(np.float32)
GROUND_DIST=np.hypot(E,N)

def nearest_az_indices(az):
    sorted_indices=np.argsort(az)
    sorted_angles=np.asarray(az[sorted_indices],dtype=np.float32)%360
    sort_order=np.argsort(sorted_angles)
    sorted_indices=sorted_indices[sort_order]
    sorted_angles=sorted_angles[sort_order]
    extended=np.concatenate([sorted_angles[-1:]-360,sorted_angles,sorted_angles[:1]+360])
    mapped=np.concatenate([sorted_indices[-1:],sorted_indices,sorted_indices[:1]])
    target=BEARING.ravel()
    position=np.searchsorted(extended,target)
    position=np.clip(position,1,len(extended)-1)
    left=position-1
    choose=np.where(np.abs(target-extended[left])<=np.abs(target-extended[position]),left,position)
    return mapped[choose].reshape((SIZE,SIZE))

def convert(path):
    with h5py.File(path,"r") as h5:
        chosen=first_sweep(h5)
        if chosen is None: raise RuntimeError("No DBZH/reflectivity sweep")
        elev,groupname,group,reflect,velocity,fields=chosen
        observed=decode_raw_data(reflect)
        rays,bins=observed.shape
        meta=group["where"].attrs
        rscale=number(meta.get("rscale"),250)
        rstart=number(meta.get("rstart"),0)*1000
        if rscale<=0:raise ValueError("Invalid observed radar bin scale")
        az=np.linspace(0,360,rays,endpoint=False,dtype=np.float32)
        if "how" in group and "startazA" in group["how"].attrs:
            azvals=np.asarray(group["how"].attrs["startazA"])
            if azvals.size==rays:az=np.asarray(azvals,dtype=np.float32).reshape(-1)
        ray=nearest_az_indices(az)
        slant=GROUND_DIST/np.cos(np.deg2rad(elev))
        gate=np.rint((slant-rstart)/rscale-.5).astype(np.int32)
        valid=(gate>=0)&(gate<bins)
        gate=np.clip(gate,0,bins-1)
        sampled=observed[ray,gate]
        valid &= np.isfinite(sampled)&(sampled>=12)&(sampled<100)
        categories=np.zeros((SIZE,SIZE),dtype=np.uint8)
        categories[valid]=np.searchsorted(BOUNDS,sampled[valid],side="right").astype(np.uint8)
        return categories,{"elangle":float(elev),"sweep":groupname,"reflectivity_field":fields,
            "sampled_40_dbz_pixels":int(np.count_nonzero(categories>=7))}

def main(src,dst):
    dst.mkdir(parents=True,exist_ok=True)
    index=[]
    for f in sorted(src.glob("8_20251124_*.pvol.h5")):
        stamp=f.name.split("_")[2][:6]
        utc="2025-11-24T"+stamp[:2]+":"+stamp[2:4]+":"+stamp[4:]+"Z"
        try:
            classes,meta=convert(f)
        except Exception as e:
            raise RuntimeError("Failed measured observation "+f.name+": "+str(e))
        out=f.name+".categories.bin"
        (dst/out).write_bytes(classes.tobytes())
        index.append(dict(observedUtc=utc,width=SIZE,height=SIZE,georef=GEOREF,
            categoriesFile=out,sourceMetadata={"provider":"AURA Level 1", "method":"spatial nearest-gate sampling", "sourceFilename":f.name},statistics=meta))
        print("REAL RASTER",utc,"40+ dBZ pixels",meta["sampled_40_dbz_pixels"],flush=True)
    if len(index)<3:raise RuntimeError("Insufficient genuine scans for hook replay")
    (dst/"observed_frame_index.json").write_text(json.dumps(index,indent=2)+"\n")
    print("Prepared",len(index),"genuine time-distinct AURA scans at 512x512. No temporal interpolation.",flush=True)

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: measured-aura-to-stormtracker-2d.py INPUT OUTPUT")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
