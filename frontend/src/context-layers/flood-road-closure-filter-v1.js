const FLOOD_EVENT_TYPES = new Set([
  "flooding"
]);

const FLOOD_EVENT_SUBTYPES = new Set([
  "flash flooding",
  "long-term flooding"
]);

const FLOOD_EVENT_CAUSES = new Set([
  "earlier flooding",
  "earlier flash flooding",
  "water over road",
  "flooding of river"
]);

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
    FLOOD_EVENT_TYPES.has(
      normalise(properties.event_type)
    )
    || FLOOD_EVENT_SUBTYPES.has(
      normalise(properties.event_subtype)
    )
    || FLOOD_EVENT_CAUSES.has(
      normalise(properties.event_due_to)
    )
  );
}

export function isRoadClosureEvent(featureOrProperties) {
  const properties =
    propertiesOf(featureOrProperties);

  return normalise(
    properties.impact?.impact_type
  ) === "closures";
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
    && isFloodRelatedRoadEvent(properties)
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
