import assert from "node:assert/strict";

import {
  BASEMAP_IDS,
  BASEMAP_STORAGE_KEY,
  GA_BASEMAP,
  basemapLabel,
  createBasemapProvider,
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

const Cesium = {
  Credit: FakeCredit,
  OpenStreetMapImageryProvider:
    FakeStreetProvider,
  UrlTemplateImageryProvider:
    FakeUrlTemplateProvider,
  WebMercatorTilingScheme:
    FakeWebMercatorTilingScheme
};

const ga =
  createBasemapProvider(
    Cesium,
    BASEMAP_IDS.GA_SATELLITE
  );

assert.equal(
  ga.options.url,
  "https://services.ga.gov.au/gis/rest/services/World_Bathymetry_Imagery/MapServer/tile/{z}/{y}/{x}"
);
assert.equal(
  ga.options.maximumLevel,
  12
);
assert.equal(
  ga.options.tileWidth,
  256
);
assert.equal(
  ga.options.tileHeight,
  256
);
assert.ok(
  ga.options.tilingScheme
  instanceof FakeWebMercatorTilingScheme
);
assert.match(
  ga.options.credit.text,
  /Geoscience Australia/
);

assert.equal(
  GA_BASEMAP.label,
  "GA satellite · Landsat imagery"
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
    "dea-satellite"
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
  BASEMAP_IDS.GA_SATELLITE
);
assert.equal(
  layers.length,
  1
);
assert.equal(
  layers[0].provider.constructor,
  FakeUrlTemplateProvider
);

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

manager.destroy();
assert.equal(
  layers.length,
  0
);

console.log(
  "Basemap manager checks passed: GA cached Landsat imagery contract, legacy preference migration, persistence, layer replacement and camera isolation."
);
