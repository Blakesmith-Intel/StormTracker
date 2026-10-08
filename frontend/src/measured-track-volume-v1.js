import {
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=track-volume-v1";

import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=track-volume-v1";

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  return (
    sorted.length % 2
      ? sorted[middle]
      : 0.5
        * (
          sorted[middle - 1]
          + sorted[middle]
        )
  );
}

function altitudeSpacing(model) {
  const altitudes =
    [
      ...new Set(
        (model?.profiles ?? [])
          .flatMap(
            profile =>
              profile.levels ?? []
          )
          .map(
            level =>
              Number(
                level.altitude_m_amsl
              )
          )
          .filter(
            Number.isFinite
          )
      )
    ].sort(
      (a, b) => a - b
    );

  if (altitudes.length < 2) {
    return 500;
  }

  const differences = [];

  for (
    let index = 1;
    index < altitudes.length;
    index++
  ) {
    const difference =
      altitudes[index]
      - altitudes[index - 1];

    if (difference > 0) {
      differences.push(
        difference
      );
    }
  }

  return (
    median(differences)
    ?? 500
  );
}

function localCellIdForObservation(
  observation,
  segmentation
) {
  const sourceId =
    String(
      segmentation?.radar_id
      ?? ""
    );

  const sourceCell =
    observation
      ?.source_cells
      ?.find(
        pair =>
          String(pair?.[0])
          === sourceId
      );

  if (!sourceCell) {
    return null;
  }

  const value =
    Number(
      sourceCell[1]
    );

  return (
    Number.isInteger(value)
      && value > 0
  )
    ? value
    : null;
}

function groundPixelAreaM2(
  frame,
  latitude
) {
  const dx =
    Math.abs(
      (
        frame.georef.maxX
        - frame.georef.minX
      )
      / frame.width
    );

  const dy =
    Math.abs(
      (
        frame.georef.maxY
        - frame.georef.minY
      )
      / frame.height
    );

  const cosLatitude =
    Math.cos(
      Number(latitude)
      * Math.PI
      / 180
    );

  return (
    dx
    * dy
    * cosLatitude
    * cosLatitude
  );
}

export function buildMeasuredTrackVolume(
  frame,
  segmentation,
  observation,
  model,
  {
    occupancyThreshold = 0.35,
    minimumOutputDbz = 20,
    displayThresholdDbz = 30,
    basePointSize = 3
  } = {}
) {
  if (
    frame?.georef?.projection
    !== "EPSG:3857"
  ) {
    throw new Error(
      "Track-specific volume requires an EPSG:3857 BOM frame."
    );
  }

  const labels =
    segmentation?.labels;

  if (
    !labels
    || labels.length
      !== frame.width
        * frame.height
  ) {
    throw new Error(
      "Measured segmentation labels were not returned by the radar worker."
    );
  }

  const localCellId =
    localCellIdForObservation(
      observation,
      segmentation
    );

  if (localCellId == null) {
    return null;
  }

  const dzM =
    altitudeSpacing(model);

  const points = [];

  let measuredPixelCount = 0;
  let inferredColumnCount = 0;

  let highSupportPoints = 0;
  let mediumSupportPoints = 0;
  let lowSupportPoints = 0;

  let maximumDbzh = null;
  let inferredTop40 = null;
  let inferredTop50 = null;
  let highSupportTop40 = null;
  let highSupportTop50 = null;

  let confidenceSum = 0;
  let sampledVolumeM3 = 0;
  let highSupportVolumeM3 = 0;

  for (
    let index = 0;
    index < labels.length;
    index++
  ) {
    if (
      Number(labels[index])
      !== localCellId
    ) {
      continue;
    }

    measuredPixelCount++;

    const row =
      Math.floor(
        index
        / frame.width
      );

    const column =
      index
      - row
        * frame.width;

    const inputDbz =
      representativeDbzForCategory(
        frame.categories[index]
      );

    if (inputDbz == null) {
      continue;
    }

    const inferred =
      inferColumn(
        model,
        inputDbz,
        {
          occupancyThreshold,
          minimumOutputDbz
        }
      );

    if (!inferred.length) {
      continue;
    }

    inferredColumnCount++;

    const mercator =
      pixelCentreMercator(
        frame,
        column,
        row
      );

    const geographic =
      webMercatorToDegrees(
        mercator.x,
        mercator.y
      );

    const pixelAreaM2 =
      groundPixelAreaM2(
        frame,
        geographic.latitude
      );

    for (const point of inferred) {
      const style =
        styleForInferredPoint(
          point,
          {
            displayThresholdDbz,
            basePointSize
          }
        );

      const volumeM3 =
        pixelAreaM2
        * dzM;

      sampledVolumeM3 +=
        volumeM3;

      confidenceSum +=
        Number(
          point.confidence
        );

      if (
        style.band
        === "high"
      ) {
        highSupportPoints++;
        highSupportVolumeM3 +=
          volumeM3;
      } else if (
        style.band
        === "medium"
      ) {
        mediumSupportPoints++;
      } else {
        lowSupportPoints++;
      }

      maximumDbzh =
        maximumDbzh == null
          ? point.dbzh
          : Math.max(
              maximumDbzh,
              point.dbzh
            );

      if (
        point.dbzh >= 40
        && (
          inferredTop40 == null
          || point.altitude_m_amsl
            > inferredTop40
        )
      ) {
        inferredTop40 =
          point.altitude_m_amsl;
      }

      if (
        point.dbzh >= 50
        && (
          inferredTop50 == null
          || point.altitude_m_amsl
            > inferredTop50
        )
      ) {
        inferredTop50 =
          point.altitude_m_amsl;
      }

      if (
        style.band === "high"
        && point.dbzh >= 40
        && (
          highSupportTop40 == null
          || point.altitude_m_amsl
            > highSupportTop40
        )
      ) {
        highSupportTop40 =
          point.altitude_m_amsl;
      }

      if (
        style.band === "high"
        && point.dbzh >= 50
        && (
          highSupportTop50 == null
          || point.altitude_m_amsl
            > highSupportTop50
        )
      ) {
        highSupportTop50 =
          point.altitude_m_amsl;
      }

      points.push({
        longitude:
          geographic.longitude,

        latitude:
          geographic.latitude,

        altitude_m_amsl:
          point.altitude_m_amsl,

        dbzh:
          point.dbzh,

        occupancy:
          point.confidence,

        p25_dbzh:
          point.p25_dbzh,

        p75_dbzh:
          point.p75_dbzh,

        support_band:
          style.band,

        alpha:
          style.alpha,

        pixel_size:
          style.pixelSize
      });
    }
  }

  return {
    local_cell_id:
      localCellId,

    measured_pixel_count:
      measuredPixelCount,

    inferred_column_count:
      inferredColumnCount,

    inferred_point_count:
      points.length,

    maximum_inferred_dbzh:
      maximumDbzh,

    inferred_top_40_m_amsl:
      inferredTop40,

    inferred_top_50_m_amsl:
      inferredTop50,

    high_support_top_40_m_amsl:
      highSupportTop40,

    high_support_top_50_m_amsl:
      highSupportTop50,

    mean_profile_occupancy:
      points.length
        ? confidenceSum
          / points.length
        : null,

    high_support_points:
      highSupportPoints,

    medium_support_points:
      mediumSupportPoints,

    low_support_points:
      lowSupportPoints,

    sampled_volume_km3:
      sampledVolumeM3
      / 1_000_000_000,

    high_support_volume_km3:
      highSupportVolumeM3
      / 1_000_000_000,

    altitude_spacing_m:
      dzM,

    points
  };
}

export function highSupportTop40Trend(
  previousVolume,
  previousObservedUtc,
  currentVolume,
  currentObservedUtc
) {
  const previous =
    Number(
      previousVolume
        ?.high_support_top_40_m_amsl
    );

  const current =
    Number(
      currentVolume
        ?.high_support_top_40_m_amsl
    );

  if (
    !Number.isFinite(previous)
    || !Number.isFinite(current)
  ) {
    return null;
  }

  const elapsedMinutes =
    (
      Date.parse(currentObservedUtc)
      - Date.parse(previousObservedUtc)
    )
    / 60000;

  if (!(elapsedMinutes > 0)) {
    return null;
  }

  const changeM =
    current
    - previous;

  return {
    change_m:
      changeM,

    elapsed_minutes:
      elapsedMinutes,

    metres_per_10_min:
      changeM
      / elapsedMinutes
      * 10
  };
}

// Display-only alignment with the frame-wide minimum dBZ setting.
// Do not change the underlying inferred profile, sampling, scoring,
// measured-track volume or high-support top calculations.
export function shouldDisplayMeasuredTrackPoint(point,minimumDisplayDbz=30){
  const value=Number(point?.dbzh),limit=Number(minimumDisplayDbz);
  return Number.isFinite(value) && Number.isFinite(limit) && value>=limit;
}
