import assert from "node:assert/strict";
import {createStormTrackerCameraController} from "../src/stormtracker-camera-v1.js";
import {focusCycloneThroughController} from "../src/cyclone-camera-focus-v1.js";

// Simulate the actual StormTracker 250-ms unsolicited-motion watchdog, rather
// than merely asserting a mocked controller received a method call.
let watchdog=null,restorations=0,flyCancels=0,frames=0;
globalThis.window={
 setInterval(fn,interval){
  assert.equal(interval,250,"Use real camera guardian correction cadence");
  watchdog=fn;return 987654;
 }
};
globalThis.Cesium={
 Cartesian3:{
  fromDegrees:(lon,lat,h)=>({lon,lat,h}),
  clone:v=>({...v}),
  distance:(a,b)=>Math.hypot(a.lon-b.lon,a.lat-b.lat,a.h-b.h)
 },
 HeadingPitchRange:class{constructor(heading,pitch,range){
  this.heading=heading;this.pitch=pitch;this.range=range;
 }},
 Matrix4:{IDENTITY:{}},
 Math:{toRadians:x=>x*Math.PI/180}
};
const camera={
 positionWC:{lon:153,lat:-27,h:160000},heading:0,pitch:-1.3,roll:0,
 frustum:{fovy:Math.PI/3},
 cancelFlight(){flyCancels++},
 lookAt(target,hpr){
  this.positionWC={lon:target.lon,lat:target.lat,h:hpr.range};
  this.heading=hpr.heading;this.pitch=hpr.pitch;this.roll=0;
 },
 lookAtTransform(){},
 setView({destination,orientation}){
  restorations++;this.positionWC={...destination};
  this.heading=orientation.heading;this.pitch=orientation.pitch;
  this.roll=orientation.roll;
 }
};
const scene={
 screenSpaceCameraController:{},
 canvas:{clientWidth:1000,clientHeight:700},
 requestRenderMode:false,maximumRenderTimeChange:0,
 requestRender(){frames++}
};
const canvas={
 clientWidth:1000,clientHeight:700,style:{},
 addEventListener(){},removeEventListener(){}
};
const controller=createStormTrackerCameraController({
 viewer:{camera,scene},container:canvas,
 home:{longitude:153,latitude:-27,targetHeight:0,range:175000,
   heading:0,pitch:-1.2}
});
assert.equal(typeof watchdog,"function");
const before=controller.getCorrectionCount();
const focus=focusCycloneThroughController({
 coordinates:[[147,-14],[165,-8],[146,-17]],controller,
 viewer:{camera,scene},marginDegrees:1.5
});
assert.equal(camera.positionWC.lon,focus.longitude);
assert.equal(camera.positionWC.lat,focus.latitude);
assert.equal(controller.getState().longitude,focus.longitude);
for(let frame=0;frame<5;frame++)watchdog(); // includes 250ms and later guards
assert.equal(controller.getCorrectionCount(),before,
 "The existing camera guardian must NOT reset a cyclone focus");
assert.equal(camera.positionWC.lon,focus.longitude);
assert.equal(restorations,0);
// A truly external native camera flight IS meant to be corrected, proving
// this test would detect the original regression.
camera.positionWC={lon:153,lat:-27,h:180000};
watchdog();
assert.equal(controller.getCorrectionCount(),before+1);
assert.equal(restorations,1);
assert.equal(camera.positionWC.lon,focus.longitude);
assert.ok(flyCancels>=2,"Guardian and controller guard Cesium flight state");
assert.ok(frames>=3,"Focus causes map redraw");
controller.destroy();
delete globalThis.Cesium;
delete globalThis.window;
console.log("PASS guardian camera 250-ms watchdog: Jasper/Alfred source focus persists, unauthorized native motion corrected.");
