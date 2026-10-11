import assert from "node:assert/strict";
import {createStormTrackerCameraController} from "../src/stormtracker-camera-v1.js";

// Simulate a busy hardware wheel without Cesium's GPU. The real browser may
// receive many wheel events before the next compositor/animation frame.
const oldWindow=globalThis.window;
const oldCesium=globalThis.Cesium;
let sequence=0,paintCount=0,renderCount=0,interactionCount=0;
const frames=new Map(),handlers=new Map(),intervals=new Set();
globalThis.window={
  requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},
  cancelAnimationFrame(id){frames.delete(id);},
  setInterval(){const id=++sequence;intervals.add(id);return id;}
};
globalThis.Cesium={
  Cartesian3:{
    clone(value){return {...value};},
    fromDegrees(longitude,latitude,height){return {x:longitude,y:latitude,z:height};},
    distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
  },
  HeadingPitchRange:class{
    constructor(heading,pitch,range){Object.assign(this,{heading,pitch,range});}
  },
  Matrix4:{IDENTITY:{}}
};
const camera={
  positionWC:{x:0,y:0,z:1000},heading:0,pitch:-1,roll:0,
  frustum:{fovy:1},
  cancelFlight(){},
  lookAt(target,orientation){
    paintCount++;
    this.positionWC={x:target.x,y:target.y,z:orientation.range};
    this.heading=orientation.heading;this.pitch=orientation.pitch;
  },
  lookAtTransform(){}
};
const scene={
  screenSpaceCameraController:{},
  requestRender(){renderCount++;}
};
const container={
  style:{},clientHeight:600,clientWidth:1000,
  addEventListener(name,fn){handlers.set(name,fn);},
  removeEventListener(name){handlers.delete(name);}
};
const home={longitude:153,latitude:-27,targetHeight:0,range:800000,
  heading:0,pitch:-1.2};
const flush=()=>{
  const pending=[...frames.values()];
  frames.clear();
  for(const fn of pending)fn();
};
let controller;
try {
  controller=createStormTrackerCameraController({
    viewer:{scene,camera},container,home,
    onInteraction(){interactionCount++;}
  });
  assert.equal(paintCount,1,"initial position renders once");
  const wheel=handlers.get("wheel");
  assert.equal(typeof wheel,"function");

  for(let i=0;i<90;i++){
    wheel({deltaY:-100,deltaMode:0,preventDefault(){},stopPropagation(){}});
  }
  assert.equal(controller.getState().range,800,"all zoom events update state");
  assert.equal(paintCount,1,"no synchronous camera paints in a wheel burst");
  assert.equal(frames.size,1,"only one RAF pending, not 90");
  assert.equal(interactionCount,90,"every wheel event renews interaction mode");
  flush();
  assert.equal(paintCount,2,"one final paint for 90 wheel events");

  for(let i=0;i<90;i++){
    wheel({deltaY:100,deltaMode:0,preventDefault(){},stopPropagation(){}});
  }
  assert.equal(controller.getState().range,5000000);
  assert.equal(frames.size,1);
  flush();
  assert.equal(paintCount,3,"one additional paint for opposite-direction burst");

  wheel({deltaY:-100,deltaMode:0,preventDefault(){},stopPropagation(){}});
  assert.equal(frames.size,1);
  controller.setView({longitude:152,latitude:-28,range:85000});
  assert.equal(frames.size,0,"programmatic view supersedes queued wheel paint");
  assert.equal(controller.getState().longitude,152);
  assert.equal(paintCount,4);
  flush();
  assert.equal(paintCount,4,"canceled paint does not overwrite new camera");

  // Mobile pinch target updates use the same bounded rendering queue.
  for(let i=0;i<80;i++) {
    controller.setGestureView({range:85000*Math.pow(0.98,i+1)});
  }
  assert.equal(frames.size,1,"80 pinch positions share one RAF");
  assert.equal(paintCount,4,"pinch updates must not redraw synchronously");
  flush();
  assert.equal(paintCount,5,"one final paint for 80 pinch positions");

  wheel({deltaY:-100,deltaMode:0,preventDefault(){},stopPropagation(){}});
  assert.equal(frames.size,1);
  controller.destroy();
  controller=null;
  assert.equal(frames.size,0,"destroy cancels pending camera paint");
  flush();
  assert.equal(paintCount,5);
  assert.ok(renderCount>=5);

  console.log("Rapid wheel and pinch zoom: 90 wheel events / 80 pinch updates each collapse into one camera render; state and teardown remain correct.");
} finally {
  controller?.destroy();
  globalThis.window=oldWindow;
  globalThis.Cesium=oldCesium;
}
