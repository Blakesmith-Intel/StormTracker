import assert from "node:assert/strict";
import { createStormTrackerCameraController }
  from "../src/stormtracker-camera-v1.js";

// Simulate sustained desktop pans and repeated wheel ticks without requiring
// an actual browser/GPU. Assert the imagery-suspension boundary precedes the
// FIRST Cesium camera operation, and only ends after the gesture finishes.
const originalCesium=globalThis.Cesium;
const originalWindow=globalThis.window;
const calls=[],activePointers=new Set(),listeners=new Map();
let suspended=false,starts=0,ends=0,cameraChanges=0;
globalThis.Cesium={
  Cartesian3:{
    clone:position=>({...position}),
    distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),
    fromDegrees:(longitude,latitude,height)=>({longitude,latitude,height})
  },
  HeadingPitchRange:class {constructor(heading,pitch,range){Object.assign(this,{heading,pitch,range});}},
  Matrix4:{IDENTITY:{}},
  Math:{toRadians:value=>value*Math.PI/180}
};
globalThis.window={setInterval:()=>0};
const container={
  style:{},clientWidth:900,clientHeight:650,
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
  setPointerCapture(id){activePointers.add(id);},
  hasPointerCapture(id){return activePointers.has(id);},
  releasePointerCapture(id){activePointers.delete(id);}
};
const camera={
  positionWC:{x:1,y:2,z:3},heading:0,pitch:-1.2,roll:0,
  frustum:{fovy:Math.PI/3},
  cancelFlight(){},
  lookAt(){
    cameraChanges++;
    if(cameraChanges>1)assert.equal(suspended,true,"imagery must suspend before camera movement");
  },
  lookAtTransform(){},
  setView(){}
};
const viewer={
  camera,
  scene:{
    requestRenderMode:false,
    maximumRenderTimeChange:0,
    requestRender(){},
    screenSpaceCameraController:{}
  }
};
function emit(type,fields={}){
  assert.equal(typeof listeners.get(type),"function",type+" listener");
  listeners.get(type)({
    preventDefault(){},
    stopPropagation(){},
    pointerId:1,button:0,buttons:1,
    clientX:20,clientY:30,deltaY:0,deltaMode:0,
    ...fields
  });
}
const controller=createStormTrackerCameraController({
  viewer,container,
  home:{longitude:153,latitude:-27,range:150000,heading:0,pitch:-1.2,targetHeight:0},
  wheelGestureQuietMs:18,
  onNavigationStart(){suspended=true;starts++;calls.push("start");},
  onNavigationEnd(){suspended=false;ends++;calls.push("end");}
});
try {
  emit("pointerdown");
  emit("pointermove",{clientX:22,clientY:30});
  assert.equal(starts,0,"mouse click/drag jitter must not hide satellite imagery");
  emit("pointermove",{clientX:29,clientY:30});
  assert.equal(starts,1);
  assert.equal(suspended,true);
  for(let i=0;i<150;i++)emit("pointermove",{clientX:29+i,clientY:30+i/3});
  assert.equal(starts,1,"150 pan events never repeatedly toggle satellite layers");
  emit("pointerup",{clientX:178,clientY:80});
  assert.equal(ends,1);
  assert.equal(suspended,false);

  emit("wheel",{deltaY:120,deltaMode:0});
  emit("wheel",{deltaY:120,deltaMode:0});
  assert.equal(starts,2,"successive wheel ticks share one detail suspension");
  assert.equal(ends,1,"wheel quiet period prevents tile thrash between ticks");
  await new Promise(resolve=>setTimeout(resolve,35));
  assert.equal(ends,2,"wheel quiet period resumes detail once after zooming");

  // Overlapping pointer and wheel lifecycles must not briefly reveal imagery
  // when one input ends while the other is still moving.
  emit("pointerdown");
  emit("pointermove",{clientX:40});
  emit("wheel",{deltaY:-120});
  assert.equal(starts,3);
  emit("pointerup",{clientX:40});
  assert.equal(ends,2,"pointer release alone cannot reveal tiles during wheel");
  await new Promise(resolve=>setTimeout(resolve,35));
  assert.equal(ends,3);

  emit("pointerdown");
  emit("pointermove",{clientX:60});
  assert.equal(starts,4);
  controller.destroy();
  assert.equal(ends,4,"destroy cleans up active navigation");
  assert.equal(suspended,false);
  assert.equal(listeners.size,0);
  console.log("PASS desktop sustained pan, jitter, discrete wheel burst, overlapping gestures and cleanup with tile suspension before camera mutation.");
} finally {
  globalThis.Cesium=originalCesium;
  globalThis.window=originalWindow;
}
