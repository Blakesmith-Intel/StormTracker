// Frame-mode boundary: source reflectivity annotations and 3-D track glyphs
// must not survive when the user switches to independent native Doppler.
// Keep the detected storm/tracking data and original BoM images untouched.
export function clearReflectivityOverlaysForDoppler({
  trackSource, trackLabels, severeAlerts, clearTrackVolumes,
  inferredVolume, resetSelection, requestRender
}) {
  // A Cesium DataSource show flag alone is not sufficient for independently
  // managed DOM markers, primitive collections and selected threat cones.
  trackSource.show = false;
  trackSource.entities.removeAll(); // Tracks, historical trails AND +90m cones
  trackLabels.setVisible(false);
  trackLabels.setMarkers([]);
  severeAlerts?.setFrame();
  clearTrackVolumes(); // Cesium track-specific volumetric primitives
  if (inferredVolume) inferredVolume.show = false;
  resetSelection(); // Deselect tracked ST ID and turn off the cone control
  requestRender();
}
