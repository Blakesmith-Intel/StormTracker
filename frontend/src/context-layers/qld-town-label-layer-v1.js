import {
  fetchQueenslandPopulationCentres
} from "./qld-population-centres-v2.js?v=9.12.3";
import {
  rankQueenslandTowns,
  greatCircleKm,
  layoutTownLabels,
  labelBudget,
  townLabelTypography
} from "./qld-town-label-declutter-v1.js?v=9.13.4";
import {
  fetchQldNearbyLocalities,
  expandLocalityBounds,
  localityBoundsContain,
  qldLocalityViewBounds
} from "./qld-nearby-localities-v1.js?v=9.13.4";

// Cesium camera.pitch may describe the camera's current reference frame
// (for example after lookAt transforms). Use the actual world-space line of
// sight relative to the ellipsoid surface normal for a reliable horizon angle.
export function cameraLookDownDegrees(camera, CesiumRef, ellipsoid) {
  const fallback = Number.isFinite(camera?.pitch)
    ? camera.pitch * 180 / Math.PI : -90;
  const position = camera?.positionWC;
  const direction = camera?.directionWC;
  const normalAtCamera = ellipsoid?.geodeticSurfaceNormal;
  const Cartesian3 = CesiumRef?.Cartesian3;
  if (!position || !direction ||
      typeof normalAtCamera !== "function" ||
      typeof Cartesian3?.dot !== "function") return fallback;
  const normal = normalAtCamera.call(ellipsoid, position, new Cartesian3());
  if (!normal) return fallback;
  const cosine = Cartesian3.dot(direction, normal);
  if (!Number.isFinite(cosine)) return fallback;
  return Math.asin(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function createQueenslandTownLabelLayer({
  viewer,
  CesiumRef = globalThis.Cesium,
  fetchImpl = globalThis.fetch,
  mode = "street",
  onStatus = () => {}
} = {}) {
  if (!viewer?.scene?.primitives || !CesiumRef?.LabelCollection ||
      !CesiumRef?.SceneTransforms || !CesiumRef?.EllipsoidalOccluder) {
    throw new TypeError("Queensland town labels require a Cesium 3-D scene");
  }

  const scene = viewer.scene;
  const collection = scene.primitives.add(new CesiumRef.LabelCollection({
    scene,
    blendOption: CesiumRef.BlendOption?.TRANSLUCENT
  }));
  // Cesium-level visibility gate: OSM Street already draws its own names.
  // Keep a single collection for imagery, never show it on Street.
  collection.show = mode === "qld-imagery";
  let destroyed = false;
  let started = null;
  let towns = [];
  let selectedIds = [];
  let displayedPlaces = [];
  let currentMode = mode;
  let lastFingerprint = "";
  let lastCalculation = 0;
  let updated = 0;
  let windowResizeListener = null;
  let postRenderDisposer = null;
  let localityCoverage = null;
  let localityBusy = false;
  let lastLocalityRequest = 0;
  let localityRequestVersion = 0;

  function maybeLoadNearby() {
    if (destroyed || currentMode !== "qld-imagery" || localityBusy ||
        !towns.length) return;
    const ellipsoid = scene.globe?.ellipsoid ?? CesiumRef.Ellipsoid?.WGS84;
    const view = qldLocalityViewBounds(scene.camera, CesiumRef, ellipsoid);
    if (!view || localityBoundsContain(localityCoverage, view)) return;
    const now = Date.now();
    if (now - lastLocalityRequest < 2500) return;
    lastLocalityRequest = now;
    const bounds = expandLocalityBounds(view);
    const version = ++localityRequestVersion;
    localityBusy = true;
    void fetchQldNearbyLocalities({bounds, fetchImpl}).then(records => {
      if (destroyed || version !== localityRequestVersion) return;
      // New view replaces previous supplemental markers to keep memory
      // bounded on long-running browser sessions.
      for (const old of towns.filter(x => x.fromGazetteer)) {
        old.label.show = false;
        collection.remove?.(old.label);
      }
      towns = towns.filter(x => !x.fromGazetteer);
      const existing = towns.filter(x => !x.fromGazetteer);
      const unique = new Set();
      for (const town of records) {
        const sameName = x => x.name.trim().toLowerCase() === town.name.toLowerCase()
          && greatCircleKm(x, town) < 8;
        if (existing.some(sameName) || towns.some(sameName)) continue;
        const identity = town.name.toLowerCase() + ":" +
          town.latitude.toFixed(3) + ":" + town.longitude.toFixed(3);
        if (unique.has(identity)) continue;
        unique.add(identity);
        const position = CesiumRef.Cartesian3.fromDegrees(
          town.longitude, town.latitude, 0
        );
        const label = collection.add({
          text: town.name, position, show: false,
          font: townLabelTypography(scene.canvas?.clientWidth ?? 0, 0).font,
          fillColor: CesiumRef.Color.WHITE,
          outlineColor: CesiumRef.Color.BLACK, outlineWidth: 3,
          style: CesiumRef.LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: CesiumRef.HorizontalOrigin.CENTER,
          verticalOrigin: CesiumRef.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          id: "qld-locality:" + town.id
        });
        towns.push({...town, position, label, fromGazetteer: true});
      }
      localityCoverage = bounds;
      selectedIds = [];
      lastFingerprint = "";
      draw(true);
    }).catch(error => {
      if (!destroyed) console.warn("Nearby Queensland gazetteer unavailable:", error);
    }).finally(() => {
      if (version === localityRequestVersion) localityBusy = false;
    });
  }

  function fingerprint() {
    const pos = scene.camera?.positionWC;
    const dir = scene.camera?.directionWC;
    const canvas = scene.canvas;
    if (!pos || !dir || !canvas) return "";
    // 1m camera movement / tiny rotation is more than sufficiently precise
    // for an outback map. Avoid recalculating on identical static frames.
    return [
      Math.round(pos.x), Math.round(pos.y), Math.round(pos.z),
      Math.round(dir.x * 10000), Math.round(dir.y * 10000),
      Math.round(dir.z * 10000), canvas.clientWidth, canvas.clientHeight,
      currentMode
    ].join(":");
  }

  function draw(force = false) {
    if (destroyed || !towns.length) return [];
    const key = fingerprint();
    if (!force && key === lastFingerprint) return selectedIds;
    const now = Date.now();
    if (!force && now - lastCalculation < 170) return selectedIds;
    lastCalculation = now;
    lastFingerprint = key;

    const camera = scene.camera;
    const canvas = scene.canvas;
    const width = canvas?.clientWidth ?? 0;
    const height = canvas?.clientHeight ?? 0;
    const cameraHeight = Math.max(0, camera?.positionCartographic?.height ?? 0);
    const cameraPitchDegrees = cameraLookDownDegrees(
      camera, CesiumRef, scene.globe?.ellipsoid ?? CesiumRef.Ellipsoid?.WGS84
    );
    const budget = labelBudget(width, height, cameraHeight, currentMode, cameraPitchDegrees);
    const candidates = [];
    // Desktop labels are larger than mobile; keep Cesium glyph sizes and
    // screen-space collision boxes in sync across viewport resizes.
    for (const place of towns) {
      const font = townLabelTypography(width, place.population).font;
      if (place.label.font !== font) place.label.font = font;
    }

    if (budget > 0 && camera?.positionWC) {
      const ellipsoid = scene.globe?.ellipsoid ?? CesiumRef.Ellipsoid.WGS84;
      const occluder = new CesiumRef.EllipsoidalOccluder(
        ellipsoid, camera.positionWC
      );
      for (const place of towns) {
        // The opposite side of the globe must never become a floating
        // label projected above the horizon.
        if (!occluder.isPointVisible(place.position)) continue;
        const screen = CesiumRef.SceneTransforms.worldToWindowCoordinates(
          scene, place.position
        );
        if (!screen) continue;
        candidates.push({
          ...place,
          x: screen.x, y: screen.y
        });
      }
    }
    const accepted = layoutTownLabels({
      candidates, width, height, cameraHeight,
      mode: currentMode, cameraPitchDegrees,
      previousVisible: selectedIds
    });
    const acceptedIds = new Set(accepted.map(place => String(place.id)));
    for (const place of towns) {
      const nextShow = acceptedIds.has(String(place.id));
      if (place.label.show !== nextShow) place.label.show = nextShow;
    }
    selectedIds = accepted.map(place => String(place.id));
    displayedPlaces = accepted.map(place => ({
      id: place.id, name: place.name,
      x: place.x, y: place.y, population: place.population,
      font: place.label.font
    }));
    updated += 1;
    scene.requestRender?.();
    maybeLoadNearby();
    return selectedIds;
  }

  function setMode(nextMode) {
    if (destroyed) return;
    const modeValue = nextMode === "qld-imagery" ? "qld-imagery" : "street";
    // Hide the entire collection synchronously before basemap tile swaps.
    // Mode changes are a hard visibility boundary, not a population filter.
    collection.show = modeValue === "qld-imagery";
    if (currentMode !== modeValue) {
      currentMode = modeValue;
      draw(true);
    }
  }

  async function start() {
    if (started) return started;
    started = (async () => {
      try {
        const records = rankQueenslandTowns(
          await fetchQueenslandPopulationCentres({ fetchImpl })
        );
        if (destroyed) return 0;
        const sourceNames = new Set();
        for (const town of records) {
          // Avoid duplicated geographical names at approximately the same
          // coordinate even when ArcGIS returns separate feature IDs.
          const identity = `${town.name.toLowerCase()}:${town.latitude.toFixed(2)}:${town.longitude.toFixed(2)}`;
          if (sourceNames.has(identity)) continue;
          sourceNames.add(identity);
          const position = CesiumRef.Cartesian3.fromDegrees(
            town.longitude, town.latitude, 0
          );
          const label = collection.add({
            text: town.name,
            position,
            show: false,
            font: townLabelTypography(
              scene.canvas?.clientWidth ?? 0, town.population
            ).font,
            fillColor: CesiumRef.Color.WHITE,
            outlineColor: CesiumRef.Color.BLACK,
            outlineWidth: 3,
            style: CesiumRef.LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: CesiumRef.HorizontalOrigin.CENTER,
            verticalOrigin: CesiumRef.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            id: `qld-town:${town.id}`
          });
          towns.push({ ...town, position, label });
        }
        // Work is driven by existing rendered frames, not by a second
        // animation timer or by reconnecting the imagery service.
        const event = scene.postRender;
        postRenderDisposer = event?.addEventListener?.(() => {
          try { draw(); } catch (error) {
            console.warn("Town label layout skipped:", error);
          }
        }) ?? null;
        if (typeof window !== "undefined") {
          windowResizeListener = () => draw(true);
          window.addEventListener("resize", windowResizeListener, { passive: true });
        }
        draw(true);
        onStatus({
          kind: "ok",
          message: `Queensland towns ready · ${towns.length} locations, decluttered by zoom`
        });
        return towns.length;
      } catch (error) {
        if (!destroyed) onStatus({
          kind: "warning",
          message: `Queensland town names unavailable: ${error?.message ?? error}`
        });
        throw error;
      }
    })();
    return started;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    localityRequestVersion += 1;
    postRenderDisposer?.();
    if (windowResizeListener && typeof window !== "undefined") {
      window.removeEventListener("resize", windowResizeListener);
    }
    scene.primitives.remove(collection);
    towns = [];
    selectedIds = [];
    displayedPlaces = [];
    scene.requestRender?.();
  }

  return {
    start, draw, setMode, destroy,
    get count() { return towns.length; },
    get visibleCount() { return selectedIds.length; },
    get visibleIds() { return [...selectedIds]; },
    get visibleLabels() { return displayedPlaces.map(place => ({ ...place })); },
    get calculationCount() { return updated; },
    get gazetteerCount() { return towns.filter(t => t.fromGazetteer).length; },
    get mode() { return currentMode; },
    get cameraHeight() { return scene.camera?.positionCartographic?.height ?? null; },
    get cameraPitchDegrees() {
      return cameraLookDownDegrees(
        scene.camera, CesiumRef, scene.globe?.ellipsoid ?? CesiumRef.Ellipsoid?.WGS84
      );
    }
  };
}
