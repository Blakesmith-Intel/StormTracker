#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

VOXEL_DIR="data/aura/derived/66/2014-11-27"
REPORT="${VOXEL_DIR}/inferred_volume_validation_v1.json"
MODEL="${VOXEL_DIR}/inferred_vertical_profile_model_v1.json"

echo "StormTracker — live-2D to inferred-3D scientific validation v1"
echo

for i in $(seq -w 0 12); do
  if [ ! -f "$VOXEL_DIR/frame_${i}.voxel_1km_500m.npz" ]; then
    echo "ERROR: Missing measured voxel volume:"
    echo "  $VOXEL_DIR/frame_${i}.voxel_1km_500m.npz"
    exit 1
  fi
done

if ! python3 - <<'PY' >/dev/null 2>&1
import numpy
PY
then
  echo "Installing NumPy as a build-time dependency..."
  python3 -m pip install --user --quiet numpy
fi

mkdir -p scripts "$VOXEL_DIR"

cat > scripts/validate_inferred_volume_v1.py <<'PY'
#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]

VOXEL_DIR = (
    ROOT
    / "data"
    / "aura"
    / "derived"
    / "66"
    / "2014-11-27"
)

REPORT = (
    VOXEL_DIR
    / "inferred_volume_validation_v1.json"
)

MODEL = (
    VOXEL_DIR
    / "inferred_vertical_profile_model_v1.json"
)

FRAME_COUNT = 13

# This intentionally uses only information that a 2-D reflectivity product
# could plausibly provide: one low-level reflectivity value per horizontal
# grid cell. No measured upper-level value from the validation frame is
# allowed into its inferred volume.
LOW_LEVEL_MAX_ALTITUDE_M = 1500.0

# Restrict validation to the better-sampled central radar domain.
VALIDATION_RADIUS_M = 120_000.0

# Empirical reflectivity classes used to condition the vertical profile.
BIN_EDGES_DBZ = np.array(
    [20, 25, 30, 35, 40, 45, 50, 55, 60, 90],
    dtype=np.float64,
)

# Require at least this fraction of training columns in a reflectivity class
# to contain >=20 dBZ echo at a height before that height is reconstructed.
OCCUPANCY_THRESHOLD = 0.35

THRESHOLDS_DBZ = (20.0, 30.0, 40.0, 50.0)


def load_frame(index: int) -> dict:
    path = (
        VOXEL_DIR
        / f"frame_{index:02d}.voxel_1km_500m.npz"
    )

    with np.load(path) as volume:
        return {
            "dbzh": np.asarray(
                volume["dbzh"],
                dtype=np.float32,
            ),
            "x": np.asarray(
                volume["x_centres_m"],
                dtype=np.float32,
            ),
            "y": np.asarray(
                volume["y_centres_m"],
                dtype=np.float32,
            ),
            "z": np.asarray(
                volume["z_centres_m"],
                dtype=np.float32,
            ),
        }


def low_level_proxy(
    dbzh: np.ndarray,
    z: np.ndarray,
) -> np.ndarray:
    levels = np.where(
        z <= LOW_LEVEL_MAX_ALTITUDE_M
    )[0]

    if not len(levels):
        raise ValueError(
            "No voxel levels fall inside low-level proxy layer."
        )

    subset = dbzh[levels]

    finite = np.isfinite(subset)

    # Use the strongest measured value in the lowest 1.5 km as a stable
    # pseudo-live 2-D proxy. This is not claimed to be identical to BOM's
    # operational mosaic construction.
    safe = np.where(
        finite,
        subset,
        -np.inf,
    )

    proxy = np.max(
        safe,
        axis=0,
    ).astype(np.float32)

    proxy[
        ~np.any(finite, axis=0)
    ] = np.nan

    return proxy


def horizontal_domain_mask(
    x: np.ndarray,
    y: np.ndarray,
) -> np.ndarray:
    xx, yy = np.meshgrid(
        x.astype(np.float64),
        y.astype(np.float64),
        indexing="xy",
    )

    return (
        np.hypot(xx, yy)
        <= VALIDATION_RADIUS_M
    )


def class_index(
    proxy: np.ndarray,
) -> np.ndarray:
    # Returns -1 below the model domain.
    result = np.digitize(
        proxy,
        BIN_EDGES_DBZ,
        right=False,
    ) - 1

    result[
        (~np.isfinite(proxy))
        | (proxy < BIN_EDGES_DBZ[0])
    ] = -1

    result[
        result >= len(BIN_EDGES_DBZ) - 1
    ] = len(BIN_EDGES_DBZ) - 2

    return result


def build_model(
    frames: list[dict],
    training_indices: list[int],
) -> dict:
    z = frames[0]["z"].astype(np.float64)
    bin_count = len(BIN_EDGES_DBZ) - 1

    delta_samples = [
        [
            []
            for _ in range(len(z))
        ]
        for _ in range(bin_count)
    ]

    echo_counts = np.zeros(
        (bin_count, len(z)),
        dtype=np.int64,
    )

    column_counts = np.zeros(
        bin_count,
        dtype=np.int64,
    )

    domain = horizontal_domain_mask(
        frames[0]["x"],
        frames[0]["y"],
    )

    for frame_index in training_indices:
        frame = frames[frame_index]
        dbzh = frame["dbzh"].astype(np.float64)
        proxy = low_level_proxy(
            dbzh,
            frame["z"],
        ).astype(np.float64)

        classes = class_index(proxy)

        for b in range(bin_count):
            columns = (
                domain
                & (classes == b)
            )

            count = int(columns.sum())

            if count == 0:
                continue

            column_counts[b] += count
            base_values = proxy[columns]

            for iz in range(len(z)):
                values = dbzh[iz][columns]

                echo = (
                    np.isfinite(values)
                    & (values >= 20.0)
                )

                if not np.any(echo):
                    continue

                echo_counts[b, iz] += int(
                    echo.sum()
                )

                delta_samples[b][iz].append(
                    (
                        values[echo]
                        - base_values[echo]
                    ).astype(np.float32)
                )

    median_delta = np.full(
        (bin_count, len(z)),
        np.nan,
        dtype=np.float32,
    )

    p25_delta = np.full_like(
        median_delta,
        np.nan,
    )

    p75_delta = np.full_like(
        median_delta,
        np.nan,
    )

    occupancy = np.zeros(
        (bin_count, len(z)),
        dtype=np.float32,
    )

    for b in range(bin_count):
        if column_counts[b] > 0:
            occupancy[b] = (
                echo_counts[b]
                / column_counts[b]
            ).astype(np.float32)

        for iz in range(len(z)):
            if not delta_samples[b][iz]:
                continue

            samples = np.concatenate(
                delta_samples[b][iz]
            ).astype(np.float64)

            median_delta[b, iz] = float(
                np.median(samples)
            )

            p25_delta[b, iz] = float(
                np.percentile(
                    samples,
                    25,
                )
            )

            p75_delta[b, iz] = float(
                np.percentile(
                    samples,
                    75,
                )
            )

    return {
        "z": z.astype(np.float32),
        "column_counts": column_counts,
        "occupancy": occupancy,
        "median_delta": median_delta,
        "p25_delta": p25_delta,
        "p75_delta": p75_delta,
    }


def infer_volume(
    frame: dict,
    model: dict,
) -> tuple[np.ndarray, np.ndarray]:
    proxy = low_level_proxy(
        frame["dbzh"],
        frame["z"],
    ).astype(np.float64)

    classes = class_index(proxy)
    z = frame["z"]

    predicted = np.full(
        frame["dbzh"].shape,
        np.nan,
        dtype=np.float32,
    )

    confidence = np.zeros(
        frame["dbzh"].shape,
        dtype=np.float32,
    )

    bin_count = (
        len(BIN_EDGES_DBZ) - 1
    )

    for b in range(bin_count):
        columns = classes == b

        if not np.any(columns):
            continue

        base = proxy[columns]

        for iz in range(len(z)):
            occ = float(
                model["occupancy"][b, iz]
            )

            delta = float(
                model["median_delta"][b, iz]
            )

            if (
                occ < OCCUPANCY_THRESHOLD
                or not math.isfinite(delta)
            ):
                continue

            values = base + delta

            # The model represents radar-reflectivity intensity only.
            values = np.clip(
                values,
                -10.0,
                85.0,
            )

            keep = values >= 20.0

            if not np.any(keep):
                continue

            layer = predicted[iz]
            layer_conf = confidence[iz]

            column_indices = np.flatnonzero(
                columns.ravel()
            )

            selected = column_indices[
                keep
            ]

            layer.ravel()[selected] = (
                values[keep]
            ).astype(np.float32)

            layer_conf.ravel()[selected] = occ

    return predicted, confidence


def contingency(
    measured: np.ndarray,
    predicted: np.ndarray,
    threshold: float,
    domain: np.ndarray,
) -> dict:
    domain3 = np.broadcast_to(
        domain[None, :, :],
        measured.shape,
    )

    measured_mask = (
        domain3
        & np.isfinite(measured)
        & (measured >= threshold)
    )

    predicted_mask = (
        domain3
        & np.isfinite(predicted)
        & (predicted >= threshold)
    )

    hits = int(
        np.count_nonzero(
            measured_mask
            & predicted_mask
        )
    )

    misses = int(
        np.count_nonzero(
            measured_mask
            & ~predicted_mask
        )
    )

    false_alarms = int(
        np.count_nonzero(
            predicted_mask
            & ~measured_mask
        )
    )

    union = (
        hits
        + misses
        + false_alarms
    )

    iou = (
        hits / union
        if union
        else None
    )

    pod = (
        hits / (hits + misses)
        if hits + misses
        else None
    )

    far = (
        false_alarms
        / (hits + false_alarms)
        if hits + false_alarms
        else None
    )

    return {
        "hits": hits,
        "misses": misses,
        "false_alarms": false_alarms,
        "iou": iou,
        "probability_of_detection": pod,
        "false_alarm_ratio": far,
    }


def column_echo_top(
    volume: np.ndarray,
    z: np.ndarray,
    threshold: float,
) -> np.ndarray:
    mask = (
        np.isfinite(volume)
        & (volume >= threshold)
    )

    result = np.full(
        volume.shape[1:],
        np.nan,
        dtype=np.float32,
    )

    if not np.any(mask):
        return result

    for iz, altitude in enumerate(z):
        result[
            mask[iz]
        ] = float(altitude)

    return result


def top_metrics(
    measured: np.ndarray,
    predicted: np.ndarray,
    z: np.ndarray,
    threshold: float,
    domain: np.ndarray,
) -> dict:
    measured_top = column_echo_top(
        measured,
        z,
        threshold,
    )

    predicted_top = column_echo_top(
        predicted,
        z,
        threshold,
    )

    paired = (
        domain
        & np.isfinite(measured_top)
        & np.isfinite(predicted_top)
    )

    measured_exists = (
        domain
        & np.isfinite(measured_top)
    )

    predicted_exists = (
        domain
        & np.isfinite(predicted_top)
    )

    if np.any(paired):
        errors = (
            predicted_top[paired]
            - measured_top[paired]
        ).astype(np.float64)

        median_abs_error = float(
            np.median(
                np.abs(errors)
            )
        )

        bias = float(
            np.mean(errors)
        )
    else:
        median_abs_error = None
        bias = None

    domain_measured_top = (
        float(
            np.nanmax(
                measured_top[
                    measured_exists
                ]
            )
        )
        if np.any(measured_exists)
        else None
    )

    domain_predicted_top = (
        float(
            np.nanmax(
                predicted_top[
                    predicted_exists
                ]
            )
        )
        if np.any(predicted_exists)
        else None
    )

    return {
        "paired_columns": int(
            paired.sum()
        ),
        "median_absolute_error_m": (
            median_abs_error
        ),
        "mean_bias_m": bias,
        "domain_max_measured_m": (
            domain_measured_top
        ),
        "domain_max_inferred_m": (
            domain_predicted_top
        ),
    }


def intensity_metrics(
    measured: np.ndarray,
    predicted: np.ndarray,
    domain: np.ndarray,
) -> dict:
    domain3 = np.broadcast_to(
        domain[None, :, :],
        measured.shape,
    )

    paired = (
        domain3
        & np.isfinite(measured)
        & np.isfinite(predicted)
        & (measured >= 20.0)
        & (predicted >= 20.0)
    )

    if not np.any(paired):
        return {
            "paired_voxels": 0,
            "mae_dbz": None,
            "rmse_dbz": None,
            "bias_dbz": None,
        }

    errors = (
        predicted[paired].astype(np.float64)
        - measured[paired].astype(np.float64)
    )

    return {
        "paired_voxels": int(
            paired.sum()
        ),
        "mae_dbz": float(
            np.mean(
                np.abs(errors)
            )
        ),
        "rmse_dbz": float(
            np.sqrt(
                np.mean(
                    errors * errors
                )
            )
        ),
        "bias_dbz": float(
            np.mean(errors)
        ),
    }


def json_number(value):
    if value is None:
        return None

    if isinstance(
        value,
        (np.integer,)
    ):
        return int(value)

    if isinstance(
        value,
        (np.floating,)
    ):
        value = float(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            return None

    return value


def serialise_model(model: dict) -> dict:
    profiles = []

    for b in range(
        len(BIN_EDGES_DBZ) - 1
    ):
        levels = []

        for iz, altitude in enumerate(
            model["z"]
        ):
            levels.append({
                "altitude_m_amsl": float(
                    altitude
                ),
                "occupancy_probability": float(
                    model["occupancy"][b, iz]
                ),
                "median_delta_dbz": json_number(
                    model[
                        "median_delta"
                    ][b, iz]
                ),
                "p25_delta_dbz": json_number(
                    model[
                        "p25_delta"
                    ][b, iz]
                ),
                "p75_delta_dbz": json_number(
                    model[
                        "p75_delta"
                    ][b, iz]
                ),
            })

        profiles.append({
            "low_level_dbz_min": float(
                BIN_EDGES_DBZ[b]
            ),
            "low_level_dbz_max": float(
                BIN_EDGES_DBZ[b + 1]
            ),
            "training_columns": int(
                model[
                    "column_counts"
                ][b]
            ),
            "levels": levels,
        })

    return {
        "format": (
            "StormTrackerEmpiricalVerticalReflectivityModelV1"
        ),
        "scientific_status": (
            "prototype-historical-single-event-calibration"
        ),
        "interpretation": (
            "Empirical vertical reflectivity profiles conditioned only "
            "on a low-level 2-D reflectivity proxy. This model is for "
            "validation and development, not yet a general operational "
            "storm-volume model."
        ),
        "low_level_proxy": {
            "definition": (
                "maximum measured DBZH at voxel altitudes <=1500 m AMSL"
            ),
            "note": (
                "This is a historical pseudo-live proxy and is not claimed "
                "to reproduce the Bureau operational mosaic algorithm."
            ),
        },
        "validation_radius_m": (
            VALIDATION_RADIUS_M
        ),
        "occupancy_threshold": (
            OCCUPANCY_THRESHOLD
        ),
        "profiles": profiles,
    }


def mean_valid(
    values: list[float | None],
) -> float | None:
    finite = [
        float(value)
        for value in values
        if value is not None
        and math.isfinite(
            float(value)
        )
    ]

    return (
        float(np.mean(finite))
        if finite
        else None
    )


def median_valid(
    values: list[float | None],
) -> float | None:
    finite = [
        float(value)
        for value in values
        if value is not None
        and math.isfinite(
            float(value)
        )
    ]

    return (
        float(np.median(finite))
        if finite
        else None
    )


def main():
    frames = [
        load_frame(index)
        for index in range(
            FRAME_COUNT
        )
    ]

    reference_shape = (
        frames[0]["dbzh"].shape
    )

    for index, frame in enumerate(
        frames
    ):
        if (
            frame["dbzh"].shape
            != reference_shape
        ):
            raise RuntimeError(
                f"Frame {index} has a different voxel shape."
            )

    domain = horizontal_domain_mask(
        frames[0]["x"],
        frames[0]["y"],
    )

    fold_results = []

    print()
    print(
        "StormTracker — inferred 3-D leave-one-frame-out validation"
    )
    print("=" * 112)
    print(
        "Input proxy: max measured reflectivity in lowest 1.5 km "
        "(historical stand-in for a live 2-D field)"
    )
    print(
        f"Validation radius: {VALIDATION_RADIUS_M/1000:.0f} km | "
        f"training: 12 frames | validation: 1 frame | folds: {FRAME_COUNT}"
    )
    print(
        "Inference: empirical vertical reflectivity delta + "
        f"occupancy >= {OCCUPANCY_THRESHOLD:.2f}"
    )
    print()

    for validation_index in range(
        FRAME_COUNT
    ):
        training_indices = [
            index
            for index in range(
                FRAME_COUNT
            )
            if index != validation_index
        ]

        model = build_model(
            frames,
            training_indices,
        )

        measured = frames[
            validation_index
        ]["dbzh"]

        predicted, confidence = infer_volume(
            frames[validation_index],
            model,
        )

        threshold_metrics = {}

        for threshold in THRESHOLDS_DBZ:
            threshold_metrics[
                str(int(threshold))
            ] = {
                "contingency": contingency(
                    measured,
                    predicted,
                    threshold,
                    domain,
                ),
                "echo_top": top_metrics(
                    measured,
                    predicted,
                    frames[
                        validation_index
                    ]["z"],
                    threshold,
                    domain,
                ),
            }

        intensity = intensity_metrics(
            measured,
            predicted,
            domain,
        )

        fold = {
            "validation_frame": (
                validation_index
            ),
            "thresholds": (
                threshold_metrics
            ),
            "intensity": intensity,
            "inferred_voxels_20plus": int(
                np.count_nonzero(
                    np.isfinite(predicted)
                    & (predicted >= 20.0)
                )
            ),
            "mean_inference_confidence": (
                float(
                    np.mean(
                        confidence[
                            confidence > 0
                        ]
                    )
                )
                if np.any(
                    confidence > 0
                )
                else None
            ),
        }

        fold_results.append(
            fold
        )

        c30 = threshold_metrics[
            "30"
        ]["contingency"]

        c40 = threshold_metrics[
            "40"
        ]["contingency"]

        top40 = threshold_metrics[
            "40"
        ]["echo_top"]

        print(
            f"Fold {validation_index:02d}: "
            f"MAE={intensity['mae_dbz'] if intensity['mae_dbz'] is not None else float('nan'):.2f} dBZ | "
            f"IoU30={c30['iou'] if c30['iou'] is not None else float('nan'):.3f} | "
            f"IoU40={c40['iou'] if c40['iou'] is not None else float('nan'):.3f} | "
            f"ET40 median abs="
            + (
                f"{top40['median_absolute_error_m']/1000:.2f} km"
                if top40[
                    "median_absolute_error_m"
                ] is not None
                else "n/a"
            )
        )

    aggregate_thresholds = {}

    for threshold in THRESHOLDS_DBZ:
        key = str(int(threshold))

        aggregate_thresholds[key] = {
            "mean_iou": mean_valid([
                fold["thresholds"][key][
                    "contingency"
                ]["iou"]
                for fold in fold_results
            ]),
            "mean_probability_of_detection": mean_valid([
                fold["thresholds"][key][
                    "contingency"
                ][
                    "probability_of_detection"
                ]
                for fold in fold_results
            ]),
            "mean_false_alarm_ratio": mean_valid([
                fold["thresholds"][key][
                    "contingency"
                ][
                    "false_alarm_ratio"
                ]
                for fold in fold_results
            ]),
            "median_echo_top_absolute_error_m": median_valid([
                fold["thresholds"][key][
                    "echo_top"
                ][
                    "median_absolute_error_m"
                ]
                for fold in fold_results
            ]),
            "mean_echo_top_bias_m": mean_valid([
                fold["thresholds"][key][
                    "echo_top"
                ][
                    "mean_bias_m"
                ]
                for fold in fold_results
            ]),
        }

    aggregate = {
        "mean_intensity_mae_dbz": mean_valid([
            fold["intensity"]["mae_dbz"]
            for fold in fold_results
        ]),
        "mean_intensity_rmse_dbz": mean_valid([
            fold["intensity"]["rmse_dbz"]
            for fold in fold_results
        ]),
        "mean_intensity_bias_dbz": mean_valid([
            fold["intensity"]["bias_dbz"]
            for fold in fold_results
        ]),
        "thresholds": (
            aggregate_thresholds
        ),
    }

    all_model = build_model(
        frames,
        list(range(FRAME_COUNT)),
    )

    MODEL.write_text(
        json.dumps(
            serialise_model(
                all_model
            ),
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    report = {
        "format": (
            "StormTrackerInferredVolumeValidationV1"
        ),
        "scientific_status": (
            "prototype-historical-single-event-cross-validation"
        ),
        "purpose": (
            "Determine whether a live 2-D reflectivity field can support "
            "a defensible empirical 3-D intensity reconstruction before "
            "the method is added to the browser application."
        ),
        "important_limitations": [
            (
                "All 13 validation frames come from one historical "
                "Mt Stapylton event, so temporal dependence can make "
                "skill appear better than true out-of-event skill."
            ),
            (
                "The low-level historical proxy is not identical to the "
                "Bureau public operational reflectivity mosaic."
            ),
            (
                "This prototype uses reflectivity only. It does not yet "
                "condition on Doppler, satellite cloud-top context, "
                "environmental observations or storm lifecycle."
            ),
            (
                "Any eventual live product based on this method must be "
                "labelled inferred volumetric intensity, not measured "
                "volumetric radar."
            ),
        ],
        "configuration": {
            "frame_count": (
                FRAME_COUNT
            ),
            "validation_method": (
                "leave-one-frame-out"
            ),
            "low_level_max_altitude_m": (
                LOW_LEVEL_MAX_ALTITUDE_M
            ),
            "validation_radius_m": (
                VALIDATION_RADIUS_M
            ),
            "bin_edges_dbz": (
                BIN_EDGES_DBZ.tolist()
            ),
            "occupancy_threshold": (
                OCCUPANCY_THRESHOLD
            ),
        },
        "folds": fold_results,
        "aggregate": aggregate,
        "candidate_model_path": str(
            MODEL.relative_to(ROOT)
        ),
    }

    REPORT.write_text(
        json.dumps(
            report,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print("-" * 112)
    print(
        "Aggregate cross-validation"
    )
    print(
        f"Intensity MAE:        "
        f"{aggregate['mean_intensity_mae_dbz']:.2f} dBZ"
    )
    print(
        f"Intensity RMSE:       "
        f"{aggregate['mean_intensity_rmse_dbz']:.2f} dBZ"
    )
    print(
        f"Intensity bias:       "
        f"{aggregate['mean_intensity_bias_dbz']:+.2f} dBZ"
    )

    for key in (
        "30",
        "40",
        "50",
    ):
        item = aggregate[
            "thresholds"
        ][key]

        top_error = item[
            "median_echo_top_absolute_error_m"
        ]

        print(
            f"{key} dBZ: IoU={item['mean_iou']:.3f}  "
            f"POD={item['mean_probability_of_detection']:.3f}  "
            f"FAR={item['mean_false_alarm_ratio']:.3f}  "
            f"echo-top median abs="
            + (
                f"{top_error/1000:.2f} km"
                if top_error is not None
                else "n/a"
            )
        )

    print()
    print(
        "Validation report:"
    )
    print(
        f"  {REPORT.relative_to(ROOT)}"
    )
    print(
        "Candidate empirical profile model:"
    )
    print(
        f"  {MODEL.relative_to(ROOT)}"
    )
    print()
    print(
        "INFERRED 3-D PROTOTYPE VALIDATION: COMPLETE"
    )
    print(
        "No live inferred volume has been deployed yet. "
        "Review these measured-vs-inferred errors first."
    )


if __name__ == "__main__":
    main()
PY

chmod +x scripts/validate_inferred_volume_v1.py

python3 scripts/validate_inferred_volume_v1.py

echo
echo "DONE"
echo
echo "Send me the terminal output from:"
echo "  Aggregate cross-validation"
echo "through:"
echo "  INFERRED 3-D PROTOTYPE VALIDATION: COMPLETE"
echo
echo "Do not commit the candidate model yet."
