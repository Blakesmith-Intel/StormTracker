import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cycloneCameraFitState,focusCycloneThroughController}
 from "../src/cyclone-camera-focus-v1.js";

const cameraController=readFileSync(new URL("../src/stormtracker-camera-v1.js",import.meta.url),"utf8");
const renderer=readFileSync(new URL("../src/historical-cyclone-forecast-map-v1.js",import.meta.url),"utf8");
const archive=readFileSync(new URL("../src/historical-cyclone-overlay-v1.js",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(cameraController,/const correctionTimer\s*=\s*window\.setInterval/);
assert.match(cameraController,/camera\.cancelFlight\(\)/);
assert.match(cameraController,/snapshotCamera\(\)/);
assert.doesNotMatch(renderer,/viewer\.camera\.flyTo\(/);
assert.doesNotMatch(archive,/viewer\.camera\.flyTo\(/);
assert.match(renderer,/controller:cameraController/);
assert.match(archive,/focusCoordinates\(points,\{marginDegrees:margin\}\)/);
assert.match(runtime,/cameraController:mapCamera/);
assert.ok(runtime.indexOf("createHistoricalCycloneForecastQA({")>
  runtime.indexOf("createStormTrackerCameraController({"),
  "QA cyclone must mount after guarded map camera exists");
const observedAlfred=[[154.6,-14.3],[153,-20],[151.5,-29]];
const observedJasper=[[165,-8.5],[146,-15.7],[145,-17]];
const originalFina=[[133.01487,-10.2893],[126.27685,-13.44687]];
const alfred=cycloneCameraFitState(observedAlfred,{viewportWidth:1280,viewportHeight:800});
const jasper=cycloneCameraFitState(observedJasper,{viewportWidth:1280,viewportHeight:800});
const mobileJasper=cycloneCameraFitState(observedJasper,{viewportWidth:390,viewportHeight:760});
const fina=cycloneCameraFitState(originalFina,{viewportWidth:1280,viewportHeight:800});
for(const target of [alfred,jasper,mobileJasper,fina]){
 assert.ok(target.longitude>=-180&&target.longitude<=180);
 assert.ok(target.latitude>=-90&&target.latitude<=90);
 assert.ok(target.range>=800&&target.range<=5_000_000);
 assert.equal(target.targetHeight,0);
 assert.ok(target.pitch< -1.25&&target.pitch> -1.57);
}
assert.ok(mobileJasper.range>jasper.range,
  "Portrait viewport needs extra range to keep full long Queensland case on screen");
assert.equal(alfred.longitude,(154.6+151.5)/2);
assert.equal(fina.latitude,(-10.2893-13.44687)/2);
assert.throws(()=>cycloneCameraFitState([[179,3],[-179,2]]),/longitude seam/);
assert.throws(()=>cycloneCameraFitState([]),/Missing\/invalid/);
assert.throws(()=>cycloneCameraFitState([[150,-90.2]]),/Missing\/invalid/);
let accepted=null,requests=0,flights=0;
const fakeViewer={
 camera:{frustum:{fovy:Math.PI/3},flyTo(){flights++}},
 scene:{canvas:{clientWidth:1080,clientHeight:650},
   requestRender(){requests++}}
};
const authoritativeCamera={
 setView(view){accepted={...view}},
 getState(){return accepted}
};
const state=focusCycloneThroughController({
 coordinates:observedJasper,controller:authoritativeCamera,
 viewer:fakeViewer,marginDegrees:1.5
});
assert.equal(state.longitude,accepted.longitude);
assert.equal(state.range,accepted.range);
assert.equal(requests,1);
assert.equal(flights,0,
 "Any direct native flight would be cancelled by the StormTracker guardian");
assert.throws(()=>focusCycloneThroughController({
 coordinates:observedAlfred,controller:null,viewer:fakeViewer}),/camera controller unavailable/);
console.log("PASS camera guardian-aligned cyclone focus, Fina/Alfred/Jasper, portrait fit and source-only viewport bounds.");
