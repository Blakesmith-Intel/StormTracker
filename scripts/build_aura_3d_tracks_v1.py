#!/usr/bin/env python3
from __future__ import annotations

import json
import math
from collections import deque
from datetime import datetime
from pathlib import Path

import numpy as np
from pyproj import Geod

ROOT = Path(__file__).resolve().parents[1]
VOXEL_DIR = ROOT / "data/aura/derived/66/2014-11-27"
BROWSER_DIR = ROOT / "frontend/3d-data/aura66-20141127"
VOLUME_MANIFEST = BROWSER_DIR / "manifest.json"
OUTPUT = BROWSER_DIR / "storm-objects-tracks.json"

DETECTION_THRESHOLD_DBZ = 30.0
MIN_VOXELS = 12
MIN_HORIZONTAL_PIXELS = 4
MIN_VERTICAL_LEVELS = 2
CORE_THRESHOLDS_DBZ = (40.0, 50.0, 60.0)

MAX_SPEED_KMH = 140.0
POSITION_MARGIN_KM = 5.0
MAX_GAP_FRAMES = 1
MINIMUM_OVERLAP_SCORE = 0.12
MINIMUM_NO_OVERLAP_SCORE = 0.35

GEOD = Geod(ellps="WGS84")

OFFSETS_26 = [
    (dz, dy, dx)
    for dz in (-1, 0, 1)
    for dy in (-1, 0, 1)
    for dx in (-1, 0, 1)
    if not (dz == 0 and dy == 0 and dx == 0)
]

def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

def bearing_degrees(dx_east_m: float, dy_north_m: float) -> float:
    return float((math.degrees(math.atan2(dx_east_m, dy_north_m)) + 360.0) % 360.0)

def resolution(axis: np.ndarray) -> float:
    axis = np.asarray(axis, dtype=np.float64)
    if len(axis) < 2:
        raise ValueError("Voxel axis must have at least two centres.")
    d = np.diff(axis)
    if not np.all(d > 0):
        raise ValueError("Voxel axis must be strictly increasing.")
    return float(np.median(d))

def local_to_geo(radar_lon, radar_lat, x, y):
    distance = math.hypot(x, y)
    if distance == 0:
        return float(radar_lon), float(radar_lat)
    lon, lat, _ = GEOD.fwd(
        radar_lon,
        radar_lat,
        bearing_degrees(x, y),
        distance,
    )
    return float(lon), float(lat)

def connected_components(mask: np.ndarray) -> list[np.ndarray]:
    coords = np.argwhere(mask)
    if not len(coords):
        return []

    lookup = {
        (int(z), int(y), int(x)): i
        for i, (z, y, x) in enumerate(coords)
    }
    visited = np.zeros(len(coords), dtype=bool)
    components = []

    for seed in range(len(coords)):
        if visited[seed]:
            continue
        visited[seed] = True
        queue = deque([seed])
        members = []

        while queue:
            current = queue.popleft()
            members.append(current)
            z, y, x = (int(v) for v in coords[current])

            for dz, dy, dx in OFFSETS_26:
                j = lookup.get((z + dz, y + dy, x + dx))
                if j is None or visited[j]:
                    continue
                visited[j] = True
                queue.append(j)

        components.append(coords[np.asarray(members, dtype=np.int64)])

    return components

def component_metrics(coords, dbzh, vradh, x_axis, y_axis, z_axis, radar_lon, radar_lat):
    iz, iy, ix = coords[:, 0], coords[:, 1], coords[:, 2]

    values = dbzh[iz, iy, ix].astype(np.float64)
    velocity = vradh[iz, iy, ix].astype(np.float64)
    xs = x_axis[ix].astype(np.float64)
    ys = y_axis[iy].astype(np.float64)
    zs = z_axis[iz].astype(np.float64)

    dx_m = resolution(x_axis)
    dy_m = resolution(y_axis)
    dz_m = resolution(z_axis)

    horizontal_pairs = np.unique(coords[:, 1:3], axis=0)
    vertical_levels = np.unique(iz)

    imax = int(np.nanargmax(values))
    max_x = float(xs[imax])
    max_y = float(ys[imax])
    max_z = float(zs[imax])
    max_lon, max_lat = local_to_geo(radar_lon, radar_lat, max_x, max_y)

    centroid_x = float(np.mean(xs))
    centroid_y = float(np.mean(ys))
    centroid_z = float(np.mean(zs))
    centroid_lon, centroid_lat = local_to_geo(
        radar_lon, radar_lat, centroid_x, centroid_y
    )

    weights = np.maximum(values - DETECTION_THRESHOLD_DBZ + 1.0, 1.0)
    weighted_x = float(np.average(xs, weights=weights))
    weighted_y = float(np.average(ys, weights=weights))
    weighted_z = float(np.average(zs, weights=weights))
    weighted_lon, weighted_lat = local_to_geo(
        radar_lon, radar_lat, weighted_x, weighted_y
    )

    x_min, x_max = float(xs.min()), float(xs.max())
    y_min, y_max = float(ys.min()), float(ys.max())
    z_min, z_max = float(zs.min()), float(zs.max())

    box_x = 0.5 * (x_min + x_max)
    box_y = 0.5 * (y_min + y_max)
    box_z = 0.5 * (z_min + z_max)
    box_lon, box_lat = local_to_geo(radar_lon, radar_lat, box_x, box_y)

    thresholds = {}
    for threshold in (DETECTION_THRESHOLD_DBZ, *CORE_THRESHOLDS_DBZ):
        m = values >= threshold
        if not np.any(m):
            thresholds[str(int(threshold))] = {
                "voxel_count": 0,
                "horizontal_pixels": 0,
                "echo_top_m_amsl": None,
                "echo_base_m_amsl": None,
            }
            continue

        tcoords = coords[m]
        tz = zs[m]
        thresholds[str(int(threshold))] = {
            "voxel_count": int(m.sum()),
            "horizontal_pixels": int(len(np.unique(tcoords[:, 1:3], axis=0))),
            "echo_top_m_amsl": float(tz.max()),
            "echo_base_m_amsl": float(tz.min()),
        }

    valid_velocity = np.isfinite(velocity)

    return {
        "voxel_count": int(len(coords)),
        "horizontal_pixels": int(len(horizontal_pairs)),
        "vertical_levels": int(len(vertical_levels)),
        "sampled_horizontal_area_km2": float(
            len(horizontal_pairs) * dx_m * dy_m / 1_000_000.0
        ),
        "sampled_voxel_volume_km3": float(
            len(coords) * dx_m * dy_m * dz_m / 1_000_000_000.0
        ),
        "vertical_depth_m": float(z_max - z_min + dz_m),
        "mean_dbzh": float(values.mean()),
        "maximum_dbzh": float(values[imax]),
        "maximum_dbzh_location": {
            "x_east_m": max_x,
            "y_north_m": max_y,
            "altitude_m": max_z,
            "longitude": max_lon,
            "latitude": max_lat,
        },
        "centroid": {
            "x_east_m": centroid_x,
            "y_north_m": centroid_y,
            "altitude_m": centroid_z,
            "longitude": centroid_lon,
            "latitude": centroid_lat,
        },
        "reflectivity_weighted_centroid": {
            "x_east_m": weighted_x,
            "y_north_m": weighted_y,
            "altitude_m": weighted_z,
            "longitude": weighted_lon,
            "latitude": weighted_lat,
        },
        "bounds": {
            "x_min_m": x_min,
            "x_max_m": x_max,
            "y_min_m": y_min,
            "y_max_m": y_max,
            "z_min_m_amsl": z_min,
            "z_max_m_amsl": z_max,
        },
        "display_envelope": {
            "longitude": box_lon,
            "latitude": box_lat,
            "altitude_m": box_z,
            "east_west_m": float(x_max - x_min + dx_m),
            "north_south_m": float(y_max - y_min + dy_m),
            "vertical_m": float(z_max - z_min + dz_m),
        },
        "vradh": {
            "valid_voxels": int(valid_velocity.sum()),
            "mean_ms": float(velocity[valid_velocity].mean()) if np.any(valid_velocity) else None,
            "minimum_ms": float(velocity[valid_velocity].min()) if np.any(valid_velocity) else None,
            "maximum_ms": float(velocity[valid_velocity].max()) if np.any(valid_velocity) else None,
        },
        "threshold_structure": thresholds,
    }

def detect_frame(dbzh, vradh, x, y, z, radar_lon, radar_lat):
    mask = np.isfinite(dbzh) & (dbzh >= DETECTION_THRESHOLD_DBZ)
    raw_components = connected_components(mask)
    accepted = []

    for coords in raw_components:
        horizontal_pixels = len(np.unique(coords[:, 1:3], axis=0))
        vertical_levels = len(np.unique(coords[:, 0]))

        if (
            len(coords) < MIN_VOXELS
            or horizontal_pixels < MIN_HORIZONTAL_PIXELS
            or vertical_levels < MIN_VERTICAL_LEVELS
        ):
            continue

        accepted.append(
            (
                coords,
                component_metrics(
                    coords, dbzh, vradh, x, y, z, radar_lon, radar_lat
                ),
            )
        )

    accepted.sort(key=lambda item: (-item[1]["maximum_dbzh"], -item[1]["voxel_count"]))

    labels = np.zeros(dbzh.shape, dtype=np.uint16)
    cells = []

    for local_id, (coords, metrics) in enumerate(accepted, start=1):
        labels[coords[:, 0], coords[:, 1], coords[:, 2]] = local_id
        metrics = dict(metrics)
        metrics["local_cell_id"] = local_id
        cells.append(metrics)

    return {
        "labels": labels,
        "cells": cells,
        "summary": {
            "threshold_dbz": DETECTION_THRESHOLD_DBZ,
            "connectivity": 26,
            "raw_component_count": int(len(raw_components)),
            "accepted_cell_count": int(len(cells)),
            "rejected_component_count": int(len(raw_components) - len(cells)),
            "threshold_voxel_count": int(mask.sum()),
            "accepted_voxel_count": int(np.count_nonzero(labels)),
        },
    }

def overlap_table(previous_labels, current_labels):
    if previous_labels.shape != current_labels.shape:
        raise ValueError("Consecutive label grids must have identical shape.")

    mask = (previous_labels > 0) & (current_labels > 0)
    if not np.any(mask):
        return {}

    previous = previous_labels[mask].astype(np.int64)
    current = current_labels[mask].astype(np.int64)
    base = int(current.max()) + 1
    encoded = previous * base + current
    keys, counts = np.unique(encoded, return_counts=True)

    return {
        (int(key // base), int(key % base)): int(count)
        for key, count in zip(keys, counts)
    }

def cell_centroid(cell):
    c = cell["reflectivity_weighted_centroid"]
    return float(c["x_east_m"]), float(c["y_north_m"])

def predict_position(observations, current_time):
    last = observations[-1]
    last_x, last_y = float(last["x_east_m"]), float(last["y_north_m"])

    if len(observations) < 2:
        return last_x, last_y

    previous = observations[-2]
    t0 = parse_time(previous["scan_time"])
    t1 = parse_time(last["scan_time"])
    history_seconds = (t1 - t0).total_seconds()

    if history_seconds <= 0:
        return last_x, last_y

    vx = (last_x - float(previous["x_east_m"])) / history_seconds
    vy = (last_y - float(previous["y_north_m"])) / history_seconds
    forecast_seconds = (current_time - t1).total_seconds()

    if forecast_seconds <= 0:
        return last_x, last_y

    return last_x + vx * forecast_seconds, last_y + vy * forecast_seconds

def candidate_score(track, current_cell, current_time, current_frame_index, overlap_voxels):
    observations = track["observations"]
    last = observations[-1]
    last_time = parse_time(last["scan_time"])
    dt_seconds = (current_time - last_time).total_seconds()

    if dt_seconds <= 0:
        return None

    gap_frames = current_frame_index - int(last["frame_index"]) - 1
    if gap_frames > MAX_GAP_FRAMES:
        return None

    predicted_x, predicted_y = predict_position(observations, current_time)
    current_x, current_y = cell_centroid(current_cell)
    last_x, last_y = float(last["x_east_m"]), float(last["y_north_m"])

    raw_distance_m = math.hypot(current_x - last_x, current_y - last_y)
    raw_speed_kmh = raw_distance_m / dt_seconds * 3.6

    if raw_speed_kmh > MAX_SPEED_KMH:
        return None

    prediction_error_m = math.hypot(
        current_x - predicted_x,
        current_y - predicted_y,
    )

    scale_m = (
        MAX_SPEED_KMH / 3.6 * dt_seconds
        + POSITION_MARGIN_KM * 1000.0
    )

    raw_distance_score = max(0.0, 1.0 - raw_distance_m / scale_m)
    prediction_score = max(0.0, 1.0 - prediction_error_m / scale_m)

    previous_voxels = max(1, int(last["voxel_count"]))
    current_voxels = max(1, int(current_cell["voxel_count"]))
    size_score = min(previous_voxels, current_voxels) / max(previous_voxels, current_voxels)

    intensity_difference = abs(
        float(current_cell["maximum_dbzh"])
        - float(last["maximum_dbzh"])
    )
    intensity_score = max(0.0, 1.0 - intensity_difference / 30.0)

    overlap_fraction = 0.0
    iou = 0.0

    if overlap_voxels > 0:
        overlap_fraction = overlap_voxels / min(previous_voxels, current_voxels)
        union = previous_voxels + current_voxels - overlap_voxels
        if union > 0:
            iou = overlap_voxels / union

        score = (
            0.45
            + 0.20 * overlap_fraction
            + 0.10 * iou
            + 0.10 * raw_distance_score
            + 0.05 * prediction_score
            + 0.05 * intensity_score
            + 0.05 * size_score
        )
        minimum_score = MINIMUM_OVERLAP_SCORE
        method = "overlap+motion"
    else:
        score = (
            0.45 * raw_distance_score
            + 0.25 * prediction_score
            + 0.15 * size_score
            + 0.15 * intensity_score
        )
        minimum_score = MINIMUM_NO_OVERLAP_SCORE
        method = "motion"

    if gap_frames > 0:
        score *= 0.80 ** gap_frames
        method = "gap+" + method

    if score < minimum_score:
        return None

    return {
        "score": float(score),
        "method": method,
        "distance_m": float(raw_distance_m),
        "raw_speed_kmh": float(raw_speed_kmh),
        "prediction_error_m": float(prediction_error_m),
        "maximum_allowed_distance_m": float(scale_m),
        "overlap_voxels": int(overlap_voxels),
        "overlap_fraction": float(overlap_fraction),
        "iou": float(iou),
        "size_score": float(size_score),
        "intensity_score": float(intensity_score),
        "gap_frames": int(gap_frames),
    }

def make_observation(frame_index, scan_time, cell, match, previous_observation):
    centre = cell["reflectivity_weighted_centroid"]

    observation = {
        "frame_index": int(frame_index),
        "scan_time": scan_time,
        "local_cell_id": int(cell["local_cell_id"]),
        "x_east_m": float(centre["x_east_m"]),
        "y_north_m": float(centre["y_north_m"]),
        "altitude_m": float(centre["altitude_m"]),
        "longitude": float(centre["longitude"]),
        "latitude": float(centre["latitude"]),
        "voxel_count": int(cell["voxel_count"]),
        "horizontal_pixels": int(cell["horizontal_pixels"]),
        "sampled_horizontal_area_km2": float(cell["sampled_horizontal_area_km2"]),
        "sampled_voxel_volume_km3": float(cell["sampled_voxel_volume_km3"]),
        "vertical_depth_m": float(cell["vertical_depth_m"]),
        "bounds": dict(cell["bounds"]),
        "display_envelope": dict(cell["display_envelope"]),
        "maximum_dbzh": float(cell["maximum_dbzh"]),
        "mean_dbzh": float(cell["mean_dbzh"]),
        "echo_top_30_m_amsl": cell["threshold_structure"]["30"]["echo_top_m_amsl"],
        "echo_top_40_m_amsl": cell["threshold_structure"]["40"]["echo_top_m_amsl"],
        "echo_top_50_m_amsl": cell["threshold_structure"]["50"]["echo_top_m_amsl"],
        "echo_top_60_m_amsl": cell["threshold_structure"]["60"]["echo_top_m_amsl"],
        "vradh": dict(cell["vradh"]),
        "match": match,
        "motion_from_previous": None,
    }

    if previous_observation is None:
        return observation

    dt_seconds = (
        parse_time(scan_time)
        - parse_time(previous_observation["scan_time"])
    ).total_seconds()

    if dt_seconds <= 0:
        return observation

    dx = observation["x_east_m"] - float(previous_observation["x_east_m"])
    dy = observation["y_north_m"] - float(previous_observation["y_north_m"])
    distance_m = math.hypot(dx, dy)

    observation["motion_from_previous"] = {
        "dt_seconds": float(dt_seconds),
        "distance_m": float(distance_m),
        "speed_kmh": float(distance_m / dt_seconds * 3.6),
        "bearing_degrees": bearing_degrees(dx, dy),
    }
    return observation

def track_frames(frames, label_grids):
    tracks = {}
    next_track_number = 1
    frame_reports = []

    for frame_position, frame in enumerate(frames):
        frame_index = int(frame["frame_index"])
        scan_time = frame["scan_time"]
        current_time = parse_time(scan_time)
        current_by_id = {
            int(cell["local_cell_id"]): cell
            for cell in frame["cells"]
        }

        overlaps = {}
        if frame_position > 0:
            overlaps = overlap_table(
                label_grids[frame_position - 1],
                label_grids[frame_position],
            )

        candidates = []

        for track_id, track in tracks.items():
            last = track["observations"][-1]
            last_frame_index = int(last["frame_index"])

            if frame_index - last_frame_index - 1 > MAX_GAP_FRAMES:
                continue

            previous_local_id = int(last["local_cell_id"])

            for current_local_id, current_cell in current_by_id.items():
                overlap_voxels = 0
                if last_frame_index == frame_index - 1:
                    overlap_voxels = overlaps.get(
                        (previous_local_id, current_local_id),
                        0,
                    )

                candidate = candidate_score(
                    track,
                    current_cell,
                    current_time,
                    frame_index,
                    overlap_voxels,
                )

                if candidate is not None:
                    candidates.append(
                        (
                            candidate["score"],
                            track_id,
                            current_local_id,
                            candidate,
                        )
                    )

        candidates.sort(key=lambda item: item[0], reverse=True)

        assigned_tracks = set()
        assigned_cells = set()
        assignments = {}

        for _, track_id, local_cell_id, match in candidates:
            if track_id in assigned_tracks or local_cell_id in assigned_cells:
                continue
            assigned_tracks.add(track_id)
            assigned_cells.add(local_cell_id)
            assignments[local_cell_id] = (track_id, match)

        frame_assignments = []

        for local_cell_id, cell in current_by_id.items():
            if local_cell_id in assignments:
                track_id, match = assignments[local_cell_id]
                track = tracks[track_id]
                previous_observation = track["observations"][-1]
            else:
                track_id = f"ST{next_track_number:04d}"
                next_track_number += 1
                match = {
                    "score": None,
                    "method": "new-track",
                    "distance_m": None,
                    "raw_speed_kmh": None,
                    "prediction_error_m": None,
                    "maximum_allowed_distance_m": None,
                    "overlap_voxels": 0,
                    "overlap_fraction": 0.0,
                    "iou": 0.0,
                    "size_score": None,
                    "intensity_score": None,
                    "gap_frames": 0,
                }
                tracks[track_id] = {
                    "track_id": track_id,
                    "observations": [],
                }
                track = tracks[track_id]
                previous_observation = None

            observation = make_observation(
                frame_index,
                scan_time,
                cell,
                match,
                previous_observation,
            )
            track["observations"].append(observation)

            frame_assignments.append({
                "local_cell_id": local_cell_id,
                "track_id": track_id,
                "match": match,
            })

        frame_reports.append({
            "frame_index": frame_index,
            "scan_time": scan_time,
            "cell_count": len(current_by_id),
            "assignments": frame_assignments,
        })

    compact_tracks = []

    for track_id, track in sorted(tracks.items()):
        observations = track["observations"]
        speeds = [
            item["motion_from_previous"]["speed_kmh"]
            for item in observations
            if item["motion_from_previous"]
        ]

        start_time = observations[0]["scan_time"]
        end_time = observations[-1]["scan_time"]

        compact_tracks.append({
            "track_id": track_id,
            "observation_count": len(observations),
            "start_frame_index": int(observations[0]["frame_index"]),
            "end_frame_index": int(observations[-1]["frame_index"]),
            "start_time": start_time,
            "end_time": end_time,
            "duration_minutes": float(
                (parse_time(end_time) - parse_time(start_time)).total_seconds() / 60.0
            ),
            "maximum_dbzh": float(max(o["maximum_dbzh"] for o in observations)),
            "maximum_echo_top_40_m_amsl": max(
                (o["echo_top_40_m_amsl"] for o in observations if o["echo_top_40_m_amsl"] is not None),
                default=None,
            ),
            "maximum_echo_top_50_m_amsl": max(
                (o["echo_top_50_m_amsl"] for o in observations if o["echo_top_50_m_amsl"] is not None),
                default=None,
            ),
            "maximum_echo_top_60_m_amsl": max(
                (o["echo_top_60_m_amsl"] for o in observations if o["echo_top_60_m_amsl"] is not None),
                default=None,
            ),
            "mean_speed_kmh": float(np.mean(speeds)) if speeds else None,
            "maximum_speed_kmh": float(np.max(speeds)) if speeds else None,
            "observations": observations,
        })

    return {
        "frames": frame_reports,
        "tracks": compact_tracks,
    }

def main():
    manifest = json.loads(VOLUME_MANIFEST.read_text(encoding="utf-8"))
    radar = manifest["radar"]
    radar_lon = float(radar["longitude"])
    radar_lat = float(radar["latitude"])

    frames = []
    labels = []

    print()
    print("StormTracker — measured 3-D storm segmentation")
    print("=" * 108)
    print(
        "Threshold 30 dBZ | 26-neighbour | min 12 voxels / "
        "4 horizontal pixels / 2 vertical levels"
    )
    print()

    for frame in manifest["frames"]:
        index = int(frame["frame_index"])
        voxel_path = VOXEL_DIR / f"frame_{index:02d}.voxel_1km_500m.npz"

        with np.load(voxel_path) as volume:
            dbzh = np.asarray(volume["dbzh"], dtype=np.float32)
            vradh = np.asarray(volume["vradh_ms"], dtype=np.float32)
            x = np.asarray(volume["x_centres_m"], dtype=np.float32)
            y = np.asarray(volume["y_centres_m"], dtype=np.float32)
            z = np.asarray(volume["z_centres_m"], dtype=np.float32)

        detected = detect_frame(dbzh, vradh, x, y, z, radar_lon, radar_lat)
        cells = detected["cells"]

        print(
            f"Frame {index:02d}  {frame['scan_time']}  "
            f"raw={detected['summary']['raw_component_count']:,}  "
            f"cells={len(cells):,}  "
            f"accepted={detected['summary']['accepted_voxel_count']:,} voxels  "
            f"strongest="
            + (f"{cells[0]['maximum_dbzh']:.1f} dBZ" if cells else "none")
        )

        frames.append({
            "frame_index": index,
            "scan_time": frame["scan_time"],
            "summary": detected["summary"],
            "cells": cells,
        })
        labels.append(detected["labels"])

    print()
    print("StormTracker — persistent measured 3-D tracking")
    print("=" * 108)

    tracked = track_frames(frames, labels)

    persistent_tracks = [
        t for t in tracked["tracks"]
        if t["observation_count"] >= 3
    ]

    maximum_motion = max(
        (
            obs["motion_from_previous"]["speed_kmh"]
            for track in tracked["tracks"]
            for obs in track["observations"]
            if obs["motion_from_previous"]
        ),
        default=0.0,
    )

    if maximum_motion > MAX_SPEED_KMH + 1e-6:
        raise RuntimeError("Track output exceeds the 140 km/h hard gate.")

    observation_lookup = {}
    for track in tracked["tracks"]:
        for observation in track["observations"]:
            observation_lookup[
                (int(observation["frame_index"]), int(observation["local_cell_id"]))
            ] = (track["track_id"], observation)

    browser_frames = []

    for frame in frames:
        cells = []
        for cell in frame["cells"]:
            track_id, observation = observation_lookup[
                (int(frame["frame_index"]), int(cell["local_cell_id"]))
            ]

            cells.append({
                "track_id": track_id,
                "local_cell_id": int(cell["local_cell_id"]),
                "voxel_count": int(cell["voxel_count"]),
                "sampled_voxel_volume_km3": float(cell["sampled_voxel_volume_km3"]),
                "maximum_dbzh": float(cell["maximum_dbzh"]),
                "mean_dbzh": float(cell["mean_dbzh"]),
                "centroid": dict(cell["reflectivity_weighted_centroid"]),
                "display_envelope": dict(cell["display_envelope"]),
                "echo_top_40_m_amsl": cell["threshold_structure"]["40"]["echo_top_m_amsl"],
                "echo_top_50_m_amsl": cell["threshold_structure"]["50"]["echo_top_m_amsl"],
                "echo_top_60_m_amsl": cell["threshold_structure"]["60"]["echo_top_m_amsl"],
                "vradh": dict(cell["vradh"]),
                "motion_from_previous": observation["motion_from_previous"],
            })

        browser_frames.append({
            "frame_index": int(frame["frame_index"]),
            "scan_time": frame["scan_time"],
            "segmentation": frame["summary"],
            "cells": cells,
        })

    output = {
        "format": "StormTrackerMeasured3DStormTracksV1",
        "source": "Australian Unified Radar Archive Level 1",
        "measurement_status": "historical-measured-volumetric-radar",
        "radar": radar,
        "frame_count": len(frames),
        "segmentation_configuration": {
            "threshold_dbz": DETECTION_THRESHOLD_DBZ,
            "connectivity": 26,
            "minimum_voxels": MIN_VOXELS,
            "minimum_horizontal_pixels": MIN_HORIZONTAL_PIXELS,
            "minimum_vertical_levels": MIN_VERTICAL_LEVELS,
            "core_thresholds_dbz": list(CORE_THRESHOLDS_DBZ),
        },
        "tracking_configuration": {
            "max_speed_kmh": MAX_SPEED_KMH,
            "position_margin_km": POSITION_MARGIN_KM,
            "max_gap_frames": MAX_GAP_FRAMES,
            "minimum_overlap_score": MINIMUM_OVERLAP_SCORE,
            "minimum_no_overlap_score": MINIMUM_NO_OVERLAP_SCORE,
            "association_inputs": [
                "3-D voxel overlap",
                "raw centroid displacement",
                "predicted centroid position",
                "voxel-count similarity",
                "maximum DBZH similarity",
            ],
            "interpretation": (
                "Track IDs are algorithmic associations between segmented measured radar volumes. "
                "They are not independently verified meteorological storm identities."
            ),
        },
        "summary": {
            "total_tracks": len(tracked["tracks"]),
            "persistent_tracks_3plus": len(persistent_tracks),
            "maximum_associated_speed_kmh": float(maximum_motion),
            "frames_with_cells": int(sum(1 for f in frames if f["cells"])),
            "total_detected_cells": int(sum(len(f["cells"]) for f in frames)),
        },
        "frames": browser_frames,
        "tracks": tracked["tracks"],
    }

    OUTPUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    print()
    print("-" * 108)
    print(f"Total tracks:             {output['summary']['total_tracks']}")
    print(f"Persistent tracks (>=3):  {output['summary']['persistent_tracks_3plus']}")
    print(f"Frames with cells:        {output['summary']['frames_with_cells']}/13")
    print(f"Total detected cells:     {output['summary']['total_detected_cells']}")
    print(f"Maximum associated speed: {maximum_motion:.1f} km/h")
    print(f"Browser track product:    {OUTPUT.relative_to(ROOT)}")
    print()
    print("MEASURED 3-D STORM OBJECT TRACKING: PASS")

if __name__ == "__main__":
    main()
