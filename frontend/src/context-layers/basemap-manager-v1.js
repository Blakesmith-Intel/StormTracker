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
      "QLD + NSW imagery · official aerial / satellite"
  });

// NSW Spatial Services official public imagery is a 256px EPSG:3857
// tiled MapServer. Its published extent is deliberately bounded so the
// browser never requests imagery outside the source's coverage. Layer order
// is global street fallback → NSW imagery → Queensland imagery on top.
export const NSW_IMAGERY_BASEMAP = Object.freeze({
  service: "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer",
  tileTemplate: "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 20, // Match the current QLD imagery zoom capability.
  rectangleDegrees: Object.freeze({
    west: 138.42823352306536,
    south: -38.38094509104267,
    east: 159.28994735728213,
    north: -26.48153106270077
  }),
  label: "NSW Spatial Services aerial / satellite imagery"
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
    // Only named population centres: the other service layers add beaches,
    // cemeteries, airfields and landmarks which collide with town labels.
    layers:
      "20",
    label:
      "Queensland Globe population centres"
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

function nswImageryRectangle(Cesium) {
  const b = NSW_IMAGERY_BASEMAP.rectangleDegrees;
  return Cesium.Rectangle.fromDegrees(b.west,b.south,b.east,b.north);
}

export function createNswImageryProvider(Cesium) {
  return new Cesium.UrlTemplateImageryProvider({
    url: NSW_IMAGERY_BASEMAP.tileTemplate,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    tileWidth: 256,
    tileHeight: 256,
    maximumLevel: NSW_IMAGERY_BASEMAP.maximumLevel,
    rectangle: nswImageryRectangle(Cesium),
    credit: new Cesium.Credit(
      "NSW imagery © Department of Customer Service (NSW Spatial Services), 2026"
    )
  });
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
  let nswLayer = null;
  let currentId = null;
  let sourceErrorDisposers = [];

  function detachSourceError() {
    for(const dispose of sourceErrorDisposers) dispose();
    sourceErrorDisposers = [];
  }

  function attachSourceError(
    provider,
    id,
    region = "QLD"
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

    const dispose = errorEvent.addEventListener(() => {
      if (currentId !== id) return;
      const satellite = id === BASEMAP_IDS.QLD_IMAGERY;
      onStatus(satellite
        ? (region === "NSW"
          ? "NSW imagery temporarily unavailable · Street map remains as fallback"
          : "Queensland imagery unavailable for part of this view · NSW imagery / Street fallback remains")
        : "Street basemap tiles are currently unavailable. Weather layers are unaffected.",
        satellite ? "normal" : "error");
    });
    if (typeof dispose === "function") sourceErrorDisposers.push(dispose);
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
    let nextFallbackLayer = null;
    let nextNswLayer = null;
    let nswProviderForErrors = null;

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

        // One satellite selection: NSW is underneath QLD; source credits
        // remain attached to each official provider. Do not move the camera.
        nswProviderForErrors = createNswImageryProvider(Cesium);
        nextNswLayer = viewer.imageryLayers.addImageryProvider(
          nswProviderForErrors, 1
        );
        nextLayer = viewer.imageryLayers.addImageryProvider(provider, 2);
      } else {
        nextLayer =
          viewer.imageryLayers
            .addImageryProvider(
              provider,
              0
            );
      }
    } catch (error) {
      if (nextNswLayer) viewer.imageryLayers.remove(nextNswLayer,true);
      if (nextFallbackLayer) viewer.imageryLayers.remove(nextFallbackLayer,true);

      onStatus(
        `Unable to switch basemap: ${error.message ?? error}`,
        "error"
      );
      throw error;
    }

    const previousLayer =
      currentLayer;

    const previousFallbackLayer = fallbackLayer;
    const previousNswLayer = nswLayer;

    detachSourceError();

    currentLayer =
      nextLayer;

    fallbackLayer = nextFallbackLayer;
    nswLayer = nextNswLayer;

    currentId =
      id;

    attachSourceError(provider,id);
    if(nswProviderForErrors) attachSourceError(nswProviderForErrors,id,"NSW");

    if (previousLayer) {
      viewer.imageryLayers.remove(
        previousLayer,
        true
      );
    }

    if (previousNswLayer) viewer.imageryLayers.remove(previousNswLayer,true);
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
        ? "Basemap: Queensland + NSW official imagery · Street fallback elsewhere"
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

    if (nswLayer) viewer.imageryLayers.remove(nswLayer, true);
    if (fallbackLayer) {
      viewer.imageryLayers.remove(
        fallbackLayer,
        true
      );
    }

    currentLayer = null;
    fallbackLayer = null;
    nswLayer = null;
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
