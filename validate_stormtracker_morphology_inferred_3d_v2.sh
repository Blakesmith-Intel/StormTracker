#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

CACHE_DIR="data/aura/cross_event_v1/voxels"
OUT_DIR="data/aura/cross_event_v2"
mkdir -p "$OUT_DIR" scripts

echo "StormTracker — morphology-conditioned inferred 3-D validation v2"
echo

EXPECTED=(
  "2013-11-10"
  "2013-11-16"
  "2014-11-27"
  "2015-05-02"
  "2015-11-29"
)

for EVENT in "${EXPECTED[@]}"; do
  for I in $(seq -w 0 12); do
    F="$CACHE_DIR/${EVENT}_frame_${I}.npz"
    if [ ! -f "$F" ]; then
      echo "ERROR: Missing cached voxel frame:"
      echo "  $F"
      echo "Run the previous leave-one-event-out validation first."
      exit 1
    fi
  done
done

if ! grep -qxF "data/aura/cross_event_v2/" .gitignore 2>/dev/null; then
  printf '\n# StormTracker morphology-conditioned cross-event validation\ndata/aura/cross_event_v2/\n' >> .gitignore
fi

cat > scripts/validate_inferred_volume_morphology_v2.py <<'PY'
#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / "data/aura/cross_event_v1/voxels"
OUT_DIR = ROOT / "data/aura/cross_event_v2"
REPORT = OUT_DIR / "morphology_leave_one_event_out_validation.json"
MODEL = OUT_DIR / "candidate_morphology_vertical_profile_model_v3.json"

EVENTS = [
    ("2013-11-10", "severe-hail-logan"),
    ("2013-11-16", "severe-hail-sunshine-coast"),
    ("2014-11-27", "validated-reference-event"),
    ("2015-05-02", "east-coast-low-heavy-rain"),
    ("2015-11-29", "severe-hail-brisbane"),
]

LOW_LEVEL_MAX_ALTITUDE_M = 1500.0
VALIDATION_RADIUS_M = 120_000.0

BIN_EDGES_DBZ = np.array(
    [20,25,30,35,40,45,50,55,60,90],
    dtype=np.float64,
)

THRESHOLDS_DBZ = (30.0, 40.0, 50.0)

REGIMES = (
    "broad_rain",
    "convective_fringe",
    "convective_core",
)

# Candidate occupancy thresholds intentionally become more conservative
# for broad rain and more permissive for strongly convective columns.
REGIME_OCCUPANCY = {
    "broad_rain": 0.55,
    "convective_fringe": 0.40,
    "convective_core": 0.30,
}

BASELINE_OCCUPANCY = 0.35

# Minimum training support before a regime-specific profile is trusted.
MIN_REGIME_BIN_COLUMNS = 300


def load_events():
    events=[]

    for event_id,label in EVENTS:
        frames=[]

        for index in range(13):
            path=CACHE_DIR/f"{event_id}_frame_{index:02d}.npz"

            with np.load(path) as d:
                frames.append({
                    "dbzh":np.asarray(d["dbzh"],dtype=np.float32),
                    "x":np.asarray(d["x"],dtype=np.float32),
                    "y":np.asarray(d["y"],dtype=np.float32),
                    "z":np.asarray(d["z"],dtype=np.float32),
                })

        events.append({
            "event_id":event_id,
            "label":label,
            "frames":frames,
        })

    return events


def domain_mask(x,y):
    xx,yy=np.meshgrid(
        x.astype(np.float64),
        y.astype(np.float64),
        indexing="xy",
    )
    return np.hypot(xx,yy)<=VALIDATION_RADIUS_M


def low_level_proxy(dbzh,z):
    levels=np.where(z<=LOW_LEVEL_MAX_ALTITUDE_M)[0]
    subset=dbzh[levels]
    finite=np.isfinite(subset)

    safe=np.where(
        finite,
        subset,
        -np.inf,
    )

    proxy=np.max(safe,axis=0).astype(np.float32)
    proxy[~np.any(finite,axis=0)]=np.nan
    return proxy


def neighbourhood_features(proxy):
    # 7x7 is a 7 km neighbourhood on the 1 km validation grid.
    finite=np.isfinite(proxy)
    filled=np.where(finite,proxy,-99.0).astype(np.float32)

    padded=np.pad(
        filled,
        3,
        mode="constant",
        constant_values=-99.0,
    )

    windows=sliding_window_view(
        padded,
        (7,7),
    )

    local_max=np.max(
        windows,
        axis=(-2,-1),
    )

    valid_window=windows>=20.0
    valid_count=np.sum(
        valid_window,
        axis=(-2,-1),
    )

    value_sum=np.sum(
        np.where(
            valid_window,
            windows,
            0.0,
        ),
        axis=(-2,-1),
    )

    local_mean=np.divide(
        value_sum,
        valid_count,
        out=np.full(
            value_sum.shape,
            np.nan,
            dtype=np.float64,
        ),
        where=valid_count>0,
    )

    texture=local_max-local_mean

    strong_fraction=np.mean(
        windows>=40.0,
        axis=(-2,-1),
    )

    return {
        "local_max":local_max,
        "local_mean":local_mean,
        "texture":texture,
        "strong_fraction":strong_fraction,
    }


def classify_regime(proxy):
    f=neighbourhood_features(proxy)

    regime=np.full(
        proxy.shape,
        -1,
        dtype=np.int8,
    )

    usable=np.isfinite(proxy)&(proxy>=20.0)

    # Strong cores are defined by intensity plus local contrast. A >=50 dBZ
    # column is always treated as convective. This separates intense compact
    # convection from broad heavy-rain shields more effectively than DBZH
    # alone while using only information available in a 2-D reflectivity field.
    core=usable & (
        (proxy>=50.0)
        | (
            (proxy>=40.0)
            & (f["texture"]>=5.0)
        )
        | (
            (proxy>=35.0)
            & (f["local_max"]>=50.0)
            & (f["texture"]>=8.0)
        )
    )

    fringe=usable & ~core & (
        (f["local_max"]>=45.0)
        & (f["texture"]>=4.0)
        & (proxy>=25.0)
    )

    broad=usable & ~core & ~fringe

    regime[broad]=0
    regime[fringe]=1
    regime[core]=2

    return regime,f


def class_index(proxy):
    result=np.digitize(
        proxy,
        BIN_EDGES_DBZ,
        right=False,
    )-1

    result[
        (~np.isfinite(proxy))
        | (proxy<BIN_EDGES_DBZ[0])
    ]=-1

    result[
        result>=len(BIN_EDGES_DBZ)-1
    ]=len(BIN_EDGES_DBZ)-2

    return result


def empty_profile_arrays(regime_count,bin_count,z_count):
    return {
        "samples":[
            [
                [[] for _ in range(z_count)]
                for _ in range(bin_count)
            ]
            for _ in range(regime_count)
        ],
        "echo_counts":np.zeros(
            (regime_count,bin_count,z_count),
            dtype=np.int64,
        ),
        "column_counts":np.zeros(
            (regime_count,bin_count),
            dtype=np.int64,
        ),
    }


def finish_profiles(accumulator,z):
    regime_count=int(accumulator["column_counts"].shape[0])
    bin_count=len(BIN_EDGES_DBZ)-1
    z_count=len(z)

    median=np.full(
        (regime_count,bin_count,z_count),
        np.nan,
        dtype=np.float32,
    )

    p25=np.full_like(median,np.nan)
    p75=np.full_like(median,np.nan)

    occupancy=np.zeros_like(
        median,
        dtype=np.float32,
    )

    for r in range(regime_count):
        for b in range(bin_count):
            count=accumulator["column_counts"][r,b]

            if count>0:
                occupancy[r,b]=(
                    accumulator["echo_counts"][r,b]
                    / count
                ).astype(np.float32)

            for iz in range(z_count):
                chunks=accumulator["samples"][r][b][iz]

                if not chunks:
                    continue

                values=np.concatenate(chunks).astype(np.float64)

                median[r,b,iz]=float(np.median(values))
                p25[r,b,iz]=float(np.percentile(values,25))
                p75[r,b,iz]=float(np.percentile(values,75))

    return {
        "z":z.astype(np.float32),
        "column_counts":accumulator["column_counts"],
        "occupancy":occupancy,
        "median_delta":median,
        "p25_delta":p25,
        "p75_delta":p75,
    }


def build_morphology_model(events):
    z=events[0]["frames"][0]["z"].astype(np.float64)
    domain=domain_mask(
        events[0]["frames"][0]["x"],
        events[0]["frames"][0]["y"],
    )

    bin_count=len(BIN_EDGES_DBZ)-1
    acc=empty_profile_arrays(
        len(REGIMES),
        bin_count,
        len(z),
    )

    # Global fallback model uses one pseudo-regime.
    global_acc=empty_profile_arrays(
        1,
        bin_count,
        len(z),
    )

    for event in events:
        for frame in event["frames"]:
            dbzh=frame["dbzh"].astype(np.float64)
            proxy=low_level_proxy(
                dbzh,
                frame["z"],
            ).astype(np.float64)

            bins=class_index(proxy)
            regimes,_=classify_regime(proxy)

            for b in range(bin_count):
                global_columns=domain&(bins==b)
                global_count=int(global_columns.sum())

                if global_count:
                    global_acc["column_counts"][0,b]+=global_count
                    base=proxy[global_columns]

                    for iz in range(len(z)):
                        values=dbzh[iz][global_columns]
                        echo=np.isfinite(values)&(values>=20.0)

                        if np.any(echo):
                            global_acc["echo_counts"][0,b,iz]+=int(echo.sum())
                            global_acc["samples"][0][b][iz].append(
                                (values[echo]-base[echo]).astype(np.float32)
                            )

                for r in range(len(REGIMES)):
                    columns=domain&(bins==b)&(regimes==r)
                    count=int(columns.sum())

                    if count==0:
                        continue

                    acc["column_counts"][r,b]+=count
                    base=proxy[columns]

                    for iz in range(len(z)):
                        values=dbzh[iz][columns]
                        echo=np.isfinite(values)&(values>=20.0)

                        if not np.any(echo):
                            continue

                        acc["echo_counts"][r,b,iz]+=int(echo.sum())
                        acc["samples"][r][b][iz].append(
                            (values[echo]-base[echo]).astype(np.float32)
                        )

    model=finish_profiles(acc,z)
    global_model=finish_profiles(global_acc,z)

    model["global_fallback"]={
        "column_counts":global_model["column_counts"][0],
        "occupancy":global_model["occupancy"][0],
        "median_delta":global_model["median_delta"][0],
        "p25_delta":global_model["p25_delta"][0],
        "p75_delta":global_model["p75_delta"][0],
    }

    return model


def infer_morphology(frame,model):
    proxy=low_level_proxy(
        frame["dbzh"],
        frame["z"],
    ).astype(np.float64)

    bins=class_index(proxy)
    regimes,_=classify_regime(proxy)

    predicted=np.full(
        frame["dbzh"].shape,
        np.nan,
        dtype=np.float32,
    )

    for r,regime_name in enumerate(REGIMES):
        occupancy_threshold=REGIME_OCCUPANCY[regime_name]

        for b in range(len(BIN_EDGES_DBZ)-1):
            columns=(regimes==r)&(bins==b)

            if not np.any(columns):
                continue

            supported=(
                model["column_counts"][r,b]
                >= MIN_REGIME_BIN_COLUMNS
            )

            if supported:
                occupancy=model["occupancy"][r,b]
                median_delta=model["median_delta"][r,b]
            else:
                occupancy=model["global_fallback"]["occupancy"][b]
                median_delta=model["global_fallback"]["median_delta"][b]

            base=proxy[columns]

            for iz in range(len(frame["z"])):
                occ=float(occupancy[iz])
                delta=float(median_delta[iz])

                if (
                    occ<occupancy_threshold
                    or not math.isfinite(delta)
                ):
                    continue

                values=np.clip(
                    base+delta,
                    -10.0,
                    85.0,
                )

                keep=values>=20.0

                if not np.any(keep):
                    continue

                layer=predicted[iz]
                flat=np.flatnonzero(columns.ravel())
                layer.ravel()[flat[keep]]=values[keep].astype(np.float32)

    return predicted


def build_baseline_model(events):
    z=events[0]["frames"][0]["z"].astype(np.float64)
    domain=domain_mask(
        events[0]["frames"][0]["x"],
        events[0]["frames"][0]["y"],
    )

    bins_count=len(BIN_EDGES_DBZ)-1

    samples=[
        [[] for _ in range(len(z))]
        for _ in range(bins_count)
    ]

    echo_counts=np.zeros(
        (bins_count,len(z)),
        dtype=np.int64,
    )

    column_counts=np.zeros(
        bins_count,
        dtype=np.int64,
    )

    for event in events:
        for frame in event["frames"]:
            dbzh=frame["dbzh"].astype(np.float64)
            proxy=low_level_proxy(
                dbzh,
                frame["z"],
            ).astype(np.float64)
            bins=class_index(proxy)

            for b in range(bins_count):
                columns=domain&(bins==b)
                count=int(columns.sum())

                if count==0:
                    continue

                column_counts[b]+=count
                base=proxy[columns]

                for iz in range(len(z)):
                    values=dbzh[iz][columns]
                    echo=np.isfinite(values)&(values>=20.0)

                    if np.any(echo):
                        echo_counts[b,iz]+=int(echo.sum())
                        samples[b][iz].append(
                            (values[echo]-base[echo]).astype(np.float32)
                        )

    occupancy=np.zeros(
        (bins_count,len(z)),
        dtype=np.float32,
    )
    median=np.full_like(
        occupancy,
        np.nan,
    )

    for b in range(bins_count):
        if column_counts[b]>0:
            occupancy[b]=(
                echo_counts[b]
                / column_counts[b]
            ).astype(np.float32)

        for iz in range(len(z)):
            if samples[b][iz]:
                median[b,iz]=float(
                    np.median(
                        np.concatenate(
                            samples[b][iz]
                        )
                    )
                )

    return {
        "occupancy":occupancy,
        "median_delta":median,
    }


def infer_baseline(frame,model):
    proxy=low_level_proxy(
        frame["dbzh"],
        frame["z"],
    ).astype(np.float64)

    bins=class_index(proxy)

    predicted=np.full(
        frame["dbzh"].shape,
        np.nan,
        dtype=np.float32,
    )

    for b in range(len(BIN_EDGES_DBZ)-1):
        columns=bins==b

        if not np.any(columns):
            continue

        base=proxy[columns]

        for iz in range(len(frame["z"])):
            occ=float(model["occupancy"][b,iz])
            delta=float(model["median_delta"][b,iz])

            if (
                occ<BASELINE_OCCUPANCY
                or not math.isfinite(delta)
            ):
                continue

            values=np.clip(
                base+delta,
                -10.0,
                85.0,
            )

            keep=values>=20.0

            if np.any(keep):
                layer=predicted[iz]
                flat=np.flatnonzero(columns.ravel())
                layer.ravel()[flat[keep]]=values[keep].astype(np.float32)

    return predicted


def contingency(measured,predicted,threshold,domain):
    d3=np.broadcast_to(
        domain[None,:,:],
        measured.shape,
    )

    m=d3&np.isfinite(measured)&(measured>=threshold)
    p=d3&np.isfinite(predicted)&(predicted>=threshold)

    hits=int(np.count_nonzero(m&p))
    misses=int(np.count_nonzero(m&~p))
    false=int(np.count_nonzero(p&~m))

    union=hits+misses+false

    return {
        "iou":hits/union if union else None,
        "pod":hits/(hits+misses) if hits+misses else None,
        "far":false/(hits+false) if hits+false else None,
    }


def echo_top(volume,z,threshold):
    mask=np.isfinite(volume)&(volume>=threshold)

    result=np.full(
        volume.shape[1:],
        np.nan,
        dtype=np.float32,
    )

    for iz,alt in enumerate(z):
        result[mask[iz]]=float(alt)

    return result


def top_error(measured,predicted,z,threshold,domain):
    mt=echo_top(measured,z,threshold)
    pt=echo_top(predicted,z,threshold)

    paired=domain&np.isfinite(mt)&np.isfinite(pt)

    if not np.any(paired):
        return None

    return float(
        np.median(
            np.abs(
                pt[paired].astype(np.float64)
                - mt[paired].astype(np.float64)
            )
        )
    )


def intensity_metrics(measured,predicted,domain):
    d3=np.broadcast_to(
        domain[None,:,:],
        measured.shape,
    )

    paired=(
        d3
        & np.isfinite(measured)
        & np.isfinite(predicted)
        & (measured>=20.0)
        & (predicted>=20.0)
    )

    if not np.any(paired):
        return {
            "mae":None,
            "rmse":None,
            "bias":None,
        }

    e=(
        predicted[paired].astype(np.float64)
        - measured[paired].astype(np.float64)
    )

    return {
        "mae":float(np.mean(np.abs(e))),
        "rmse":float(np.sqrt(np.mean(e*e))),
        "bias":float(np.mean(e)),
    }


def valid(values,func=np.mean):
    values=[
        float(v)
        for v in values
        if v is not None
        and math.isfinite(float(v))
    ]

    return float(func(values)) if values else None


def evaluate_event(event,morph_model,baseline_model):
    domain=domain_mask(
        event["frames"][0]["x"],
        event["frames"][0]["y"],
    )

    morph_results=[]
    baseline_results=[]

    for frame in event["frames"]:
        measured=frame["dbzh"]
        morph=infer_morphology(frame,morph_model)
        baseline=infer_baseline(frame,baseline_model)

        def evaluate(predicted):
            thresholds={}

            for threshold in THRESHOLDS_DBZ:
                key=str(int(threshold))
                thresholds[key]=contingency(
                    measured,
                    predicted,
                    threshold,
                    domain,
                )
                thresholds[key]["echo_top_abs_m"]=top_error(
                    measured,
                    predicted,
                    frame["z"],
                    threshold,
                    domain,
                )

            return {
                "intensity":intensity_metrics(
                    measured,
                    predicted,
                    domain,
                ),
                "thresholds":thresholds,
            }

        morph_results.append(
            evaluate(morph)
        )
        baseline_results.append(
            evaluate(baseline)
        )

    def aggregate(results):
        thresholds={}

        for key in ("30","40","50"):
            thresholds[key]={
                "iou":valid([
                    r["thresholds"][key]["iou"]
                    for r in results
                ]),
                "pod":valid([
                    r["thresholds"][key]["pod"]
                    for r in results
                ]),
                "far":valid([
                    r["thresholds"][key]["far"]
                    for r in results
                ]),
                "echo_top_abs_m":valid(
                    [
                        r["thresholds"][key]["echo_top_abs_m"]
                        for r in results
                    ],
                    np.median,
                ),
            }

        return {
            "mae":valid([
                r["intensity"]["mae"]
                for r in results
            ]),
            "rmse":valid([
                r["intensity"]["rmse"]
                for r in results
            ]),
            "bias":valid([
                r["intensity"]["bias"]
                for r in results
            ]),
            "thresholds":thresholds,
        }

    return {
        "event_id":event["event_id"],
        "label":event["label"],
        "candidate":aggregate(morph_results),
        "baseline":aggregate(baseline_results),
    }


def serialise_model(model):
    profiles=[]

    for r,regime in enumerate(REGIMES):
        bins=[]

        for b in range(len(BIN_EDGES_DBZ)-1):
            levels=[]

            for iz,altitude in enumerate(model["z"]):
                def clean(v):
                    v=float(v)
                    return v if math.isfinite(v) else None

                levels.append({
                    "altitude_m_amsl":float(altitude),
                    "occupancy_probability":float(
                        model["occupancy"][r,b,iz]
                    ),
                    "median_delta_dbz":clean(
                        model["median_delta"][r,b,iz]
                    ),
                    "p25_delta_dbz":clean(
                        model["p25_delta"][r,b,iz]
                    ),
                    "p75_delta_dbz":clean(
                        model["p75_delta"][r,b,iz]
                    ),
                })

            bins.append({
                "low_level_dbz_min":float(BIN_EDGES_DBZ[b]),
                "low_level_dbz_max":float(BIN_EDGES_DBZ[b+1]),
                "training_columns":int(
                    model["column_counts"][r,b]
                ),
                "levels":levels,
            })

        profiles.append({
            "regime":regime,
            "minimum_occupancy":REGIME_OCCUPANCY[regime],
            "bins":bins,
        })

    return {
        "format":"StormTrackerMorphologyVerticalReflectivityModelV3",
        "scientific_status":"candidate-multi-event-morphology-conditioned-model",
        "regimes":list(REGIMES),
        "classification":{
            "neighbourhood":"7x7 km on 1 km training grid",
            "core":"proxy>=50 OR proxy>=40 with texture>=5 OR proxy>=35 with local max>=50 and texture>=8",
            "fringe":"not core, proxy>=25, local max>=45, texture>=4",
            "broad_rain":"remaining >=20 dBZ columns",
        },
        "minimum_regime_bin_training_columns":MIN_REGIME_BIN_COLUMNS,
        "profiles":profiles,
    }


def main():
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    events=load_events()

    print("="*112)
    print("MORPHOLOGY-CONDITIONED LEAVE-ONE-EVENT-OUT VALIDATION")
    print("="*112)
    print("Candidate uses only live-available 2-D reflectivity morphology: intensity, 7 km local maximum and texture.")
    print()

    results=[]

    for held in events:
        training=[
            event
            for event in events
            if event["event_id"]!=held["event_id"]
        ]

        morph_model=build_morphology_model(training)
        baseline_model=build_baseline_model(training)

        result=evaluate_event(
            held,
            morph_model,
            baseline_model,
        )

        results.append(result)

        print(f"{held['event_id']} — {held['label']}")
        print(
            f"  Candidate MAE {result['candidate']['mae']:.2f} dBZ | "
            f"baseline {result['baseline']['mae']:.2f}"
        )

        for key in ("30","40","50"):
            c=result["candidate"]["thresholds"][key]
            b=result["baseline"]["thresholds"][key]

            print(
                f"  {key} dBZ candidate: IoU {c['iou']:.3f}  POD {c['pod']:.3f}  FAR {c['far']:.3f}  "
                f"top {c['echo_top_abs_m']/1000:.2f} km"
            )
            print(
                f"         baseline:  IoU {b['iou']:.3f}  POD {b['pod']:.3f}  FAR {b['far']:.3f}  "
                f"top {b['echo_top_abs_m']/1000:.2f} km"
            )

        print()

    def overall(which):
        thresholds={}

        for key in ("30","40","50"):
            thresholds[key]={
                "iou":valid([
                    r[which]["thresholds"][key]["iou"]
                    for r in results
                ]),
                "pod":valid([
                    r[which]["thresholds"][key]["pod"]
                    for r in results
                ]),
                "far":valid([
                    r[which]["thresholds"][key]["far"]
                    for r in results
                ]),
                "echo_top_abs_m":valid(
                    [
                        r[which]["thresholds"][key]["echo_top_abs_m"]
                        for r in results
                    ],
                    np.median,
                ),
            }

        return {
            "mae":valid([
                r[which]["mae"]
                for r in results
            ]),
            "rmse":valid([
                r[which]["rmse"]
                for r in results
            ]),
            "bias":valid([
                r[which]["bias"]
                for r in results
            ]),
            "thresholds":thresholds,
        }

    candidate=overall("candidate")
    baseline=overall("baseline")

    final_model=build_morphology_model(events)

    MODEL.write_text(
        json.dumps(
            serialise_model(final_model),
            indent=2,
        )+"\n",
        encoding="utf-8",
    )

    report={
        "format":"StormTrackerMorphologyConditionedCrossEventValidationV2",
        "events":results,
        "candidate":candidate,
        "baseline":baseline,
        "candidate_model_path":str(MODEL.relative_to(ROOT)),
    }

    REPORT.write_text(
        json.dumps(report,indent=2)+"\n",
        encoding="utf-8",
    )

    print("="*112)
    print("CROSS-EVENT COMPARISON")
    print("="*112)
    print(
        f"Intensity MAE: candidate {candidate['mae']:.2f} dBZ | baseline {baseline['mae']:.2f} dBZ"
    )
    print(
        f"Intensity RMSE: candidate {candidate['rmse']:.2f} dBZ | baseline {baseline['rmse']:.2f} dBZ"
    )
    print(
        f"Intensity bias: candidate {candidate['bias']:+.2f} dBZ | baseline {baseline['bias']:+.2f} dBZ"
    )

    for key in ("30","40","50"):
        c=candidate["thresholds"][key]
        b=baseline["thresholds"][key]

        print(
            f"{key} dBZ candidate: IoU={c['iou']:.3f} POD={c['pod']:.3f} FAR={c['far']:.3f} "
            f"top={c['echo_top_abs_m']/1000:.2f} km"
        )
        print(
            f"       baseline:  IoU={b['iou']:.3f} POD={b['pod']:.3f} FAR={b['far']:.3f} "
            f"top={b['echo_top_abs_m']/1000:.2f} km"
        )

    print()
    print(f"Report: {REPORT.relative_to(ROOT)}")
    print(f"Candidate V3 model: {MODEL.relative_to(ROOT)}")
    print()
    print("MORPHOLOGY-CONDITIONED VALIDATION: COMPLETE")
    print("Do not deploy the V3 candidate until the comparison is reviewed.")


if __name__=="__main__":
    main()
PY

chmod +x scripts/validate_inferred_volume_morphology_v2.py

python3 scripts/validate_inferred_volume_morphology_v2.py

echo
echo "DONE"
echo
echo "Send me:"
echo "  • each held-out event candidate/baseline block"
echo "  • the CROSS-EVENT COMPARISON block"
echo "  • MORPHOLOGY-CONDITIONED VALIDATION: COMPLETE"
echo
echo "Do not commit the candidate V3 model yet."
