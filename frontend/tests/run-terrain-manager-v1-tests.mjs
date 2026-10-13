import assert from "node:assert/strict";

import {
  TERRAIN_STORAGE_KEY,
  WORLD_TERRAIN,
  createStormTrackerTerrainManager,
  createWorldTerrainProvider,
  normaliseTerrainEnabled
} from "../src/context-layers/terrain-manager-v1.js";

class FakeCredit {
  constructor(text) {
    this.text = text;
  }
}

class FakeEllipsoidTerrainProvider {}

const createdProviders = [];

const Cesium = {
  Credit:
    FakeCredit,

  EllipsoidTerrainProvider:
    FakeEllipsoidTerrainProvider,

  ArcGISTiledElevationTerrainProvider: {
    async fromUrl(url) {
      const provider = {
        kind:
          "arcgis-terrain",
        url
      };

      createdProviders.push(
        provider
      );

      return provider;
    }
  }
};

assert.equal(
  normaliseTerrainEnabled("off"),
  false
);

assert.equal(
  normaliseTerrainEnabled("on"),
  true
);

const direct =
  await createWorldTerrainProvider(
    Cesium
  );

assert.equal(
  direct.url,
  WORLD_TERRAIN.endpoint
);

const store =
  new Map();

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
const credits = [];

const viewer = {
  terrainProvider:
    new FakeEllipsoidTerrainProvider(),

  scene: {
    requestRender() {}
  },

  creditDisplay: {
    addStaticCredit(
      credit
    ) {
      credits.push(
        credit.text
      );
    }
  }
};

const manager =
  createStormTrackerTerrainManager({
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
  await manager.initialise();

assert.equal(
  initial.enabled,
  true
);

assert.equal(
  viewer.terrainProvider.kind,
  "arcgis-terrain"
);

assert.ok(
  credits.some(
    text =>
      text.includes(
        "Esri WorldElevation3D"
      )
  )
);

await manager.setEnabled(
  false
);

assert.equal(
  manager.enabled,
  false
);

assert.ok(
  viewer.terrainProvider
  instanceof FakeEllipsoidTerrainProvider
);

assert.equal(
  store.get(
    TERRAIN_STORAGE_KEY
  ),
  "off"
);

await manager.setEnabled(
  true
);

assert.equal(
  manager.enabled,
  true
);

assert.equal(
  store.get(
    TERRAIN_STORAGE_KEY
  ),
  "on"
);

assert.ok(
  statuses.some(
    entry =>
      entry.message
        .includes(
          "ArcGIS World Elevation"
        )
  )
);

const previousDownloads=createdProviders.length;
store.set(TERRAIN_STORAGE_KEY,"on");
const diagnosticFlat=await manager.setEnabled(false,{persist:false});
assert.equal(diagnosticFlat.enabled,false);
assert.ok(viewer.terrainProvider instanceof FakeEllipsoidTerrainProvider);
assert.equal(createdProviders.length,previousDownloads,
  "Flat A/B comparison must not construct/download an ArcGIS elevation provider");
assert.equal(store.get(TERRAIN_STORAGE_KEY),"on",
  "The flat-terrain preview must preserve the user's normal 3-D terrain preference");
console.log("PASS diagnostic flat-terrain guard: no elevation requests and no persisted preference changes.");
console.log(
  "Terrain manager checks passed: free ArcGIS World Elevation provider, persisted toggle, attribution and flat fallback."
);
