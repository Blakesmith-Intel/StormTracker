export const SUPPORT_BANDS = Object.freeze({
  high: Object.freeze({
    label: "High support",
    alpha: 0.95,
    sizeScale: 1.00
  }),

  medium: Object.freeze({
    label: "Medium support",
    alpha: 0.58,
    sizeScale: 0.82
  }),

  low: Object.freeze({
    label: "Low support",
    alpha: 0.22,
    sizeScale: 0.62
  })
});

export function inferredIqrDbz(point) {
  const p25 =
    Number(point?.p25_dbzh);

  const p75 =
    Number(point?.p75_dbzh);

  if (
    !Number.isFinite(p25)
    || !Number.isFinite(p75)
  ) {
    return null;
  }

  return Math.max(
    0,
    p75 - p25
  );
}

export function supportBandForPoint(
  point,
  {
    displayThresholdDbz = 20
  } = {}
) {
  const occupancy =
    Number(point?.confidence);

  const median =
    Number(point?.dbzh);

  const p25 =
    Number(point?.p25_dbzh);

  const iqr =
    inferredIqrDbz(point);

  if (
    !Number.isFinite(occupancy)
    || !Number.isFinite(median)
  ) {
    return "low";
  }

  if (
    occupancy >= 0.70
    && Number.isFinite(iqr)
    && iqr <= 10
    && Number.isFinite(p25)
    && p25 >= displayThresholdDbz
  ) {
    return "high";
  }

  if (
    occupancy >= 0.50
    && (
      iqr == null
      || iqr <= 16
    )
    && median >= displayThresholdDbz
  ) {
    return "medium";
  }

  return "low";
}

export function styleForInferredPoint(
  point,
  {
    displayThresholdDbz = 20,
    basePointSize = 3
  } = {}
) {
  const band =
    supportBandForPoint(
      point,
      {
        displayThresholdDbz
      }
    );

  const definition =
    SUPPORT_BANDS[band];

  return {
    band,

    alpha:
      definition.alpha,

    pixelSize:
      Math.max(
        1.5,
        Number(basePointSize)
        * definition.sizeScale
      ),

    iqr_dbz:
      inferredIqrDbz(point)
  };
}
