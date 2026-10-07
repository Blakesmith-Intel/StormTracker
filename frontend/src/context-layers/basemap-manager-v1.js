export const BASEMAP_STORAGE_KEY =
  "stormtracker.basemap.v1";

export const BASEMAP_IDS =
  Object.freeze({
    STREET: "street",
    QLD_IMAGERY: "qld-imagery",
    // Compatibility alias for older callers; stored legacy values are migrated.
    GA_SATELLITE: "qld-imagery"
  });

const LEGACY_SATELLITE_IDS =
  new Set([
    "dea-satellite",
    "ga-satellite"
  ]);

export const QLD_IMAGERY_BASEMAP =
  Object.freeze({
    service:
      "https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer",
    tileTemplate:
      "https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer/tile/{z}/{y}/{x}",
    maximumLevel:
      20,
    rectangleDegrees:
      Object.freeze({
        west: 137.7422089133493,
        south: -29.510092143356154,
        east: 153.75941606036122,
        north: -9.00150272786486
      }),
    label:
      "Queensland imagery · latest public aerial / satellite"
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

export const QUEENSLAND_PLACE_LABELS =
  Object.freeze({
    service:
      "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Location/Places/MapServer",
    layers:
      "20,10,11,12,13,16,17,18,19",
    label:
      "Queensland Globe Places"
  });

export function normaliseBasemapId(
  value
) {
  return (
    value === BASEMAP_IDS.QLD_IMAGERY
    || LEGACY_SATELLITE_IDS.has(
      value
    )
  )
    ? BASEMAP_IDS.QLD_IMAGERY
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

function qldImageryRectangle(
  Cesium
) {
  const bounds =
    QLD_IMAGERY_BASEMAP
      .rectangleDegrees;

  return Cesium.Rectangle.fromDegrees(
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north
  );
}

export function createReferenceLabelProvider(
  Cesium
) {
  return new Cesium.UrlTemplateImageryProvider({
    url:
      REFERENCE_LABELS.tileTemplate,

    // Deliberately do not inherit the Queensland-imagery rectangle here.
    // This layer is cross-border context and must remain continuous over
    // the generic fallback wherever the aerial imagery ends.
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

export async function createQueenslandPlaceLabelProvider(
  Cesium
) {
  const factory =
    Cesium
      ?.ArcGisMapServerImageryProvider
      ?.fromUrl;

  if (
    typeof factory
      !== "function"
  ) {
    throw new TypeError(
      "Cesium ArcGIS MapServer imagery support is unavailable."
    );
  }

  return factory.call(
    Cesium.ArcGisMapServerImageryProvider,
    QUEENSLAND_PLACE_LABELS.service,
    {
      usePreCachedTilesIfAvailable:
        false,

      enablePickFeatures:
        false,

      layers:
        QUEENSLAND_PLACE_LABELS.layers
    }
  );
}

export function createBasemapProvider(
  Cesium,
  id
) {
  const selected =
    normaliseBasemapId(id);

  if (
    selected
    === BASEMAP_IDS.QLD_IMAGERY
  ) {
    return new Cesium.UrlTemplateImageryProvider({
      url:
        QLD_IMAGERY_BASEMAP.tileTemplate,

      tilingScheme:
        new Cesium.WebMercatorTilingScheme(),

      tileWidth:
        256,

      tileHeight:
        256,

      maximumLevel:
        QLD_IMAGERY_BASEMAP.maximumLevel,

      rectangle:
        qldImageryRectangle(
          Cesium
        ),

      credit:
        new Cesium.Credit(
          "Imagery © State of Queensland; © Planet Labs Netherlands B.V., Planet and Geoplex, 2026"
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
    === BASEMAP_IDS.QLD_IMAGERY
      ? QLD_IMAGERY_BASEMAP.label
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
  let fallbackLayer = null;
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
            id === BASEMAP_IDS.QLD_IMAGERY
              ? "Queensland imagery unavailable for part of this view · generic map shown underneath"
              : "Street basemap tiles are currently unavailable. Weather layers are unaffected.",
            id === BASEMAP_IDS.QLD_IMAGERY
              ? "normal"
              : "error"
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
    let nextFallbackLayer =
      null;

    try {
      if (
        id
        === BASEMAP_IDS.QLD_IMAGERY
      ) {
        nextFallbackLayer =
          viewer.imageryLayers
            .addImageryProvider(
              new Cesium
                .OpenStreetMapImageryProvider({
                  url:
                    "https://tile.openstreetmap.org/"
                }),
              0
            );

        nextLayer =
          viewer.imageryLayers
            .addImageryProvider(
              provider,
              1
            );
      } else {
        nextLayer =
          viewer.imageryLayers
            .addImageryProvider(
              provider,
              0
            );
      }
    } catch (error) {
      if (nextFallbackLayer) {
        viewer.imageryLayers.remove(
          nextFallbackLayer,
          true
        );
      }

      onStatus(
        `Unable to switch basemap: ${error.message ?? error}`,
        "error"
      );
      throw error;
    }

    const previousLayer =
      currentLayer;

    const previousFallbackLayer =
      fallbackLayer;

    detachSourceError();

    currentLayer =
      nextLayer;

    fallbackLayer =
      nextFallbackLayer;

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

    if (previousFallbackLayer) {
      viewer.imageryLayers.remove(
        previousFallbackLayer,
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
      id === BASEMAP_IDS.QLD_IMAGERY
        ? "Basemap: Queensland imagery · generic global fallback outside coverage"
        : `Basemap: ${basemapLabel(id)}`,
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

    if (fallbackLayer) {
      viewer.imageryLayers.remove(
        fallbackLayer,
        true
      );
    }

    currentLayer = null;
    fallbackLayer = null;
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
