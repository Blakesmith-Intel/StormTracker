import {
  REFLECTIVITY_CLASSES
} from "./palette.js?v=diagnostics-v1";

function boundedWeight(value) {
  const weight = Number(value);
  if (!Number.isFinite(weight)) {
    throw new TypeError("Temporal interpolation weight must be finite.");
  }
  return Math.max(0, Math.min(1, weight));
}

function sameGeoref(left, right) {
  return [
    "projection",
    "minX",
    "maxX",
    "minY",
    "maxY"
  ].every(key => left?.[key] === right?.[key]);
}

export function interpolateRadarFrame(
  before,
  after,
  observedUtc,
  weight
) {
  if (!before || !after) {
    throw new Error(
      "Temporal radar interpolation requires bounding observed frames."
    );
  }

  if (
    before.width !== after.width
    || before.height !== after.height
    || before.categories?.length !== after.categories?.length
    || !sameGeoref(before.georef, after.georef)
  ) {
    throw new Error(
      "Bounding radar frames are not spatially compatible."
    );
  }

  const targetEpoch = Date.parse(observedUtc);
  const beforeEpoch = Date.parse(before.observedUtc);
  const afterEpoch = Date.parse(after.observedUtc);

  if (
    !Number.isFinite(targetEpoch)
    || !Number.isFinite(beforeEpoch)
    || !Number.isFinite(afterEpoch)
    || !(beforeEpoch < targetEpoch && targetEpoch < afterEpoch)
  ) {
    throw new Error(
      "Interpolated radar timestamp must lie strictly between its bounding observations."
    );
  }

  const blend = boundedWeight(weight);
  const categories =
    new Uint8Array(before.categories.length);

  let colouredPixelCount = 0;
  let strongPixelCount = 0;
  let maxCategory = 0;
  const categoryHistogram =
    Array(16).fill(0);

  for (
    let index = 0;
    index < categories.length;
    index++
  ) {
    const left =
      Number(before.categories[index]) || 0;

    const right =
      Number(after.categories[index]) || 0;

    const category =
      Math.max(
        0,
        Math.min(
          15,
          Math.round(
            left
            + (right - left) * blend
          )
        )
      );

    categories[index] = category;

    if (category > 0) {
      colouredPixelCount++;
      categoryHistogram[category]++;
      maxCategory =
        Math.max(maxCategory, category);
    }

    if (category >= 7) {
      strongPixelCount++;
    }
  }

  const [
    maxDbzLowerBound,
    maxDbzUpperBound
  ] =
    REFLECTIVITY_CLASSES[maxCategory]
    ?? [null, null];

  return {
    ...before,
    observedUtc,
    categories,
    georef: { ...before.georef },
    sourceMetadata: {
      ...before.sourceMetadata,
      provider:
        "StormTracker display interpolation from Australian Bureau of Meteorology observations",
      transport:
        "StormTracker browser temporal interpolation",
      colouredPixelCount,
      strongPixelCount,
      maxCategory,
      maxDbzLowerBound,
      maxDbzUpperBound,
      categoryHistogram,
      volumeStatus:
        "inferred-temporal-display-only",
      temporalInference: {
        displayOnly: true,
        method:
          "linear-category-blend-between-bounding-observed-frames",
        beforeUtc:
          before.observedUtc,
        afterUtc:
          after.observedUtc,
        targetUtc:
          observedUtc,
        weight: blend
      }
    }
  };
}

export function isTemporallyInferredRadarFrame(frame) {
  return Boolean(
    frame?.sourceMetadata
      ?.temporalInference
      ?.displayOnly
  );
}
