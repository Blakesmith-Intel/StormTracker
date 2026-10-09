import { distanceKm, initialBearingDegrees } from "./geo.js";

// This is a geometry-based motion envelope, not a calibrated probability
// forecast. Check *observed positions* against the previously issued envelope,
// and check newer 30/60-minute projected centres for impending departures.
const bearingDelta = (a, b) =>
  Math.abs(((Number(a) - Number(b) + 540) % 360) - 180);

export function pointWithinIssuedThreatCone(cone, point, marginKm = 0) {
  const origin = cone?.samples?.[0]?.centre;
  const longitude = Number(point?.longitude ?? point?.centroid_longitude);
  const latitude = Number(point?.latitude ?? point?.centroid_latitude);
  if (!origin || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  const distance = distanceKm(origin.longitude, origin.latitude, longitude, latitude);
  const bearing = distance > 0.00001
    ? initialBearingDegrees(origin.longitude, origin.latitude, longitude, latitude)
    : cone.heading_degrees;
  const radians = bearingDelta(bearing, cone.heading_degrees) * Math.PI / 180;
  const forward = distance * Math.cos(radians);
  const lateral = distance * Math.abs(Math.sin(radians));
  const radius = Number(cone.footprint_radius_km);
  const maxDistance = Number(cone.speed_kmh) * Number(cone.horizon_minutes) / 60;
  const spread = Math.tan(Number(cone.heading_half_angle_degrees) * Math.PI / 180);
  const tolerance = Math.max(0, Number(marginKm) || 0);
  return forward >= -radius - tolerance &&
    forward <= maxDistance + radius + tolerance &&
    lateral <= radius + spread * Math.max(0, forward) + tolerance;
}

export function createAdaptiveThreatConeController({
  buildCone,
  rolloverMinutes = 30,
  turnThresholdDegrees = 12,
  breachMarginKm = 0.5
} = {}) {
  if (typeof buildCone !== "function") {
    throw new TypeError("Adaptive cone controller requires a cone builder");
  }
  const issued = new Map();

  function clear(trackId = null) {
    if (trackId == null) issued.clear();
    else issued.delete(String(trackId));
  }

  function evaluate(track, observation, buildOptions = {}) {
    const id = String(track?.track_id ?? "");
    const observedUtc = observation?.observed_utc;
    const observedEpoch = Date.parse(observedUtc);
    if (!id || !Number.isFinite(observedEpoch)) {
      return { cone:null, reason:"unavailable", rebased:false };
    }
    const proposed = buildCone(track, observation, buildOptions);
    if (!proposed) {
      clear(id);
      return { cone:null, reason:"motion-unavailable", rebased:false };
    }

    const previous = issued.get(id);
    let reason = null;
    if (!previous) reason = "initial";
    else if (observedEpoch < previous.lastObservedEpoch) reason = "timeline-rewound";
    else if (observedEpoch === previous.lastObservedEpoch) {
      return {
        cone:previous.cone, reason:"same-observation", rebased:false,
        issue_observed_utc:previous.issueObservedUtc,
        age_minutes:Math.max(0,(observedEpoch-previous.issueEpoch)/60000)
      };
    } else {
      const elapsed = (observedEpoch - previous.issueEpoch) / 60000;
      const centreOutside = !pointWithinIssuedThreatCone(previous.cone, observation, breachMarginKm);
      const prospectiveOutside = proposed.samples.some(sample => {
        // A forecast extending beyond the previous 90-minute horizon cannot
        // be called a breach; the periodic rollover handles ageing cones.
        const forecastMinute = elapsed + sample.minutes_ahead;
        return sample.minutes_ahead > 0 &&
          forecastMinute <= previous.cone.horizon_minutes &&
          !pointWithinIssuedThreatCone(previous.cone, sample.centre, breachMarginKm);
      });
      const turning = bearingDelta(
        Number(proposed.measured_heading_degrees),
        Number(previous.cone.measured_heading_degrees)
      ) >= turnThresholdDegrees;
      if (centreOutside) reason = "observed-outside";
      else if (prospectiveOutside) reason = "projected-track-outside";
      else if (turning) reason = "direction-change";
      else if (elapsed >= rolloverMinutes) reason = "rolling-refresh";
    }

    if (reason) {
      issued.set(id,{
        cone:proposed,
        issueEpoch:observedEpoch,
        issueObservedUtc:observedUtc,
        lastObservedEpoch:observedEpoch,
        lastReason:reason
      });
      return {
        cone:proposed, reason, rebased:true,
        issue_observed_utc:observedUtc, age_minutes:0
      };
    }
    // One evaluation per new *measured* observation, not per UI repaint.
    previous.lastObservedEpoch = observedEpoch;
    return {
      cone:previous.cone, reason:"inside-envelope", rebased:false,
      issue_observed_utc:previous.issueObservedUtc,
      age_minutes:(observedEpoch - previous.issueEpoch)/60000
    };
  }

  return { evaluate, clear };
}
