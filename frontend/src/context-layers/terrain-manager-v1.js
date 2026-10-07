export const TERRAIN_STORAGE_KEY =
  "stormtracker.terrain.v1";

export const WORLD_TERRAIN =
  Object.freeze({
    endpoint:
      "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
    label:
      "ArcGIS World Elevation 3-D"
  });

export function normaliseTerrainEnabled(
  value
) {
  if (
    value === false
    || value === "false"
    || value === "off"
    || value === "0"
  ) {
    return false;
  }

  return true;
}

function readStoredTerrainEnabled(
  storage
) {
  try {
    const value =
      storage?.getItem(
        TERRAIN_STORAGE_KEY
      );

    if (value == null) {
      return true;
    }

    return normaliseTerrainEnabled(
      value
    );
  } catch {
    return true;
  }
}

function persistTerrainEnabled(
  storage,
  enabled
) {
  try {
    storage?.setItem(
      TERRAIN_STORAGE_KEY,
      enabled
        ? "on"
        : "off"
    );
  } catch {
    // Terrain remains usable even if browser storage is unavailable.
  }
}

export async function createWorldTerrainProvider(
  Cesium
) {
  return Cesium
    .ArcGISTiledElevationTerrainProvider
    .fromUrl(
      WORLD_TERRAIN.endpoint
    );
}

export function createStormTrackerTerrainManager({
  Cesium,
  viewer,
  storage =
    globalThis.localStorage,
  onStatus = () => {}
}) {
  if (
    !Cesium
    || !viewer
  ) {
    throw new TypeError(
      "Terrain manager requires Cesium and a viewer."
    );
  }

  let enabled = false;
  let requestToken = 0;
  let terrainCreditAdded = false;

  function useFlatTerrain() {
    viewer.terrainProvider =
      new Cesium.EllipsoidTerrainProvider();

    enabled = false;

    viewer.scene?.requestRender?.();
  }

  function ensureTerrainCredit() {
    if (terrainCreditAdded) {
      return;
    }

    const addStaticCredit =
      viewer.creditDisplay
        ?.addStaticCredit;

    if (
      typeof addStaticCredit
      !== "function"
    ) {
      return;
    }

    addStaticCredit.call(
      viewer.creditDisplay,
      new Cesium.Credit(
        "Elevation: Esri WorldElevation3D contributors"
      )
    );

    terrainCreditAdded = true;
  }

  async function setEnabled(
    requestedEnabled,
    {
      persist = true
    } = {}
  ) {
    const wanted =
      normaliseTerrainEnabled(
        requestedEnabled
      );

    const token =
      ++requestToken;

    if (!wanted) {
      useFlatTerrain();

      if (persist) {
        persistTerrainEnabled(
          storage,
          false
        );
      }

      onStatus(
        "3-D terrain off · ellipsoid surface",
        "ok"
      );

      return {
        enabled:
          false,
        failed:
          false
      };
    }

    onStatus(
      "Loading 3-D terrain…",
      "normal"
    );

    try {
      const provider =
        await createWorldTerrainProvider(
          Cesium
        );

      if (
        token !== requestToken
      ) {
        return {
          enabled,
          stale:
            true
        };
      }

      viewer.terrainProvider =
        provider;

      enabled = true;

      ensureTerrainCredit();

      if (persist) {
        persistTerrainEnabled(
          storage,
          true
        );
      }

      onStatus(
        `Terrain: ${WORLD_TERRAIN.label}`,
        "ok"
      );

      viewer.scene?.requestRender?.();

      return {
        enabled:
          true,
        failed:
          false,
        provider
      };
    } catch (error) {
      if (
        token !== requestToken
      ) {
        return {
          enabled,
          stale:
            true
        };
      }

      useFlatTerrain();

      // Preserve an explicit "on" preference so a transient upstream failure
      // is retried on the next page load.
      if (persist) {
        persistTerrainEnabled(
          storage,
          true
        );
      }

      onStatus(
        "3-D terrain unavailable · using flat fallback",
        "error"
      );

      return {
        enabled:
          false,
        failed:
          true,
        error
      };
    }
  }

  async function initialise() {
    return setEnabled(
      readStoredTerrainEnabled(
        storage
      ),
      {
        persist:
          false
      }
    );
  }

  return {
    initialise,
    setEnabled,

    get enabled() {
      return enabled;
    }
  };
}
