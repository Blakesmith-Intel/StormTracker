// Labels controls the complete track identifier presentation: DOM dot,
// text and corresponding Cesium history trail. The selected threat cone,
// severe alerts and operational overlays have independent controls.
export const TRACK_TRAIL_ENTITY_PREFIX = "hybrid-trail-";

export function setStormTrackTrailVisibility(entities, visible) {
  const show=Boolean(visible);
  let updated=0;
  for(const entity of entities?.values??[]) {
    if(typeof entity?.id!=="string" ||
       !entity.id.startsWith(TRACK_TRAIL_ENTITY_PREFIX)) continue;
    entity.show=show;
    updated++;
  }
  return updated;
}
