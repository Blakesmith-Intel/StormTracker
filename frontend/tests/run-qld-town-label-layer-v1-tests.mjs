import assert from "node:assert/strict";
import {createQueenslandTownLabelLayer,cameraLookDownDegrees}
  from "../src/context-layers/qld-town-label-layer-v1.js";

const fakeCartesian=class Cartesian3 {
  static dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
  static fromDegrees(lon,lat){return {x:lon,y:lat,z:0};}
};
const ellipsoid={geodeticSurfaceNormal(){return {x:0,y:0,z:1};}};
const lookAtCamera={
  pitch:-Math.PI/2,positionWC:{x:0,y:0,z:10},
  directionWC:{x:Math.cos(12*Math.PI/180),y:0,z:-Math.sin(12*Math.PI/180)}
};
assert.ok(Math.abs(cameraLookDownDegrees(lookAtCamera,{Cartesian3:fakeCartesian},
  ellipsoid)+12)<.01);

class MockElement {
  constructor(tag="div"){
    this.tag=tag;this.children=[];this.style={};this.attributes={};
    this.textContent="";this.className="";this.parent=null;
  }
  appendChild(child){this.children.push(child);child.parent=this;return child;}
  remove(){
    if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);
    this.parent=null;
  }
  setAttribute(key,val){this.attributes[key]=val;}
  get childElementCount(){return this.children.length;}
}
const mapPanel=new MockElement();
const documentRef={createElement:tag=>new MockElement(tag)};
const scene={
  canvas:{clientWidth:1200,clientHeight:800},
  camera:{
    positionWC:{x:0,y:0,z:300},directionWC:{x:0,y:0,z:-1},
    positionCartographic:{height:1_700_000},pitch:-Math.PI/2
  },
  globe:{ellipsoid},
  postRender:{addEventListener(fn){scene.listener=fn;return ()=>{scene.listener=null;};}},
  requestRender(){}
};
const viewer={scene,container:{parentElement:mapPanel}};
let cameraPanPixelsX=0,cameraPanPixelsY=0;
const CesiumRef={
  Cartesian3:fakeCartesian,Ellipsoid:{WGS84:ellipsoid},
  SceneTransforms:{worldToWindowCoordinates(_,p){
    return {x:45+(p.x-138)*70+cameraPanPixelsX,
      y:60+(-29-p.y)*-31+cameraPanPixelsY};
  }},
  EllipsoidalOccluder:class {isPointVisible(){return true;}}
};
const mk=(id,name,lon,lat,pop)=>({
  type:"Feature",id,
  properties:{objectid:id,name,population:pop},
  geometry:{type:"Point",coordinates:[lon,lat]}
});
const features=[];
for(let y=0;y<7;y++)for(let x=0;x<10;x++){
  const i=y*10+x+1;
  features.push(mk(i,`Queensland locality ${i}`,138+x*1.55,-28+y*2.9,150));
}
features.push(mk(1000,"Brisbane",153.03,-27.47,2_600_000));
let feedCount=0;const statuses=[];
const layer=createQueenslandTownLabelLayer({
  viewer,CesiumRef,documentRef,container:mapPanel,mode:"qld-imagery",
  fetchImpl:async()=>{feedCount++;return {
    ok:true,async json(){return {type:"FeatureCollection",features};}
  };},
  onStatus:status=>statuses.push(status)
});
assert.equal(await layer.start(),features.length);
assert.equal(feedCount,1);
assert.equal(mapPanel.childElementCount,1);
assert.equal(mapPanel.children[0].className,"qld-place-foreground");
assert.ok(layer.visibleCount>=12,
  "Wide Queensland desktop view should show at least twelve distinct places");
assert.equal(mapPanel.children[0].childElementCount,layer.visibleCount,
  "Only actually visible labels get browser DOM nodes");
assert.ok(layer.visibleLabels.some(p=>p.name.includes("locality")));
// Screen-space positions must follow Cesium EACH frame rather than every
// 170ms layout tick. Reproject immediately while the declutter set is stable.
const tracked=mapPanel.children[0].children[0];
const beforePan=parseFloat(tracked.style.left),beforePanY=parseFloat(tracked.style.top);
const layoutBeforePan=layer.calculationCount;
cameraPanPixelsX=18;
cameraPanPixelsY=-7;
scene.camera.positionWC.x+=1;
scene.listener?.();
assert.equal(parseFloat(tracked.style.left),beforePan+18,
  "Pan must move DOM label precisely with geographic camera projection");
assert.equal(parseFloat(tracked.style.top),beforePanY-7,
  "Vertical pan must not leave place names lagging behind map features");
assert.equal(layer.calculationCount,layoutBeforePan,
  "Pan-follow positions should update without a costly decluttering pass");
cameraPanPixelsX=0;
cameraPanPixelsY=0;
scene.listener?.();
assert.equal(parseFloat(tracked.style.left),beforePan,
  "Reverse pan returns label to its original geographic position");
assert.ok(layer.visibleLabels.every(p=>p.x>=0&&p.x<=1200));
assert.ok(statuses.some(s=>s.kind==="ok"));
assert.ok(layer.visibleLabels.every(p=>["bold 15px sans-serif","bold 16px sans-serif"].includes(p.font)),
  "Major city and rural place names retain their own legible font sizes");
const previous=layer.calculationCount;
layer.draw();
assert.equal(layer.calculationCount,previous,
  "Static camera does not repaint foreground labels on playback frames");
layer.setMode("street");
assert.equal(layer.mode,"street");
assert.ok(layer.visibleCount>0,
  "Street now displays additional rural place names over native map");
assert.ok(!layer.visibleLabels.some(p=>p.name==="Brisbane"),
  "Avoid redundant major city label above OSM");
layer.setMode("qld-imagery");
assert.ok(layer.visibleCount>0);
assert.equal(feedCount,1,"Changing basemaps never refetches towns");
scene.canvas.clientWidth=390;scene.canvas.clientHeight=350;
layer.draw(true);
assert.ok(layer.visibleCount<=16);
assert.ok(layer.visibleLabels.every(p=>p.font==="12px sans-serif"));
scene.canvas.clientWidth=1200;scene.canvas.clientHeight=800;
scene.camera.positionCartographic.height=4_000_000;
layer.draw(true);
assert.equal(layer.visibleCount,0,"Planetary distance hides place-name clutter");
assert.equal(mapPanel.children[0].childElementCount,0,
  "Hidden labels do not hold onto thousands of DOM nodes");
scene.camera.positionCartographic.height=1_700_000;
layer.draw(true);
assert.ok(layer.visibleCount>0);
scene.listener?.();
assert.equal(feedCount,1);
layer.destroy();
assert.equal(mapPanel.childElementCount,0);
assert.equal(scene.listener,null);
console.log("PASS fast foreground town labels above Cesium, dense statewide imagery, rural Street supplements, mobile collision budget, zero DOM leaks.");
