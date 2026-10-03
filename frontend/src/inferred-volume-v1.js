import {
  REFLECTIVITY_CLASSES
} from "./palette.js?v=live3d-v1";

export const DEFAULT_OCCUPANCY_THRESHOLD = 0.35;
export const MINIMUM_INPUT_DBZ = 23.0;

export function representativeDbzForCategory(category) {
  const range = REFLECTIVITY_CLASSES[category];

  if (!range) {
    return null;
  }

  const [lower, upper] = range;

  // Category 1 spans 12–23 dBZ and therefore straddles the model's
  // 20 dBZ training floor. Do not infer a vertical column from it.
  if (category === 1) {
    return null;
  }

  if (upper == null) {
    return lower + 2.0;
  }

  return 0.5 * (lower + upper);
}

export function profileForDbz(model, dbz) {
  if (!model?.profiles || !Number.isFinite(dbz)) {
    return null;
  }

  return (
    model.profiles.find(profile =>
      dbz >= profile.low_level_dbz_min &&
      dbz < profile.low_level_dbz_max
    )
    ?? model.profiles.at(-1)
    ?? null
  );
}

export function inferColumn(
  model,
  inputDbz,
  {
    occupancyThreshold = DEFAULT_OCCUPANCY_THRESHOLD,
    minimumOutputDbz = 20.0
  } = {}
) {
  if (
    !Number.isFinite(inputDbz)
    || inputDbz < MINIMUM_INPUT_DBZ
  ) {
    return [];
  }

  const profile = profileForDbz(
    model,
    inputDbz
  );

  if (!profile) {
    return [];
  }

  const points = [];

  for (const level of profile.levels ?? []) {
    const occupancy =
      Number(level.occupancy_probability);

    const delta =
      Number(level.median_delta_dbz);

    if (
      !Number.isFinite(occupancy)
      || !Number.isFinite(delta)
      || occupancy < occupancyThreshold
    ) {
      continue;
    }

    const dbzh =
      inputDbz + delta;

    if (
      !Number.isFinite(dbzh)
      || dbzh < minimumOutputDbz
    ) {
      continue;
    }

    const p25Delta =
      level.p25_delta_dbz == null
        ? null
        : Number(level.p25_delta_dbz);

    const p75Delta =
      level.p75_delta_dbz == null
        ? null
        : Number(level.p75_delta_dbz);

    points.push({
      altitude_m_amsl:
        Number(level.altitude_m_amsl),

      dbzh,

      confidence:
        occupancy,

      median_delta_dbz:
        delta,

      p25_delta_dbz:
        p25Delta,

      p75_delta_dbz:
        p75Delta,

      p25_dbzh:
        Number.isFinite(p25Delta)
          ? inputDbz + p25Delta
          : null,

      p75_dbzh:
        Number.isFinite(p75Delta)
          ? inputDbz + p75Delta
          : null
    });
  }

  return points;
}

export function webMercatorToDegrees(x, y) {
  const radius = 6378137;

  return {
    longitude:
      x / radius * 180 / Math.PI,

    latitude:
      (
        2 * Math.atan(
          Math.exp(y / radius)
        )
        - Math.PI / 2
      )
      * 180 / Math.PI
  };
}

export function pixelCentreMercator(
  frame,
  column,
  row
) {
  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  return {
    x:
      frame.georef.minX
      + (column + 0.5) * dx,

    y:
      frame.georef.maxY
      - (row + 0.5) * dy
  };
}
