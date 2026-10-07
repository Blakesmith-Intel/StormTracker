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

export function isActiveFloodRoadClosure(feature) {
  const properties =
    propertiesOf(feature);

  return (
    normalise(properties.status) === "published"
    && isFloodRelatedRoadEvent(properties)
    && isRoadClosureEvent(properties)
  );
}

export function filterFloodRoadClosures(payload) {
  const features =
    Array.isArray(payload?.features)
      ? payload.features.filter(
          isActiveFloodRoadClosure
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
