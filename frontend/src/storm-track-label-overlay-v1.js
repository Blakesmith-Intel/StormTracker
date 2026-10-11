// Storm tracking identifiers are a screen-space presentation overlay above
// all Cesium volume primitives. Each tracking dot and label is one DOM marker,
// sharing positioning, visibility and lifecycle without modifying radar data.
export function createStormTrackLabelOverlay({
  scene,
  CesiumRef,
  container,
  documentRef = globalThis.document
}) {
  if (!scene?.postRender || !CesiumRef?.SceneTransforms || !container) {
    throw new TypeError("Storm identifier overlay requires a Cesium scene and map panel");
  }

  const root = documentRef.createElement("div");
  root.className = "storm-track-overlay";
  root.setAttribute("aria-hidden", "true");
  root.hidden = true;
  container.appendChild(root);

  let markers = [];
  let visible = true;
  let destroyed = false;

  function project() {
    if (destroyed || !visible || !markers.length) {
      root.hidden = true;
      return;
    }

    root.hidden = false;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const ellipsoid = scene.globe?.ellipsoid;
    const cameraPosition = scene.camera?.positionWC;
    const occluder = ellipsoid && cameraPosition && CesiumRef.EllipsoidalOccluder
      ? new CesiumRef.EllipsoidalOccluder(ellipsoid, cameraPosition)
      : null;

    // Screen-space collision checking keeps points and their text paired.
    // Higher-priority persistent/strong storms and the selected track win.
    const occupied = [];
    let visibleCount = 0;
    const labelLimit = Math.max(6, Math.min(38, Math.floor(width * height / 20000)));
    for (const { position, element, labelLength, size } of markers) {
      const location = CesiumRef.SceneTransforms.worldToWindowCoordinates(scene, position);
      const inside = location && Number.isFinite(location.x)
        && Number.isFinite(location.y)
        && location.x >= 0 && location.y >= 0
        && location.x <= width && location.y <= height;
      const aboveHorizon = !occluder || occluder.isPointVisible(position);
      const rect = inside ? {
        left: location.x - size / 2,
        right: location.x + size / 2 + labelLength * 7.2 + 12,
        top: location.y - 12,
        bottom: location.y + 17
      } : null;
      const collision = rect && occupied.some(other =>
        rect.left < other.right && rect.right > other.left &&
        rect.top < other.bottom && rect.bottom > other.top);
      element.hidden = !inside || !aboveHorizon || collision || visibleCount >= labelLimit;
      if (!element.hidden) {
        occupied.push(rect);
        visibleCount++;
        element.style.left = `${location.x}px`;
        element.style.top = `${location.y}px`;
      }
    }
  }

  function setMarkers(nextMarkers) {
    if (destroyed) return;
    // Replace the point AND its label atomically when changing radar frames.
    markers = (nextMarkers ?? []).map(({ position, text, colour, size, priority }) => {
      const element = documentRef.createElement("div");
      element.className = "storm-track-marker";
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
      element.style.backgroundColor = colour;
      const label = documentRef.createElement("span");
      label.className = "storm-track-marker-label";
      label.textContent = text;
      element.appendChild(label);
      return { position, element, size: Number(size) || 8, labelLength: String(text ?? "").length, priority: Number(priority) || 0 };
    }).sort((a,b) => b.priority - a.priority);
    root.replaceChildren(...markers.map(marker => marker.element));
    project();
    scene.requestRender();
  }

  function setVisible(nextVisible) {
    if (destroyed) return;
    visible = Boolean(nextVisible);
    project(); // Immediate even when paused on the final frame.
    scene.requestRender();
  }

  const removePostRender = scene.postRender.addEventListener(project);
  return {
    setMarkers,
    setVisible,
    get markerCount() { return markers.length; },
    get visible() { return visible; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      removePostRender?.();
      markers = [];
      root.remove();
    }
  };
}
