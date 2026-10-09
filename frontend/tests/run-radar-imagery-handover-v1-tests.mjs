import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRadarImageryHandover } from "../src/radar-imagery-handover-v1.js";

function fixture() {
  const listeners=new Set(), layers=[], queue=[], removed=[];
  let nextId=0;
  const scene={globe:{tilesLoaded:false},requests:0,
    requestRender(){this.requests++},
    postRender:{addEventListener(fn){listeners.add(fn);return ()=>listeners.delete(fn)}}
  };
  const imageryLayers={
    add(layer,index=layers.length){layers.splice(index,0,layer);return layer},
    remove(layer){const i=layers.indexOf(layer);if(i>=0)layers.splice(i,1);removed.push(layer);return true},
    indexOf:layer=>layers.indexOf(layer),
    raiseToTop(layer){const i=layers.indexOf(layer);layers.splice(i,1);layers.push(layer)}
  };
  const api=createRadarImageryHandover({imageryLayers,scene,
    setTimeoutImpl:fn=>{queue.push(fn);return ++nextId},
    clearTimeoutImpl:()=>{}});
  const fire=()=>[...listeners].forEach(fn=>fn());
  return {scene,layers,removed,api,fire,queue,listeners};
}
const f=fixture();
const original={name:"old",alpha:0};
assert.equal(await f.api.replace(original,{alpha:0.65}),true);
assert.equal(f.layers[0],original);
const replacement={name:"new",alpha:1};
const job=f.api.replace(replacement,{alpha:0.65});
assert.equal(f.layers.length,2);
assert.equal(f.layers[0],replacement,"new layer staged under old layer");
assert.equal(replacement.alpha,0.001);
assert.equal(f.api.currentLayer,original);
f.fire();f.fire();
assert.equal(f.api.currentLayer,original,"do not unveil new imagery while tiles still loading");
f.scene.globe.tilesLoaded=true;
f.fire();f.fire();
assert.equal(await job,true);
assert.deepEqual(f.layers,[replacement]);
assert.equal(f.api.currentLayer,replacement);
assert.equal(replacement.alpha,0.65);
assert.ok(f.removed.includes(original));
f.api.setOpacity(0.4);
assert.equal(replacement.alpha,0.4);

const blocked={name:"blocked"};
f.scene.globe.tilesLoaded=false;
const wait=f.api.replace(blocked,{alpha:0.8});
assert.equal(f.api.currentLayer,replacement);
f.queue.at(-1)();
assert.equal(await wait,false,"timeout must NOT replace visible radar with empty basemap");
assert.equal(f.api.currentLayer,replacement);
assert.ok(!f.layers.includes(blocked));

const obsolete={name:"obsolete"};
const inflight=f.api.replace(obsolete,{alpha:0.9});
const newest={name:"newest"};
const final=f.api.replace(newest,{alpha:0.75});
assert.equal(await inflight,false);
assert.ok(!f.layers.includes(obsolete));
f.scene.globe.tilesLoaded=true;
f.fire();f.fire();
assert.equal(await final,true);
assert.equal(f.api.currentLayer,newest);
assert.equal(f.layers.length,1,"no leaking radar imagery layers");
assert.equal(f.listeners.size,0,"all postRender subscriptions removed");
f.api.reset();
assert.equal(f.layers.length,0);
const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.ok(runtime.includes("radarImageryHandover.replace("),"live surface must use the atomic swap");
assert.ok(!runtime.includes("viewer.imageryLayers.remove(\n      surfaceLayer"),"never remove outgoing radar before new imagery is ready");
assert.ok(runtime.includes("createRadarMotionTransition(previousFrame,frame)"),"sequential radar transitions use source-measured spatial movement");
assert.ok(runtime.includes("prepareRadarSurfaceProvider(frame)"),"native BoM raster providers are cached and reused");
assert.ok(!runtime.includes("frameCrossfade"),"no compositor fade remains in the live weather runtime");
assert.ok(runtime.includes("timeoutMs:Math.min(180"),"visual-only intermediate steps have a strict render budget");
assert.ok(runtime.includes("renderSurface(displayFrame,renderToken"),"intermediate imagery is visual-only and never fed into storm science");
assert.ok(!runtime.includes("frameCrossfade.play("),"whole-scene opacity fade must never be used");
assert.ok(runtime.includes("previousVisibleIndex"),"failed Cesium loads cannot falsely advance the frame indicator");
assert.ok(!runtime.includes('"pointerdown", "pointermove", "wheel", "keydown"'),"hover must not interrupt radar transitions");
// A native SingleTile image already decoded from BoM must not await every
// unrelated map/terrain tile. Its outgoing image is still retained until
// Cesium has had three render boundaries to composite the new source.
const native=fixture();
const oldNative={name:"old-native"};
await native.api.replace(oldNative);
native.scene.globe.tilesLoaded=false;
const newNative={name:"decoded-native"};
const nativeSwap=native.api.replace(newNative,{decodedSingleTile:true});
native.fire();
native.fire();
assert.equal(native.api.currentLayer,oldNative,"do not unveil immediately");
native.fire();
assert.equal(await nativeSwap,true,
  "decoded SingleTile image advances despite independently loading basemap");
assert.equal(native.api.currentLayer,newNative);
assert.equal(native.layers.length,1);
native.api.reset();
// Same-frame presentation contract: dependent measured 3-D geometry is
// activated immediately BEFORE uncovering the matching 2-D radar source.
const synced=fixture();
const old2d={name:"t0",alpha:0};
await synced.api.replace(old2d);
const next2d={name:"t1",alpha:0};
let geometryFrame="t0";
const waiting=synced.api.replace(next2d,{
  decodedSingleTile:true,
  beforeReveal:()=>{
    assert.equal(synced.api.currentLayer,old2d,
      "old radar remains displayed until geometry prepares");
    assert.equal(next2d.alpha,.001,
      "incoming genuine rain image remains hidden during geometry update");
    geometryFrame="t1";
  }
});
synced.fire();synced.fire();
assert.equal(geometryFrame,"t0","waiting for radar texture must not change 3-D data");
synced.fire();
assert.equal(await waiting,true);
assert.equal(geometryFrame,"t1");
assert.equal(synced.api.currentLayer,next2d);
assert.equal(next2d.alpha,1);
const failure2d={name:"failed",alpha:0};
const oldGeometry=geometryFrame;
const cancelled=synced.api.replace(failure2d,{
  decodedSingleTile:true,
  beforeReveal:()=>{geometryFrame="INVALID";},
});
synced.queue.at(-1)();
assert.equal(await cancelled,false);
assert.equal(geometryFrame,oldGeometry,
  "failed radar tile must not advance volume to an unrenderable observation");
synced.api.reset();
console.log("PASS original BoM 2-D and measured-frame inferred 3-D reveal atomically, with failed tile rollback.");
