#!/usr/bin/env python3
"""Research-only Level-1 radial-velocity assessment around historic ST0027.

Actual radar gates from NCI AURA 8_20251124.pvol.zip, not web-image colours.
No velocity dealiasing or tornado declaration. Apply reflectivity QC (>=20dBZ)
and radar gate proximity to two flagged shape centres. Do not mix elevations.
"""
from __future__ import annotations
import csv
import json
import math
import sys
from pathlib import Path

import h5py
import numpy as np
from PIL import Image, ImageDraw

# Source data and coordinate conventions follow existing measured AURA scripts.
MOD = __import__("runpy").run_path(str(Path(__file__).with_name("summarize-aura-gympie-2025.py")))
fields_by_sweep = MOD["fields_by_sweep"]
decode_raw_data = MOD["decode_raw_data"]
number = MOD["number"]

RADAR_LAT = -25.95733
RADAR_LON = 152.57692
# ST0027 two consecutive experimental *reflectivity-shape* detections, not
# a verified mesocyclone or confirmed tornado. AEST 16:00 and 16:05.
CANDIDATES = {
    "20251124_060000": (-26.3899658834032, 153.11893430002428),
    "20251124_060500": (-26.33625414630085, 153.11393877652174)
}
MID = ((CANDIDATES["20251124_060000"][0] + CANDIDATES["20251124_060500"][0]) / 2,
       (CANDIDATES["20251124_060000"][1] + CANDIDATES["20251124_060500"][1]) / 2)
VIEW_KM = 13
RADII_KM = [3, 5, 8, 12]
REFLECTIVITY_GATE_MIN = 20.0
SPEED_MIN = 12.0
MAX_DISPLAY_MPS = 55.0

def xy_km(latitude, longitude):
    lat_r = math.radians(RADAR_LAT)
    x = (longitude - RADAR_LON) * math.cos(lat_r) * 111.32
    y = (latitude - RADAR_LAT) * 111.32
    return x, y

def radar_gate_positions(group, n_rays, n_bins):
    """Actual (ray, gate) positions in local tangent-plane km."""
    where = group["where"].attrs
    step_km = number(where.get("rscale"),250) / 1000
    start_km = number(where.get("rstart"),0)
    elangle = number(where.get("elangle"),0)
    if step_km <= 0:
        raise ValueError("Invalid range scale")
    azimuth = np.linspace(0,360,n_rays,endpoint=False,dtype=np.float32)
    if "how" in group:
        # ODIM 'startazA' explicitly describes per-ray acquisition azimuth.
        a = np.asarray(group["how"].attrs.get("startazA",[]))
        if a.size == n_rays:
            azimuth = a.astype(np.float32).reshape(-1)
        else:
            a = np.asarray(group["how"].attrs.get("stopazA",[]))
            if a.size == n_rays:
                azimuth = a.astype(np.float32).reshape(-1)
    range_km = (start_km + (np.arange(n_bins,dtype=np.float32)+.5)*step_km) * math.cos(math.radians(elangle))
    a = np.deg2rad(azimuth)[:,None]
    east = np.sin(a)*range_km[None,:]
    north = np.cos(a)*range_km[None,:]
    return east, north, elangle, float(step_km)

def find_same_sweep(radar):
    options=[]
    for elevation, name, group, fields in fields_by_sweep(radar):
        refl = next((fields[f] for f in ("DBZH","TH","DBZ","DBZT","DBTH") if f in fields),None)
        vel = next((fields[f] for f in ("VRADH","VRAD","VRADHC","VEL") if f in fields),None)
        if refl is not None and vel is not None:
            options.append((elevation,name,group,refl,vel,sorted(fields)))
    return min(options,key=lambda item:item[0]) if options else None

def descriptive_velocity(vel, valid, radius_mask):
    vals=vel[valid & radius_mask]
    if not vals.size:
        return dict(gates=0,negative_gates=0,positive_gates=0)
    neg=vals[vals<=-SPEED_MIN]
    pos=vals[vals>=SPEED_MIN]
    return {
       "gates": int(vals.size),
       "negative_gates": int(neg.size),
       "positive_gates": int(pos.size),
       "raw_min_mps": round(float(vals.min()),2),
       "raw_max_mps": round(float(vals.max()),2),
       "negative_p10_mps": round(float(np.percentile(neg,10)),2) if neg.size else None,
       "positive_p90_mps": round(float(np.percentile(pos,90)),2) if pos.size else None,
       "raw_peak_to_peak_mps": round(float(vals.max()-vals.min()),2),
       "note":"Opposing signs in a large area alone DO NOT prove a velocity couplet"
    }

def plot_field(east, north, data, quality, centre, title, out):
    size=540
    latitude,longitude=centre
    c_east,c_north=xy_km(latitude,longitude)
    de=east-c_east
    dn=north-c_north
    px=np.rint((.5+de/(VIEW_KM*2))*(size-1)).astype(np.int32)
    py=np.rint((.5-dn/(VIEW_KM*2))*(size-1)).astype(np.int32)
    inside=quality & (px>=0)&(px<size)&(py>=0)&(py<size)
    base=np.full((size,size,3),[11,20,29],np.uint8)
    values=data[inside]
    if "Velocity" in title:
        speed=np.clip(np.abs(values)/MAX_DISPLAY_MPS,0,1)
        neg=np.stack([25+20*speed,70+100*speed,110+135*speed],axis=1)
        pos=np.stack([130+120*speed,63+120*speed,20+23*speed],axis=1)
        color=np.where((values<0)[:,None],neg,pos).astype(np.uint8)
    else:
        n=np.clip((values-12)/55,0,1)
        color=np.stack([30+220*n,95+125*(1-n),210*(1-n)+20],axis=1).astype(np.uint8)
    base[py[inside],px[inside]]=color
    image=Image.fromarray(base,"RGB")
    d=ImageDraw.Draw(image)
    center=size//2
    for radius in (3,5,8,12):
        p=radius/VIEW_KM*(size/2)
        d.ellipse((center-p,center-p,center+p,center+p),outline=(130,145,149),width=1)
    d.line((center-8,center,center+8,center),fill=(255,225,175),width=2)
    d.line((center,center-8,center,center+8),fill=(255,225,175),width=2)
    d.text((10,10),title,fill=(250,250,250))
    d.text((10,size-20),"Raw radar gates; >=20 dBZ QC; white cross = ST0027 shape marker",fill=(250,250,250))
    image.save(out,optimize=True)

def evaluate(path,out):
    stem=path.stem
    hhmm=stem.split("_")[-1][:4]
    key="20251124_"+stem.split("_")[-1][:6]
    target=CANDIDATES.get(key,MID)
    with h5py.File(path,"r") as radar:
        option=find_same_sweep(radar)
        if option is None:
            return {"file":path.name,"error":"No co-elevation reflectivity and radial-velocity fields"}
        el,name,group,ref_field,vel_field,all_fields=option
        refl=decode_raw_data(ref_field)
        vel=decode_raw_data(vel_field)
        if refl.shape!=vel.shape:
            return {"file":path.name,"error":"Reflectivity/velocity dimensions differ in same sweep"}
        east,north,actual_el,gate_step=radar_gate_positions(group,*refl.shape)
        e0,n0=xy_km(*target)
        distance=np.hypot(east-e0,north-n0)
        quality=np.isfinite(refl)&np.isfinite(vel)&(refl>=REFLECTIVITY_GATE_MIN)
        result={
          "observed_utc":"2025-11-24T"+key[-6:-4]+":"+key[-4:-2]+":"+key[-2:]+"Z",
          "observed_aest":key[-6:-4]+":"+key[-4:-2]+" +10 hours",
          "source_volume":path.name,
          "experiment_track_id":"ST0027",
          "shape_candidate_at_this_timestamp":key in CANDIDATES,
          "centroid_used_lat_lon":[round(target[0],6),round(target[1],6)],
          "scan_elevation_deg":round(float(actual_el),3),
          "sweep":name,
          "all_fields":all_fields,
          "gate_range_step_m":round(gate_step*1000),
          "reflectivity_qc_dbz_min":REFLECTIVITY_GATE_MIN,
          "opposing_sign_threshold_mps":SPEED_MIN,
          "unfiltered_raw_velocity_max_abs_mps":round(float(np.nanmax(np.abs(vel))),3),
          "radar_to_centroid_km":round(math.hypot(e0,n0),2),
          "source_velocity_quantity":str(vel_field["what"].attrs.get("quantity","?")),
          "nyquist_or_wavelength_metadata": {
              groupname+"."+str(key):str(val)[:150]
              for groupname,g in (("how",radar.get("how")),("dataset_how",group.get("how")),("what",radar.get("what")))
              if g is not None for key,val in g.attrs.items()
              if any(word in str(key).lower() for word in ("nyquist","ni","wavelength","prf","pulse","radar"))
          },
          "neighbourhoods_km": {}
        }
        for rad in RADII_KM:
            result["neighbourhoods_km"][str(rad)]=descriptive_velocity(vel,quality,distance<=rad)
        # A "compact opposite-sign support" metric is only an exploratory
        # spatial co-location test: nearest gate distance between >=12m/s
        # positive and negative gates in <=5km of the flagged centroid.
        mask=quality & (distance<=5)
        inbound=np.argwhere(mask & (vel<=-SPEED_MIN))
        outbound=np.argwhere(mask & (vel>=SPEED_MIN))
        record=dict(negative_count=int(len(inbound)),positive_count=int(len(outbound)),
                    nearest_opposite_sign_km=None,close_pairs_under_2km=None,
                    limitation="Compact opposing signs are NOT sufficient for mesocyclonic rotation: folding, storm motion and clutter unresolved")
        # Bounded sample nearest neighbour (grid-based exact metric for native
        # radar gate positions), never infer missing radar gates.
        if len(inbound) and len(outbound):
            pos=np.stack([east[tuple(outbound.T)],north[tuple(outbound.T)]],axis=1)
            neg=np.stack([east[tuple(inbound.T)],north[tuple(inbound.T)]],axis=1)
            # Sort by raw intensity to prevent massive all-pairs memory.
            ip=np.argsort(vel[tuple(outbound.T)])[::-1][:800]
            im=np.argsort(vel[tuple(inbound.T)])[:800]
            dx=pos[ip,None,0]-neg[None,im,0]
            dy=pos[ip,None,1]-neg[None,im,1]
            d=np.hypot(dx,dy)
            record["nearest_opposite_sign_km"]=round(float(d.min()),3)
            record["close_pairs_under_2km"]=int(np.count_nonzero(d<=2.0))
        result["compact_opposite_sign_support"]=record
        should_plot = key in CANDIDATES or key in ("20251124_055500","20251124_061000")
        if should_plot:
            plot_field(east,north,vel,quality,target,"Velocity "+key+" UT at same low-level sweep",out/(key+"_radial_velocity.png"))
            plot_field(east,north,refl,quality,target,"Reflectivity "+key+" UT",out/(key+"_reflectivity.png"))
        return result

def main(src,dst):
    dst.mkdir(parents=True,exist_ok=True)
    paths=sorted(src.glob("8_20251124_*.pvol.h5"))
    if not paths:raise RuntimeError("No real historical HDF5 volumes; cannot assess Doppler")
    rows=[]
    for p in paths:
        key=p.stem.split("_")[-1][:6]
        if "053000" <= key <= "063000":
            result=evaluate(p,dst)
            rows.append(result)
            print("DOPPLER_QC",result["observed_utc"],
                  "5km",json.dumps(result.get("neighbourhoods_km",{}).get("5",{})),
                  "spatial_support",json.dumps(result.get("compact_opposite_sign_support",{})),
                  flush=True)
    selected=[r for r in rows if r.get("shape_candidate_at_this_timestamp")]
    if len(selected)!=2:
        raise RuntimeError("Missing one or more actual timestamp-matched ST0027 scan(s)")
    report={
       "analysis_name":"StormTrackerGympieST0027RawDopplerResearchV1",
       "dataset":"AURA Level 1, Gympie radar 8, 24 Nov 2025",
       "candidate_points":CANDIDATES,
       "minimum_quality_reflectivity_dbz":REFLECTIVITY_GATE_MIN,
       "uncertainty":"No velocity dealiasing, motion subtraction, 3D rotation retrieval, Nyquist instrument validation, or independent tornado ground truth. This is not a BoM warning or 90 km/h gust alert.",
       "interpretation_gate":"Do not infer rotation from maximum speeds or positive/negative gates alone; manually examine co-located radial couplet in multiple scans and elevations.",
       "observed_scans_assessed":len(rows),
       "rows":rows
    }
    (dst/"st0027_doppler_evidence.json").write_text(json.dumps(report,indent=2,default=str)+"\n")
    with (dst/"st0027_doppler_summary.csv").open("w",newline="") as output:
       writer=csv.writer(output)
       writer.writerow(["scan_utc","target_flag","elevation_deg","range_km","5km_valid_gate_count","5km_positive_ge12mps","5km_negative_le-12mps","minimum_sign_distance_km"])
       for x in rows:
          d=x.get("neighbourhoods_km",{}).get("5",{})
          c=x.get("compact_opposite_sign_support",{})
          writer.writerow([x["observed_utc"],x["shape_candidate_at_this_timestamp"],x.get("scan_elevation_deg"),
              x.get("radar_to_centroid_km"),d.get("gates"),d.get("positive_gates"),d.get("negative_gates"),
              c.get("nearest_opposite_sign_km")])
    print("RESEARCH_DOPPLER_COMPLETE",len(rows),"authentic volumes examined, 2 matching experimental reflectivity candidate timestamps",flush=True)

if __name__=="__main__":
    if len(sys.argv)!=3:
        raise SystemExit("Usage: audit-aura-gympie-st0027-doppler.py REAL_H5_DIR REPORT_DIR")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
