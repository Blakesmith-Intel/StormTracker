import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {QLD_RADAR_SITES} from "../src/qld-radar-sites-v1.js";
import {NSW_BORDER_RADAR_SITES,BORDER_RADAR_SITES,primaryRadarDopplerSites} from "../src/border-radar-sites-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl} from "../src/bom-wmts-loop-v2.js";
import {RADARS} from "../src/config.js";
import {createRadarSiteNameOverlay} from "../src/context-layers/radar-site-name-overlay-v1.js";
import {chooseSupplementalRadarSites,MAX_DISPLAY_RADAR_SITES} from "../src/multi-radar-display-v9.js";

assert.equal(Object.keys(QLD_RADAR_SITES).length,19,"Do not change the QLD-only radar source contract");
assert.equal(Object.keys(NSW_BORDER_RADAR_SITES).length,3);
assert.equal(Object.keys(BORDER_RADAR_SITES).length,22);
for(const [id,name,lat,lon] of [["93","Brewarrina",-29.96,146.81],["53","Moree",-29.50,149.85],["28","Grafton",-29.62,152.97]]){
  const radar=NSW_BORDER_RADAR_SITES[id];
  assert.equal(radar.id,id);
  assert.equal(radar.name,name);
  assert.equal(radar.state,"NSW");
  assert.equal(radar.latitude,lat);
  assert.equal(radar.longitude,lon);
  assert.equal(RADARS[id].name,name);
  assert.equal(radar.analysisGeorefVerified,false);
  assert.deepEqual(primaryRadarDopplerSites(id),id==="93"?["93"]:[],
    "Only Brewarrina carries an authorised NSW Doppler product");
  const w=reflectivityWindowForRegion(id);
  assert.ok(w.colStart>=0&&w.colEnd<=42&&w.rowStart>=0&&w.rowEnd<=32, "BoM WMTS matrix bounds");
  assert.ok(w.colEnd>=w.colStart&&w.rowEnd>=w.rowStart);
  const uri=buildBomReflectivityTileUrl(w.colStart,w.rowStart,"2026-10-12T11:00:00Z");
  assert.equal(new URL(uri).searchParams.get("LAYER"),"atm_surf_air_precip_reflectivity_dbz");
}
assert.equal(NSW_BORDER_RADAR_SITES["93"].dopplerAvailableAtBom,true);
assert.deepEqual(primaryRadarDopplerSites("66"),["66"],"Existing Queensland Doppler remains untouched");
assert.equal(MAX_DISPLAY_RADAR_SITES,4);
assert.deepEqual(chooseSupplementalRadarSites("93",["53","28","66","50"],BORDER_RADAR_SITES),["53","28","66"]);
assert.deepEqual(chooseSupplementalRadarSites("53",["53","93","93"],BORDER_RADAR_SITES),["93"]);
const controller=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const styles=readFileSync(new URL("../src/operational-dashboard-v9-1.css",import.meta.url),"utf8");
const overlay=readFileSync(new URL("../src/context-layers/radar-site-name-overlay-v1.js",import.meta.url),"utf8");
assert.match(controller,/Object\.values\(BORDER_RADAR_SITES\)\.sort/);
assert.match(controller,/createRadarSiteNameOverlay\(/);
assert.match(controller,/selector\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/,"Map label uses the existing source reload");
assert.match(controller,/sites:BORDER_RADAR_SITES/);
assert.match(controller,/getPrimary:selectedRadarRegion/);
assert.match(html,/Primary radar site in Queensland or northern New South Wales/);
assert.match(html,/Radar dish icons on the map/);
assert.match(styles,/\.radar-site-labels/);
assert.match(styles,/color:#61eeff/);
assert.match(styles,/border:0;border-radius:0/,"Radar-site icons must have no border or box");
assert.match(overlay,/aria-label","Load "\+item\.site\.name\+" as primary radar"/);
assert.match(overlay,/worldToWindowCoordinates/);
assert.match(overlay,/scene\.postRender\.addEventListener/);
assert.match(overlay,/btn\.addEventListener\("click"/);
// Exercise the actual overlay event handler in a headless DOM/Cesium stub.
// This is in addition to static markup checks above.
const nodes=[];
class Element {
  constructor(tag){this.tag=tag;this.dataset={};this.style={};this.handlers={};this.hidden=false;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,handler){this.handlers[type]=handler;}
  appendChild(child){nodes.push(child);return child;}
  remove(){this.removed=true;}
}
const container=new Element("main");
const doc={createElement:tag=>new Element(tag)};
let postRenderListener=null,removed=false,chosen=null,primary="66";
const fakeScene={
  canvas:{clientWidth:1200,clientHeight:900},
  camera:{positionWC:{}},
  globe:{ellipsoid:{}},
  postRender:{addEventListener(handler){postRenderListener=handler;return()=>{removed=true;};}}
};
const fakeCesium={
  Cartesian3:{fromDegrees(lon,lat){return {lon,lat};}},
  SceneTransforms:{worldToWindowCoordinates(_scene,point){
    return {x:580+(point.lon-149)*40,y:340+(point.lat+26)*28};
  }},
  EllipsoidalOccluder:class{isPointVisible(){return true;}}
};
const overlayInstance=createRadarSiteNameOverlay({
  scene:fakeScene,CesiumRef:fakeCesium,container,documentRef:doc,
  sites:BORDER_RADAR_SITES,onSelect:id=>{chosen=id;primary=id;},
  getPrimary:()=>primary
});
assert.equal(overlayInstance.siteCount,22);
assert.equal(typeof postRenderListener,"function");
const newSite=nodes.find(node=>node.dataset.radarSiteId==="93");
assert.ok(newSite,"Brewarrina radar icon exists");
assert.equal(newSite.textContent,"📡","Only a dish icon, no persistent site name");
assert.match(newSite.title,/Brewarrina/,"Full station name available in tooltip");
assert.equal(newSite.hidden,false,"Brewarrina visible when camera shows location");
let stopped=0,prevented=0;
newSite.handlers.click({
  stopPropagation(){stopped++;},preventDefault(){prevented++;}
});
assert.equal(chosen,"93","Click routes site ID to the existing selection callback");
assert.equal(stopped,1);
assert.equal(prevented,1);
postRenderListener();
assert.equal(newSite.dataset.primary,"true","New primary radar is highlighted");
overlayInstance.destroy();
assert.equal(removed,true,"Render listener removed cleanly");
assert.equal(container.removed,undefined);
assert.equal(newSite.handlers.click!==undefined,true);
console.log("22-site QLD/NSW catalogue, Brewarrina-only NSW Doppler, compact clickable radar dish icons and 4-site cap verified.");
