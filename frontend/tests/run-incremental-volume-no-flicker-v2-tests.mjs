import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createIncrementalVolumeRenderer} from "../src/incremental-volume-renderer-v1.js";
import {addVolumeDisplayPoint,updateVolumeDisplayPoint,setVolumeDisplayOpacity}
  from "../src/volume-display-opacity-v1.js";
const colour=(base,alpha=1)=>({base,alpha,withAlpha(a){return colour(base,a);}});
const points=[];
let created=0,removed=0,sceneRemovals=0;
const collection={
  points,show:true,
  add(spec){const glyph={...spec};points.push(glyph);created++;return glyph;},
  remove(glyph){const index=points.indexOf(glyph);if(index<0)return false;points.splice(index,1);removed++;return true;},
  get length(){return points.length;},
  get(index){return points[index];}
};
const scene={primitives:{
    add(x){return x;},
    remove(x){sceneRemovals++;x.points.splice(0);}
  },requestRender(){}};
const renderer=createIncrementalVolumeRenderer({scene,
  requestFrame(){throw Error("Do not schedule a full-volume fade");}});
function spec(dbz,level){
  return {options:{position:{dbz,level},color:colour(dbz),width:8,height:8},
    alpha:0.85,percent:70};
}
function apply(key,dbz,count=2){
  const specs=Array.from({length:count},(_,i)=>spec(dbz,i));
  if(renderer.unchanged(key,dbz)){
    renderer.touch(key,dbz);
    return;
  }
  renderer.upsert(key,dbz,specs,
    spec=>addVolumeDisplayPoint(collection,spec.options,spec.alpha,spec.percent),
    (glyph,spec)=>updateVolumeDisplayPoint(glyph,spec.options,spec.alpha,spec.percent));
}
renderer.begin("footprint-A",()=>collection,false);
apply(10,7);apply(11,7);apply(12,7);
renderer.end();
assert.equal(created,6);
const first=points[0],other=points[2];
assert.equal(first.color.alpha,0.85*0.7);
for(let pass=0;pass<25;pass++){
  renderer.begin("footprint-A",()=>collection,false);
  apply(10,pass%2?7:8);
  apply(11,7);
  apply(12,pass%2?8:9);
  const result=renderer.end();
  assert.equal(result.animated,false);
  assert.equal(points.length,6,"No transient ghost points are retained");
  assert.equal(created,6,"Changing storm intensity must update existing glyphs");
  assert.strictEqual(points[0],first);
  assert.strictEqual(points[2],other);
  assert.ok(points.every(p=>p.color.alpha>0),"No entire-cloud zero-alpha redraw");
}
assert.equal(removed,0);
renderer.begin("footprint-A",()=>collection,false);
apply(10,8,1);apply(11,7);
renderer.end();
assert.equal(points.length,3,"When a cell disappears only its own glyphs leave");
assert.ok(removed>=3);
setVolumeDisplayOpacity(collection,45);
assert.equal(first.color.alpha,0.85*.45,"Updated glyph source alpha survives slider adjustment");
renderer.reset();
assert.equal(sceneRemovals,1);
assert.equal(renderer.columns,0);
const source=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
const supplemental=readFileSync(new URL("../src/supplemental-radar-volume-v1.js",import.meta.url),"utf8");
assert.match(source,/inferredCollection\.show=INCREMENTAL_VOLUME_PREVIEW \? true/);
assert.match(source,/const showTrackVolumes = !INCREMENTAL_VOLUME_PREVIEW && useTrackSpecificVolume/);
assert.match(source,/incrementalVolumeRenderer\.upsert\(pixelIndex,category,nextSpecs/);
assert.match(source,/false \/\/ No double-buffer or fade/);
assert.match(source,/supplementalVolumeDisplay\?\.pruneSites\(additionalRadarSiteIds\)/);
assert.match(supplemental,/state\.delta\.upsert\(i,categories\[i\],nextSpecs/);
assert.match(supplemental,/function pruneSites\(selectedIds=\[\]\)/);
assert.doesNotMatch(supplemental,/setVolumeDisplayOpacity\(collection,settings\.volumePercent\)/,
  "Do not upload every unchanged colour on each secondary frame");
console.log("PASS steady 3-D glyph count across 25 intensity transitions, in-place identity, source alpha and secondary GPU cleanup.");
