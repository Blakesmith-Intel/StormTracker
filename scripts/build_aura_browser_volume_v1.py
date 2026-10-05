#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import h5py
import numpy as np
from pyproj import Geod


ROOT = Path(__file__).resolve().parents[1]

SOURCE_MANIFEST = (
    ROOT
    / "data"
    / "aura"
    / "reference"
    / "66"
    / "2014-11-27"
    / "reference_source_manifest.json"
)

DERIVED_DIR = (
    ROOT
    / "data"
    / "aura"
    / "derived"
    / "66"
    / "2014-11-27"
)

BROWSER_DIR = (
    ROOT
    / "frontend"
    / "3d-data"
    / "aura66-20141127"
)

SEQUENCE_MANIFEST = (
    DERIVED_DIR
    / "sequence_build_manifest.json"
)

BROWSER_MANIFEST = (
    BROWSER_DIR
    / "manifest.json"
)

# Standard-atmosphere radar beam geometry.
EARTH_RADIUS_M = 6_371_000.0
EFFECTIVE_EARTH_RADIUS_M = EARTH_RADIUS_M * 4.0 / 3.0

# Fixed frame-to-frame Cartesian volume geometry. Keeping every frame on one
# grid is important for later 3-D segmentation and persistent tracking.
X_MIN_M = -160_000.0
X_MAX_M = 160_000.0
Y_MIN_M = -160_000.0
Y_MAX_M = 160_000.0
Z_MIN_M = 0.0
Z_MAX_M = 25_000.0

DX_M = 1_000.0
DY_M = 1_000.0
DZ_M = 500.0

# Static browser data contains all occupied voxels at or above 20 dBZ.
# The viewer can apply a higher threshold interactively without inventing data.
BROWSER_MIN_DBZH = 20.0

GEOD = Geod(ellps="WGS84")


def text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, np.bytes_):
        return bytes(value).decode("utf-8", errors="replace")
    return str(value)


def attr(group, name, default=None):
    if group is None:
        return default
    return group.attrs.get(name, default)


def attr_float(group, name, default=None):
    value = attr(group, name, default)
    if value is None:
        return None
    array = np.asarray(value)
    if array.size != 1:
        return None
    return float(array.reshape(-1)[0])


def attr_array(group, name):
    if group is None or name not in group.attrs:
        return None
    try:
        return np.asarray(group.attrs[name], dtype=np.float64).reshape(-1)
    except Exception:
        return None


def find_quantity_group(dataset, wanted):
    wanted = {q.upper() for q in wanted}

    for key in sorted(dataset.keys()):
        if not key.startswith("data"):
            continue

        group = dataset[key]

        if "what" not in group or "data" not in group:
            continue

        quantity = text(
            group["what"].attrs.get("quantity", "")
        ).upper()

        if quantity in wanted:
            return group, quantity

    return None, None


def decode_moment(group):
    raw = np.asarray(group["data"][...])
    what = group["what"]

    gain = float(np.asarray(what.attrs.get("gain", 1.0)).reshape(-1)[0])
    offset = float(np.asarray(what.attrs.get("offset", 0.0)).reshape(-1)[0])

    nodata = what.attrs.get("nodata", None)
    undetect = what.attrs.get("undetect", None)

    valid = np.ones(raw.shape, dtype=bool)

    if nodata is not None:
        valid &= raw != np.asarray(nodata).reshape(-1)[0]

    if undetect is not None:
        valid &= raw != np.asarray(undetect).reshape(-1)[0]

    decoded = raw.astype(np.float32) * gain + offset
    decoded[~valid] = np.nan

    return decoded


def circular_midpoint(start_deg, stop_deg):
    delta = (stop_deg - start_deg + 540.0) % 360.0 - 180.0
    return (start_deg + 0.5 * delta) % 360.0


def ray_geometry(dataset, nrays):
    how = dataset.get("how")
    where = dataset.get("where")

    # Prefer actual per-ray azimuth metadata.
    start_az = attr_array(how, "startazA")
    stop_az = attr_array(how, "stopazA")

    if (
        start_az is not None
        and stop_az is not None
        and len(start_az) == nrays
        and len(stop_az) == nrays
    ):
        azimuth = circular_midpoint(start_az, stop_az)
        azimuth_source = "how/startazA+stopazA"

    else:
        azangles = attr_array(how, "azangles")

        if azangles is not None and len(azangles) == nrays:
            azimuth = np.mod(azangles, 360.0)
            azimuth_source = "how/azangles"
        else:
            # ODIM surveillance volumes are full 360-degree scans. This
            # fallback is retained for format tolerance, but is reported.
            azimuth = (
                np.arange(nrays, dtype=np.float64)
                + 0.5
            ) * (360.0 / nrays)
            azimuth_source = "uniform-360-fallback"

    start_el = attr_array(how, "startelA")
    stop_el = attr_array(how, "stopelA")

    if (
        start_el is not None
        and stop_el is not None
        and len(start_el) == nrays
        and len(stop_el) == nrays
    ):
        elevation = 0.5 * (start_el + stop_el)
        elevation_source = "how/startelA+stopelA"
    else:
        elangle = attr_float(where, "elangle")

        if elangle is None:
            raise ValueError("Sweep has no usable elevation geometry.")

        elevation = np.full(nrays, elangle, dtype=np.float64)
        elevation_source = "where/elangle"

    return (
        np.asarray(azimuth, dtype=np.float64),
        np.asarray(elevation, dtype=np.float64),
        azimuth_source,
        elevation_source,
    )


def gate_ranges(dataset, nbins):
    where = dataset["where"]

    rstart_km = attr_float(where, "rstart", 0.0)
    rscale_m = attr_float(where, "rscale")

    if rscale_m is None or rscale_m <= 0:
        raise ValueError("Sweep has invalid/missing ODIM rscale.")

    # ODIM rstart is kilometres to the start of the first bin; rscale is m.
    return (
        rstart_km * 1000.0
        + (
            np.arange(nbins, dtype=np.float64)
            + 0.5
        )
        * rscale_m
    )


def antenna_to_cartesian(ranges_m, azimuth_deg, elevation_deg):
    r = ranges_m
    theta_a = np.deg2rad(azimuth_deg)
    theta_e = np.deg2rad(elevation_deg)
    R = EFFECTIVE_EARTH_RADIUS_M

    z = (
        np.sqrt(
            r * r
            + R * R
            + 2.0 * r * R * np.sin(theta_e)
        )
        - R
    )

    argument = (
        r
        * np.cos(theta_e)
        / (R + z)
    )

    argument = np.clip(argument, -1.0, 1.0)

    s = R * np.arcsin(argument)

    x = s * np.sin(theta_a)
    y = s * np.cos(theta_a)

    return x, y, z


def scan_time(h5, fallback):
    if "what" not in h5:
        return fallback

    what = h5["what"]
    date_value = text(what.attrs.get("date", "")).strip()
    time_value = text(what.attrs.get("time", "")).strip()

    if len(date_value) == 8 and len(time_value) >= 6:
        return (
            f"{date_value[0:4]}-{date_value[4:6]}-{date_value[6:8]}"
            f"T{time_value[0:2]}:{time_value[2:4]}:{time_value[4:6]}Z"
        )

    return fallback


def load_frame(path, fallback_scan_time):
    with h5py.File(path, "r") as h5:
        if "where" not in h5:
            raise ValueError(f"{path.name}: root /where missing")

        root_where = h5["where"]

        radar_lon = attr_float(root_where, "lon")
        radar_lat = attr_float(root_where, "lat")
        radar_height = attr_float(root_where, "height", 0.0)

        if radar_lon is None or radar_lat is None:
            raise ValueError(f"{path.name}: radar lon/lat missing")

        xs = []
        ys = []
        zs = []
        dbzs = []
        vrads = []
        sweep_metadata = []

        source_max_dbzh = -np.inf
        total_valid_gates = 0

        datasets = sorted(
            key
            for key in h5.keys()
            if key.startswith("dataset")
        )

        for dataset_name in datasets:
            dataset = h5[dataset_name]

            dbzh_group, dbzh_quantity = find_quantity_group(
                dataset,
                {"DBZH"}
            )

            if dbzh_group is None:
                continue

            dbzh = decode_moment(dbzh_group)

            if dbzh.ndim != 2:
                raise ValueError(
                    f"{path.name}/{dataset_name}: DBZH is not 2-D"
                )

            nrays, nbins = dbzh.shape

            vrad_group, vrad_quantity = find_quantity_group(
                dataset,
                {"VRADH", "VRAD"}
            )

            if vrad_group is not None:
                vrad = decode_moment(vrad_group)
                if vrad.shape != dbzh.shape:
                    vrad = np.full(dbzh.shape, np.nan, dtype=np.float32)
                    vrad_quantity = "shape-mismatch"
            else:
                vrad = np.full(dbzh.shape, np.nan, dtype=np.float32)
                vrad_quantity = None

            (
                azimuth,
                elevation,
                azimuth_source,
                elevation_source,
            ) = ray_geometry(dataset, nrays)

            ranges = gate_ranges(dataset, nbins)

            az2 = np.repeat(
                azimuth[:, None],
                nbins,
                axis=1,
            )

            el2 = np.repeat(
                elevation[:, None],
                nbins,
                axis=1,
            )

            range2 = np.repeat(
                ranges[None, :],
                nrays,
                axis=0,
            )

            x, y, relative_z = antenna_to_cartesian(
                range2,
                az2,
                el2,
            )

            altitude = relative_z + radar_height

            valid = np.isfinite(dbzh)

            if not np.any(valid):
                continue

            frame_dbzh = dbzh[valid].astype(np.float32)
            frame_vrad = vrad[valid].astype(np.float32)

            xs.append(x[valid].astype(np.float32))
            ys.append(y[valid].astype(np.float32))
            zs.append(altitude[valid].astype(np.float32))
            dbzs.append(frame_dbzh)
            vrads.append(frame_vrad)

            source_max_dbzh = max(
                source_max_dbzh,
                float(np.nanmax(frame_dbzh)),
            )

            total_valid_gates += int(valid.sum())

            where = dataset.get("where")

            sweep_metadata.append({
                "dataset": dataset_name,
                "elevation_nominal_deg": attr_float(where, "elangle"),
                "nrays": int(nrays),
                "nbins": int(nbins),
                "rstart_km": attr_float(where, "rstart", 0.0),
                "rscale_m": attr_float(where, "rscale"),
                "azimuth_source": azimuth_source,
                "elevation_source": elevation_source,
                "dbzh_quantity": dbzh_quantity,
                "vrad_quantity": vrad_quantity,
            })

        if not xs:
            raise ValueError(f"{path.name}: no valid DBZH gates found")

        return {
            "scan_time": scan_time(h5, fallback_scan_time),
            "radar": {
                "longitude": float(radar_lon),
                "latitude": float(radar_lat),
                "antenna_height_m": float(radar_height),
            },
            "x": np.concatenate(xs),
            "y": np.concatenate(ys),
            "z": np.concatenate(zs),
            "dbzh": np.concatenate(dbzs),
            "vradh_ms": np.concatenate(vrads),
            "source_max_dbzh": float(source_max_dbzh),
            "source_valid_gate_count": int(total_valid_gates),
            "sweeps": sweep_metadata,
        }


def voxel_axes():
    x = np.arange(
        X_MIN_M + DX_M / 2.0,
        X_MAX_M,
        DX_M,
        dtype=np.float32,
    )

    y = np.arange(
        Y_MIN_M + DY_M / 2.0,
        Y_MAX_M,
        DY_M,
        dtype=np.float32,
    )

    z = np.arange(
        Z_MIN_M + DZ_M / 2.0,
        Z_MAX_M,
        DZ_M,
        dtype=np.float32,
    )

    return x, y, z


def voxelise(frame):
    x_centres, y_centres, z_centres = voxel_axes()

    nx = len(x_centres)
    ny = len(y_centres)
    nz = len(z_centres)

    x = frame["x"].astype(np.float64)
    y = frame["y"].astype(np.float64)
    z = frame["z"].astype(np.float64)
    dbzh = frame["dbzh"].astype(np.float64)
    vrad = frame["vradh_ms"].astype(np.float64)

    ix = np.floor((x - X_MIN_M) / DX_M).astype(np.int64)
    iy = np.floor((y - Y_MIN_M) / DY_M).astype(np.int64)
    iz = np.floor((z - Z_MIN_M) / DZ_M).astype(np.int64)

    inside = (
        np.isfinite(dbzh)
        & (ix >= 0)
        & (ix < nx)
        & (iy >= 0)
        & (iy < ny)
        & (iz >= 0)
        & (iz < nz)
    )

    if not np.any(inside):
        raise ValueError("No valid radar gates fall inside the fixed 3-D grid.")

    ix = ix[inside]
    iy = iy[inside]
    iz = iz[inside]
    dbzh = dbzh[inside]
    vrad = vrad[inside]

    flat = (iz * ny + iy) * nx + ix

    # Stable aggregation contract:
    # - one output value per voxel;
    # - DBZH is the maximum measured gate reflectivity in the voxel;
    # - VRADH is taken from that same strongest-reflectivity gate;
    # - gate_count records all valid reflectivity gates mapped to the voxel.
    order = np.lexsort((dbzh, flat))
    sorted_flat = flat[order]

    group_ends = np.r_[
        np.nonzero(sorted_flat[1:] != sorted_flat[:-1])[0],
        len(sorted_flat) - 1,
    ]

    chosen = order[group_ends]
    chosen_flat = flat[chosen]

    unique_flat, gate_counts = np.unique(
        flat,
        return_counts=True,
    )

    if not np.array_equal(unique_flat, chosen_flat):
        raise RuntimeError("Voxel aggregation indexing mismatch.")

    out_dbzh = np.full(
        (nz, ny, nx),
        np.nan,
        dtype=np.float32,
    )

    out_vrad = np.full(
        (nz, ny, nx),
        np.nan,
        dtype=np.float32,
    )

    out_count = np.zeros(
        (nz, ny, nx),
        dtype=np.uint16,
    )

    chosen_iz = iz[chosen]
    chosen_iy = iy[chosen]
    chosen_ix = ix[chosen]

    out_dbzh[
        chosen_iz,
        chosen_iy,
        chosen_ix,
    ] = dbzh[chosen].astype(np.float32)

    out_vrad[
        chosen_iz,
        chosen_iy,
        chosen_ix,
    ] = vrad[chosen].astype(np.float32)

    out_count.flat[unique_flat] = np.minimum(
        gate_counts,
        np.iinfo(np.uint16).max,
    ).astype(np.uint16)

    source_max_in_grid = float(np.nanmax(dbzh))
    voxel_max = float(np.nanmax(out_dbzh))

    if abs(source_max_in_grid - voxel_max) > 0.01:
        raise RuntimeError(
            "Maximum DBZH was not preserved by voxelisation: "
            f"{source_max_in_grid:.2f} vs {voxel_max:.2f}"
        )

    return {
        "dbzh": out_dbzh,
        "vradh_ms": out_vrad,
        "gate_count": out_count,
        "x_centres_m": x_centres,
        "y_centres_m": y_centres,
        "z_centres_m": z_centres,
        "source_gate_count_in_grid": int(inside.sum()),
        "source_max_dbzh_in_grid": source_max_in_grid,
        "occupied_voxel_count": int(np.isfinite(out_dbzh).sum()),
        "maximum_dbzh": voxel_max,
    }


def geographic_points(voxel, radar):
    mask = (
        np.isfinite(voxel["dbzh"])
        & (voxel["dbzh"] >= BROWSER_MIN_DBZH)
    )

    iz, iy, ix = np.nonzero(mask)

    x = voxel["x_centres_m"][ix].astype(np.float64)
    y = voxel["y_centres_m"][iy].astype(np.float64)
    altitude = voxel["z_centres_m"][iz].astype(np.float64)

    distance = np.hypot(x, y)
    azimuth = (
        np.degrees(np.arctan2(x, y))
        + 360.0
    ) % 360.0

    lon, lat, _ = GEOD.fwd(
        np.full(len(x), radar["longitude"]),
        np.full(len(x), radar["latitude"]),
        azimuth,
        distance,
    )

    dbzh = voxel["dbzh"][iz, iy, ix].astype(np.float32)
    vrad = voxel["vradh_ms"][iz, iy, ix].astype(np.float32)

    # Convert browser representation to float32 now, then validate that the
    # geographic encoding itself stays inside the established <=5 m standard.
    lon32 = np.asarray(lon, dtype=np.float32)
    lat32 = np.asarray(lat, dtype=np.float32)
    alt32 = np.asarray(altitude, dtype=np.float32)

    inv_az, _, inv_distance = GEOD.inv(
        np.full(len(x), radar["longitude"]),
        np.full(len(x), radar["latitude"]),
        lon32.astype(np.float64),
        lat32.astype(np.float64),
    )

    expected_x = (
        inv_distance
        * np.sin(np.deg2rad(inv_az))
    )

    expected_y = (
        inv_distance
        * np.cos(np.deg2rad(inv_az))
    )

    xy_error = np.hypot(
        expected_x - x,
        expected_y - y,
    )

    max_xy_error = (
        float(np.nanmax(xy_error))
        if len(xy_error)
        else 0.0
    )

    if max_xy_error > 5.0:
        raise RuntimeError(
            "Browser geographic float32 encoding exceeded 5 m XY tolerance: "
            f"{max_xy_error:.3f} m"
        )

    packed = np.column_stack([
        lon32,
        lat32,
        alt32,
        dbzh,
        vrad,
    ]).astype("<f4", copy=False)

    return packed, max_xy_error


def echo_tops(voxel):
    result = {}

    for threshold in (20, 30, 40, 50, 60):
        mask = (
            np.isfinite(voxel["dbzh"])
            & (voxel["dbzh"] >= threshold)
        )

        if not np.any(mask):
            result[str(threshold)] = {
                "voxel_count": 0,
                "maximum_echo_top_m_amsl": None,
                "minimum_echo_base_m_amsl": None,
            }
            continue

        iz = np.nonzero(mask)[0]
        z = voxel["z_centres_m"][iz]

        result[str(threshold)] = {
            "voxel_count": int(mask.sum()),
            "maximum_echo_top_m_amsl": float(np.max(z)),
            "minimum_echo_base_m_amsl": float(np.min(z)),
        }

    return result


def main():
    if not SOURCE_MANIFEST.exists():
        raise SystemExit(f"Missing source manifest: {SOURCE_MANIFEST}")

    source = json.loads(
        SOURCE_MANIFEST.read_text(encoding="utf-8")
    )

    frames = source.get("frames", [])

    if len(frames) != 13:
        raise SystemExit(
            f"Expected 13 selected AURA frames, found {len(frames)}"
        )

    DERIVED_DIR.mkdir(parents=True, exist_ok=True)
    BROWSER_DIR.mkdir(parents=True, exist_ok=True)

    sequence_frames = []
    browser_frames = []

    radar_reference = None
    previous_time = None
    global_xy_error = 0.0
    total_browser_points = 0
    total_occupied_voxels = 0

    print()
    print("StormTracker — measured AURA 3-D conversion")
    print("=" * 96)
    print(
        f"Grid: {DX_M/1000:.1f} km × {DY_M/1000:.1f} km × "
        f"{DZ_M/1000:.1f} km"
    )
    print(
        f"Domain: X/Y ±{X_MAX_M/1000:.0f} km, "
        f"altitude {Z_MIN_M/1000:.0f}–{Z_MAX_M/1000:.0f} km AMSL"
    )
    print(
        f"Browser export threshold: >= {BROWSER_MIN_DBZH:.0f} dBZ"
    )
    print()

    for index, record in enumerate(frames):
        source_path = ROOT / record["extracted_path"]

        if not source_path.exists():
            raise SystemExit(f"Missing selected AURA volume: {source_path}")

        frame = load_frame(
            source_path,
            record.get("scan_time_from_filename"),
        )

        if radar_reference is None:
            radar_reference = frame["radar"]
        else:
            for key in ("longitude", "latitude", "antenna_height_m"):
                if abs(
                    frame["radar"][key]
                    - radar_reference[key]
                ) > 0.01:
                    raise RuntimeError(
                        f"Radar metadata changed unexpectedly at frame {index}"
                    )

        if (
            previous_time is not None
            and frame["scan_time"] <= previous_time
        ):
            raise RuntimeError("Sequence scan times are not increasing.")

        previous_time = frame["scan_time"]

        voxel = voxelise(frame)

        voxel_path = (
            DERIVED_DIR
            / f"frame_{index:02d}.voxel_1km_500m.npz"
        )

        np.savez_compressed(
            voxel_path,
            dbzh=voxel["dbzh"],
            vradh_ms=voxel["vradh_ms"],
            gate_count=voxel["gate_count"],
            x_centres_m=voxel["x_centres_m"],
            y_centres_m=voxel["y_centres_m"],
            z_centres_m=voxel["z_centres_m"],
        )

        packed, max_xy_error = geographic_points(
            voxel,
            frame["radar"],
        )

        binary_path = (
            BROWSER_DIR
            / f"frame_{index:02d}.bin"
        )

        packed.tofile(binary_path)

        expected_bytes = len(packed) * 5 * 4
        actual_bytes = binary_path.stat().st_size

        if actual_bytes != expected_bytes:
            raise RuntimeError(
                f"Binary byte mismatch frame {index}: "
                f"{actual_bytes} != {expected_bytes}"
            )

        tops = echo_tops(voxel)

        sequence_frames.append({
            "frame_index": index,
            "scan_time": frame["scan_time"],
            "source_file": str(source_path.relative_to(ROOT)),
            "voxel_path": str(voxel_path.relative_to(ROOT)),
            "source_valid_gate_count": frame["source_valid_gate_count"],
            "source_gate_count_in_grid": voxel["source_gate_count_in_grid"],
            "source_max_dbzh": frame["source_max_dbzh"],
            "source_max_dbzh_in_grid": voxel["source_max_dbzh_in_grid"],
            "occupied_voxel_count": voxel["occupied_voxel_count"],
            "maximum_dbzh": voxel["maximum_dbzh"],
            "echo_tops": tops,
            "sweeps": frame["sweeps"],
        })

        browser_frames.append({
            "frame_index": index,
            "scan_time": frame["scan_time"],
            "binary_url": (
                f"./3d-data/aura66-20141127/frame_{index:02d}.bin"
            ),
            "point_count": int(len(packed)),
            "stride_float32": 5,
            "fields": [
                "longitude",
                "latitude",
                "altitude_m_amsl",
                "dbzh",
                "vradh_ms",
            ],
            "minimum_exported_dbzh": BROWSER_MIN_DBZH,
            "maximum_dbzh": voxel["maximum_dbzh"],
            "max_geographic_xy_error_m": max_xy_error,
            "echo_tops": tops,
        })

        total_browser_points += len(packed)
        total_occupied_voxels += voxel["occupied_voxel_count"]
        global_xy_error = max(global_xy_error, max_xy_error)

        az_sources = sorted({
            sweep["azimuth_source"]
            for sweep in frame["sweeps"]
        })

        print(
            f"Frame {index:02d}  {frame['scan_time']}  "
            f"gates={voxel['source_gate_count_in_grid']:,}  "
            f"voxels={voxel['occupied_voxel_count']:,}  "
            f"browser={len(packed):,}  "
            f"max={voxel['maximum_dbzh']:.1f} dBZ  "
            f"XYerr≤{max_xy_error:.2f} m  "
            f"az={'+'.join(az_sources)}"
        )

    sequence_manifest = {
        "format": "StormTrackerAura3DSequenceBuildV1",
        "source": "Australian Unified Radar Archive Level 1 ODIM HDF5",
        "measurement_status": "historical-measured-volumetric-radar",
        "radar": radar_reference,
        "frame_count": len(sequence_frames),
        "geometry": {
            "beam_model": "standard atmosphere, 4/3 Earth radius",
            "effective_earth_radius_m": EFFECTIVE_EARTH_RADIUS_M,
            "grid": {
                "x_min_m": X_MIN_M,
                "x_max_m": X_MAX_M,
                "y_min_m": Y_MIN_M,
                "y_max_m": Y_MAX_M,
                "z_min_m_amsl": Z_MIN_M,
                "z_max_m_amsl": Z_MAX_M,
                "dx_m": DX_M,
                "dy_m": DY_M,
                "dz_m": DZ_M,
            },
            "voxel_aggregation": (
                "maximum DBZH; VRADH from the same strongest-reflectivity "
                "gate; gate_count retained"
            ),
        },
        "frames": sequence_frames,
    }

    browser_manifest = {
        "format": "StormTrackerAura3DBrowserV1",
        "source": "Australian Unified Radar Archive Level 1 ODIM HDF5",
        "measurement_status": "historical-measured-volumetric-radar",
        "scientific_note": (
            "These points are occupied 1 km x 1 km x 0.5 km Cartesian voxels "
            "derived from measured multi-elevation AURA radar gates. "
            "They are not vertical extrusion of a 2-D radar image."
        ),
        "radar": radar_reference,
        "frame_count": len(browser_frames),
        "binary_contract": {
            "dtype": "little-endian float32",
            "stride_float32": 5,
            "fields": [
                "longitude",
                "latitude",
                "altitude_m_amsl",
                "dbzh",
                "vradh_ms",
            ],
        },
        "grid": sequence_manifest["geometry"]["grid"],
        "browser_minimum_dbzh": BROWSER_MIN_DBZH,
        "validation": {
            "maximum_geographic_xy_error_m": global_xy_error,
            "xy_tolerance_m": 5.0,
        },
        "frames": browser_frames,
    }

    SEQUENCE_MANIFEST.write_text(
        json.dumps(sequence_manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    BROWSER_MANIFEST.write_text(
        json.dumps(browser_manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    print()
    print("-" * 96)
    print(f"Frames:                  {len(browser_frames)}")
    print(f"Occupied voxels:         {total_occupied_voxels:,}")
    print(f"Browser volume points:   {total_browser_points:,}")
    print(f"Maximum XY validation:   {global_xy_error:.3f} m")
    print(f"Browser manifest:        {BROWSER_MANIFEST.relative_to(ROOT)}")
    print()

    if global_xy_error > 5.0:
        raise SystemExit(
            "FAIL: geographic XY validation exceeded 5 m tolerance"
        )

    if len(browser_frames) != 13:
        raise SystemExit("FAIL: browser frame count is not 13")

    print("MEASURED AURA 3-D CONVERSION: PASS")


if __name__ == "__main__":
    main()
