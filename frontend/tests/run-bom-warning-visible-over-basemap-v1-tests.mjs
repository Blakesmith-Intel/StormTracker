import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 insertOfficialWarningImageryAboveBasemap,officialWarningBounds
} from "../src/context-layers/bom-warning-operational-v1.js";

const layers=[
 {name:"global satellite",opaque:true},
 {name:"DEA regional",opaque:true},
 {name:"NSW satellite",opaque:true},
 {name:"QLD local satellite",opaque:true},
 {name:"measured BoM radar"}
];
const imagery={
 arr:[...layers],
 add(layer,index){this.arr.splice(index===undefined?this.arr.length:index,0,layer);},
 indexOf(layer){return this.arr.indexOf(layer);},
 raiseToTop(layer){
  const at=this.indexOf(layer);
  if(at<0)throw Error("Missing radar layer");
  this.arr.splice(at,1);this.arr.push(layer);
 }
};
const warning={name:"source verified IDQ21033 warning"};
insertOfficialWarningImageryAboveBasemap(imagery,warning,()=>layers[4]);
assert.deepEqual(imagery.arr.map(x=>x.name),[
 "global satellite","DEA regional","NSW satellite","QLD local satellite",
 "source verified IDQ21033 warning","measured BoM radar"
],"Warning must sit ABOVE all opaque basemaps, BELOW measured radar");
// Updating the four satellite layers adds new imagery at the bottom,
// retaining the warning above them without altering the radar.
for(let i=0;i<4;i++){
 const fresh={name:"new-basemap-"+i};
 imagery.add(fresh,i);
}
for(const l of layers.slice(0,4)){
 imagery.arr.splice(imagery.indexOf(l),1);
}
assert(imagery.indexOf(warning)>3,"Changing basemaps must not hide warning");
assert.equal(imagery.arr.at(-1),layers[4],"Measured radar remains highest");
const none={arr:[{name:"base"}],add(layer){this.arr.push(layer);},indexOf(l){return this.arr.indexOf(l)},raiseToTop(){throw Error("Must not touch absent radar")}};
insertOfficialWarningImageryAboveBasemap(none,warning,()=>null);
assert.equal(none.arr.at(-1),warning,"Warning must display even before radar playback");

const actual={official:true,productCode:"IDQ21033",
 geometry:{type:"Polygon",coordinates:[[
 [143.4,-25.1],[144.7,-25.1],[144.7,-26.2],[143.4,-26.2],[143.4,-25.1]
 ]]}};
const d=officialWarningBounds([actual]);
assert.deepEqual(d,{west:143.4,east:144.7,south:-26.2,north:-25.1});
assert.deepEqual(officialWarningBounds([
 {...actual,geometry:{type:"MultiPolygon",coordinates:[actual.geometry.coordinates,[
 [[145,-27],[145.2,-27],[145.2,-27.2],[145,-27.2],[145,-27]]
 ]]}}
]),{west:143.4,east:145.2,south:-27.2,north:-25.1});
assert.equal(officialWarningBounds([]),null);
assert.equal(officialWarningBounds([{geometry:{type:"Polygon",coordinates:[[[-100,500],[-99,500],[-100,501]]]}}]),null);
const repoRoot=new URL("../../",import.meta.url);
const html=readFileSync(new URL("frontend/live3d-operational-v9.html",repoRoot),"utf8");
const build=readFileSync(new URL("scripts/build-current-site.sh",repoRoot),"utf8");
const control=readFileSync(new URL("frontend/src/context-layers/bom-warning-operational-v1.js",repoRoot),"utf8");
assert(html.includes('id="locateOfficialBomWarnings"'));
assert(html.includes('#locateOfficialBomWarnings[hidden]'));
assert(build.includes('getRadarLayer:()=>surfaceLayer'));
assert(build.includes('warning-visible-20261030-v1'));
assert(control.includes('cameraController.setView(target)'));
assert(control.includes('locateBtn.addEventListener("click",onLocate)'));
assert(control.includes('locateBtn.removeEventListener("click",onLocate)'));
assert(!control.includes('imageryLayers.add(imagery,Math.min(1,'));
console.log("PASS actual warning above four opaque satellite bases, radar above warning, basemap replacement stable, true bounds and explicit operator camera action");
