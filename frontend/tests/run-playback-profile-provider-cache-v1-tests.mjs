import assert from "node:assert/strict";
import {createVolumeCategoryProfileCache}
  from "../src/volume-category-profile-cache-v1.js";
import {createSupplementalRadarDisplay}
  from "../src/multi-radar-display-v9.js";

// Infer only once per genuine original BoM dBZ category, not once per pixel.
// Style, uncertainty, altitude and dBZ are EXACTLY unchanged.
const model={profiles:[{id:"known"}]};
let inferenceCount=0,styleCount=0;
const inferColumn=(_model,dbz,{occupancyThreshold,minimumOutputDbz})=>{
  inferenceCount++;
  assert.equal(_model,model);
  assert.equal(occupancyThreshold,0.35);
  assert.equal(minimumOutputDbz,30);
  return [
    {dbzh:dbz,altitude_m_amsl:1000,confidence:.9},
    {dbzh:dbz+8,altitude_m_amsl:1500,confidence:.72}
  ];
};
const cache=createVolumeCategoryProfileCache({
  model,occupancyThreshold:.35,displayThresholdDbz:40,pointSize:4,
  representativeDbzForCategory:c=>c===0?null:35+c*5,
  inferColumn,shouldRenderVolumePoint:(dbz,minimum)=>dbz>=minimum,
  styleForInferredPoint:point=>{styleCount++;return {
    band:point.confidence>.8?"high":"medium",
    alpha:point.confidence,pixelSize:4
  };}
});
assert.equal(cache.get(0),null);
const first=cache.get(2);
assert.equal(cache.get(2),first);
for(let k=0;k<120000;k++)assert.equal(cache.get(2),first);
assert.equal(inferenceCount,1);
assert.equal(styleCount,2);
assert.deepEqual(first.points.map(p=>p.dbzh),[45,53]);
assert.deepEqual(first.points.map(p=>p.altitude_m_amsl),[1000,1500]);
assert.equal(first.styles[0].alpha,.9);
const another=cache.get(1);
assert.equal(inferenceCount,2);
assert.equal(another.points.length,1,"A 40 dBZ cutoff only changes presentation");
assert.equal(cache.size,3);
const otherSettings=createVolumeCategoryProfileCache({
  model,occupancyThreshold:.6,displayThresholdDbz:50,pointSize:4,
  representativeDbzForCategory:c=>35+c*5,
  inferColumn:(_m,dbz,{occupancyThreshold})=>{
    assert.equal(occupancyThreshold,.6);
    return [{dbzh:dbz,altitude_m_amsl:2200,confidence:.9}];
  },
  shouldRenderVolumePoint:(v,min)=>v>=min,
  styleForInferredPoint:()=>({alpha:.9})
});
assert.equal(otherSettings.get(2).points.length,0);
console.log("PASS identical original model profiles, heights, dBZ and confidence with category-once memoisation.");

// A repeated six-frame two-site radar playback used to evict frames after
// eight entries and redo canvas projection+PNG every loop. Confirm that
// the original source UTC still controls cached provider identity.
const listeners=new Set();
let graphics=[];
const scene={
  globe:{tilesLoaded:true},
  postRender:{addEventListener(listener){listeners.add(listener);
    return ()=>listeners.delete(listener);}},
  requestRender(){queueMicrotask(()=>{for(const fn of [...listeners])fn();});}
};
const imageryLayers={
  add(layer){graphics.push(layer);return layer;},
  remove(layer){graphics=graphics.filter(x=>x!==layer);return true;},
  indexOf(layer){return graphics.indexOf(layer);}
};
const w1={colStart:0,colEnd:0,rowStart:0,rowEnd:0};
const w2={colStart:1,colEnd:1,rowStart:0,rowEnd:0};
const windows={p:w1,s:w2};
const times=["2026-10-16T00:00:00Z","2026-10-16T00:05:00Z"];
let fetched=0,prepared=0,displayed=0;
const display=createSupplementalRadarDisplay({
  imageryLayers,scene,
  loadFrame:async(utc,site)=>{
    assert.equal(site,"s");fetched++;
    return {width:256,height:256,observedUtc:utc,
      categories:new Uint8Array(256*256).fill(9),
      sourceMetadata:{tileWindow:w2}};
  },
  prepareProvider:async(frame)=>{
    prepared++;return {originalUtc:frame.observedUtc};
  },
  createLayer:provider=>({provider,show:true,alpha:1}),
  getWindow:site=>windows[site],
  onDisplay:(site,frame,utc)=>{
    assert.equal(site,"s");assert.equal(frame.observedUtc,utc);displayed++;
  },
  maxCached:2,maxProviderCached:2
});
display.configure("p",["s"]);
for(const utc of [...times,...times]){
  await display.show(utc);
  assert.equal(display.visibleSites[0],"s");
}
assert.equal(fetched,2,"LRU retains exact original source observations");
assert.equal(prepared,2,"One PNG reproject per source UTC, even after loop restarts");
assert.equal(display.providerCacheSize,2);
assert.equal(display.sourceFrameCacheSize,2);
assert.equal(displayed,4,"Cached images still commit at each authentic UTC");
assert.equal(graphics.length,1,"No accumulated imagery layers");

display.configure("p",[]);
assert.equal(display.providerCacheSize,0,
  "A changed site/mask configuration retires old optional providers");
assert.deepEqual(display.visibleSites,[]);
console.log("PASS genuine BoM UTC cached and handed over repeatedly, bounded provider LRU, site/mask change cleanup.");
