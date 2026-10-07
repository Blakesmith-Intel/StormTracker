export const BASEMAP_STORAGE_KEY =
  "stormtracker.basemap.v1";

export const BASEMAP_IDS =
  Object.freeze({
    STREET: "street",
    GA_SATELLITE: "ga-satellite"
  });

const LEGACY_DEA_SATELLITE_ID =
  "dea-satellite";

export const GA_BASEMAP =
  Object.freeze({
    service:
      "https://services.ga.gov.au/gis/rest/services/World_Bathymetry_Imagery/MapServer",
    tileTemplate:
      "https://services.ga.gov.au/gis/rest/services/World_Bathymetry_Imagery/MapServer/tile/{z}/{y}/{x}",
    maximumLevel:
      12,
    label:
      "GA satellite · Landsat imagery"
  });

export const REFERENCE_LABELS =
  Object.freeze({
    tileTemplate:
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    maximumLevel:
      23,
    label:
      "World Boundaries and Places"
  });

export function normaliseBasemapId(
  value
) {
  return (
    value === BASEMAP_IDS.GA_SATELLITE
    || value === LEGACY_DEA_SATELLITE_ID
  )
    ? BASEMAP_IDS.GA_SATELLITE
    : BASEMAP_IDS.STREET;
}

function readStoredBasemap(
  storage
) {
  try {
    return normaliseBasemapId(
      storage?.getItem(
        BASEMAP_STORAGE_KEY
      )
    );
  } catch {
    return BASEMAP_IDS.STREET;
  }
}

function persistBasemap(
  storage,
  id
) {
  try {
    storage?.setItem(
      BASEMAP_STORAGE_KEY,
      id
    );
  } catch {
    // Storage is an optional convenience. Basemap switching must still work.
  }
}

export function createReferenceLabelProvider(
  Cesium
) {
  return new Cesium.UrlTemplateImageryProvider({
    url:
      REFERENCE_LABELS.tileTemplate,

    tilingScheme:
      new Cesium.WebMercatorTilingScheme(),

    tileWidth:
      256,

    tileHeight:
      256,

    maximumLevel:
      REFERENCE_LABELS.maximumLevel,

    credit:
      new Cesium.Credit(
        "Reference labels: Esri, HERE, Garmin, OpenStreetMap contributors, GIS user community"
      )
  });
}

export function createBasemapProvider(
  Cesium,
  id
) {
  const selected =
    normaliseBasemapId(id);

  if (
    selected
    === BASEMAP_IDS.GA_SATELLITE
  ) {
    return new Cesium.UrlTemplateImageryProvider({
      url:
        GA_BASEMAP.tileTemplate,

      tilingScheme:
        new Cesium.WebMercatorTilingScheme(),

      tileWidth:
        256,

      tileHeight:
        256,

      maximumLevel:
        GA_BASEMAP.maximumLevel,

      credit:
        new Cesium.Credit(
          "Geoscience Australia · World Bathymetry, Imagery and Hillshade · CC BY 4.0"
        )
    });
  }

  return new Cesium.OpenStreetMapImageryProvider({
    url:
      "https://tile.openstreetmap.org/"
  });
}

export function basemapLabel(
  id
) {
  return normaliseBasemapId(id)
    === BASEMAP_IDS.GA_SATELLITE
      ? GA_BASEMAP.label
      : "Street · OpenStreetMap";
}

export function createStormTrackerBasemapManager({
  Cesium,
  viewer,
  storage =
    globalThis.localStorage,
  onStatus = () => {}
}) {
  if (!Cesium || !viewer?.imageryLayers) {
    throw new TypeError(
      "Basemap manager requires Cesium and a viewer imagery collection."
    );
  }

  let currentLayer = null;
  let currentId = null;
  let sourceErrorDisposer = null;

  function detachSourceError() {
    if (
      typeof sourceErrorDisposer
      === "function"
    ) {
      sourceErrorDisposer();
    }

    sourceErrorDisposer = null;
  }

  function attachSourceError(
    provider,
    id
  ) {
    const errorEvent =
      provider?.errorEvent;

    if (
      !errorEvent
      || typeof errorEvent.addEventListener
        !== "function"
    ) {
      return;
    }

    sourceErrorDisposer =
      errorEvent.addEventListener(
        () => {
          if (currentId !== id) return;

          onStatus(
            id === BASEMAP_IDS.GA_SATELLITE
              ? "GA satellite tiles are currently unavailable. Weather layers are unaffected; switch to Street if needed."
              : "Street basemap tiles are currently unavailable. Weather layers are unaffected.",
            "error"
          );
        }
      );
  }

  function setBasemap(
    requestedId,
    {
      persist = true
    } = {}
  ) {
    const id =
      normaliseBasemapId(
        requestedId
      );

    if (
      currentLayer
      && currentId === id
    ) {
      return {
        id,
        layer:
          currentLayer,
        changed:
          false
      };
    }

    const provider =
      createBasemapProvider(
        Cesium,
        id
      );

    let nextLayer;

    try {
      nextLayer =
        viewer.imageryLayers
          .addImageryProvider(
            provider,
            0
          );
    } catch (error) {
      onStatus(
        `Unable to switch basemap: ${error.message ?? error}`,
        "error"
      );
      throw error;
    }

    const previousLayer =
      currentLayer;

    detachSourceError();

    currentLayer =
      nextLayer;

    currentId =
      id;

    attachSourceError(
      provider,
      id
    );

    if (previousLayer) {
      viewer.imageryLayers.remove(
        previousLayer,
        true
      );
    }

    if (persist) {
      persistBasemap(
        storage,
        id
      );
    }

    onStatus(
      `Basemap: ${basemapLabel(id)}`,
      "ok"
    );

    viewer.scene?.requestRender?.();

    return {
      id,
      layer:
        nextLayer,
      changed:
        true
    };
  }

  function initialise() {
    const stored =
      readStoredBasemap(
        storage
      );

    return setBasemap(
      stored,
      {
        persist:
          false
      }
    );
  }

  function destroy() {
    detachSourceError();

    if (currentLayer) {
      viewer.imageryLayers.remove(
        currentLayer,
        true
      );
    }

    currentLayer = null;
    currentId = null;
  }

  return {
    initialise,
    setBasemap,
    destroy,

    get currentId() {
      return currentId;
    }
  };
}
