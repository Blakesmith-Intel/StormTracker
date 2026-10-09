#!/usr/bin/env python3
"""Research-only replay: observed low-level Gympie radial gates into ST V10.

Never create extra scans, time interpolation, synthetic velocity, dealiased
velocity, ground gust estimates, or warning classifications.
Each sampled point originates from the same co-elevation, nearest measured
AURA reflectivity/VRAD gate, quality-controlled to >=40 dBZ. For comparability
to the public browser decoder, limit retained raw radial speeds to +/-70 km/h.
This is a *retrospective research comparison*, not a calibration or proof of
valid gust forecasts.
"""
from pathlib import Path
import json
import math
import runpy
import sys
import h5py
import numpy as np

here = Path(__file__).resolve().parent
converter = runpy.run_path(str(here / "measured-aura-to-stormtracker-2d.py"))
helpers = runpy.run_path(str(here / "summarize-aura-gympie-2025.py"))
nearest_az_indices = converter["nearest_az_indices"]
bearing = converter["BEARING"]
dist = converter["GROUND_DIST"]
east = converter["E"]
north = converter["N"]
georef = converter["GEOREF"]
radar_lat = converter["LAT"]
radar_lon = converter["LON"]
size = converter["SIZE"]
first_sweep = helpers["first_sweep"]
decode = helpers["decode_raw_data"]
number = helpers["number"]
R = 6378137
MIN_REFLECTIVITY_DBZ = 40.0
MAX_PUBLIC_RADIAL_KMH = 70.0
GRID_STRIDE = 2


def positions(row, col):
    minx,maxx,miny,maxy=(georef[k] for k in ("minX","maxX","minY","maxY"))
    xm=minx+(col+.5)/size*(maxx-minx)
    ym=maxy-(row+.5)/size*(maxy-miny)
    lon=xm/R*180/math.pi
    lat=(2*np.arctan(np.exp(ym/R))-math.pi/2)*180/math.pi
    return lat,lon


def convert_file(path, out):
    with h5py.File(path,"r") as h5:
        chosen=first_sweep(h5)
        if chosen is None:
            raise RuntimeError("No reflectivity sweep available")
        elev,ds_name,group,reflect_group,velocity_group,fields=chosen
        if velocity_group is None:
            raise RuntimeError("No same-elevation VRAD field")
        reflect=decode(reflect_group)
        velocity=decode(velocity_group)
        if reflect.shape!=velocity.shape:
            raise RuntimeError("Reflectivity/velocity gates don't match in same sweep")
        rays,bins=reflect.shape
        attrs=group["where"].attrs
        rscale=number(attrs.get("rscale"),250)
        rstart=number(attrs.get("rstart"),0)*1000
        if rscale<=0:raise RuntimeError("Bad source radar range spacing")
        az=np.linspace(0,360,rays,endpoint=False,dtype=np.float32)
        if "how" in group and "startazA" in group["how"].attrs:
            measured=np.asarray(group["how"].attrs["startazA"])
            if measured.size==rays:az=measured.astype(np.float32).reshape(-1)
        ray=nearest_az_indices(az)
        slant=dist/np.cos(np.deg2rad(elev))
        gate=np.rint((slant-rstart)/rscale-.5).astype(np.int32)
        valid=(gate>=0)&(gate<bins)
        gate=np.clip(gate,0,bins-1)
        dbz=reflect[ray,gate]
        vrad_kmh=velocity[ray,gate]*3.6
        good=(valid & np.isfinite(dbz) & (dbz >= MIN_REFLECTIVITY_DBZ) &
              np.isfinite(vrad_kmh) &
              (np.abs(vrad_kmh)<=MAX_PUBLIC_RADIAL_KMH) &
              (vrad_kmh!=0))
        # A deterministic spatial subset reduces browser replay pressure and
        # keeps clusters from being over-weighted by nearest-gate repeats.
        sample_rows=np.arange(0,size,GRID_STRIDE)
        sample_cols=np.arange(0,size,GRID_STRIDE)
        selection=np.zeros((size,size),dtype=bool)
        selection[np.ix_(sample_rows,sample_cols)]=True
        yy,xx=np.nonzero(good & selection)
        lat,lon=positions(yy,xx)
        samples=[
            dict(latitude=round(float(lat[i]),6),
                 longitude=round(float(lon[i]),6),
                 velocity_kmh=round(float(vrad_kmh[yy[i],xx[i]]),2))
            for i in range(len(yy))
        ]
        stamp=path.name.split("_")[2][:6]
        utc="2025-11-24T"+stamp[:2]+":"+stamp[2:4]+":"+stamp[4:]+"Z"
        record=dict(radarId="08",observedUtc=utc,
                    timeBasis="AURA-Level1-source-scan-UTC",
                    radialSampleBasis="measured same-lowest-elevation ODIM gates",
                    verifiedRadialRangeKmh=70,
                    velocityRangeVerified=False, # Not proven full public palette calibration.
                    quality_control=dict(minReflectivityDbz=40,
                         maxAbsRawRadialKmh=70,
                         nearestGateSpatialResampling=True,
                         decimationPixelStride=2,
                         dealiasing=False,
                         storm_motion_removed=False,
                         sample_count=len(samples)),
                    samples=samples)
        output=out/(path.name+".doppler.json")
        output.write_text(json.dumps(record,separators=(",",":"))+"\n")
        print("AURA_V10_OBSERVED",utc,"reflectivity >=40,radial <=70 samples",len(samples),
              "lowest elevation",round(float(elev),3),flush=True)


def main(src,out):
    out.mkdir(parents=True,exist_ok=True)
    scans=sorted(src.glob("8_20251124_*.pvol.h5"))
    if not scans:raise RuntimeError("No archived original Gympie ODIM volumes")
    for path in scans:
        convert_file(path,out)
    if len(scans)!=28:
        raise RuntimeError("Expected exactly 28 archived Gympie observations, found "+str(len(scans)))


if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: python scripts/extract-gympie-v10-radial.py SCANS OUT")
    main(Path(sys.argv[1]),Path(sys.argv[2]))
