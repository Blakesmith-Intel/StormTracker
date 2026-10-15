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
      "Satellite · DEA regional / detailed when zoomed in"
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

// Verified 2026-10-13 against DEA WMTS GetCapabilities and a real NSW/QLD
// tile: Web Mercator matrix 0..14, default Time 2025-01-01, simple_rgb.
// Annual GeoMAD is a cloud-free historical *reference*, not a live scan.
export const DEA_REGIONAL_IMAGERY = Object.freeze({
  service:"https://ows.dea.ga.gov.au/",
  layer:"ga_ls8cls9c_gm_cyear_3",
  style:"simple_rgb",
  format:"image/png",
  matrixSet:"WholeWorld_WebMercator",
  time:"2025-01-01",
  maximumLevel:12,
  label:"DEA GeoMAD Landsat 8/9 · 2025 · regional reference"
});

export const DETAIL_SWITCH = Object.freeze({
  // 30-m native Landsat resolution; use aerial detail only as camera display
  // starts oversampling regional pixels. Hysteresis prevents toggle chatter.
  enterMetresPerPixel:38,
  exitMetresPerPixel:65,
  blendStep:0.25
});

export function estimatedCameraMetresPerPixel(scene) {
  const height=Number(scene?.camera?.positionCartographic?.height);
  const pixels=Number(scene?.canvas?.clientHeight);
  const fov=Number(scene?.camera?.frustum?.fovy) ||
    Number(scene?.camera?.frustum?.fov) || Math.PI/3;
  if(!Number.isFinite(height)||height<0||pixels<1)return Infinity;
  return 2*height*Math.tan(fov/2)/pixels;
}

export function chooseDetailForScale(previousDetailed,metresPerPixel) {
  if(!Number.isFinite(metresPerPixel))return false;
  return previousDetailed
    ? metresPerPixel<DETAIL_SWITCH.exitMetresPerPixel
    : metresPerPixel<=DETAIL_SWITCH.enterMetresPerPixel;
}

export function createDeaRegionalImageryProvider(Cesium) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url:DEA_REGIONAL_IMAGERY.service,
    layer:DEA_REGIONAL_IMAGERY.layer,
    style:DEA_REGIONAL_IMAGERY.style,
    format:DEA_REGIONAL_IMAGERY.format,
    tileMatrixSetID:DEA_REGIONAL_IMAGERY.matrixSet,
    tilingScheme:new Cesium.WebMercatorTilingScheme(),
    tileWidth:256,tileHeight:256,
    maximumLevel:DEA_REGIONAL_IMAGERY.maximumLevel,
    dimensions:{Time:DEA_REGIONAL_IMAGERY.time},
    credit:new Cesium.Credit(
      "Regional historical satellite composite © Geoscience Australia (DEA), CC BY 4.0; GeoMAD Landsat 8 & 9, 2025"
    )
  });
}

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
    return createDeaRegionalImageryProvider(Cesium);
  }

  return new Cesium.OpenStreetMapImageryProvider({
    url:
      "https://tile.openstreetmap.org/"
  });
}

export function createDetailedQldProvider(Cesium){
  return new Cesium.UrlTemplateImageryProvider({
      url:QLD_IMAGERY_BASEMAP.tileTemplate,

      tilingScheme:
        new Cesium.WebMercatorTilingScheme(),

      tileWidth:
        256,

      tileHeight:
        256,

      maximumLevel:
        QLD_IMAGERY_BASEMAP.maximumLevel,
      // Queensland's published cache starts at zoom level 4.
      minimumLevel:4,

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

export function basemapLabel(
  id
) {
  return normaliseBasemapId(id)
    === BASEMAP_IDS.QLD_IMAGERY
      ? QLD_IMAGERY_BASEMAP.label
      : "Street · OpenStreetMap";
}

export function createStormTrackerBasemapManager({
  Cesium,viewer,storage=globalThis.localStorage,onStatus=()=>{},
  suspendDetailDuringNavigation=false,
  // Keep state-owned satellite tiles present at regional camera scales.
  // Prevents DEA missing tiles exposing OSM across northern Queensland.
  // Enabled only for the next-baseline browser preview until visual QA.
  persistentSatelliteCoverage=false,
  // Isolated A/B QA: never instantiate DEA/QLD/NSW satellite basemap
  // providers even when storage retained a previous satellite selection.
  forceStreetOnly=false,
  resumeDetailDelayMs=700,
  schedule=setTimeout,cancel=clearTimeout
}) {
  if(!Cesium||!viewer?.imageryLayers)
    throw TypeError("Basemap manager requires Cesium and a viewer");
  const imagery=viewer.imageryLayers;
  const scene=viewer.scene;
  let currentId=null,streetLayer=null,regionalLayer=null,
    qldDetailLayer=null,nswDetailLayer=null;
  let sourceListeners=[],postRenderUnlisten=null;
  let detailTarget=false,detailStaging=false,detailBlend=0,readyFrames=0;
  let destroyed=false,navigationActive=false,resumeTimer=null;
  function remove(layer){if(layer)imagery.remove(layer,true);}
  function render(){scene?.requestRender?.();}
  function detach(){
    postRenderUnlisten?.();postRenderUnlisten=null;
    for(const dispose of sourceListeners)dispose();
    sourceListeners=[];
  }
  function clearLayers(){
    if(resumeTimer!==null){cancel(resumeTimer);resumeTimer=null;}
    navigationActive=false;
    detach();
    remove(qldDetailLayer);remove(nswDetailLayer);
    remove(regionalLayer);remove(streetLayer);
    qldDetailLayer=null;nswDetailLayer=null;
    regionalLayer=null;streetLayer=null;
    detailTarget=false;detailStaging=false;detailBlend=0;readyFrames=0;
    render();
  }
  function attach(provider,label){
    const dispose=provider?.errorEvent?.addEventListener?.(()=>{
      if(destroyed||currentId!==BASEMAP_IDS.QLD_IMAGERY)return;
      onStatus(label+" imagery unavailable; retaining underlying DEA / Street map","warning");
    });
    if(typeof dispose==="function")sourceListeners.push(dispose);
  }
  function setBlend(alpha){
    detailBlend=Math.max(0,Math.min(1,alpha));
    if(qldDetailLayer)qldDetailLayer.alpha=detailBlend || .005;
    if(nswDetailLayer)nswDetailLayer.alpha=detailBlend || .005;
    if(!detailBlend&&!detailTarget){
      if(qldDetailLayer)qldDetailLayer.show=false;
      if(nswDetailLayer)nswDetailLayer.show=false;
    }
    render();
  }
  function updateForCamera(){
    if(destroyed||currentId!==BASEMAP_IDS.QLD_IMAGERY)return "street";
    if(persistentSatelliteCoverage){
      // One state source per jurisdiction, from regional zoom through detail.
      // Never swap layers, request extra copies, or reveal the street fallback.
      return "detailed";
    }
    // Do not change zoom/detail modes while the user is navigating. Most
    // importantly, never hide a satellite layer in the middle of a pan:
    // regional DEA may still be resolving a tile, exposing Street beneath.
    // Retain the already displayed provider, alpha and imagery cache.
    if(navigationActive)return "navigation";
    const target=chooseDetailForScale(detailTarget,estimatedCameraMetresPerPixel(scene));
    if(target!==detailTarget){
      detailTarget=target;
      if(target){
        if(qldDetailLayer){qldDetailLayer.show=true;qldDetailLayer.alpha=.005;}
        if(nswDetailLayer){nswDetailLayer.show=true;nswDetailLayer.alpha=.005;}
        detailStaging=true;readyFrames=0;
      } else if(detailStaging){
        detailStaging=false;readyFrames=0;setBlend(0);
      }
      render();
    }
    if(detailTarget&&detailStaging){
      // Cesium fetches official fine imagery beneath a virtually transparent
      // layer while the GeoMAD raster stays 100% visible. TWO globe-ready
      // frames are needed, otherwise a bare map/partial tile mosaic flashes.
      readyFrames=scene?.globe?.tilesLoaded===true?readyFrames+1:0;
      if(readyFrames>=2){detailStaging=false;readyFrames=0;}
      else if(readyFrames>0)render();
    }
    if(!detailStaging){
      const targetBlend=detailTarget?1:0;
      if(Math.abs(detailBlend-targetBlend)>.001){
        const step=DETAIL_SWITCH.blendStep;
        setBlend(detailTarget?
          Math.min(targetBlend,detailBlend+step):
          Math.max(targetBlend,detailBlend-step));
      }
    }
    return detailStaging?"staging":detailBlend>0?"detailed":"regional";
  }
  function setNavigationActive(active) {
    if(destroyed||!suspendDetailDuringNavigation)return false;
    if(resumeTimer!==null){cancel(resumeTimer);resumeTimer=null;}
    if(active){
      if(navigationActive)return true;
      navigationActive=true;
      // Keep all currently visible satellite layers present throughout the
      // gesture. Hiding state imagery caused an immediate street-map flash,
      // especially in northern Queensland while DEA tiles were still pending.
      // The ordinary camera performance governor reduces terrain pressure
      // instead; the detail scale decision is frozen until movement settles.
      return true;
    }
    if(!navigationActive)return false;
    resumeTimer=schedule(()=>{
      resumeTimer=null;
      if(destroyed)return;
      navigationActive=false;
      // Re-evaluate the FINAL camera scale after navigation settles.
      // Existing imagery never disappeared while the camera was moving.
      updateForCamera();
      render();
    },resumeDetailDelayMs);
    return true;
  }
  function setBasemap(requestedId,{persist=true}={}){
    if(destroyed)throw Error("Basemap manager was destroyed");
    const id=forceStreetOnly ? BASEMAP_IDS.STREET : normaliseBasemapId(requestedId);
    if(currentId===id&&streetLayer)
      return {id,layer:regionalLayer??streetLayer,changed:false};
    // Stage original data providers before discarding any current imagery.
    const created=[],subscriptions=[];
    let nextStreet,nextRegional=null,nextNsw=null,nextQld=null;
    try{
      nextStreet=imagery.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url:"https://tile.openstreetmap.org/"
        }),0);
      created.push(nextStreet);
      if(id===BASEMAP_IDS.QLD_IMAGERY){
        const regionalProvider=createDeaRegionalImageryProvider(Cesium);
        nextRegional=imagery.addImageryProvider(regionalProvider,1);
        created.push(nextRegional);
        const nswProvider=createNswImageryProvider(Cesium);
        nextNsw=imagery.addImageryProvider(nswProvider,2);
        created.push(nextNsw);nextNsw.show=false;
        const qldProvider=createDetailedQldProvider(Cesium);
        nextQld=imagery.addImageryProvider(qldProvider,3);
        created.push(nextQld);nextQld.show=false;
        // Register source errors only after all insertions are successful.
        subscriptions.push([regionalProvider,"DEA"],[nswProvider,"NSW"],[qldProvider,"QLD"]);
      }
    }catch(error){
      for(const layer of created.reverse())remove(layer);
      onStatus("Unable to switch basemap: "+error.message,"error");
      throw error;
    }
    clearLayers();
    streetLayer=nextStreet;regionalLayer=nextRegional;
    nswDetailLayer=nextNsw;qldDetailLayer=nextQld;
    currentId=id;
    if(id===BASEMAP_IDS.QLD_IMAGERY && persistentSatelliteCoverage){
      // The QLD cache carries state-wide imagery at regional scales (from
      // zoom 4), while NSW similarly covers its published jurisdiction.
      // DEA remains below both for surrounding Australia.  OSM is NOT an
      // appropriate visible fallback within the Satellite basemap.
      streetLayer.show=false;
      if(qldDetailLayer){qldDetailLayer.show=true;qldDetailLayer.alpha=1;}
      if(nswDetailLayer){nswDetailLayer.show=true;nswDetailLayer.alpha=1;}
      detailTarget=true;detailStaging=false;detailBlend=1;readyFrames=0;
    }
    for(const [provider,label] of subscriptions)attach(provider,label);
    if(id===BASEMAP_IDS.QLD_IMAGERY && !persistentSatelliteCoverage &&
        scene?.postRender?.addEventListener)
      postRenderUnlisten=scene.postRender.addEventListener(updateForCamera);
    // A test route must not overwrite the user's real map preference.
    if(persist && !forceStreetOnly)persistBasemap(storage,id);
    onStatus(id===BASEMAP_IDS.QLD_IMAGERY
      ? persistentSatelliteCoverage
        ? "Satellite: continuous official QLD/NSW coverage · DEA regional underneath"
        : "Satellite: DEA regional (2025) · automatic official QLD/NSW detail on zoom"
      : forceStreetOnly
        ? "STREET-ONLY TEST · Satellite basemaps disabled (no DEA/QLD/NSW tile downloads)"
        : "Basemap: Street · OpenStreetMap","ok");
    updateForCamera();
    render();
    return {id,layer:regionalLayer??streetLayer,changed:true};
  }
  function initialise(){return setBasemap(readStoredBasemap(storage),{persist:false});}
  function destroy(){
    if(destroyed)return;
    clearLayers();currentId=null;destroyed=true;
  }
  return {
    initialise,setBasemap,destroy,updateForCamera,setNavigationActive,
    get currentId(){return currentId;},
    get detailMode(){
      return detailStaging?"staging":detailBlend>0?"detailed":"regional";
    },
    get detailBlend(){return detailBlend;},
    get navigationActive(){return navigationActive;},
    get forceStreetOnly(){return forceStreetOnly;},
    get persistentSatelliteCoverage(){return persistentSatelliteCoverage;},
    get regionalLayer(){return regionalLayer;}
  };
}
