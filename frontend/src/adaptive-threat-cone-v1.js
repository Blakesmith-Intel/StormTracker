import { distanceKm, initialBearingDegrees } from "./geo.js";
import { geodesicMotion } from "./tracking.js";

// This is a geometry-based motion envelope, not a calibrated probability
// forecast. Check *observed positions* against the previously issued envelope,
// and check newer 30/60-minute projected centres for impending departures.
const bearingDelta = (a, b) =>
  Math.abs(((Number(a) - Number(b) + 540) % 360) - 180);

// Use the polygon actually drawn on the map when one is available; the
// previous infinite-wedge approximation included an invisible extension
// behind the storm and past the final +90m marker. The local ENU-style
// projection is sufficient for the bounded regional envelopes we display.
function withinDisplayedConePolygon(cone, point, marginKm) {
  const origin=cone?.samples?.[0]?.centre;
  const boundary=cone?.polygon;
  if(!origin || !Array.isArray(boundary) || boundary.length<3)return null;
  const xy=position=>{
    const distance=distanceKm(origin.longitude,origin.latitude,
      Number(position.longitude),Number(position.latitude));
    const bearing=initialBearingDegrees(origin.longitude,origin.latitude,
      Number(position.longitude),Number(position.latitude))*Math.PI/180;
    return {x:distance*Math.sin(bearing),y:distance*Math.cos(bearing)};
  };
  const vertices=boundary.map(xy);
  const target=xy(point);
  if(![target,...vertices].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))
    return null;
  const tolerance=Math.max(0,Number(marginKm)||0);
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[j],b=vertices[i];
    const dx=b.x-a.x,dy=b.y-a.y;
    const lengthSquared=dx*dx+dy*dy;
    const t=lengthSquared>0
      ?Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/lengthSquared))
      :0;
    if(Math.hypot(target.x-(a.x+t*dx),target.y-(a.y+t*dy))<=tolerance+1e-7)
      return true;
    if((a.y>target.y)!==(b.y>target.y)){
      const crossing=a.x+(target.y-a.y)*(b.x-a.x)/(b.y-a.y);
      if(target.x<crossing)inside=!inside;
    }
  }
  return inside;
}

export function pointWithinIssuedThreatCone(cone, point, marginKm = 0) {
  const origin = cone?.samples?.[0]?.centre;
  const longitude = Number(point?.longitude ?? point?.centroid_longitude);
  const latitude = Number(point?.latitude ?? point?.centroid_latitude);
  if (!origin || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  const polygonResult=withinDisplayedConePolygon(cone,{longitude,latitude},marginKm);
  if(polygonResult!==null)return polygonResult;
  // Older synthetic / legacy cones may expose only sampled centres.
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

// A gradual storm turn can consist of several genuine 5-minute centroid
// shifts below the single-scan 1.25 km steering threshold. Check SHORT,
// chronological measured windows instead of projecting the latest jitter.
// No interpolated display frames, future samples or Doppler wind estimates.
export function sustainedMeasuredSteering(track, observation, {
  minimumNetKm=1.25, minimumSpeedKmh=6, minimumStraightness=0.70,
  maximumGapMinutes=12, maximumLookbackMinutes=20
}={}) {
  const history=observationsThrough(track,observation);
  if(history.length<3)return null;
  const latest=history.at(-1);
  const latestEpoch=Date.parse(latest.observed_utc);
  // Prefer the shortest supported window: a real new direction should
  // override older segments after two or three agreeing observations.
  for(const segments of [2,3,4]){
    if(history.length<=segments)continue;
    const recent=history.slice(-(segments+1));
    const first=recent[0],firstEpoch=Date.parse(first.observed_utc);
    const spanMinutes=(latestEpoch-firstEpoch)/60000;
    if(!(spanMinutes>=8 && spanMinutes<=maximumLookbackMinutes))continue;
    let pathKm=0,valid=true;
    for(let i=1;i<recent.length;i++){
      const dt=(Date.parse(recent[i].observed_utc)-
        Date.parse(recent[i-1].observed_utc))/60000;
      if(!(dt>0 && dt<=maximumGapMinutes)){valid=false;break;}
      pathKm+=distanceKm(
        Number(recent[i-1].centroid_longitude),Number(recent[i-1].centroid_latitude),
        Number(recent[i].centroid_longitude),Number(recent[i].centroid_latitude)
      );
    }
    if(!valid || !(pathKm>0))continue;
    const netKm=distanceKm(
      Number(first.centroid_longitude),Number(first.centroid_latitude),
      Number(latest.centroid_longitude),Number(latest.centroid_latitude)
    );
    const speedKmh=netKm*60/spanMinutes;
    const straightness=netKm/pathKm;
    if(netKm<minimumNetKm || speedKmh<minimumSpeedKmh ||
        straightness<minimumStraightness || speedKmh>160)continue;
    const heading=initialBearingDegrees(
      Number(first.centroid_longitude),Number(first.centroid_latitude),
      Number(latest.centroid_longitude),Number(latest.centroid_latitude)
    );
    if(!Number.isFinite(heading))continue;
    return {
      heading_degrees:heading,speed_kmh:speedKmh,net_km:netKm,
      straightness,span_minutes:spanMinutes,segment_count:segments
    };
  }
  return null;
}

export function createAdaptiveThreatConeController({
  buildCone,
  rolloverMinutes = 30,
  turnThresholdDegrees = 12,
  steeringChangeThresholdDegrees = 8,
  minimumSteeringSpeedKmh = 12,
  minimumSteeringMotionKm = 1.25,
  breachMarginKm = 0.5,
  reissueOnObservedExit = true,
  observedExitMarginKm = breachMarginKm,
  minimumTranslationKm = 4,
  minimumTranslationMinutes = 5,
  followMeasuredPosition = false,
  minimumMeasuredReanchorKm = 0.5
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
    let proposed = buildCone(track, observation, buildOptions);
    if (!proposed) {
      clear(id);
      return { cone:null, reason:"motion-unavailable", rebased:false };
    }

    const previous = issued.get(id);
    const sustainedSteering=sustainedMeasuredSteering(track,observation);
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
      const centreOutside = reissueOnObservedExit &&
        !pointWithinIssuedThreatCone(previous.cone, observation, observedExitMarginKm);
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
      ) >= turnThresholdDegrees
        && Number(track?.motion?.speed_kmh) >= minimumSteeringSpeedKmh
        && (!Number.isFinite(Number(track?.motion?.distance_km))
          || Number(track.motion.distance_km) >= minimumSteeringMotionKm);
      // A storm can gradually turn through a sequence of sub-12° changes.
      // The old rule compared only the last issued heading and allowed a
      // lagging three-segment mean to keep aiming along the previous course.
      // Compare the NEWEST genuinely observed movement to the actual
      // displayed centreline. Require both an observed displacement and
      // meaningful speed before treating the heading as reliable steering.
      const latestMotion = track?.motion;
      const steeringEvidence = Number(latestMotion?.distance_km) >= minimumSteeringMotionKm
        && Number(latestMotion?.speed_kmh) >= minimumSteeringSpeedKmh;
      const steeringErrorDegrees = bearingDelta(
        Number(proposed.measured_heading_degrees), Number(previous.cone.heading_degrees)
      );
      const steeringChanged = steeringEvidence
        && steeringErrorDegrees >= steeringChangeThresholdDegrees;
      // A slow but sustained sideways drift is genuine steering evidence,
      // even if each 5-minute centroid displacement is below 1.25 km.
      // Compare measured net motion with the last ACTUALLY DRAWN centreline.
      const sustainedHeadingChange = sustainedSteering &&
        bearingDelta(sustainedSteering.heading_degrees,
          previous.cone.heading_degrees) >= turnThresholdDegrees;
      // A broad 90-minute envelope can contain many successive storm cores,
      // leaving its original starting point visually stranded. Advance the
      // forecast with a meaningfully displaced measured centroid even when
      // the old broad geometry has not technically been breached.
      const issuedCentre = previous.cone.samples[0].centre;
      const observedTranslationKm = distanceKm(
        issuedCentre.longitude, issuedCentre.latitude,
        Number(observation.centroid_longitude), Number(observation.centroid_latitude)
      );
      const translationThresholdKm = Math.max(
        minimumTranslationKm,
        Math.min(10, Number(previous.cone.footprint_radius_km) * 0.8)
      );
      const translated = elapsed >= minimumTranslationMinutes &&
        observedTranslationKm >= translationThresholdKm;
      if (centreOutside) reason = "observed-outside";
      else if (prospectiveOutside) reason = "projected-track-outside";
      else if (turning) reason = "direction-change";
      else if (steeringChanged) reason = "steering-change";
      else if (sustainedHeadingChange) reason = "sustained-steering-change";
      else if (elapsed >= rolloverMinutes) reason = "rolling-refresh";
      else if (translated) reason = "storm-advanced";
      else if (followMeasuredPosition && elapsed >= 1 &&
        observedTranslationKm >= minimumMeasuredReanchorKm)
        reason = "measured-position";
    }

    if (reason) {
      // Reissuing with the same smoothed heading leaves the cone pointed in
      // the wrong direction even when a measured turn is recognised.
      // Only force the actual heading with sufficient displacement/speed.
      const reliableBreachSteering = reason === "observed-outside" &&
        Number(track?.motion?.distance_km) >= minimumSteeringMotionKm &&
        Number(track?.motion?.speed_kmh) >= minimumSteeringSpeedKmh &&
        Number.isFinite(Number(proposed.measured_heading_degrees));
      const instantaneousSteeringSupported =
        Number(track?.motion?.distance_km) >= minimumSteeringMotionKm &&
        Number(track?.motion?.speed_kmh) >= minimumSteeringSpeedKmh;
      const shouldReorient = reason === "observed-outside" ||
        reason === "sustained-steering-change" ||
        reason === "steering-change" ||
        reason === "direction-change";
      // A convincing two/three-interval displacement gives us a measured
      // orientation when the last individual step is too small to qualify.
      // If neither single-scan nor sustained motion is trustworthy, an
      // observed escape reanchors but does NOT invent a direction.
      const headingEvidence=shouldReorient
        ? (sustainedSteering && (!instantaneousSteeringSupported ||
            reason==="sustained-steering-change")
            ? sustainedSteering.heading_degrees
            : instantaneousSteeringSupported
              ? Number(proposed.measured_heading_degrees)
              : null)
        : null;
      if (Number.isFinite(headingEvidence)) {
        proposed = buildCone(track, observation, {
          ...buildOptions,forceMeasuredHeading:true,
          steeringHeadingDegrees:headingEvidence
        }) ?? proposed;
      }
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


// A display frame must have the same forecast regardless of the order in
// which the operator plays, pauses, loops or scrubs the animation. Replay
// genuine observations in SOURCE-time order and never consult a later frame.
function observationsThrough(track, observation) {
  const targetEpoch = Date.parse(observation?.observed_utc);
  if (!Number.isFinite(targetEpoch)) return [];
  const byEpoch = new Map();
  for (const item of track?.history ?? []) {
    const epoch = Date.parse(item?.observed_utc);
    if (Number.isFinite(epoch) && epoch <= targetEpoch && !byEpoch.has(epoch)) {
      byEpoch.set(epoch, item);
    }
  }
  const chronological = [...byEpoch.entries()]
    .sort((a,b) => a[0] - b[0])
    .map(([,item]) => item);
  // Never silently project from a different observation than the frame shown.
  return Date.parse(chronological.at(-1)?.observed_utc) === targetEpoch
    ? chronological : [];
}

export function measuredTrackMotionAtObservation(track, observation) {
  const history = observationsThrough(track, observation);
  return history.length >= 2
    ? geodesicMotion(history.at(-2), history.at(-1))
    : null;
}

export function evaluateChronologicalTrackThreatCone(
  track,
  observation,
  buildCone,
  buildOptions = {},
  controllerOptions = {}
) {
  const history = observationsThrough(track, observation);
  if (!history.length || !track?.track_id) {
    return { cone:null, reason:"observation-unavailable", rebased:false };
  }
  const controller = createAdaptiveThreatConeController({
    buildCone,
    ...controllerOptions
  });
  let evaluation = {
    cone:null,
    reason:"insufficient-measured-motion",
    rebased:false
  };
  for (let index=1; index<history.length; index++) {
    const motion = geodesicMotion(history[index-1], history[index]);
    if (!motion) continue;
    // Restrict BOTH the heading calculation and directional smoothing to
    // what had actually been measured at this scan.
    const historicalTrack = {
      ...track,
      history:history.slice(0,index+1),
      motion
    };
    evaluation=controller.evaluate(
      historicalTrack,
      history[index],
      buildOptions
    );
  }
  return evaluation;
}
