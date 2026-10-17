import assert from "node:assert/strict";
import {
  MAX_SECONDARY_WIND_OFFSET_MINUTES,supportedSecondaryWindSites,
  matchingSecondaryWindFrame,createSupplementalDopplerDisplay
} from "../src/multi-doppler-display-v1.js";

assert.equal(MAX_SECONDARY_WIND_OFFSET_MINUTES,8);
const sites={
  "66":{dopplerProduct:"IDR66I"},
  "50":{dopplerProduct:"IDR50I"},
  "08":{dopplerProduct:"IDR08I"},
  "19":{dopplerProduct:"IDR19I"},
  "24":{dopplerProduct:null},
  "93":{dopplerProduct:"IDR93I",dopplerIntegrated:false}
};
assert.deepEqual(
  supportedSecondaryWindSites("66",["66","50","08","50","24","93","19"],sites),
  ["50","08","19"]
);
const frames=[
  {filename:"f05",observedUtc:"2026-10-17T00:05:00Z"},
  {filename:"f10",observedUtc:"2026-10-17T00:10:00Z"},
  {filename:"f15",observedUtc:"2026-10-17T00:15:00Z"}
];
assert.equal(matchingSecondaryWindFrame(frames,"2026-10-17T00:12:00Z").frame.filename,"f10");
assert.equal(matchingSecondaryWindFrame(frames,"2026-10-17T00:26:00Z"),null);
assert.equal(matchingSecondaryWindFrame(frames,"not-a-date"),null);

const visibleLayers=[],transitions=new Map(),hits=[],updates=[];
const imageryLayers={
  add(layer){visibleLayers.push(layer);},
  remove(layer){const i=visibleLayers.indexOf(layer);if(i>=0)visibleLayers.splice(i,1);},
  indexOf(layer){return visibleLayers.indexOf(layer);},
  raiseToTop(layer){const i=visibleLayers.indexOf(layer);if(i>=0){visibleLayers.splice(i,1);visibleLayers.push(layer);}}
};
const scene={requestRender(){}};
let delay=null,resolveDelay=null;
function makeTransition(){
  const s={currentLayer:null,currentKey:null,
    clear(){if(this.currentLayer)imageryLayers.remove(this.currentLayer);this.currentLayer=null;this.currentKey=null;},
    async replacePrepared({layer,key,onAdded}){
      if(this.currentLayer)imageryLayers.remove(this.currentLayer);
      this.currentLayer=layer;this.currentKey=key;
      imageryLayers.add(layer);onAdded();return {changed:true,layer};
    }
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
assert.deepEqual(ctrl.snapshot().selected,["50","08"]);
ctrl.setEnabled(true);
ctrl.showAt("2026-10-17T00:12:00Z");
await until(()=>ctrl.visibleSites.length===2,"two genuine extra sites");
assert.deepEqual(ctrl.visibleSites.sort(),["08","50"]);
assert.equal(ctrl.snapshot().sources.filter(s=>s.matched).length,2);
assert.ok(hits.some(s=>s==="frame:08:f10"));
assert.ok(hits.some(s=>s==="frame:50:f10"));
assert.ok(!hits.some(s=>s.includes(":93")||s.includes(":24")));
const before=hits.length;
ctrl.showAt("2026-10-17T00:12:00Z");
await new Promise(r=>setTimeout(r,15));
assert.equal(hits.length,before,"same measured scan should reuse cached provider");

ctrl.showAt("2026-10-17T00:30:00Z");
await until(()=>ctrl.visibleSites.length===0,"out-of-range source clears");
assert.equal(ctrl.snapshot().sources.filter(s=>s.matched).length,0);
ctrl.setEnabled(false);
assert.equal(visibleLayers.length,0,"rain-only mode must clear all wind images");
ctrl.setEnabled(true);
ctrl.showAt("2026-10-17T00:15:00Z");
await until(()=>ctrl.visibleSites.length===2,"restore wind after rain");
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
ctrl2.showAt("2026-10-17T00:10:00Z");
await until(()=>typeof resolveDelay==="function","first scan started");
ctrl2.showAt("2026-10-17T00:15:00Z");
resolveDelay();
await until(()=>ctrl2.snapshot().sources[0].observedUtc==="2026-10-17T00:15:00Z",
  "newest measured scan wins");
assert.equal(ctrl2.snapshot().sources[0].observedUtc,"2026-10-17T00:15:00Z");
ctrl2.destroy();
assert.equal(visibleLayers.length,0,"destroy retires all native wind textures");
console.log("PASS simultaneous BoM secondary Doppler source selection, UTC matching, cache, stale async rejection, rain reset and cleanup.");
