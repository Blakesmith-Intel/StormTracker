import assert from "node:assert/strict";

import {
  BASEMAP_IDS,
  BASEMAP_STORAGE_KEY,
  QLD_IMAGERY_BASEMAP,
  NSW_IMAGERY_BASEMAP,
  createNswImageryProvider,
  QUEENSLAND_PLACE_LABELS,
  REFERENCE_LABELS,
  basemapLabel,
  createBasemapProvider,
  createQueenslandPlaceLabelProvider,
  createReferenceLabelProvider,
  createStormTrackerBasemapManager,
  normaliseBasemapId
} from "../src/context-layers/basemap-manager-v1.js";

class FakeCredit {
  constructor(text) {
    this.text = text;
  }
}

class FakeStreetProvider {
  constructor(options) {
    this.options = options;
    this.errorEvent = {
      addEventListener: () => () => {}
    };
  }
}

class FakeUrlTemplateProvider {
  constructor(options) {
    this.options = options;
    this.errorEvent = {
      addEventListener: listener => {
        this.listener = listener;
        return () => {
          this.listener = null;
        };
      }
    };
  }
}

class FakeWebMercatorTilingScheme {}

class FakeArcGisProvider {
  static async fromUrl(
    url,
    options
  ) {
    return {
      url,
      options,
      errorEvent: {
        addEventListener:
          () => () => {}
      }
    };
  }
}

class FakeRectangle {
  static fromDegrees(
    west,
    south,
    east,
    north
  ) {
    return {
      west,
      south,
      east,
      north
    };
  }
}

const Cesium = {
  Credit: FakeCredit,
  OpenStreetMapImageryProvider:
    FakeStreetProvider,
  UrlTemplateImageryProvider:
    FakeUrlTemplateProvider,
  ArcGisMapServerImageryProvider:
    FakeArcGisProvider,
  WebMercatorTilingScheme:
    FakeWebMercatorTilingScheme,
  Rectangle:
    FakeRectangle
};

const qld =
  createBasemapProvider(
    Cesium,
    BASEMAP_IDS.QLD_IMAGERY
  );

assert.equal(
  qld.options.url,
  "https://spatial-img.information.qld.gov.au/arcgis/rest/services/Basemaps/LatestStateProgram_AllUsers/ImageServer/tile/{z}/{y}/{x}"
);
assert.equal(
  qld.options.maximumLevel,
  20
);
assert.equal(
  qld.options.tileWidth,
  256
);
assert.equal(
  qld.options.tileHeight,
  256
);
assert.ok(
  qld.options.tilingScheme
  instanceof FakeWebMercatorTilingScheme
);
assert.match(
  qld.options.credit.text,
  /State of Queensland/
);

assert.deepEqual(
  qld.options.rectangle,
  QLD_IMAGERY_BASEMAP.rectangleDegrees
);

assert.equal(
  QLD_IMAGERY_BASEMAP.label,
  "QLD + NSW imagery · official aerial / satellite"
);

const nsw = createNswImageryProvider(Cesium);
assert.equal(
  nsw.options.url,
  "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}"
);
assert.equal(nsw.options.maximumLevel,20,"Both state imagery providers support the same requested zoom limit");
assert.equal(nsw.options.tileWidth,256);
assert.equal(nsw.options.tileHeight,256);
assert.ok(nsw.options.tilingScheme instanceof FakeWebMercatorTilingScheme);
assert.deepEqual(nsw.options.rectangle, NSW_IMAGERY_BASEMAP.rectangleDegrees,
  "NSW source only requests official service footprint (no nationwide blank tiles)");
assert.match(nsw.options.credit.text,/NSW Spatial Services/,
  "NSW government requires a separate attribution credit");
assert.ok(NSW_IMAGERY_BASEMAP.rectangleDegrees.north>QLD_IMAGERY_BASEMAP.rectangleDegrees.south,
  "Small geographic overlap prevents a latitude gap at the Queensland/NSW border");
assert.ok(NSW_IMAGERY_BASEMAP.rectangleDegrees.south < -37,
  "Satellite imagery must reach southern NSW, not just the QLD border");

const labels =
  createReferenceLabelProvider(
    Cesium
  );

assert.equal(
  labels.options.url,
  REFERENCE_LABELS.tileTemplate
);

assert.equal(
  labels.options.maximumLevel,
  23
);

assert.ok(
  labels.options.tilingScheme
  instanceof FakeWebMercatorTilingScheme
);

assert.match(
  labels.options.credit.text,
  /Reference labels/
);

assert.equal(
  labels.options.rectangle,
  undefined,
  "Global reference labels must not inherit the Queensland imagery rectangle or they will be cut off at the imagery seam."
);

const qldPlaces =
  await createQueenslandPlaceLabelProvider(
    Cesium
  );

assert.equal(
  qldPlaces.url,
  QUEENSLAND_PLACE_LABELS.service
);

assert.equal(
  qldPlaces.options
    .usePreCachedTilesIfAvailable,
  false
);

assert.equal(
  qldPlaces.options
    .enablePickFeatures,
  false
);

assert.equal(
  qldPlaces.options.layers,
  "20"
);

assert.match(
  QUEENSLAND_PLACE_LABELS.label,
  /Queensland Globe population centres/
);
assert.equal(
  normaliseBasemapId("nonsense"),
  BASEMAP_IDS.STREET
);
assert.equal(
  basemapLabel(BASEMAP_IDS.STREET),
  "Street · OpenStreetMap"
);

const calls = [];
const layers = [];

const viewer = {
  imageryLayers: {
    addImageryProvider(
      provider,
      index
    ) {
      const layer = {
        provider,
        index,
        id:
          `layer-${layers.length + 1}`
      };

      layers.splice(
        index,
        0,
        layer
      );

      calls.push([
        "add",
        provider.constructor.name,
        index
      ]);

      return layer;
    },

    remove(
      layer,
      destroy
    ) {
      const index =
        layers.indexOf(layer);

      if (index >= 0) {
        layers.splice(
          index,
          1
        );
      }

      calls.push([
        "remove",
        layer.id,
        destroy
      ]);

      return true;
    }
  },

  scene: {
    requestRender() {
      calls.push([
        "render"
      ]);
    }
  },

  camera: {
    setView() {
      throw new Error(
        "Basemap changes must not move the camera."
      );
    }
  }
};

const store = new Map([
  [
    BASEMAP_STORAGE_KEY,
    "ga-satellite"
  ]
]);

const storage = {
  getItem:
    key => store.get(key) ?? null,

  setItem(
    key,
    value
  ) {
    store.set(
      key,
      value
    );
  }
};

const statuses = [];

const manager =
  createStormTrackerBasemapManager({
    Cesium,
    viewer,
    storage,
    onStatus:
      (message, kind) =>
        statuses.push({
          message,
          kind
        })
  });

const initial =
  manager.initialise();

assert.equal(
  initial.id,
  BASEMAP_IDS.QLD_IMAGERY
);
assert.equal(layers.length,3);
assert.equal(layers[0].provider.constructor,FakeStreetProvider,
  "QLD + NSW satellite retains the global street fallback");
assert.equal(layers[1].provider.options.url,NSW_IMAGERY_BASEMAP.tileTemplate,
  "Official NSW imagery renders ABOVE street");
assert.equal(layers[2].provider.options.url,QLD_IMAGERY_BASEMAP.tileTemplate,
  "Existing QLD imagery renders ABOVE NSW for border overlap priority");
assert.equal(layers[1].index,1);
assert.equal(layers[2].index,2);
const oldNswProvider=layers[1].provider;
const oldQldProvider=layers[2].provider;
oldNswProvider.listener();
assert.match(statuses.at(-1).message,/NSW imagery temporarily unavailable/,
  "Unavailable NSW tiles warn but leave street fallback usable");
assert.ok(oldNswProvider.listener && oldQldProvider.listener,
  "Both official source errors have separate listeners while imagery is selected");


const street =
  manager.setBasemap(
    BASEMAP_IDS.STREET
  );

assert.equal(
  street.changed,
  true
);
assert.equal(
  layers.length,
  1
);
assert.equal(
  layers[0].provider.constructor,
  FakeStreetProvider
);
assert.equal(oldNswProvider.listener,null,
  "Switching to street unsubscribes old NSW provider events");
assert.equal(oldQldProvider.listener,null,
  "Switching to street unsubscribes old Queensland provider events");
assert.equal(
  store.get(
    BASEMAP_STORAGE_KEY
  ),
  BASEMAP_IDS.STREET
);
assert.ok(
  statuses.some(
    entry =>
      entry.message
        .includes(
          "OpenStreetMap"
        )
  )
);
assert.ok(
  calls.some(
    call =>
      call[0] === "remove"
  )
);

const unchanged =
  manager.setBasemap(
    BASEMAP_IDS.STREET
  );

assert.equal(
  unchanged.changed,
  false
);
assert.equal(
  layers.length,
  1
);

const returned=manager.setBasemap(BASEMAP_IDS.QLD_IMAGERY);
assert.equal(returned.changed,true);
assert.equal(layers.length,3);
assert.deepEqual(layers.map(layer=>layer.provider.constructor),[
  FakeStreetProvider,FakeUrlTemplateProvider,FakeUrlTemplateProvider
]);
manager.destroy();
assert.equal(layers.length,0);

console.log(
  "Basemap manager checks passed: QLD/NSW official satellite layers overlap safely, clear attribution/error handling, global street fallback, labels, switching/cleanup and camera safety."
);
