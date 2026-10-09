// The Labels control owns the COMPLETE storm-track annotation:
// DOM label+centroid marker and the corresponding Cesium history trail.
// Never touch threat cones, source radar imagery, severe alerts or other lines.
export const TRACK_TRAIL_ENTITY_PREFIX = "hybrid-trail-";

export function setStormTrackTrailVisibility(entities, visible) {
  const show = Boolean(visible);
  let updated = 0;
  for (const entity of entities?.values ?? []) {
    if (typeof entity?.id !== "string" ||
        !entity.id.startsWith(TRACK_TRAIL_ENTITY_PREFIX)) continue;
    entity.show = show;
    updated++;
  }
  return updated;
}
