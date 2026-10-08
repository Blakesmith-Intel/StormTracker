#!/usr/bin/env python3
"""Research-only multi-elevation review of measured Gympie ST0027 Doppler.

Uses only authentic AURA ODIM radial gates, identical-sweep reflectivity QC.
This is NOT automatic mesocyclone, tornado, or damaging-surface-gust detection.
"""
import csv,json,math,runpy,sys
from pathlib import Path
import h5py
import numpy as np

base=Path(__file__).with_name("summarize-aura-gympie-2025.py")
aux=runpy.run_path(str(base))
fields_by_sweep=aux["fields_by_sweep"]
decode=aux["decode_raw_data"]
number=aux["number"]
radar_lat=-25.95733
radar_lon=152.57692
targets={
 "055500":(-26.3899658834032,153.11893430002428),
 "060000":(-26.3899658834032,153.11893430002428),
 "060500":(-26.33625414630085,153.11393877652174),
 "063000":(-26.33625414630085,153.11393877652174)
}
def xy(lat,lon):
    return ((lon-radar_lon)*math.cos(math.radians(radar_lat))*111.32,
            (lat-radar_lat)*111.32)
def coords(sweep,rays,bins,angle):
    attrs=sweep["where"].attrs
    gate_size=number(attrs.get("rscale"),250)/1000
    if gate_size<=0:raise ValueError("Bad polar radial spacing")
    start=number(attrs.get("rstart"),0)
    r=(start+(np.arange(bins,dtype=np.float32)+.5)*gate_size)*math.cos(math.radians(angle))
    az=np.arange(rays,dtype=np.float32)*(360/rays)
    if "how" in sweep:
        for k in ["startazA","stopazA"]:
            sampled=np.asarray(sweep["how"].attrs.get(k,[]))
            if sampled.size==rays:
                az=sampled.astype(np.float32).reshape(-1)
                break
    az=np.deg2rad(az)
    return np.sin(az[:,None])*r[None,:],np.cos(az[:,None])*r[None,:]
def inspect(file,utc,target):
    x0,y0=xy(*target)
    rows=[]
    with h5py.File(file,"r") as f:
        for el,groupname,group,fields in fields_by_sweep(f):
            ref=next((fields[n] for n in ("DBZH","TH","DBZ","DBZT","DBTH") if n in fields),None)
            vel=next((fields[n] for n in ("VRADH","VRAD","VRADHC","VEL") if n in fields),None)
            if ref is None or vel is None:continue
            reflect=decode(ref)
            speed=decode(vel)
            if reflect.shape != speed.shape:continue
            east,north=coords(group,*speed.shape,el)
            radius=np.hypot(east-x0,north-y0)
            valid=(radius<=5)&np.isfinite(speed)&np.isfinite(reflect)&(reflect>=20)
            values=speed[valid]
            inbound=valid&(speed<=-12)
            outbound=valid&(speed>=12)
            neg=np.argwhere(inbound)
            pos=np.argwhere(outbound)
            sep=None
            if len(neg) and len(pos):
                # Small bounded nearest-neighbour search in a true same-tilt
                # measured scan; a nearby sign change is NOT confirmed rotation.
                neg=neg[np.argsort(speed[tuple(neg.T)])[:400]]
                pos=pos[np.argsort(speed[tuple(pos.T)])[::-1][:400]]
                aa=np.stack([east[tuple(neg.T)],north[tuple(neg.T)]],axis=1)
                bb=np.stack([east[tuple(pos.T)],north[tuple(pos.T)]],axis=1)
                dist=np.hypot(aa[:,None,0]-bb[None,:,0],aa[:,None,1]-bb[None,:,1])
                sep=round(float(dist.min()),3)
            rows.append({
                "utc":utc,"filename":file.name,"elevation_deg":round(float(el),2),
                "dataset":groupname,"reflectivity_quantity":str(ref["what"].attrs.get("quantity")),
                "velocity_quantity":str(vel["what"].attrs.get("quantity")),
                "valid_5km_gates":int(values.size),
                "inbound_le_neg12mps":int(len(neg)),
                "outbound_ge_pos12mps":int(len(pos)),
                "min_raw_mps":round(float(values.min()),2) if values.size else None,
                "max_raw_mps":round(float(values.max()),2) if values.size else None,
                "nearest_opposite_gate_km":sep,
                "centroid_lat":target[0],"centroid_lon":target[1],
                "interpretation":"Experimental opposing-sign proximity only; velocities not dealiased or storm-motion corrected."
            })
    return rows
def main(inputdir,outdir):
    outdir.mkdir(parents=True,exist_ok=True)
    results=[]
    for stamp,target in targets.items():
        path=inputdir/("8_20251124_"+stamp+".pvol.h5")
        if not path.is_file():raise RuntimeError("Missing authentic radar file "+path.name)
        rows=inspect(path,"2025-11-24T"+stamp[:2]+":"+stamp[2:4]+":"+stamp[4:]+"Z",target)
        if not rows:raise RuntimeError("No same-elevation DBZH and VRAD for "+stamp)
        results.extend(rows)
        print("TILTS",stamp, "count",len(rows),"first",json.dumps(rows[:2]),flush=True)
    report={
      "format":"AURAGympieST0027MultiElevationResearchV1",
      "real_volumes":list(targets),
      "measured_elevation_count":len(results),
      "reflectivity_gate_qc_dbz":20,
      "signed_velocity_gate_threshold_mps":12,
      "centre_radius_km":5,
      "limitations":"No quality-controlled dealiasing, no independent vortex identification, no tornado confirmation; opposite velocity signs alone do not establish rotation.",
      "data":results
    }
    (outdir/"multi_elevation_ST0027.json").write_text(json.dumps(report,indent=2)+"\n")
    with (outdir/"multi_elevation_ST0027.csv").open("w",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(results[0].keys()))
        writer.writeheader()
        writer.writerows(results)
    print("RESEARCH_TILTS_COMPLETE",len(results),"same-tilt observations across 4 true volume timestamps")

if __name__=="__main__":
    if len(sys.argv)!=3: raise SystemExit("Usage: multi-elevation-gympie-st0027.py AUTHENTIC_H5_DIR OUTPUT_DIR")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
