import assert from "node:assert/strict";
import {
  BASEMAP_IDS,BASEMAP_STORAGE_KEY,DEA_REGIONAL_IMAGERY,DETAIL_SWITCH,
  QLD_IMAGERY_BASEMAP,NSW_IMAGERY_BASEMAP,REFERENCE_LABELS,
  QUEENSLAND_PLACE_LABELS,basemapLabel,createBasemapProvider,
  createDeaRegionalImageryProvider,createDetailedQldProvider,
  createNswImageryProvider,createQueenslandPlaceLabelProvider,
  createReferenceLabelProvider,createStormTrackerBasemapManager,
  estimatedCameraMetresPerPixel,chooseDetailForScale,normaliseBasemapId
} from "../src/context-layers/basemap-manager-v1.js";

class FakeCredit{constructor(text){this.text=text;}}
class Provider{
  constructor(options){this.options=options;this.errorEvent={
    addEventListener:handler=>{this.listener=handler;return()=>{this.listener=null;};}
  };}
}
class Street extends Provider{}
class UrlTemplate extends Provider{}
class Wmts extends Provider{}
class ArcGis{static async fromUrl(url,options){return {url,options};}}
class Mercator{}
class Rectangle{
  static fromDegrees(west,south,east,north){
    return {west,south,east,north};
  }
}
const Cesium={
  Credit:FakeCredit,OpenStreetMapImageryProvider:Street,
  UrlTemplateImageryProvider:UrlTemplate,
  WebMapTileServiceImageryProvider:Wmts,
  ArcGisMapServerImageryProvider:ArcGis,
  WebMercatorTilingScheme:Mercator,Rectangle
};
const dea=createDeaRegionalImageryProvider(Cesium);
assert.equal(dea.options.url,"https://ows.dea.ga.gov.au/");
assert.equal(dea.options.layer,"ga_ls8cls9c_gm_cyear_3");
assert.equal(dea.options.style,"simple_rgb");
assert.equal(dea.options.format,"image/png");
assert.equal(dea.options.tileMatrixSetID,"WholeWorld_WebMercator");
assert.equal(dea.options.dimensions.Time,"2025-01-01");
assert.equal(dea.options.maximumLevel,12);
assert.equal(dea.options.rectangle,undefined,
  "DEA must not inherit either state imagery's rectangular crop");
assert.ok(dea.options.tilingScheme instanceof Mercator);
assert.match(dea.options.credit.text,/Geoscience Australia/);
assert.equal(DEA_REGIONAL_IMAGERY.maximumLevel,12);
assert.ok(DETAIL_SWITCH.enterMetresPerPixel<DETAIL_SWITCH.exitMetresPerPixel);
assert.equal(createBasemapProvider(Cesium,BASEMAP_IDS.QLD_IMAGERY).constructor,Wmts);
assert.equal(createBasemapProvider(Cesium,BASEMAP_IDS.STREET).constructor,Street);
const qld=createDetailedQldProvider(Cesium);
const nsw=createNswImageryProvider(Cesium);
assert.equal(qld.options.url,QLD_IMAGERY_BASEMAP.tileTemplate);
assert.deepEqual(qld.options.rectangle,QLD_IMAGERY_BASEMAP.rectangleDegrees);
assert.equal(nsw.options.url,NSW_IMAGERY_BASEMAP.tileTemplate);
assert.deepEqual(nsw.options.rectangle,NSW_IMAGERY_BASEMAP.rectangleDegrees);
assert.match(qld.options.credit.text,/State of Queensland/);
assert.match(nsw.options.credit.text,/NSW Spatial Services/);
assert.equal(createReferenceLabelProvider(Cesium).options.url,REFERENCE_LABELS.tileTemplate);
const qldPlaces=await createQueenslandPlaceLabelProvider(Cesium);
assert.equal(qldPlaces.url,QUEENSLAND_PLACE_LABELS.service);
assert.equal(qldPlaces.options.layers,"20");
assert.equal(normaliseBasemapId("ga-satellite"),BASEMAP_IDS.QLD_IMAGERY);
assert.equal(basemapLabel(BASEMAP_IDS.STREET),"Street · OpenStreetMap");

const listeners=new Set(),layers=[],events=[];
const viewer={
  imageryLayers:{
    addImageryProvider(provider,index=layers.length){
      const layer={imageryProvider:provider,show:true,alpha:1};
      layers.splice(index,0,layer);
      events.push(["add",provider.constructor.name,index]);
      return layer;
    },
    remove(layer){
      const index=layers.indexOf(layer);
      if(index>=0)layers.splice(index,1);
      return index>=0;
    }
  },
  scene:{
    globe:{tilesLoaded:true},
    canvas:{clientHeight:900},
    camera:{
      positionCartographic:{height:500000},
      frustum:{fovy:Math.PI/3}
    },
    postRender:{addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);}},
    requestRender(){events.push(["render"]);},
  },
  camera:{setView(){throw Error("Basemap must never reset camera");}}
};
const mapState=new Map([[BASEMAP_STORAGE_KEY,"ga-satellite"]]);
const storage={
  getItem:key=>mapState.get(key)||null,
  setItem:(key,value)=>mapState.set(key,value)
};
const statuses=[];
const manager=createStormTrackerBasemapManager({
  Cesium,viewer,storage,onStatus:(message,kind)=>statuses.push([message,kind])
});
assert.equal(manager.initialise().id,BASEMAP_IDS.QLD_IMAGERY);
assert.equal(layers.length,4);
assert.deepEqual(layers.map(x=>x.imageryProvider.constructor),
  [Street,Wmts,UrlTemplate,UrlTemplate],
  "Staged imagery must draw Street < regional DEA < NSW < QLD");
assert.equal(listeners.size,1);
assert.equal(layers[2].show,false,"NSW detailed imagery not requested at regional zoom");
assert.equal(layers[3].show,false,"QLD detailed imagery not requested at regional zoom");
assert.equal(manager.detailMode,"regional");
assert.equal(manager.regionalLayer,layers[1]);
assert.ok(estimatedCameraMetresPerPixel(viewer.scene)>65);
assert.equal(chooseDetailForScale(false,45),false);
assert.equal(chooseDetailForScale(true,45),true);
assert.equal(chooseDetailForScale(false,30),true);
assert.equal(chooseDetailForScale(true,70),false);

// Regional-scale zoom shouldn't toggle prematurely.
viewer.scene.camera.positionCartographic.height=40000;
manager.updateForCamera();
assert.equal(manager.detailMode,"regional");

// Local zoom: stage the two official detail sources while DEA remains visible.
viewer.scene.camera.positionCartographic.height=12000;
viewer.scene.globe.tilesLoaded=false;
manager.updateForCamera();
assert.equal(manager.detailMode,"staging");
assert.equal(layers[1].show,true);
assert.equal(layers[2].show,true);
assert.equal(layers[3].show,true);
assert.equal(layers[2].alpha,.005);
assert.equal(layers[3].alpha,.005);
for(let n=0;n<3;n++)listeners.forEach(fn=>fn());
assert.equal(manager.detailMode,"staging",
  "Never reveal state imagery if Cesium is still downloading tiles");
viewer.scene.globe.tilesLoaded=true;
for(let n=0;n<5;n++)listeners.forEach(fn=>fn());
assert.equal(manager.detailBlend,1);
assert.equal(manager.detailMode,"detailed",
  "Two ready boundaries and four compositor steps finish the detail fade");
assert.equal(layers[2].alpha,1);
assert.equal(layers[3].alpha,1);
assert.equal(layers[1].show,true,"DEA always remains the fallback beneath detail");

// Hysteresis: oscillation near the 38m threshold keeps fine imagery.
viewer.scene.camera.positionCartographic.height=35000;
manager.updateForCamera();
assert.equal(manager.detailMode,"detailed");
viewer.scene.camera.positionCartographic.height=100000;
for(let n=0;n<5;n++)manager.updateForCamera();
assert.equal(manager.detailBlend,0);
assert.equal(manager.detailMode,"regional");
assert.equal(layers[2].show,false);
assert.equal(layers[3].show,false);
assert.equal(layers[1].show,true);

// Street selection cleans up all three imagery layers and the render listener.
const before=layers[1].imageryProvider;
manager.setBasemap(BASEMAP_IDS.STREET);
assert.equal(layers.length,1);
assert.ok(layers[0].imageryProvider instanceof Street);
assert.equal(before.listener,null);
assert.equal(listeners.size,0);
assert.equal(mapState.get(BASEMAP_STORAGE_KEY),BASEMAP_IDS.STREET);
assert.equal(manager.setBasemap(BASEMAP_IDS.STREET).changed,false);
manager.setBasemap(BASEMAP_IDS.QLD_IMAGERY);
assert.equal(layers.length,4);
assert.equal(listeners.size,1);
manager.destroy();
assert.equal(layers.length,0);
assert.equal(listeners.size,0);
assert.ok(statuses.some(([msg])=>msg.includes("DEA regional")));
// Regression: during sustained iOS panning the overlapping official QLD
// and NSW detail sources must NOT issue more Cesium tile requests. DEA remains
// available for orientation, and only the final settled view stages detail.
let resume=null,cancelled=0;
const phone=createStormTrackerBasemapManager({
  Cesium,viewer,storage,suspendDetailDuringNavigation:true,
  resumeDetailDelayMs:700,
  schedule(cb,delay){
    assert.equal(delay,700);
    resume=cb;return 27;
  },
  cancel(){cancelled++;resume=null;}
});
phone.setBasemap(BASEMAP_IDS.QLD_IMAGERY);
viewer.scene.camera.positionCartographic.height=12000;
viewer.scene.globe.tilesLoaded=true;
phone.updateForCamera();
for(let n=0;n<6;n++)listeners.forEach(fn=>fn());
assert.equal(phone.detailMode,"detailed");
const stateLayers=layers.slice(2);
assert.equal(stateLayers.length,2);
assert.ok(stateLayers.every(l=>l.show),"both state details visible when idle");
assert.equal(phone.setNavigationActive(true),true);
assert.equal(phone.navigationActive,true);
assert.ok(stateLayers.every(l=>l.show===false),"gesture hides both overlapping state detail sources");
assert.equal(phone.updateForCamera(),"navigation","post-render cannot reactivate hidden detail while dragging");
viewer.scene.camera.positionCartographic.height=7000;
for(let n=0;n<12;n++)listeners.forEach(fn=>fn());
assert.ok(stateLayers.every(l=>l.show===false),"sustained navigation causes zero new detail loading");
assert.equal(layers[1].show,true,"official DEA stays available throughout drag");
phone.setNavigationActive(false);
assert.ok(resume,"release schedules one delayed high-detail recovery");
phone.setNavigationActive(true);
assert.ok(cancelled>0,"a new drag cancels stale recovery before firing");
assert.equal(resume,null);
phone.setNavigationActive(false);
const settle=resume;
viewer.scene.camera.positionCartographic.height=11000;
settle();
assert.equal(phone.navigationActive,false);
assert.equal(phone.detailMode,"staging");
assert.ok(stateLayers.every(l=>l.show),"detail resumes for the final camera location");
assert.equal(layers[1].show,true,"regional imagery remains under detail");
phone.setNavigationActive(true);
phone.setNavigationActive(false);
phone.destroy();
assert.equal(resume,null,"destroy cancels pending detail restore");
assert.equal(layers.length,0);
console.log("PASS satellite mobile gesture suspends redundant NSW/QLD tile requests and resumes settled detail; source/credit/fade contracts retained.");

// Isolated street-only control group: previously selected Satellite in
// localStorage and even an explicit future satellite switch must not
// instantiate ANY DEA, NSW or QLD imagery provider or fetch their tiles.
mapState.set(BASEMAP_STORAGE_KEY,BASEMAP_IDS.QLD_IMAGERY);
const beforeAdds=events.filter(x=>x[0]==="add").length;
const streetOnlyStatuses=[];
const streetOnly=createStormTrackerBasemapManager({
  Cesium,viewer,storage,forceStreetOnly:true,
  onStatus:(message,kind)=>streetOnlyStatuses.push([message,kind])
});
assert.equal(streetOnly.forceStreetOnly,true);
assert.equal(streetOnly.initialise().id,BASEMAP_IDS.STREET);
assert.equal(layers.length,1);
assert.ok(layers[0].imageryProvider instanceof Street);
assert.equal(streetOnly.regionalLayer,null);
assert.equal(listeners.size,0,
  "satellite switching/postRender machinery must never be attached");
assert.equal(events.filter(x=>x[0]==="add").length,beforeAdds+1,
  "Street-only mode creates exactly one background imagery provider");
assert.equal(streetOnly.setBasemap(BASEMAP_IDS.QLD_IMAGERY).id,
  BASEMAP_IDS.STREET,"programmatic switch cannot enable satellite");
assert.equal(streetOnly.setBasemap("dea-satellite").changed,false);
assert.equal(streetOnly.setBasemap("ga-satellite").changed,false);
assert.equal(layers.length,1);
assert.equal(mapState.get(BASEMAP_STORAGE_KEY),BASEMAP_IDS.QLD_IMAGERY,
  "QA preview must never erase the user's stored satellite preference");
assert.equal(streetOnly.setNavigationActive(true),false,
  "street-only mode performs no imagery-detail handover on camera movement");
assert.equal(streetOnly.updateForCamera(),"street");
assert.ok(streetOnlyStatuses.some(([message])=>
  /satellite/i.test(message) && message.includes("disabled")));
streetOnly.destroy();
assert.equal(layers.length,0);
console.log("PASS street-only A/B mode: satellite preference ignored but preserved, DEA/NSW/QLD providers never instantiated, selector switch rejected, no fade, single OSM layer.");
