import assert from "node:assert/strict";

import {
  BASEMAP_IDS,
  BASEMAP_STORAGE_KEY,
  DEA_BASEMAP,
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

class FakeWmsProvider {
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

const Cesium = {
  Credit: FakeCredit,
  OpenStreetMapImageryProvider:
    FakeStreetProvider,
  WebMapServiceImageryProvider:
    FakeWmsProvider
};

const dea =
  createBasemapProvider(
    Cesium,
    BASEMAP_IDS.DEA_SATELLITE
  );

assert.equal(
  dea.options.url,
  "https://ows.dea.ga.gov.au/"
);
assert.equal(
  dea.options.layers,
  "ga_ls8cls9c_gm_cyear_3"
);
assert.equal(
  dea.options.parameters.styles,
  "simple_rgb"
);
assert.equal(
  dea.options.parameters.time,
  "2025-01-01"
);
assert.match(
  dea.options.credit.text,
  /Digital Earth Australia/
);

assert.equal(
  DEA_BASEMAP.label,
  "GA satellite · DEA GeoMAD 2025"
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
    BASEMAP_IDS.DEA_SATELLITE
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
  BASEMAP_IDS.DEA_SATELLITE
);
assert.equal(
  layers.length,
  1
);
assert.equal(
  layers[0].provider.constructor,
  FakeWmsProvider
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
  "Basemap manager checks passed: DEA WMS contract, persistence, layer replacement and camera isolation."
);
