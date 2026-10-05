#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

OUT_DIR="data/aura/cross_event_v1"
mkdir -p "$OUT_DIR" scripts

echo "StormTracker — multi-event inferred 3-D validation v1"
echo

REQUIRED_MANIFESTS=(
  "data/aura/reference/66/2014-11-27/reference_source_manifest.json"
  "data/aura/multievent/66/2013-11-10/reference_source_manifest.json"
  "data/aura/multievent/66/2013-11-16/reference_source_manifest.json"
  "data/aura/multievent/66/2015-05-02/reference_source_manifest.json"
  "data/aura/multievent/66/2015-11-29/reference_source_manifest.json"
)

for f in "${REQUIRED_MANIFESTS[@]}"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing event manifest:"
    echo "  $f"
    exit 1
  fi
done

if ! grep -qxF "data/aura/cross_event_v1/" .gitignore 2>/dev/null; then
  printf '\n# StormTracker cross-event AURA validation products\ndata/aura/cross_event_v1/\n' >> .gitignore
fi

if ! python3 - <<'PY' >/dev/null 2>&1
import numpy, h5py
PY
then
  echo "Installing build-time Python dependencies..."
  python3 -m pip install --user --quiet numpy h5py
fi

cat > scripts/validate_inferred_volume_multievent_v1.py <<'PY'
#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from pathlib import Path

import h5py
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

EVENTS = [
    ("2013-11-10", "severe-hail-logan",
     ROOT/"data/aura/multievent/66/2013-11-10/reference_source_manifest.json"),
    ("2013-11-16", "severe-hail-sunshine-coast",
     ROOT/"data/aura/multievent/66/2013-11-16/reference_source_manifest.json"),
    ("2014-11-27", "validated-reference-event",
     ROOT/"data/aura/reference/66/2014-11-27/reference_source_manifest.json"),
    ("2015-05-02", "east-coast-low-heavy-rain",
     ROOT/"data/aura/multievent/66/2015-05-02/reference_source_manifest.json"),
    ("2015-11-29", "severe-hail-brisbane",
     ROOT/"data/aura/multievent/66/2015-11-29/reference_source_manifest.json"),
]

OUT_DIR = ROOT/"data/aura/cross_event_v1"
CACHE_DIR = OUT_DIR/"voxels"
REPORT_PATH = OUT_DIR/"leave_one_event_out_validation.json"
MODEL_PATH = OUT_DIR/"candidate_vertical_profile_model_v2.json"

EARTH_RADIUS_M = 6_371_000.0
EFFECTIVE_EARTH_RADIUS_M = EARTH_RADIUS_M*4.0/3.0

X_MIN_M, X_MAX_M = -160_000.0, 160_000.0
Y_MIN_M, Y_MAX_M = -160_000.0, 160_000.0
Z_MIN_M, Z_MAX_M = 0.0, 25_000.0

DX_M = DY_M = 1_000.0
DZ_M = 500.0

LOW_LEVEL_MAX_ALTITUDE_M = 1_500.0
VALIDATION_RADIUS_M = 120_000.0
OCCUPANCY_THRESHOLD = 0.35

BIN_EDGES_DBZ = np.array(
    [20,25,30,35,40,45,50,55,60,90],
    dtype=np.float64
)
THRESHOLDS_DBZ = (30.0, 40.0, 50.0)


def as_text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, np.bytes_):
        return bytes(value).decode("utf-8", errors="replace")
    return str(value)


def attr_float(group, name, default=None):
    if group is None or name not in group.attrs:
        return default
    value = np.asarray(group.attrs[name])
    if value.size != 1:
        return default
    return float(value.reshape(-1)[0])


def attr_array(group, name):
    if group is None or name not in group.attrs:
        return None
    try:
        return np.asarray(group.attrs[name], dtype=np.float64).reshape(-1)
    except Exception:
        return None


def find_dbzh_group(dataset):
    for key in sorted(dataset.keys()):
        if not key.startswith("data"):
            continue
        group = dataset[key]
        if "what" not in group or "data" not in group:
            continue
        quantity = as_text(group["what"].attrs.get("quantity","")).upper()
        if quantity == "DBZH":
            return group
    return None


def decode_moment(group):
    raw = np.asarray(group["data"][...])
    what = group["what"]
    gain = float(np.asarray(what.attrs.get("gain",1.0)).reshape(-1)[0])
    offset = float(np.asarray(what.attrs.get("offset",0.0)).reshape(-1)[0])
    nodata = what.attrs.get("nodata",None)
    undetect = what.attrs.get("undetect",None)
    valid = np.ones(raw.shape,dtype=bool)
    if nodata is not None:
        valid &= raw != np.asarray(nodata).reshape(-1)[0]
    if undetect is not None:
        valid &= raw != np.asarray(undetect).reshape(-1)[0]
    values = raw.astype(np.float32)*gain + offset
    values[~valid] = np.nan
    return values


def circular_midpoint(start_deg, stop_deg):
    delta = (stop_deg-start_deg+540.0)%360.0-180.0
    return (start_deg+0.5*delta)%360.0


def ray_geometry(dataset, nrays):
    how = dataset.get("how")
    where = dataset.get("where")
    start_az = attr_array(how,"startazA")
    stop_az = attr_array(how,"stopazA")
    if start_az is not None and stop_az is not None and len(start_az)==nrays and len(stop_az)==nrays:
        azimuth = circular_midpoint(start_az,stop_az)
    else:
        azangles = attr_array(how,"azangles")
        if azangles is not None and len(azangles)==nrays:
            azimuth = np.mod(azangles,360.0)
        else:
            azimuth = (np.arange(nrays,dtype=np.float64)+0.5)*(360.0/nrays)

    start_el = attr_array(how,"startelA")
    stop_el = attr_array(how,"stopelA")
    if start_el is not None and stop_el is not None and len(start_el)==nrays and len(stop_el)==nrays:
        elevation = 0.5*(start_el+stop_el)
    else:
        nominal = attr_float(where,"elangle",None)
        if nominal is None:
            raise ValueError("No usable elevation metadata")
        elevation = np.full(nrays,nominal,dtype=np.float64)
    return np.asarray(azimuth), np.asarray(elevation)


def gate_ranges(dataset, nbins):
    where = dataset["where"]
    rstart_km = attr_float(where,"rstart",0.0)
    rscale_m = attr_float(where,"rscale",None)
    if rscale_m is None or rscale_m <= 0:
        raise ValueError("Invalid rscale")
    return rstart_km*1000.0 + (np.arange(nbins,dtype=np.float64)+0.5)*rscale_m


def antenna_to_cartesian(ranges_m, azimuth_deg, elevation_deg):
    r = ranges_m
    az = np.deg2rad(azimuth_deg)
    el = np.deg2rad(elevation_deg)
    R = EFFECTIVE_EARTH_RADIUS_M
    z = np.sqrt(r*r + R*R + 2.0*r*R*np.sin(el)) - R
    arg = np.clip(r*np.cos(el)/(R+z), -1.0, 1.0)
    ground = R*np.arcsin(arg)
    return ground*np.sin(az), ground*np.cos(az), z


def voxel_axes():
    x = np.arange(X_MIN_M+DX_M/2,X_MAX_M,DX_M,dtype=np.float32)
    y = np.arange(Y_MIN_M+DY_M/2,Y_MAX_M,DY_M,dtype=np.float32)
    z = np.arange(Z_MIN_M+DZ_M/2,Z_MAX_M,DZ_M,dtype=np.float32)
    return x,y,z


def volume_to_voxel(path):
    x_centres,y_centres,z_centres = voxel_axes()
    nx,ny,nz = len(x_centres),len(y_centres),len(z_centres)
    xs=[];ys=[];zs=[];dbzs=[]

    with h5py.File(path,"r") as h5:
        radar_height = attr_float(h5.get("where"),"height",0.0)
        for name in sorted(k for k in h5.keys() if k.startswith("dataset")):
            ds = h5[name]
            group = find_dbzh_group(ds)
            if group is None:
                continue
            dbzh = decode_moment(group)
            if dbzh.ndim != 2:
                continue
            nrays,nbins = dbzh.shape
            az,el = ray_geometry(ds,nrays)
            ranges = gate_ranges(ds,nbins)
            az2 = np.repeat(az[:,None],nbins,axis=1)
            el2 = np.repeat(el[:,None],nbins,axis=1)
            r2 = np.repeat(ranges[None,:],nrays,axis=0)
            x,y,relz = antenna_to_cartesian(r2,az2,el2)
            alt = relz + radar_height
            valid = np.isfinite(dbzh)
            if not np.any(valid):
                continue
            xs.append(x[valid].astype(np.float32))
            ys.append(y[valid].astype(np.float32))
            zs.append(alt[valid].astype(np.float32))
            dbzs.append(dbzh[valid].astype(np.float32))

    if not xs:
        raise ValueError(f"No DBZH gates in {path}")

    x=np.concatenate(xs).astype(np.float64)
    y=np.concatenate(ys).astype(np.float64)
    z=np.concatenate(zs).astype(np.float64)
    dbzh=np.concatenate(dbzs).astype(np.float64)

    ix=np.floor((x-X_MIN_M)/DX_M).astype(np.int64)
    iy=np.floor((y-Y_MIN_M)/DY_M).astype(np.int64)
    iz=np.floor((z-Z_MIN_M)/DZ_M).astype(np.int64)

    inside=(np.isfinite(dbzh)&(ix>=0)&(ix<nx)&(iy>=0)&(iy<ny)&(iz>=0)&(iz<nz))
    ix=ix[inside];iy=iy[inside];iz=iz[inside];dbzh=dbzh[inside]
    flat=(iz*ny+iy)*nx+ix

    order=np.lexsort((dbzh,flat))
    sorted_flat=flat[order]
    ends=np.r_[np.nonzero(sorted_flat[1:]!=sorted_flat[:-1])[0],len(sorted_flat)-1]
    chosen=order[ends]

    out=np.full((nz,ny,nx),np.nan,dtype=np.float32)
    out[iz[chosen],iy[chosen],ix[chosen]]=dbzh[chosen].astype(np.float32)

    return {"dbzh":out,"x":x_centres,"y":y_centres,"z":z_centres}


def resolve_frame_path(manifest_path, frame):
    raw = Path(frame["extracted_path"])
    if raw.is_absolute() and raw.exists():
        return raw
    candidate = ROOT/raw
    if candidate.exists():
        return candidate
    candidate = manifest_path.parent/"raw"/raw.name
    if candidate.exists():
        return candidate
    raise FileNotFoundError(raw)


def load_events():
    CACHE_DIR.mkdir(parents=True,exist_ok=True)
    result=[]
    for event_id,label,manifest_path in EVENTS:
        manifest=json.loads(manifest_path.read_text())
        frames=manifest.get("frames",[])
        if len(frames)!=13:
            raise RuntimeError(f"{event_id}: expected 13 frames, found {len(frames)}")
        prepared=[]
        print(f"\nPreparing {event_id} — {label}")
        for i,frame in enumerate(frames):
            cache=CACHE_DIR/f"{event_id}_frame_{i:02d}.npz"
            if cache.exists():
                with np.load(cache) as d:
                    prepared.append({
                        "dbzh":np.asarray(d["dbzh"],dtype=np.float32),
                        "x":np.asarray(d["x"],dtype=np.float32),
                        "y":np.asarray(d["y"],dtype=np.float32),
                        "z":np.asarray(d["z"],dtype=np.float32),
                    })
                print(f"  frame {i:02d}: cache")
            else:
                source=resolve_frame_path(manifest_path,frame)
                voxel=volume_to_voxel(source)
                np.savez_compressed(cache,**voxel)
                prepared.append(voxel)
                print(f"  frame {i:02d}: converted max={np.nanmax(voxel['dbzh']):.1f} dBZ")
        result.append({"event_id":event_id,"label":label,"frames":prepared})
    return result


def domain_mask(x,y):
    xx,yy=np.meshgrid(x.astype(np.float64),y.astype(np.float64),indexing="xy")
    return np.hypot(xx,yy)<=VALIDATION_RADIUS_M


def low_level_proxy(dbzh,z):
    levels=np.where(z<=LOW_LEVEL_MAX_ALTITUDE_M)[0]
    subset=dbzh[levels]
    finite=np.isfinite(subset)
    safe=np.where(finite,subset,-np.inf)
    proxy=np.max(safe,axis=0).astype(np.float32)
    proxy[~np.any(finite,axis=0)]=np.nan
    return proxy


def class_index(proxy):
    result=np.digitize(proxy,BIN_EDGES_DBZ,right=False)-1
    result[(~np.isfinite(proxy))|(proxy<BIN_EDGES_DBZ[0])]=-1
    result[result>=len(BIN_EDGES_DBZ)-1]=len(BIN_EDGES_DBZ)-2
    return result


def build_model(events):
    z=events[0]["frames"][0]["z"].astype(np.float64)
    bins=len(BIN_EDGES_DBZ)-1
    samples=[[[] for _ in range(len(z))] for _ in range(bins)]
    echo_counts=np.zeros((bins,len(z)),dtype=np.int64)
    column_counts=np.zeros(bins,dtype=np.int64)
    domain=domain_mask(events[0]["frames"][0]["x"],events[0]["frames"][0]["y"])

    for event in events:
        for frame in event["frames"]:
            dbzh=frame["dbzh"].astype(np.float64)
            proxy=low_level_proxy(dbzh,frame["z"]).astype(np.float64)
            classes=class_index(proxy)
            for b in range(bins):
                columns=domain&(classes==b)
                count=int(columns.sum())
                if count==0:
                    continue
                column_counts[b]+=count
                base=proxy[columns]
                for iz in range(len(z)):
                    values=dbzh[iz][columns]
                    echo=np.isfinite(values)&(values>=20.0)
                    if not np.any(echo):
                        continue
                    echo_counts[b,iz]+=int(echo.sum())
                    samples[b][iz].append((values[echo]-base[echo]).astype(np.float32))

    median=np.full((bins,len(z)),np.nan,dtype=np.float32)
    p25=np.full_like(median,np.nan)
    p75=np.full_like(median,np.nan)
    occupancy=np.zeros_like(median,dtype=np.float32)

    for b in range(bins):
        if column_counts[b]>0:
            occupancy[b]=(echo_counts[b]/column_counts[b]).astype(np.float32)
        for iz in range(len(z)):
            if not samples[b][iz]:
                continue
            vals=np.concatenate(samples[b][iz]).astype(np.float64)
            median[b,iz]=float(np.median(vals))
            p25[b,iz]=float(np.percentile(vals,25))
            p75[b,iz]=float(np.percentile(vals,75))

    return {
        "z":z.astype(np.float32),
        "column_counts":column_counts,
        "occupancy":occupancy,
        "median_delta":median,
        "p25_delta":p25,
        "p75_delta":p75,
    }


def infer_volume(frame,model):
    proxy=low_level_proxy(frame["dbzh"],frame["z"]).astype(np.float64)
    classes=class_index(proxy)
    predicted=np.full(frame["dbzh"].shape,np.nan,dtype=np.float32)

    for b in range(len(BIN_EDGES_DBZ)-1):
        columns=classes==b
        if not np.any(columns):
            continue
        base=proxy[columns]
        for iz in range(len(frame["z"])):
            occ=float(model["occupancy"][b,iz])
            delta=float(model["median_delta"][b,iz])
            if occ<OCCUPANCY_THRESHOLD or not math.isfinite(delta):
                continue
            values=np.clip(base+delta,-10.0,85.0)
            keep=values>=20.0
            if not np.any(keep):
                continue
            layer=predicted[iz]
            idx=np.flatnonzero(columns.ravel())
            layer.ravel()[idx[keep]]=values[keep].astype(np.float32)
    return predicted


def contingency(measured,predicted,threshold,domain):
    d3=np.broadcast_to(domain[None,:,:],measured.shape)
    m=d3&np.isfinite(measured)&(measured>=threshold)
    p=d3&np.isfinite(predicted)&(predicted>=threshold)
    hits=int(np.count_nonzero(m&p))
    misses=int(np.count_nonzero(m&~p))
    fa=int(np.count_nonzero(p&~m))
    union=hits+misses+fa
    return {
        "iou":hits/union if union else None,
        "pod":hits/(hits+misses) if hits+misses else None,
        "far":fa/(hits+fa) if hits+fa else None,
    }


def echo_top(volume,z,threshold):
    mask=np.isfinite(volume)&(volume>=threshold)
    result=np.full(volume.shape[1:],np.nan,dtype=np.float32)
    for iz,alt in enumerate(z):
        result[mask[iz]]=float(alt)
    return result


def top_metrics(measured,predicted,z,threshold,domain):
    mt=echo_top(measured,z,threshold)
    pt=echo_top(predicted,z,threshold)
    paired=domain&np.isfinite(mt)&np.isfinite(pt)
    if not np.any(paired):
        return {"median_absolute_error_m":None,"mean_bias_m":None}
    errors=pt[paired].astype(np.float64)-mt[paired].astype(np.float64)
    return {
        "median_absolute_error_m":float(np.median(np.abs(errors))),
        "mean_bias_m":float(np.mean(errors)),
    }


def intensity_metrics(measured,predicted,domain):
    d3=np.broadcast_to(domain[None,:,:],measured.shape)
    paired=d3&np.isfinite(measured)&np.isfinite(predicted)&(measured>=20)&(predicted>=20)
    if not np.any(paired):
        return {"mae_dbz":None,"rmse_dbz":None,"bias_dbz":None}
    errors=predicted[paired].astype(np.float64)-measured[paired].astype(np.float64)
    return {
        "mae_dbz":float(np.mean(np.abs(errors))),
        "rmse_dbz":float(np.sqrt(np.mean(errors*errors))),
        "bias_dbz":float(np.mean(errors)),
    }


def valid(values,func=np.mean):
    vals=[float(v) for v in values if v is not None and math.isfinite(float(v))]
    return float(func(vals)) if vals else None


def evaluate_event(event,model):
    domain=domain_mask(event["frames"][0]["x"],event["frames"][0]["y"])
    frames=[]
    for i,frame in enumerate(event["frames"]):
        predicted=infer_volume(frame,model)
        measured=frame["dbzh"]
        thresholds={}
        for threshold in THRESHOLDS_DBZ:
            key=str(int(threshold))
            thresholds[key]={
                "contingency":contingency(measured,predicted,threshold,domain),
                "echo_top":top_metrics(measured,predicted,frame["z"],threshold,domain),
            }
        frames.append({
            "frame_index":i,
            "intensity":intensity_metrics(measured,predicted,domain),
            "thresholds":thresholds,
        })

    aggregate_thresholds={}
    for threshold in THRESHOLDS_DBZ:
        key=str(int(threshold))
        aggregate_thresholds[key]={
            "mean_iou":valid([f["thresholds"][key]["contingency"]["iou"] for f in frames]),
            "mean_pod":valid([f["thresholds"][key]["contingency"]["pod"] for f in frames]),
            "mean_far":valid([f["thresholds"][key]["contingency"]["far"] for f in frames]),
            "median_echo_top_absolute_error_m":valid(
                [f["thresholds"][key]["echo_top"]["median_absolute_error_m"] for f in frames],
                np.median
            ),
            "mean_echo_top_bias_m":valid(
                [f["thresholds"][key]["echo_top"]["mean_bias_m"] for f in frames]
            ),
        }

    return {
        "event_id":event["event_id"],
        "label":event["label"],
        "mean_intensity_mae_dbz":valid([f["intensity"]["mae_dbz"] for f in frames]),
        "mean_intensity_rmse_dbz":valid([f["intensity"]["rmse_dbz"] for f in frames]),
        "mean_intensity_bias_dbz":valid([f["intensity"]["bias_dbz"] for f in frames]),
        "thresholds":aggregate_thresholds,
        "frames":frames,
    }


def serialise_model(model):
    profiles=[]
    for b in range(len(BIN_EDGES_DBZ)-1):
        levels=[]
        for iz,alt in enumerate(model["z"]):
            def clean(v):
                v=float(v)
                return v if math.isfinite(v) else None
            levels.append({
                "altitude_m_amsl":float(alt),
                "occupancy_probability":float(model["occupancy"][b,iz]),
                "median_delta_dbz":clean(model["median_delta"][b,iz]),
                "p25_delta_dbz":clean(model["p25_delta"][b,iz]),
                "p75_delta_dbz":clean(model["p75_delta"][b,iz]),
            })
        profiles.append({
            "low_level_dbz_min":float(BIN_EDGES_DBZ[b]),
            "low_level_dbz_max":float(BIN_EDGES_DBZ[b+1]),
            "training_columns":int(model["column_counts"][b]),
            "levels":levels,
        })
    return {
        "format":"StormTrackerEmpiricalVerticalReflectivityModelV2",
        "scientific_status":"multi-event-candidate-model",
        "training_event_count":len(EVENTS),
        "training_events":[{"event_id":e[0],"label":e[1]} for e in EVENTS],
        "low_level_proxy":{
            "definition":"maximum measured DBZH at voxel altitudes <=1500 m AMSL",
            "note":"historical pseudo-live proxy; not identical to Bureau public mosaic",
        },
        "validation_radius_m":VALIDATION_RADIUS_M,
        "occupancy_threshold":OCCUPANCY_THRESHOLD,
        "profiles":profiles,
    }


def main():
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    events=load_events()

    print("\n"+"="*106)
    print("LEAVE-ONE-EVENT-OUT VALIDATION")
    print("="*106)
    print(f"Events: {len(events)} | 13 scans/event | held-out event excluded from its own model\n")

    results=[]

    for held in events:
        training=[e for e in events if e["event_id"]!=held["event_id"]]
        model=build_model(training)
        result=evaluate_event(held,model)
        results.append(result)

        print(f"{held['event_id']} — {held['label']}")
        print(
            f"  MAE {result['mean_intensity_mae_dbz']:.2f} dBZ | "
            f"RMSE {result['mean_intensity_rmse_dbz']:.2f} dBZ | "
            f"bias {result['mean_intensity_bias_dbz']:+.2f} dBZ"
        )
        for key in ("30","40","50"):
            t=result["thresholds"][key]
            top=t["median_echo_top_absolute_error_m"]
            top_text="n/a" if top is None else f"{top/1000:.2f} km"
            print(
                f"  {key} dBZ: IoU {t['mean_iou']:.3f}  "
                f"POD {t['mean_pod']:.3f}  FAR {t['mean_far']:.3f}  "
                f"echo-top abs {top_text}"
            )
        print()

    overall_thresholds={}
    for key in ("30","40","50"):
        overall_thresholds[key]={
            "mean_iou":valid([r["thresholds"][key]["mean_iou"] for r in results]),
            "mean_pod":valid([r["thresholds"][key]["mean_pod"] for r in results]),
            "mean_far":valid([r["thresholds"][key]["mean_far"] for r in results]),
            "median_event_echo_top_absolute_error_m":valid(
                [r["thresholds"][key]["median_echo_top_absolute_error_m"] for r in results],
                np.median
            ),
        }

    overall={
        "mean_event_intensity_mae_dbz":valid([r["mean_intensity_mae_dbz"] for r in results]),
        "mean_event_intensity_rmse_dbz":valid([r["mean_intensity_rmse_dbz"] for r in results]),
        "mean_event_intensity_bias_dbz":valid([r["mean_intensity_bias_dbz"] for r in results]),
        "thresholds":overall_thresholds,
    }

    final_model=build_model(events)
    MODEL_PATH.write_text(json.dumps(serialise_model(final_model),indent=2)+"\n")

    report={
        "format":"StormTrackerLeaveOneEventOutValidationV1",
        "method":"leave-one-event-out",
        "event_count":len(events),
        "frames_per_event":13,
        "events":results,
        "overall":overall,
        "limitations":[
            "All events use Mt Stapylton radar 66.",
            "The historical low-level proxy is not identical to the live public BOM mosaic.",
            "Only five event sequences are represented.",
            "The model is reflectivity-only at this stage.",
            "Any live output remains inferred volumetric intensity, not measured volumetric radar.",
        ],
        "candidate_model_path":str(MODEL_PATH.relative_to(ROOT)),
    }

    REPORT_PATH.write_text(json.dumps(report,indent=2)+"\n")

    print("="*106)
    print("CROSS-EVENT AGGREGATE")
    print("="*106)
    print(f"Intensity MAE:  {overall['mean_event_intensity_mae_dbz']:.2f} dBZ")
    print(f"Intensity RMSE: {overall['mean_event_intensity_rmse_dbz']:.2f} dBZ")
    print(f"Intensity bias: {overall['mean_event_intensity_bias_dbz']:+.2f} dBZ")
    for key in ("30","40","50"):
        t=overall["thresholds"][key]
        print(
            f"{key} dBZ: IoU={t['mean_iou']:.3f}  "
            f"POD={t['mean_pod']:.3f}  FAR={t['mean_far']:.3f}  "
            f"echo-top median-event abs={t['median_event_echo_top_absolute_error_m']/1000:.2f} km"
        )

    print("\nValidation report:")
    print(f"  {REPORT_PATH.relative_to(ROOT)}")
    print("Candidate multi-event model:")
    print(f"  {MODEL_PATH.relative_to(ROOT)}")
    print("\nLEAVE-ONE-EVENT-OUT VALIDATION: COMPLETE")
    print("Do not deploy the candidate model until these results are reviewed.")


if __name__=="__main__":
    main()
PY

chmod +x scripts/validate_inferred_volume_multievent_v1.py

python3 scripts/validate_inferred_volume_multievent_v1.py

echo
echo "Disk usage:"
du -sh "$OUT_DIR" 2>/dev/null || true

echo
echo "Git safety:"
git check-ignore -v "$OUT_DIR" 2>/dev/null || true

echo
echo "DONE"
echo
echo "Send me:"
echo "  • each held-out event result block"
echo "  • the CROSS-EVENT AGGREGATE block"
echo "  • LEAVE-ONE-EVENT-OUT VALIDATION: COMPLETE"
echo
echo "Do not commit the candidate model yet."
