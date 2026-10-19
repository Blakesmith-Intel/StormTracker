import assert from "node:assert/strict";
import {
  MAX_SECONDARY_WIND_OFFSET_MINUTES,SECONDARY_WIND_BLEND_MS,
  SECONDARY_WIND_FRAME_SYNC_WAIT_MS,waitForSecondaryWindPreparation,
  SECONDARY_WIND_RETRY_COOLDOWN_MS,SECONDARY_WIND_PROVIDER_CACHE_SIZE,
  supportedSecondaryWindSites,
  matchingSecondaryWindFrame,createSupplementalDopplerDisplay
} from "../src/multi-doppler-display-v1.js";

assert.equal(MAX_SECONDARY_WIND_OFFSET_MINUTES,8);
assert.equal(SECONDARY_WIND_BLEND_MS,120);
assert.equal(SECONDARY_WIND_FRAME_SYNC_WAIT_MS,350);
assert.equal(await waitForSecondaryWindPreparation(Promise.resolve()),true);
assert.equal(await waitForSecondaryWindPreparation(Promise.reject(Error("Optional site offline"))),false);
assert.equal(await waitForSecondaryWindPreparation(new Promise(()=>{}),5),false,
  "Slow optional Doppler must never stop the primary timeline");
assert.equal(SECONDARY_WIND_RETRY_COOLDOWN_MS,60000);
assert.equal(SECONDARY_WIND_PROVIDER_CACHE_SIZE,8,
  "One complete seven-frame authentic BoM loop must fit in the bounded site cache");
const sites={
  "66":{dopplerProduct:"IDR66I"},
  "50":{dopplerProduct:"IDR50I"},
  "08":{dopplerProduct:"IDR08I"},
  "19":{dopplerProduct:"IDR19I"},
  "24":{dopplerProduct:null},
  "93":{dopplerProduct:"IDR93I",dopplerIntegrated:true}
};
assert.deepEqual(
  supportedSecondaryWindSites("66",["66","50","08","50","24","93","19"],sites),
  ["50","08","93","19"]
);
const frames=[
  {filename:"f05",observedUtc:"2026-10-17T00:05:00Z"},
  {filename:"f10",observedUtc:"2026-10-17T00:10:00Z"},
  {filename:"f15",observedUtc:"2026-10-17T00:15:00Z"}
];
assert.equal(matchingSecondaryWindFrame(frames,"2026-10-17T00:12:00Z").frame.filename,"f10");
assert.equal(matchingSecondaryWindFrame(frames,"2026-10-17T00:26:00Z"),null);
assert.equal(matchingSecondaryWindFrame(frames,"not-a-date"),null);

const visibleLayers=[],transitions=new Map(),hits=[],updates=[],blendDurations=[];
const imageryLayers={
  add(layer){if(!visibleLayers.includes(layer))visibleLayers.push(layer);},
  remove(layer){const i=visibleLayers.indexOf(layer);if(i>=0)visibleLayers.splice(i,1);},
  indexOf(layer){return visibleLayers.indexOf(layer);},
  raiseToTop(layer){const i=visibleLayers.indexOf(layer);if(i>=0){visibleLayers.splice(i,1);visibleLayers.push(layer);}}
};
const scene={requestRender(){}};
let delay=null,resolveDelay=null;
function makeTransition(){
  const s={currentLayer:null,currentKey:null,
    clear(){if(this.currentLayer)imageryLayers.remove(this.currentLayer);this.currentLayer=null;this.currentKey=null;},
    replace({layer,key,onAdded,durationMs}){
      blendDurations.push(durationMs);
      if(this.currentLayer)imageryLayers.remove(this.currentLayer);
      this.currentLayer=layer;this.currentKey=key;
      imageryLayers.add(layer);onAdded();return {changed:true,layer};
    },
    async replacePrepared(args){return this.replace(args);}
  };
  transitions.set(transitions.size,s);return s;
}
const ctrl=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  loadSiteHistory:async id=>{hits.push("history:"+id);return {frames,palette:{valid:true}};},
  loadSiteFrame:async (id,frame)=>{
    hits.push("frame:"+id+":"+frame.filename);
    if(delay && id==="50" && frame.filename==="f10")
      await delay;
    return {provider:id+"@"+frame.observedUtc,observedUtc:frame.observedUtc};
  },
  onStatus:s=>updates.push(s)
});
async function until(condition,msg){
  for(let i=0;i<100;i++){
    if(condition())return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw Error("Timed out: "+msg);
}
ctrl.configure("66",["50","08","93","24"]);
assert.deepEqual(ctrl.snapshot().selected,["50","08","93"]);
ctrl.setEnabled(true);
await ctrl.prepare("2026-10-17T00:12:00Z");
assert.equal(ctrl.visibleSites.length,0,
  "As for rain, staging three wind layers must not expose them early");
ctrl.commit("2026-10-17T00:12:00Z");
await until(()=>ctrl.visibleSites.length===3,"three genuine extra sites including Brewarrina");
assert.deepEqual(ctrl.visibleSites.sort(),["08","50","93"]);
assert.equal(ctrl.snapshot().sources.filter(s=>s.matched).length,3);
assert.ok(ctrl.snapshot().sources.every(s=>s.offsetMinutes===-2),
  "Extra Doppler shows its observed UTC offset from the primary clock");
assert.ok(hits.some(s=>s==="frame:08:f10"));
assert.ok(hits.some(s=>s==="frame:50:f10"));
assert.ok(hits.some(s=>s==="frame:93:f10"));
assert.ok(!hits.some(s=>s.includes(":24")));
assert.ok(blendDurations.every(ms=>ms===SECONDARY_WIND_BLEND_MS),
  "Secondary wind transitions must preserve primary-like staged presentation");
const before=hits.length;
await ctrl.prewarm("2026-10-17T00:15:00Z");
assert.ok(hits.filter(s=>s==="frame:50:f15").length===1);
assert.ok(hits.filter(s=>s==="frame:08:f15").length===1);
assert.ok(hits.filter(s=>s==="frame:93:f15").length===1);
await ctrl.prepare("2026-10-17T00:12:00Z");
ctrl.commit("2026-10-17T00:12:00Z");
assert.equal(hits.length,before+3,"prewarming one future real scan per site should not refetch the current scan");

await ctrl.prepare("2026-10-17T00:30:00Z");
assert.equal(ctrl.visibleSites.length,3,
  "Before commit, previous source must remain fully visible (like rain)");
ctrl.commit("2026-10-17T00:30:00Z");
await until(()=>ctrl.visibleSites.length===0,"out-of-range source clears");
assert.equal(ctrl.snapshot().sources.filter(s=>s.matched).length,0);
assert.equal(ctrl.snapshot().sources.filter(s=>s.offsetMinutes!==null).length,0,
  "Never report a measured offset for a missing Doppler scan");
ctrl.setEnabled(false);
assert.equal(visibleLayers.length,0,"rain-only mode must clear all wind images");
ctrl.setEnabled(true);
await ctrl.prepare("2026-10-17T00:15:00Z");
assert.equal(ctrl.visibleSites.length,0,"Wind staging must be hidden");
ctrl.commit("2026-10-17T00:15:00Z");
await until(()=>ctrl.visibleSites.length===3,"restore all three supported wind sites after rain");
ctrl.configure("66",[]);
assert.equal(visibleLayers.length,0,"unselect site must retire its imagery");

// A stale, pending authentic scan must not replace newer requested source time.
const ctrl2=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  loadSiteHistory:async()=>({frames,palette:{}}),
  loadSiteFrame:async(id,frame)=>{
    hits.push("slow:"+frame.filename);
    if(frame.filename==="f10"){
      await new Promise(resolve=>{resolveDelay=resolve;});
    }
    return {provider:frame.filename,observedUtc:frame.observedUtc};
  }
});
ctrl2.configure("66",["50"]);ctrl2.setEnabled(true);
const stale=ctrl2.prepare("2026-10-17T00:10:00Z");
await until(()=>typeof resolveDelay==="function","first scan started");
const newest=ctrl2.prepare("2026-10-17T00:15:00Z");
resolveDelay();
await stale;
assert.deepEqual(ctrl2.commit("2026-10-17T00:10:00Z"),[],
  "Superseded source UTC must never commit");
await newest;
assert.equal(ctrl2.snapshot().sources[0].observedUtc,null,
  "New source remains hidden until master clock commit");
ctrl2.commit("2026-10-17T00:15:00Z");
await until(()=>ctrl2.snapshot().sources[0].observedUtc==="2026-10-17T00:15:00Z",
  "newest measured scan wins");
assert.equal(ctrl2.snapshot().sources[0].observedUtc,"2026-10-17T00:15:00Z");
ctrl2.destroy();
assert.equal(visibleLayers.length,0,"destroy retires all native wind textures");
console.log("PASS simultaneous BoM secondary Doppler source selection, UTC matching, cache, stale async rejection, rain reset and cleanup.");

const sourceFailureHits=[];
let clock=0;
const down=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  now:()=>clock,
  loadSiteHistory:async id=>{sourceFailureHits.push(id);throw Error("HTTP 502");},
  loadSiteFrame:async()=>{throw Error("Should not decode a failed source");}
});
down.configure("66",["50"]);down.setEnabled(true);
await down.prepare("2026-10-17T00:10:00Z");
down.commit("2026-10-17T00:10:00Z");
await until(()=>down.snapshot().sources[0].error!==null,"first unavailable source");
assert.equal(sourceFailureHits.length,1);
for(let i=0;i<10;i++){
  await down.prepare("2026-10-17T00:15:00Z");
  down.commit("2026-10-17T00:15:00Z");
}
await new Promise(resolve=>setTimeout(resolve,25));
assert.equal(sourceFailureHits.length,1,
  "Animated frames must not flood a failed optional Doppler relay");
clock+=SECONDARY_WIND_RETRY_COOLDOWN_MS+1;
await down.prepare("2026-10-17T00:10:00Z");
down.commit("2026-10-17T00:10:00Z");
await until(()=>sourceFailureHits.length===2,"retry after cooldown");
down.destroy();
console.log("PASS secondary Doppler warm cache, source backoff and staged transitions.");

import {readFileSync} from "node:fs";
const primaryPlayback=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
const windFrameBlock=primaryPlayback.slice(primaryPlayback.indexOf("async function showDopplerOnlyFrame"),
  primaryPlayback.indexOf("async function showHybridFrame"));
assert.ok(windFrameBlock.indexOf("supplementalDopplerDisplay.prepare(source.observedUtc)")<
  windFrameBlock.indexOf("commitWindObservation(prepared"),
  "Same rain-radar prepare staging before the primary measured image reveal");
assert.ok(windFrameBlock.indexOf("waitForSecondaryWindPreparation(extrasPreparing)")<
  windFrameBlock.indexOf("commitWindObservation(prepared"),
  "Short bounded sync preparation before the master clock advances");
assert.ok(windFrameBlock.indexOf("commitWindObservation(prepared")<
  windFrameBlock.indexOf("supplementalDopplerDisplay.commit(source.observedUtc)"),
  "Extra Doppler sites synchronously commit after the primary image stage");
assert.doesNotMatch(windFrameBlock,/supplementalDopplerDisplay\.showAt\(/,
  "Per-radar asynchronous reveal must not control Doppler playback");
console.log("PASS bounded multi-site Doppler sync preparation and honest source UTC offsets.");

// Regression: the primary is permitted to commit before a slow extra BoM site.
// Authentic late frames may appear at that SAME selected UTC, never later at
// a different cursor position; in-window old pixels remain visible meantime.
const stableHits=[],stableStatus=[];
let unblock08=null;
let block08=false;
const stable=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  loadSiteHistory:async()=>({frames,palette:{valid:true}}),
  loadSiteFrame:async(id,frame)=>{
    stableHits.push(id+":"+frame.filename);
    if(id==="08" && block08 && frame.filename==="f15"){
      await new Promise(resolve=>{unblock08=resolve;});
    }
    return {provider:id+"@"+frame.filename,observedUtc:frame.observedUtc};
  },
  onStatus:s=>stableStatus.push(s)
});
stable.configure("66",["50","08"]);stable.setEnabled(true);
const initial=stable.prepare("2026-10-17T00:10:00Z");
assert.deepEqual(stable.commit("2026-10-17T00:10:00Z"),[],
  "Primary can commit without discarding background secondary decoding");
await initial;
await until(()=>stable.visibleSites.length===2,"two slower authentic sites appear at current UTC");
assert.deepEqual(stable.visibleSites.sort(),["08","50"]);
assert.equal(visibleLayers.length,2);
block08=true;
const following=stable.prepare("2026-10-17T00:15:00Z");
assert.deepEqual(stable.commit("2026-10-17T00:15:00Z").sort(),["08","50"],
  "Previously measured 5-minute-old wind stays visible while next scan loads");
assert.equal(stable.snapshot().sources.find(s=>s.id==="08").offsetMinutes,-5);
await until(()=>unblock08!==null,"blocked secondary request launched");
assert.equal(stable.visibleSites.length,2,"No blank imagery between genuine frames");
unblock08();await following;
await until(()=>stable.snapshot().sources.every(s=>s.observedUtc==="2026-10-17T00:15:00Z"),
  "late second-site image completes at still-selected clock");
assert.equal(visibleLayers.length,2,"One native tile per selected site, no duplicates");
const expired=stable.prepare("2026-10-17T00:30:00Z");
stable.commit("2026-10-17T00:30:00Z");
await expired;
assert.equal(stable.visibleSites.length,0,
  "Out-of-window Doppler is removed rather than relabelled as current");
assert.equal(visibleLayers.length,0);
stable.destroy();

let resolveOld;
const seek=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  loadSiteHistory:async()=>({frames,palette:{}}),
  loadSiteFrame:async(id,frame)=>{
    if(frame.filename==="f10")await new Promise(resolve=>{resolveOld=resolve;});
    return {provider:frame.filename,observedUtc:frame.observedUtc};
  }
});
seek.configure("66",["50"]);seek.setEnabled(true);
const slowOld=seek.prepare("2026-10-17T00:10:00Z");
seek.commit("2026-10-17T00:10:00Z");
await until(()=>typeof resolveOld==="function","slow frame started after primary commit");
const newer=seek.prepare("2026-10-17T00:15:00Z");
seek.commit("2026-10-17T00:15:00Z");
resolveOld();
await Promise.all([slowOld,newer]);
assert.equal(seek.snapshot().sources[0].observedUtc,"2026-10-17T00:15:00Z",
  "Late older UTC must never overwrite a newer selected playback frame");
seek.destroy();
assert.equal(visibleLayers.length,0);
console.log("PASS no secondary Doppler flicker, source-accurate hold, late same-UTC recovery and stale-seek rejection.");

// Live-camera regression: image staging requires three Cesium post-render
// callbacks, often spanning one or more PRIMARY Doppler playback ticks.
// The source filename remains genuine and matches the newer clock, so the
// pending staged layer must not be cancelled or redundantly decoded.
const callbacks=new Set();
const slowScene={requestRender(){},postRender:{
  addEventListener(cb){callbacks.add(cb);return ()=>callbacks.delete(cb);}
}};
const warmCounts=new Map();
const slowDisplay=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene:slowScene,createTransition:makeTransition,
  createLayer:provider=>({provider,alpha:1}),
  loadSiteHistory:async()=>({frames,palette:{}}),
  loadSiteFrame:async(id,frame)=>{
    const key=id+"@"+frame.filename;
    warmCounts.set(key,(warmCounts.get(key)??0)+1);
    return {provider:key,observedUtc:frame.observedUtc};
  }
});
slowDisplay.configure("66",["50","08"]);slowDisplay.setEnabled(true);
const firstPending=slowDisplay.prepare("2026-10-17T00:10:00Z");
slowDisplay.commit("2026-10-17T00:10:00Z");
await until(()=>callbacks.size===2,"two authentic secondary Cesium stages running");
const clockAdvanced=slowDisplay.prepare("2026-10-17T00:12:00Z");
slowDisplay.commit("2026-10-17T00:12:00Z");
assert.equal(callbacks.size,2,
  "Clock change within same source UTC must not destroy and re-stage textures");
for(let i=0;i<3;i++){
  for(const callback of [...callbacks])callback();
  await Promise.resolve();
}
await Promise.all([firstPending,clockAdvanced]);
assert.deepEqual(slowDisplay.visibleSites.sort(),["08","50"],
  "Both genuine extra sites must appear together after their original stage");
assert.equal(warmCounts.get("50@f10"),1,"Marburg staged only once");
assert.equal(warmCounts.get("08@f10"),1,"Gympie staged only once");
assert.equal(visibleLayers.length,2,"No duplicate secondary Cesium imagery layers");
assert.ok(slowDisplay.snapshot().sources.every(p=>p.offsetMinutes===-2),
  "Retain the genuine original timestamp after primary clock advances");
const nextPending=slowDisplay.prepare("2026-10-17T00:15:00Z");
slowDisplay.commit("2026-10-17T00:15:00Z");
assert.deepEqual(slowDisplay.visibleSites.sort(),["08","50"],
  "Within-window previous real scan must remain visible while next scans stage");
await until(()=>callbacks.size===2,"two next wind frames stage");
for(let i=0;i<3;i++){
  for(const callback of [...callbacks])callback();
  await Promise.resolve();
}
await nextPending;
assert.ok(slowDisplay.snapshot().sources.every(p=>p.observedUtc==="2026-10-17T00:15:00Z"),
  "Once ready both selected radars hand over to the actual next BoM scan");
assert.equal(visibleLayers.length,2);
slowDisplay.destroy();assert.equal(visibleLayers.length,0);
console.log("PASS slow Cesium stages survive 5-minute playback-clock steps without flicker, duplicate tiles or false UTC.");

// The previous 3-frame provider LRU thrashed on every 7-frame loop repeat.
// Decode each authentic frame once, then replay multiple loops from bounded
// warm per-site providers, without synthetic frame creation.
const sevenFrames=Array.from({length:7},(_,i)=>({
  filename:"loop"+i,
  observedUtc:new Date(Date.parse("2026-10-17T00:00:00Z")+i*300000).toISOString()
}));
const sevenLoads=new Map();
const loopCache=createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,createTransition:makeTransition,
  createLayer:provider=>({provider}),
  loadSiteHistory:async()=>({frames:sevenFrames,palette:{}}),
  loadSiteFrame:async(id,frame)=>{
    const key=id+"@"+frame.filename;
    sevenLoads.set(key,(sevenLoads.get(key)??0)+1);
    return {provider:key,observedUtc:frame.observedUtc};
  }
});
loopCache.configure("66",["50","08"]);loopCache.setEnabled(true);
for(const frame of sevenFrames)await loopCache.prewarm(frame.observedUtc);
assert.equal(sevenLoads.size,14,"Seven genuine BoM images loaded for each selected site");
assert.equal(loopCache.needsBoundaryWait("2026-10-17T00:00:00Z"),true,
  "A selected real first scan needs pre-commit staging on initial entry");
for(let cycle=0;cycle<3;cycle++){
  for(const frame of sevenFrames){
    await loopCache.prepare(frame.observedUtc);
    loopCache.commit(frame.observedUtc);
    assert.deepEqual(loopCache.visibleSites.sort(),["08","50"],
      "All extra Doppler sites remain visible on every observed loop frame");
    assert.ok(loopCache.snapshot().sources.every(p=>p.observedUtc===frame.observedUtc),
      "Each visible site carries its original real BoM source timestamp");
  }
}
assert.ok([...sevenLoads.values()].every(n=>n===1),
  "Repeat loops must reuse cached native frames, not re-fetch/reproject them");
assert.equal(visibleLayers.length,2);
assert.equal(loopCache.needsBoundaryWait("2026-10-17T00:30:00Z"),false,
  "No extra pause when the currently rendered source already matches");
assert.equal(loopCache.needsBoundaryWait("2026-10-17T00:00:00Z"),true,
  "At 7-frame loop wrap, hold primary until a real old site scan is staged");
loopCache.destroy();assert.equal(visibleLayers.length,0);
console.log("PASS three complete 7-frame multi-site Doppler loops without imagery dropout or repeated decoding.");
