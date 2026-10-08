// Display-only 3-D storm volume intensity gate. Never use this to filter
// source reflectivity, track segmentation, measured footprints or inference.
export const MINIMUM_VOLUME_DISPLAY_DBZ = 40;

export function volumeDisplayThresholdDbz(requested) {
  const value = Number(requested);
  return Number.isFinite(value)
    ? Math.max(MINIMUM_VOLUME_DISPLAY_DBZ, value)
    : MINIMUM_VOLUME_DISPLAY_DBZ;
}

export function shouldRenderVolumePoint(dbzh, requestedThreshold = MINIMUM_VOLUME_DISPLAY_DBZ) {
  const value = Number(dbzh);
  return Number.isFinite(value) && value >= volumeDisplayThresholdDbz(requestedThreshold);
}
