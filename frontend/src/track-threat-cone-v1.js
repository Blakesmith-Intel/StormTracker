import {
  directPoint,
  distanceKm,
  initialBearingDegrees
} from "./geo.js";

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

function angularDifferenceDegrees(left, right) {
  const delta = Math.abs(((left - right + 540) % 360) - 180);
  return Number.isFinite(delta) ? delta : 0;
}

function circularMeanDegrees(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  const x = valid.reduce((sum, value) => sum + Math.cos(value * Math.PI / 180), 0);
  const y = valid.reduce((sum, value) => sum + Math.sin(value * Math.PI / 180), 0);
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return valid.at(-1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function equivalentRadiusKm(areaKm2) {
  const area = Number(areaKm2);
  return area > 0 ? Math.sqrt(area / Math.PI) : 0;
}

function recentMotions(track, observation, maximumSegments = 5) {
  const referenceTime = Date.parse(observation?.observed_utc);
  const history = (track?.history ?? [])
    .filter(item => Number.isFinite(Date.parse(item?.observed_utc)))
    .filter(item => !Number.isFinite(referenceTime) || Date.parse(item.observed_utc) <= referenceTime)
    .slice(-(maximumSegments + 1));

  const motions = [];

  for (let index = 1; index < history.length; index++) {
    const older = history[index - 1];
    const newer = history[index];
    const elapsedHours = (Date.parse(newer.observed_utc) - Date.parse(older.observed_utc)) / 3_600_000;
    if (!(elapsedHours > 0)) continue;

    const distance = distanceKm(
      older.centroid_longitude,
      older.centroid_latitude,
      newer.centroid_longitude,
      newer.centroid_latitude
    );

    const speed = distance / elapsedHours;
    const heading = initialBearingDegrees(
      older.centroid_longitude,
      older.centroid_latitude,
      newer.centroid_longitude,
      newer.centroid_latitude
    );

    if (Number.isFinite(speed) && Number.isFinite(heading)) {
      motions.push({ speed_kmh: speed, heading_degrees: heading });
    }
  }

  return motions.slice(-maximumSegments);
}

export function buildTrackThreatCone(
  track,
  observation,
  {
    horizonMinutes = 90,
    markerMinutes = [30, 60, 90],
    minimumHeadingSpreadDegrees = 8,
    maximumHeadingSpreadDegrees = 25,
    minimumFootprintRadiusKm = 2,
    maximumFootprintRadiusKm = 25,
    directionChangeThresholdDegrees = 12,
    smoothingSegments = 3,
    forceMeasuredHeading = false
  } = {}
) {
  const motion = track?.motion;
  const speedKmh = Number(motion?.speed_kmh);
  const measuredHeadingDegrees = Number(motion?.heading_degrees);
  const longitude = Number(observation?.centroid_longitude);
  const latitude = Number(observation?.centroid_latitude);

  if (
    !(speedKmh > 0)
    || !Number.isFinite(measuredHeadingDegrees)
    || !Number.isFinite(longitude)
    || !Number.isFinite(latitude)
    || !(horizonMinutes > 0)
  ) {
    return null;
  }

  const recent = recentMotions(track, observation);
  const smoothingCount = Math.max(1, Math.floor(Number(smoothingSegments) || 3));
  const previousHeadingDegrees = circularMeanDegrees(
    recent.slice(0, -1).slice(-smoothingCount).map(item => item.heading_degrees)
  );
  const directionChangeDegrees = previousHeadingDegrees == null
    ? 0
    : angularDifferenceDegrees(measuredHeadingDegrees, previousHeadingDegrees);
  const directionChangeDetected =
    previousHeadingDegrees != null
    && directionChangeDegrees >= Number(directionChangeThresholdDegrees);
  const smoothedHeadingDegrees = circularMeanDegrees(
    recent.slice(-smoothingCount).map(item => item.heading_degrees)
  ) ?? measuredHeadingDegrees;
  // A verified new steering heading must be allowed to overrule the
  // three-segment smoother. The smoother remains for ordinary noisy frames.
  const headingDegrees = forceMeasuredHeading || directionChangeDetected
    ? measuredHeadingDegrees
    : smoothedHeadingDegrees;

  const recentHeadingDeviation = recent.length
    ? Math.max(
        ...recent.map(item =>
          angularDifferenceDegrees(item.heading_degrees, headingDegrees)
        )
      )
    : 0;

  const headingHalfAngleDegrees = clamp(
    Math.max(minimumHeadingSpreadDegrees, recentHeadingDeviation),
    minimumHeadingSpreadDegrees,
    maximumHeadingSpreadDegrees
  );

  const baseRadiusKm = clamp(
    equivalentRadiusKm(observation.sampled_area_km2),
    minimumFootprintRadiusKm,
    maximumFootprintRadiusKm
  );

  const minutes = [
    0,
    ...markerMinutes.filter(value => value > 0 && value < horizonMinutes),
    horizonMinutes
  ].filter((value, index, values) => values.indexOf(value) === index)
   .sort((a, b) => a - b);

  const samples = minutes.map(minutesAhead => {
    const centreDistanceKm = speedKmh * minutesAhead / 60;
    const centre = directPoint(
      longitude,
      latitude,
      headingDegrees,
      centreDistanceKm * 1000
    );

    const headingSpreadKm =
      Math.tan(headingHalfAngleDegrees * Math.PI / 180)
      * centreDistanceKm;

    const halfWidthKm = baseRadiusKm + headingSpreadKm;

    const left = directPoint(
      centre.longitude,
      centre.latitude,
      headingDegrees - 90,
      halfWidthKm * 1000
    );

    const right = directPoint(
      centre.longitude,
      centre.latitude,
      headingDegrees + 90,
      halfWidthKm * 1000
    );

    return {
      minutes_ahead: minutesAhead,
      centre,
      left,
      right,
      centre_distance_km: centreDistanceKm,
      half_width_km: halfWidthKm
    };
  });

  return {
    track_id: track.track_id ?? null,
    horizon_minutes: horizonMinutes,
    speed_kmh: speedKmh,
    measured_heading_degrees: ((measuredHeadingDegrees % 360) + 360) % 360,
    heading_degrees: ((headingDegrees % 360) + 360) % 360,
    direction_change_threshold_degrees: Number(directionChangeThresholdDegrees),
    direction_change_degrees: directionChangeDegrees,
    direction_change_detected: directionChangeDetected,
    steering_heading_applied: Boolean(forceMeasuredHeading),
    heading_half_angle_degrees: headingHalfAngleDegrees,
    footprint_radius_km: baseRadiusKm,
    recent_motion_segment_count: recent.length,
    samples,
    centreline: samples.map(item => item.centre),
    polygon: [
      ...samples.map(item => item.left),
      ...samples.slice().reverse().map(item => item.right)
    ],
    interpretation:
      "Motion extrapolation from measured ST centroids, not movement of individual rain cells. Routine jitter is smoothed; significant turns or independently verified steering divergence orient the cone to the latest measured heading. Width reflects current footprint and historical heading variability; not a forecast probability."
  };
}
