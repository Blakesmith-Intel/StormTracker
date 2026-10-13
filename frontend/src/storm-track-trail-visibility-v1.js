// The Labels control owns the complete map track annotation on the current
// frame, including historical trails and the corresponding selected threat
// cone/boundary/centreline/markers. Never hide source radar, inferred volumes,
// severe warnings, rescue lines, or unrelated map entities.
export const TRACK_TRAIL_ENTITY_PREFIX = "hybrid-trail-";
export const TRACK_THREAT_ENTITY_PREFIX = "hybrid-threat-";

export function setStormTrackTrailVisibility(entities, visible) {
  const show = Boolean(visible);
  let updated = 0;
  for (const entity of entities?.values ?? []) {
    if (typeof entity?.id !== "string" ||
        !(entity.id.startsWith(TRACK_TRAIL_ENTITY_PREFIX) ||
          entity.id.startsWith(TRACK_THREAT_ENTITY_PREFIX))) continue;
    entity.show = show;
    updated++;
  }
  return updated;
}
