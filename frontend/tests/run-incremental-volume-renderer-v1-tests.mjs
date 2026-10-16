import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createIncrementalVolumeRenderer} from "../src/incremental-volume-renderer-v1.js";
let work=[],cancelled=new Set(),nextId=0;
function schedule(fn){const id=++nextId;work.push({id,fn});return id;}
function cancel(id){cancelled.add(id);}
function flush(){
  let now=0;
  for(let i=0;i<20 && work.length;i++){
    const current=work;work=[];
    now+=40;
    for(const entry of current)if(!cancelled.has(entry.id))entry.fn(now);
  }
  assert.equal(work.length,0,"morph must terminate");
}
const col={
  points:[],show:true,
  add(options){const p={...options};col.points.push(p);return p;},
  remove(p){const index=col.points.indexOf(p);if(index<0)return false;col.points.splice(index,1);return true;},
  get length(){return col.points.length;},
  get(i){return col.points[i];}
};
let removed=0,rendered=0;
const scene={primitives:{add(collection){return collection;},remove(collection){removed++;collection.points=[];}},
  requestRender(){rendered++;}};
const renderer=createIncrementalVolumeRenderer({
  scene,requestFrame:schedule,cancelFrame:cancel,maxMorphGlyphs:5,durationMs:100
});
const colour=alpha=>({alpha,withAlpha(a){return colour(a);}});
const points=n=>Array.from({length:n},()=>col.add({color:colour(0.7)}));
renderer.begin("radar:geometry:stride-2",()=>col);
renderer.touch(101,7,points(2));
renderer.touch(102,7,points(1));
assert.deepEqual(renderer.end(),{changedColumns:2,animated:false,glyphChanges:3});
assert.equal(col.length,3);
const old1=col.points[0],old2=col.points[2];
renderer.begin("radar:geometry:stride-2",()=>{throw Error("should reuse collection")},true);
assert.ok(renderer.unchanged(101,7));
renderer.touch(101,7);renderer.touch(102,7);
assert.deepEqual(renderer.end(),{changedColumns:0,animated:false,glyphChanges:0});
assert.strictEqual(col.points[0],old1,"unchanged primitive must remain identical");
renderer.begin("radar:geometry:stride-2",()=>col,true);
renderer.touch(101,8,points(2));
renderer.touch(102,7);
assert.equal(renderer.end().animated,true);
assert.equal(col.length,5,"old/new must overlap only during local morph");
flush();
assert.equal(col.length,3);
assert.strictEqual(col.points[0],old2,"unmodified second column stays intact");
renderer.begin("radar:geometry:stride-2",()=>col,true);
renderer.touch(102,7); // Omit cell 101 entirely to simulate disappearing reflectivity.
assert.equal(renderer.end().animated,true,"disappearing column should morph out");
flush();
assert.equal(col.length,1);
assert.strictEqual(col.points[0],old2);
renderer.begin("radar:geometry:stride-2",()=>col,true);
renderer.touch(102,9,points(9));
assert.equal(renderer.end().animated,false,"large changes skip morph to protect mobile GPU");
assert.equal(col.length,9);
renderer.begin("radar:geometry:stride-4",()=>col,true);
assert.equal(removed,1,"changing footprint/stride must reset the collection");
renderer.touch(200,7,points(1));renderer.end();
renderer.reset();
assert.equal(renderer.collection,null);
assert.equal(removed,2);
assert.ok(rendered>=4);
const live=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(live,/INCREMENTAL_VOLUME_PREVIEW/);
assert.match(live,/incrementalVolumeRenderer\.unchanged\(pixelIndex,category\)/);
assert.match(live,/incrementalVolumeRenderer\.upsert\(pixelIndex,category,nextSpecs/);
assert.match(live,/stablePrimaryVolumeStride/);
assert.match(live,/incrementalVolumeRenderer\.end\(\)/);
assert.match(live,/sourceMetadata\?\.temporalInference/);
const radar=readFileSync(new URL("../src/radar-source.js",import.meta.url),"utf8");
assert.ok(live.includes("PUBLISHED_PRODUCTION_RUNTIME || INCREMENTAL_VOLUME_PREVIEW"));
assert.ok(radar.includes("/preview/incremental-3d/"));
for(const name of ["power-outages-operational-v1.js",
  "flood-road-closures-operational-v1.js","river-gauges-operational-v1.js"]){
  const content=readFileSync(new URL("../src/context-layers/"+name,import.meta.url),"utf8");
  assert.ok(content.includes("/preview/incremental-3d/"),
    name+" must preserve production's safe Cesium hover-picking behaviour in the preview");
}
console.log("Persistent glyph identity, partial-change morph, disappearance, overflow and reset verified.");
