// Independently toggleable map-pin + alert dock. Never touches ST labels or Cesium weather.
export function createSevereStormAlertOverlay({
  scene, CesiumRef, container, onFocus,
  documentRef = globalThis.document
}) {
  if (!scene || !CesiumRef || !container) throw new TypeError("Map scene required.");
  const root = documentRef.createElement("section");
  root.className = "storm-severe-alert-dock";
  root.setAttribute("aria-label", "Radar evidence alerts");
  const heading = documentRef.createElement("div");
  heading.className = "storm-severe-alert-heading";
  const caption = documentRef.createElement("strong");
  caption.textContent = "RADAR ALERTS";
  const counter = documentRef.createElement("span");
  counter.className = "storm-severe-alert-count";
  heading.append(caption, counter);
  const status = documentRef.createElement("p");
  status.className = "storm-severe-alert-status";
  const rows = documentRef.createElement("div");
  rows.className = "storm-severe-alert-rows";
  const detail = documentRef.createElement("div");
  detail.className = "storm-severe-alert-detail";
  detail.hidden = true;
  root.append(heading, rows, status, detail);
  container.appendChild(root);
  const pinsRoot = documentRef.createElement("div");
  pinsRoot.className = "storm-severe-alert-pins";
  container.appendChild(pinsRoot);

  let enabled = true;
  let alerts = [];
  let hasObservedFrame = false;
  let windSourceSupported = false;
  let hookExperimental = false;
  let displayedUtc = null;
  let atNewestFrame = false;
  let selectedId = "";
  let markers = [];
  let destroyed = false;

  function reveal(alert) {
    selectedId = alert.id;
    detail.replaceChildren();
    const title = documentRef.createElement("strong");
    title.textContent = alert.title + " · " + alert.track_id;
    const measured = documentRef.createElement("p");
    measured.textContent = alert.type === "wind"
      ? "Radial velocity " + Math.abs(alert.velocity_kmh).toFixed(0) +
        " km/h (" + (alert.velocity_kmh < 0 ? "toward" : "away") + " radar) · " +
        alert.sample_count + " high-speed samples · radar " + alert.radar_id
      : "Connected low-reflectivity arc " + alert.arc_degrees.toFixed(0) +
        "° · seen in two consecutive measured scans";
    const source = documentRef.createElement("p");
    source.textContent = "Reflectivity " + alert.observed_utc +
      (alert.source_utc ? " · Doppler " + alert.source_utc : "");
    const warning = documentRef.createElement("p");
    warning.textContent = alert.caveat;
    const sourceLink = documentRef.createElement("a");
    sourceLink.textContent = "Open official BoM radar imagery";
    sourceLink.href = "https://www.bom.gov.au/australia/radar/";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    const close = documentRef.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", () => {
      detail.hidden = true;
      selectedId = "";
    });
    detail.append(title, measured, source, warning, sourceLink, close);
    detail.hidden = false;
    onFocus?.(alert);
  }

  function draw() {
    if (destroyed) return;
    root.hidden = !enabled;
    pinsRoot.hidden = !enabled;
    if (!enabled) return;
    counter.textContent = String(alerts.length);
    rows.replaceChildren();
    pinsRoot.replaceChildren();
    markers = [];
    if (!hasObservedFrame) {
      status.textContent = "Load an observed storm loop for radar evidence.";
    } else if (!windSourceSupported) {
      status.textContent = "90 km/h Doppler: unsupported by current ±70 km/h image scale.";
    } else {
      status.textContent = alerts.length ? "Radar-derived indicators · not official warnings" :
        "No qualifying radar indicators in this frame.";
    }
    if (hasObservedFrame) {
      const epoch = Date.parse(displayedUtc);
      const ageMs = Date.now() - epoch;
      const isFresh = Number.isFinite(ageMs) && ageMs >= -300000 &&
        ageMs <= 30 * 60000;
      const label = !atNewestFrame ? "HISTORICAL" : (isFresh ? "LATEST" : "STALE");
      const stamp = Number.isFinite(epoch)
        ? new Date(epoch).toLocaleTimeString("en-AU", {
            timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit"
          }) + " AEST"
        : "unknown source time";
      status.dataset.frameState = label.toLowerCase();
      status.textContent = label + " · " + stamp + ". " + status.textContent;
    }
    if (hookExperimental) {
      const note = documentRef.createElement("small");
      note.textContent = "Hook-shape model is experimental / unvalidated.";
      status.append(documentRef.createElement("br"), note);
    }
    for (const alert of alerts.slice(0, 8)) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "storm-severe-alert-row " + alert.type;
      const prefix = alert.type === "wind" ? "WIND" : "HOOK?";
      button.textContent = prefix + " · " + alert.track_id + " · " +
        (alert.type === "wind"
          ? Math.abs(alert.velocity_kmh).toFixed(0) + " km/h radial"
          : "possible curved echo");
      button.addEventListener("click", () => reveal(alert));
      rows.appendChild(button);
      const pin = documentRef.createElement("button");
      pin.type = "button";
      pin.className = "storm-severe-alert-pin " + alert.type;
      pin.textContent = alert.type === "wind" ? "W" : "?";
      pin.setAttribute("aria-label", alert.title + " " + alert.track_id);
      pin.addEventListener("click", () => reveal(alert));
      pinsRoot.appendChild(pin);
      markers.push({
        position: CesiumRef.Cartesian3.fromDegrees(alert.longitude, alert.latitude, 2000),
        element: pin
      });
    }
    project();
  }

  function project() {
    if (destroyed || !enabled) return;
    const width = container.clientWidth, height = container.clientHeight;
    const ellipsoid = scene.globe?.ellipsoid;
    const cameraPosition = scene.camera?.positionWC;
    const occluder = ellipsoid && cameraPosition && CesiumRef.EllipsoidalOccluder
      ? new CesiumRef.EllipsoidalOccluder(ellipsoid, cameraPosition) : null;
    for (const marker of markers) {
      const location = CesiumRef.SceneTransforms.worldToWindowCoordinates(scene, marker.position);
      const inside = location && Number.isFinite(location.x) &&
        Number.isFinite(location.y) && location.x >= 0 && location.y >= 0 &&
        location.x <= width && location.y <= height;
      marker.element.hidden = !inside || (occluder && !occluder.isPointVisible(marker.position));
      if (!marker.element.hidden) {
        marker.element.style.left = location.x + "px";
        marker.element.style.top = location.y + "px";
      }
    }
  }

  const removeListener = scene.postRender.addEventListener(project);
  const ageRefresh = setInterval(() => { if (!destroyed && enabled) draw(); }, 60000);
  draw();
  return {
    setEnabled(value) { enabled = Boolean(value); draw(); scene.requestRender(); },
    setFrame({ alerts: next = [], observedFrame = false,
      windSupported = false, experimentalHook = false,
      displayedUtc: utc = null, atNewestFrame = false } = {}) {
      alerts = next;
      hasObservedFrame = observedFrame;
      windSourceSupported = windSupported;
      hookExperimental = experimentalHook;
      displayedUtc = utc;
      atNewestFrame = Boolean(atNewestFrame);
      selectedId = "";
      detail.hidden = true;
      draw();
      scene.requestRender();
    },
    get alertCount() { return alerts.length; },
    get selectedAlertId() { return selectedId; },
    destroy() {
      destroyed = true;
      clearInterval(ageRefresh);
      removeListener?.();
      root.remove();
      pinsRoot.remove();
    }
  };
}
