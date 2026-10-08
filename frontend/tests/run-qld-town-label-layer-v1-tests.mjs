import assert from "node:assert/strict";
import {
  createQueenslandTownLabelLayer,
  cameraLookDownDegrees
} from "../src/context-layers/qld-town-label-layer-v1.js";

// A lookAt target may leave camera.pitch near -90 in Cesium's transformed
// frame while the actual view direction is just 12 degrees below horizon.
const fakeCartesian = class Cartesian3 {
  static dot(a,b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
};
const fakeEllipsoid = {
  geodeticSurfaceNormal() { return {x:0,y:0,z:1}; }
};
const direction = {x:Math.cos(12*Math.PI/180),y:0,z:-Math.sin(12*Math.PI/180)};
const lookAtCamera = {
  pitch:-Math.PI/2,
  positionWC:{x:0,y:0,z:10},
  directionWC:direction
};
assert.ok(Math.abs(cameraLookDownDegrees(lookAtCamera,{
  Cartesian3:fakeCartesian
},fakeEllipsoid)+12)<0.01,
"Low-angle viewing geometry must override Cesium's transformed pitch");
assert.equal(cameraLookDownDegrees({pitch:-Math.PI/4}, {}, {}),-45,
"Missing camera geometry must use ordinary pitch fallback");

const raw=(id,name,lon,lat,pop=100)=>({
  type:"Feature",id,
  properties:{objectid:id,name,population:pop},
  geometry:{type:"Point",coordinates:[lon,lat]}
});
let feedLoads=0, layoutCallbacks=[], removed=false, renderRequests=0;
const fakeLabels=[];
const collection={
  add(options){const label={...options};fakeLabels.push(label);return label;}
};
const viewer={scene:{
  canvas:{clientWidth:390,clientHeight:340},
  camera:{
    positionWC:{x:10,y:10,z:10},
    directionWC:{x:1,y:0,z:0},
    positionCartographic:{height:50000}
  },
  globe:{ellipsoid:{name:"earth"}},
  primitives:{
    add(){return collection;},
    remove(source){assert.equal(source,collection);removed=true;}
  },
  postRender:{
    addEventListener(cb){layoutCallbacks.push(cb);return ()=>{layoutCallbacks=layoutCallbacks.filter(f=>f!==cb);};}
  },
  requestRender(){renderRequests++;}
}};
const Cesium={
  LabelCollection:class{},
  BlendOption:{TRANSLUCENT:2},
  Cartesian3:{fromDegrees(lon,lat,alt){return {x:lon,y:lat,z:alt};}},
  Color:{WHITE:"white",BLACK:"black"},
  LabelStyle:{FILL_AND_OUTLINE:"fillOutline"},
  HorizontalOrigin:{CENTER:"center"},
  VerticalOrigin:{CENTER:"center"},
  Ellipsoid:{WGS84:{}},
  EllipsoidalOccluder:class {
    constructor(ellipsoid,pos){assert.equal(pos,viewer.scene.camera.positionWC);}
    isPointVisible(point){return point.x<151;} // Brisbane is behind this artificial test horizon
  },
  SceneTransforms:{
    worldToWindowCoordinates(scene,position){
      return {
        x:(position.x-139.35)*160+195,
        y:(-25.9-position.y)*160+170
      };
    }
  }
};
const status=[];
const layer=createQueenslandTownLabelLayer({
  viewer,CesiumRef:Cesium,
  fetchImpl:async()=>{feedLoads++;return {ok:true,async json(){return {
    type:"FeatureCollection",features:[
      raw(1,"Birdsville",139.35,-25.9,115),
      raw(2,"Bedourie",139.47,-24.35,110),
      raw(3,"Brisbane",153.03,-27.47,2600000)
    ]
  };}};},
  onStatus:value=>status.push(value)
});
assert.equal(await layer.start(),3);
assert.equal(await layer.start(),3);
assert.equal(feedLoads,1,"Town name service must load only once");
assert.equal(fakeLabels.length,3);
assert.ok(fakeLabels.every(l=>l.horizontalOrigin==="center"));
assert.equal(collection.show,false,"Initial Street mode must hide the entire Cesium label collection");
assert.equal(layer.visibleCount,0,"Street renders no supplemental labels");
assert.ok(fakeLabels.every(l=>l.show===false));
assert.equal(layer.mode,"street");
layer.setMode("qld-imagery");
assert.equal(collection.show,true,"Imagery enables the anchored Queensland name collection");
assert.equal(fakeLabels.filter(l=>l.show).length,1,"Only horizon-visible in-frame Birdsville is rendered");
assert.equal(fakeLabels.find(l=>l.text==="Birdsville").show,true);
assert.equal(fakeLabels.find(l=>l.text==="Brisbane").show,false);
assert.ok(layer.visibleCount<=5);
assert.ok(status.some(s=>s.kind==="ok"));
const calculated=layer.calculationCount;
layer.draw();
assert.equal(layer.calculationCount,calculated,"Identical camera cannot recalculate label layout");
layer.setMode("street");
assert.equal(collection.show,false,"Imagery-to-Street must remove all supplemental map labels immediately");
assert.equal(layer.visibleCount,0);
assert.deepEqual(layer.visibleLabels,[]);
assert.ok(fakeLabels.every(l=>l.show===false));
layer.draw(true);
assert.equal(layer.visibleCount,0,"Panning in Street mode must not resurrect names");
layer.setMode("qld-imagery");
assert.equal(collection.show,true);
assert.equal(layer.visibleIds.length,1,"Switching back to QLD imagery restores Birdsville without refetching");
assert.equal(feedLoads,1,"Basemap changes must not refetch labels");
viewer.scene.camera.positionCartographic.height=2_000_000;
layer.draw(true);
assert.equal(layer.visibleCount,0,"Labels hidden at planetary horizon view");
assert.ok(fakeLabels.every(l=>l.show===false));
viewer.scene.camera.positionCartographic.height=50000;
layer.draw(true);
assert.equal(layer.visibleIds.length,1);
viewer.scene.camera.positionWC.x+=100;
for(const callback of layoutCallbacks)callback();
assert.ok(layer.calculationCount>=calculated);
layer.destroy();
assert.equal(removed,true);
assert.equal(layoutCallbacks.length,0,"Remove scene postRender handler on disposal");
console.log("QLD town layer checks passed: Street has zero supplemental names before/after basemap switch; imagery restores Birdsville without reload, horizon and cleanup remain correct.");
