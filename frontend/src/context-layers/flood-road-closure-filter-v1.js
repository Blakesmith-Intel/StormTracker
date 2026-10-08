// Only these four official QLDTraffic classifications justify a displayed
// road closure. Generic "Flooding", water-over-road and free-text references
// are insufficient on their own.
const PERMITTED_ROAD_CLOSURE_REASONS = new Set([
  "flash flooding",
  "long-term flooding",
  "earlier flooding",
  "heavy rain"
]);

const CLOSED_TO_ALL_TRAFFIC = "road closed to all traffic";

function normalise(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function propertiesOf(featureOrProperties) {
  return featureOrProperties?.properties
    ?? featureOrProperties
    ?? {};
}

export function isFloodRelatedRoadEvent(featureOrProperties) {
  const properties =
    propertiesOf(featureOrProperties);

  return (
    PERMITTED_ROAD_CLOSURE_REASONS.has(
      normalise(properties.event_subtype)
    )
    || PERMITTED_ROAD_CLOSURE_REASONS.has(
      normalise(properties.event_due_to)
    )
  );
}

// QLDTraffic has no independent "unplanned" boolean. Rely on its
// structured event_type/event_subtype/event_due_to, never free-text guessing.
// Hazards, flooding, crashes, emergency/unplanned works and other unscheduled
// incidents are eligible. Explicitly scheduled works/events are not.
export function isUnplannedRoadClosureEvent(featureOrProperties) {
  const p=propertiesOf(featureOrProperties);
  const type=normalise(p.event_type);
  const subtype=normalise(p.event_subtype);
  const dueTo=normalise(p.event_due_to);
  const reasons=[type,subtype,dueTo];
  if(reasons.some(value=>/^(planned|scheduled)\b/.test(value)))return false;
  // Normal planned QLDTraffic roadworks form the bulk of all-traffic closures.
  // Missing roadwork subtype is ambiguous; include only where explicitly
  // emergency/unplanned, rather than silently treating works as incidents.
  if(type==="roadworks" || type==="special event" || type==="special events") {
    return reasons.some(value=>/\b(emergency|unplanned|unscheduled)\b/.test(value));
  }
  // Lack of a structured event classification is not proof of an incident.
  return Boolean(type||subtype||dueTo);
}

export function isRoadClosureEvent(featureOrProperties) {
  const properties =
    propertiesOf(featureOrProperties);

  return (
    normalise(properties.impact?.impact_type) === "closures"
    && normalise(properties.impact?.impact_subtype) === CLOSED_TO_ALL_TRAFFIC
  );
}

function parsedEventTime(value) {
  const text =
    String(value ?? "").trim();

  if (!text) {
    return null;
  }

  let normalisedText =
    text;

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      normalisedText
    )
  ) {
    normalisedText =
      `${normalisedText}T00:00:00+10:00`;
  } else if (
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(
      normalisedText
    )
    && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(
      normalisedText
    )
  ) {
    normalisedText =
      `${normalisedText}+10:00`;
  }

  const parsed =
    Date.parse(
      normalisedText
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function isRoadEventCurrent(
  featureOrProperties,
  nowMs = Date.now()
) {
  const properties =
    propertiesOf(featureOrProperties);

  const duration =
    properties.duration
    && typeof properties.duration === "object"
      ? properties.duration
      : {};

  const startText =
    duration.start
    ?? properties.start_time
    ?? properties.startTime
    ?? properties.fromDate
    ?? properties.from
    ?? "";

  const endText =
    duration.end
    ?? properties.end_time
    ?? properties.endTime
    ?? properties.toDate
    ?? properties.to
    ?? "";

  const start =
    parsedEventTime(startText);

  const end =
    parsedEventTime(endText);

  if (
    String(startText).trim()
    && start === null
  ) {
    return true;
  }

  if (
    String(endText).trim()
    && end === null
  ) {
    return true;
  }

  if (
    start !== null
    && end !== null
    && end < start
  ) {
    return true;
  }

  if (
    start !== null
    && nowMs < start
  ) {
    return false;
  }

  if (
    end !== null
    && nowMs > end
  ) {
    return false;
  }

  return true;
}

export function isActiveFloodRoadClosure(
  feature,
  nowMs = Date.now()
) {
  const properties =
    propertiesOf(feature);

  return (
    normalise(properties.status) === "published"
    && isRoadEventCurrent(
      properties,
      nowMs
    )
    && isUnplannedRoadClosureEvent(properties)
    && isRoadClosureEvent(properties)
  );
}

export function filterFloodRoadClosures(
  payload,
  nowMs = Date.now()
) {
  const features =
    Array.isArray(payload?.features)
      ? payload.features.filter(
          feature =>
            isActiveFloodRoadClosure(
              feature,
              nowMs
            )
        )
      : [];

  return {
    ...(payload && typeof payload === "object"
      ? payload
      : {}),
    type: "FeatureCollection",
    features
  };
}


// Legacy production behaviour is deliberately retained on the original
// /flood-road-closures Worker endpoint until V9.15 acceptance. Do not use
// this less-specific filter in the V9.15 map or preview endpoint.
const LEGACY_FLOOD_SUBTYPES=new Set(["flash flooding","long-term flooding"]);
const LEGACY_FLOOD_CAUSES=new Set([
  "earlier flooding","earlier flash flooding","water over road","flooding of river"
]);
export function filterLegacyFloodRoadClosures(payload,nowMs=Date.now()){
  const features=Array.isArray(payload?.features)?payload.features.filter(feature=>{
    const p=propertiesOf(feature);
    return normalise(p.status)==="published"
      && isRoadEventCurrent(p,nowMs)
      && normalise(p.impact?.impact_type)==="closures"
      && (normalise(p.event_type)==="flooding"
        || LEGACY_FLOOD_SUBTYPES.has(normalise(p.event_subtype))
        || LEGACY_FLOOD_CAUSES.has(normalise(p.event_due_to)));
  }):[];
  return {
    ...(payload&&typeof payload==="object"?payload:{}),
    type:"FeatureCollection",features
  };
}

export function floodRoadGeometryParts(feature) {
  const geometry =
    feature?.geometry;

  if (!geometry) {
    return [];
  }

  const geometries =
    geometry.type === "GeometryCollection"
      ? geometry.geometries ?? []
      : [geometry];

  return geometries.filter(
    item =>
      item
      && (
        item.type === "Point"
        || item.type === "LineString"
        || item.type === "MultiLineString"
      )
  );
}

function firstPositionFromGeometry(geometry) {
  if (!geometry) {
    return null;
  }

  if (
    geometry.type === "Point"
    && Array.isArray(geometry.coordinates)
    && geometry.coordinates.length >= 2
  ) {
    return geometry.coordinates;
  }

  if (
    geometry.type === "LineString"
    && Array.isArray(geometry.coordinates)
    && geometry.coordinates[0]?.length >= 2
  ) {
    return geometry.coordinates[0];
  }

  if (
    geometry.type === "MultiLineString"
    && Array.isArray(geometry.coordinates)
    && geometry.coordinates[0]?.[0]?.length >= 2
  ) {
    return geometry.coordinates[0][0];
  }

  return null;
}

export function firstFloodRoadClosureCoordinate(feature) {
  for (const geometry of floodRoadGeometryParts(feature)) {
    const coordinate =
      firstPositionFromGeometry(
        geometry
      );

    if (coordinate) {
      return [
        Number(coordinate[0]),
        Number(coordinate[1])
      ];
    }
  }

  return null;
}

export function floodRoadClosureSummary(feature) {
  const properties =
    propertiesOf(feature);

  const impact =
    properties.impact
    ?? {};

  const road =
    properties.road_summary
    ?? {};

  return {
    id:
      properties.id
      ?? null,

    roadName:
      road.road_name
      || "Unnamed road",

    locality:
      road.locality
      || "",

    postcode:
      road.postcode
      || "",

    localGovernmentArea:
      road.local_government_area
      || "",

    district:
      road.district
      || "",

    eventType:
      properties.event_type
      || "",

    eventSubtype:
      properties.event_subtype
      || "",

    eventDueTo:
      properties.event_due_to
      || "",

    priority:
      properties.event_priority
      || "",

    direction:
      impact.direction
      || "",

    impactType:
      impact.impact_type
      || "",

    impactSubtype:
      impact.impact_subtype
      || "",

    delay:
      impact.delay
      || "",

    description:
      properties.description
      || "",

    advice:
      properties.advice
      || "",

    information:
      properties.information
      || "",

    lastUpdated:
      properties.last_updated
      || "",

    nextInspection:
      properties.next_inspection
      || "",

    webLink:
      properties.web_link
      || "",

    source:
      properties.source?.provided_by
      || properties.source?.source_name
      || "QLDTraffic"
  };
}
