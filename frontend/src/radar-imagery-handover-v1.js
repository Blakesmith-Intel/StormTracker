// Browser-only, source-faithful Cesium radar imagery handover.
//
// Keep the previous measured/inferred image visible until the incoming image
// has been added to the globe AND its queued imagery tiles have rendered.
// Never expose the bare basemap between successive radar observations.
export function createRadarImageryHandover({
  imageryLayers, scene, setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
}) {
  if (!imageryLayers || !scene?.postRender) {
    throw new TypeError("Radar imagery handover needs Cesium imagery and render events");
  }
  let activeLayer = null;
  let pending = null;
  let generation = 0;

  function safeRemove(layer) {
    if (!layer) return;
    try { imageryLayers.remove(layer, true); } catch { /* view reset */ }
  }
  function cancelPending() {
    generation++;
    if (pending) {
      const abandoned = pending;
      pending = null;
      abandoned.cancel();
    }
  }
  function reset() {
    cancelPending();
    safeRemove(activeLayer);
    activeLayer = null;
    scene.requestRender();
  }
  function setOpacity(alpha) {
    if (activeLayer) {
      activeLayer.alpha = Math.max(0, Math.min(1, Number(alpha) || 0));
      scene.requestRender();
    }
  }

  async function replace(layer, {
    alpha = 1,
    timeoutMs = 2200,
    decodedSingleTile = false,
    beforeReveal = null,
    isCurrent = () => true
  } = {}) {
    if (!layer) throw new TypeError("Replacement radar imagery is required");
    cancelPending();
    const myGeneration = generation;
    const targetAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    const previous = activeLayer;

    // First frame has no outgoing image to retain. All subsequent transitions
    // preserve the complete outgoing image until the new one is ready.
    if (!previous) {
      // Geometry and the first authentic radar scan appear in the SAME
      // Cesium render transaction, not on successive frames.
      layer.alpha = 0;
      imageryLayers.add(layer);
      try {
        if (beforeReveal) beforeReveal();
      } catch (error) {
        safeRemove(layer);
        scene.requestRender();
        throw error;
      }
      if (myGeneration !== generation || !isCurrent()) {
        safeRemove(layer);
        return false;
      }
      layer.alpha = targetAlpha;
      activeLayer = layer;
      scene.requestRender();
      return true;
    }

    // Nonzero alpha ensures Cesium continues loading the staged layer. It sits
    // UNDER the currently visible weather overlay and cannot flash bare map.
    layer.alpha = 0.001;
    imageryLayers.add(layer, imageryLayers.indexOf(previous));
    scene.requestRender();

    const ready = await new Promise(resolve => {
      let done = false;
      let frames = 0;
      let consecutiveReady = 0;
      let detach = () => {};
      let deadline;
      const finish = ok => {
        if (done) return;
        done = true;
        detach();
        clearTimeoutImpl(deadline);
        if (pending === entry) pending = null;
        resolve(ok);
      };
      const entry = { cancel: () => finish(false) };
      pending = entry;
      detach = scene.postRender.addEventListener(() => {
        if (myGeneration !== generation || !isCurrent()) {
          finish(false);
          return;
        }
        frames++;
        // Cesium's documented signal covers queued terrain and imagery
        // for this view. Two consecutive rendered frames avoid a single
        // stale true immediately after the layer was inserted.
        // A decoded native BoM SingleTile image does not depend on unrelated
        // basemap/terrain requests completing. Permit handover after THREE
        // successful render boundaries even if the global Cesium tile queue
        // is still busy with other layers. Non-predecoded imagery must pass
        // the existing global tilesLoaded test.
        const imageReady = scene.globe?.tilesLoaded === true ||
          (decodedSingleTile && frames >= 3);
        consecutiveReady = imageReady ? consecutiveReady + 1 : 0;
        if (frames >= 2 && consecutiveReady >= (decodedSingleTile ? 1 : 2)) {
          finish(true);
        } else {
          scene.requestRender();
        }
      });
      deadline = setTimeoutImpl(() => finish(false), timeoutMs);
      scene.requestRender();
    });
    if (!ready || myGeneration !== generation || !isCurrent()) {
      safeRemove(layer);
      scene.requestRender();
      return false;
    }
    // Atomically advance dependent 3-D storm geometry and the underlying
    // authentic 2-D raster: no browser frame should show mixed timestamps.
    // This callback is synchronous, immediately before uncovering imagery.
    try {
      if (beforeReveal) beforeReveal();
    } catch(error) {
      safeRemove(layer);
      scene.requestRender();
      throw error;
    }
    if(myGeneration !== generation || !isCurrent()) {
      safeRemove(layer);
      scene.requestRender();
      return false;
    }
    layer.alpha = targetAlpha;
    imageryLayers.raiseToTop(layer);
    activeLayer = layer;
    safeRemove(previous);
    scene.requestRender();
    return true;
  }

  return {
    replace, reset, setOpacity,
    get currentLayer() { return activeLayer; }
  };
}
