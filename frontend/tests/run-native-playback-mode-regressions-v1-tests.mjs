import assert from "node:assert/strict";
import {createRadarImageryHandover} from "../src/radar-imagery-handover-v1.js";
import {readFileSync} from "node:fs";
const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(runtime,/independentDopplerRequest\+\+; \/\/ Invalidate a pending old wind render/);
assert.match(runtime,/Promise\.all\(\[\s*renderSurface\(frame,renderToken\)/);
assert.doesNotMatch(runtime,/showIndependentDopplerFrame\(/);
const scene={globe:{tilesLoaded:false},requestRender(){},
  postRender:{addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn)}}};
const listeners=new Set(),layers=[];
const imageryLayers={
  add(layer,i=layers.length){layers.splice(i,0,layer);return layer},
  remove(layer){let i=layers.indexOf(layer);if(i>=0)layers.splice(i,1);return true},
  indexOf:layer=>layers.indexOf(layer),
  raiseToTop(layer){this.remove(layer);layers.push(layer)}
};
const paint=()=>{for(const cb of [...listeners])cb()};
const rain=createRadarImageryHandover({imageryLayers,scene});
const wind=createRadarImageryHandover({imageryLayers,scene});
for(let i=0;i<18;i++){
  const a=rain.replace({source:"rain",i}),b=wind.replace({source:"wind",i});
  paint();paint();
  assert.deepEqual(await Promise.all([a,b]),[true,true],
    "3×6 measured frames must advance despite unrelated map tile activity");
  assert.equal(layers.length,2);
  assert.equal(rain.currentLayer.i,i);
  assert.equal(wind.currentLayer.i,i);
}
wind.reset();
for(let i=0;i<6;i++){
  const a=rain.replace({source:"rain-only",i});paint();paint();
  assert.equal(await a,true);
  assert.equal(layers.length,1,"wind should not return after rain-only selection");
}
assert.equal(wind.currentLayer,null);
console.log("PASS 18 paired frames, three complete loops and rain-only mode isolation.");
