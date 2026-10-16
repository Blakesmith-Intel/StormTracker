import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {chooseScaleDistance,formatMapDistance,sumSurfaceDistances} from "../src/map-measure-math-v1.js";

const read = path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const shell=read("../live3d-operational-v9.html");
const js=read("../src/live3d-operational-v9.js");
const controls=read("../src/friendly-map-tools-v1.js");
const css=read("../src/friendly-ui-v1.css");
const root=read("../index.html");
assert.equal(formatMapDistance(0),"0 m");
assert.equal(formatMapDistance(250),"250 m");
assert.equal(formatMapDistance(999),"999 m");
assert.equal(formatMapDistance(1250),"1.25 km");
assert.equal(formatMapDistance(12500),"12.5 km");
assert.equal(formatMapDistance(-1),"—");
assert.equal(chooseScaleDistance(0),null);
assert.equal(chooseScaleDistance(NaN),null);
assert.deepEqual(chooseScaleDistance(10,110),{metres:1000,pixels:100,label:"1.00 km"});
assert.deepEqual(chooseScaleDistance(1,110),{metres:100,pixels:100,label:"100 m"});
const ellipsoid={cartesianToCartographic:position=>position};
class StubGeodesic {
  constructor(from,to){this.surfaceDistance=Math.abs(to.x-from.x);}
}
assert.equal(sumSurfaceDistances([{x:0},{x:15},{x:32}],ellipsoid,StubGeodesic),32);
assert.equal(sumSurfaceDistances([{x:0}],ellipsoid,StubGeodesic),0);
assert.match(shell,/<body class="simple-ui">/);
assert.match(shell,/id="simpleModeToggle"/);
for(const id of ["measureToggle","measureSurface","mapMeasurePanel","measureUndo","measureClear","measureDone","mapScaleBar","mapScaleLabel","mapScaleLine"]){
 assert.match(shell,new RegExp('id="'+id+'"'),id);
}
assert.match(shell,/friendly-ui-v1\.css/);
assert.match(js,/createFriendlyMapTools\(\{viewer,Cesium\}\)/);
assert.match(controls,/new Cesium\.CustomDataSource/);
assert.match(controls,/Cesium\.Ellipsoid\.WGS84/);
assert.match(controls,/clampToGround:true/);
assert.match(controls,/source\.entities\.removeAll\(\)/);
assert.match(controls,/viewer\.dataSources\.remove\(source,true\)/);
assert.match(controls,/aria-pressed/);
assert.match(controls,/camera\.changed\.addEventListener/);
assert.match(css,/#measureSurface/);
assert.match(css,/body\.simple-ui #controlSidebar/);
assert.match(css,/#mapScaleBar/);
assert.ok(css.includes("grid-template-rows:minmax(0,min(29dvh,250px))"));
assert.ok(css.includes("body.simple-ui .layer-controls,body.simple-ui .live-notices"));
assert.ok(css.includes("#mapMeasurePanel small {display:none;}"));
assert.ok(css.includes("#measureDone {grid-column:auto;"));
assert.ok(controls.includes("Measurement finished."));
assert.match(root,/simple-ui-measure-v2-mobile/);
assert.doesNotMatch(controls,/loadBomReflectivityMosaic|loadDopplerFrame|buildStormTrack/);
console.log("Friendly UI, distance and scale regression checks passed.");

// QFD rescue & assistance must remain accessible without opening advanced mode.
