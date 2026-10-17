import assert from "node:assert/strict";
import {
  MAX_SECONDARY_WIND_OFFSET_MINUTES,SECONDARY_WIND_BLEND_MS,
  SECONDARY_WIND_FRAME_SYNC_WAIT_MS,waitForSecondaryWindPreparation,
  SECONDARY_WIND_RETRY_COOLDOWN_MS,supportedSecondaryWindSites,
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
