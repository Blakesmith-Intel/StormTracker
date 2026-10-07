export const BASEMAP_STORAGE_KEY =
  "stormtracker.basemap.v1";

export const BASEMAP_IDS =
  Object.freeze({
    STREET: "street",
    DEA_SATELLITE: "dea-satellite"
  });

export const DEA_BASEMAP =
  Object.freeze({
    endpoint:
      "https://ows.dea.ga.gov.au/",
    layer:
      "ga_ls8cls9c_gm_cyear_3",
    style:
      "simple_rgb",
    date:
      "2025-07-02",
    label:
      "GA satellite · DEA GeoMAD 2025"
  });

export function normaliseBasemapId(
  value
) {
  return value === BASEMAP_IDS.DEA_SATELLITE
    ? BASEMAP_IDS.DEA_SATELLITE
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

export function createBasemapProvider(
  Cesium,
  id
) {
  const selected =
    normaliseBasemapId(id);

  if (
    selected
    === BASEMAP_IDS.DEA_SATELLITE
  ) {
    return new Cesium.WebMapServiceImageryProvider({
      url:
        DEA_BASEMAP.endpoint,

      layers:
        DEA_BASEMAP.layer,

      parameters: {
        format:
          "image/png",

        transparent:
          false,

        styles:
          DEA_BASEMAP.style,

        time:
          DEA_BASEMAP.date
      },

      credit:
        new Cesium.Credit(
          "Digital Earth Australia / Geoscience Australia · CC BY 4.0"
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
    === BASEMAP_IDS.DEA_SATELLITE
      ? DEA_BASEMAP.label
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
            id === BASEMAP_IDS.DEA_SATELLITE
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
