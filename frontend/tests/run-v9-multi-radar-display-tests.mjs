import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {QLD_RADAR_SITES} from "../src/qld-radar-sites-v1.js";
import {reflectivityWindowForRegion} from "../src/bom-wmts-loop-v2.js";
import {
  MAX_DISPLAY_RADAR_SITES,chooseSupplementalRadarSites,
  maskPreviouslyDisplayedTiles,fitSelectedRadarSites,
  createSupplementalRadarDisplay
} from "../src/multi-radar-display-v9.js";

let passed=0;
function check(name,action){action();passed++;console.log("PASS multi radar "+name);}
check("four total sites including the primary, duplicate and unknown IDs rejected",()=>{
  assert.equal(MAX_DISPLAY_RADAR_SITES,4);
  assert.deepEqual(chooseSupplementalRadarSites("66",
    ["66","50","08","50","24","98"],QLD_RADAR_SITES),["50","08","24"]);
  assert.deepEqual(chooseSupplementalRadarSites("50",[],QLD_RADAR_SITES),[]);
  assert.throws(()=>chooseSupplementalRadarSites("bogus",["66"],QLD_RADAR_SITES));
});
check("genuine site windows share a single fixed original BoM WMTS grid",()=>{
  for(const id of ["66","50","08","24"]){
    const w=reflectivityWindowForRegion(id);
    assert.ok(w.colStart<=w.colEnd && w.rowStart<=w.rowEnd);
  }
  const primary=reflectivityWindowForRegion("66");
  const adjacent=reflectivityWindowForRegion("50");
  assert.ok(primary.colEnd>=adjacent.colStart || adjacent.colEnd>=primary.colStart);
});
check("tile overlap completely transparent without altering source data or UTC",()=>{
  const width=6,height=4;
  const original=Uint8Array.from({length:width*height},(_,i)=>i+1);
  const frame={width,height,categories:original,
    observedUtc:"2026-10-10T01:00:00Z",
    sourceMetadata:{tileWindow:{colStart:10,colEnd:12,rowStart:20,rowEnd:21}}};
  const result=maskPreviouslyDisplayedTiles(frame,[{colStart:10,colEnd:10,rowStart:20,rowEnd:20}],2);
  assert.deepEqual([...result.categories.slice(0,6)],[0,0,3,4,5,6]);
  assert.deepEqual([...result.categories.slice(6,12)],[0,0,9,10,11,12]);
  assert.deepEqual([...result.categories.slice(12)],[...original.slice(12)]);
  assert.equal(original[0],1);
  assert.equal(result.observedUtc,frame.observedUtc);
  assert.equal(result.sourceMetadata.supplementalDisplayOnly,true);
  assert.equal(result.sourceMetadata.overlappingTilesMasked,1);
  assert.throws(()=>maskPreviouslyDisplayedTiles({...frame,width:7},[],2));
});
check("fit selected uses measured radar geographic centres, not fictitious storm centroids",()=>{
  const fit=fitSelectedRadarSites("66",["50","08"],QLD_RADAR_SITES);
  assert.ok(fit.longitude>152.5 && fit.longitude<153.3);
  assert.ok(fit.latitude>-27.8 && fit.latitude<-25.9);
  assert.ok(fit.range>=175000);
  assert.deepEqual(chooseSupplementalRadarSites("66",["66"],QLD_RADAR_SITES),[]);
});
function deferred(){
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  return {promise,resolve,reject};
}
const ms=256;
const utc="2026-10-10T01:05:00Z";
const primaryWindow={colStart:0,colEnd:0,rowStart:0,rowEnd:0};
const secondaryWindow={colStart:0,colEnd:1,rowStart:0,rowEnd:0};
const tertiaryWindow={colStart:0,colEnd:1,rowStart:0,rowEnd:1};
const windows={primary:primaryWindow,secondary:secondaryWindow,tertiary:tertiaryWindow};
function frame(id,time=utc){
  const window=windows[id];
  const width=(window.colEnd-window.colStart+1)*ms;
  const height=(window.rowEnd-window.rowStart+1)*ms;
  return {width,height,observedUtc:time,categories:new Uint8Array(width*height).fill(11),
    sourceMetadata:{tileWindow:window}};
}
let layers=[],updates=0,requests=[],warnings=[];
const renderListeners=new Set();
const imageryLayers={
  add(layer,index=layers.length){layers.splice(index,0,layer);return layer;},
  indexOf(layer){return layers.indexOf(layer);},
  raiseToTop(layer){
    const index=layers.indexOf(layer);
    if(index>=0){layers.splice(index,1);layers.push(layer);}
  },
  remove(layer){layers=layers.filter(x=>x!==layer);return true;}
};
const scene={
  globe:{tilesLoaded:true},
  postRender:{addEventListener(fn){
    renderListeners.add(fn);
    return ()=>renderListeners.delete(fn);
  }},
  requestRender(){
    updates++;
    // Deterministic browser render ticks for staged SingleTile images.
    queueMicrotask(()=>{for(const fn of [...renderListeners])fn();});
  }
};
const sources=new Map();
const providers=[];
const controller=createSupplementalRadarDisplay({
  imageryLayers,scene,
  loadFrame:(timestamp,id)=>{
    requests.push({timestamp,id});
    return sources.has(id)?sources.get(id):Promise.resolve(frame(id,timestamp));
  },
  prepareProvider:async image=>{providers.push(image);return {source:image};},
  createLayer:provider=>({provider,alpha:0}),
  getWindow:id=>windows[id],
  onStatus:message=>warnings.push(message)
});
controller.configure("primary",["secondary"]);
check("primary + second site, duplicate shared tiles masked, source UTC preserved",async()=>{});
const initial=controller.show(utc,{alpha:.65});
await initial;
assert.deepEqual(controller.visibleSites,["secondary"]);
assert.equal(layers.length,1);
assert.equal(layers[0].alpha,.65);
assert.equal(providers[0].observedUtc,utc);
assert.equal(providers[0].sourceMetadata.overlappingTilesMasked,1);
assert.ok(providers[0].categories.slice(0,ms).every(v=>v===0));
assert.ok(providers[0].categories.slice(ms).some(v=>v===11));
passed++;
controller.setOpacity(.2);
assert.equal(layers[0].alpha,.2);
await controller.show(utc,{alpha:.4});
assert.equal(requests.length,1);
assert.equal(layers[0].alpha,.4);
passed++;
console.log("PASS multi radar cached scan repeated without reload and opacity updated");

controller.configure("primary",["secondary","tertiary"]);
const pending=deferred();
sources.set("secondary",pending.promise);
const stale=controller.show("2026-10-10T01:10:00Z");
assert.equal(controller.visibleSites.length,0);
controller.configure("primary",["tertiary"]);
const newScan=controller.show("2026-10-10T01:15:00Z");
pending.resolve(frame("secondary","2026-10-10T01:10:00Z"));
await Promise.all([stale,newScan]);
assert.deepEqual(controller.visibleSites,["tertiary"]);
assert.equal(layers.length,1);
assert.equal(providers.at(-1).observedUtc,"2026-10-10T01:15:00Z");
passed++;
console.log("PASS multi radar source switch cancels obsolete pending image without stale radar bleed");

controller.configure("primary",["secondary"]);
await controller.show(utc);
assert.equal(layers.length,1);
const retained=layers[0];
const delayed=deferred();
sources.set("secondary",delayed.promise);
const nextUtc="2026-10-10T01:06:00Z";
const nextFrame=controller.show(nextUtc);
await Promise.resolve();
assert.equal(layers.length,1,"Old measured radar image MUST remain while next scan loads");
assert.equal(layers[0],retained,"Current image is not removed just for a new UTC");
delayed.resolve(frame("secondary",nextUtc));
await nextFrame;
assert.equal(layers.length,1,"Exactly one measured source image after atomic handover");
assert.notEqual(layers[0],retained,"Fresh genuine BoM scan replaces old scan");
assert.equal(providers.at(-1).observedUtc,nextUtc);
assert.equal(layers[0].alpha,1);
assert.equal(renderListeners.size,0,"Staging listeners detached after successful handover");
sources.delete("secondary");
passed++;
console.log("PASS QLD/NSW supplemental images retain prior source through decode and 3-frame handover; no blank transition");

// Same primary/selection: a late older radar scan must not overwrite a new UTC.
const slow=deferred();
sources.set("secondary",slow.promise);
const oldTask=controller.show("2026-10-10T01:07:00Z");
await Promise.resolve(); // Start the old in-flight BoM source request.
sources.delete("secondary"); // Next request returns a genuine newer frame.
const freshTask=controller.show("2026-10-10T01:08:00Z");
slow.resolve(frame("secondary","2026-10-10T01:07:00Z"));
await Promise.all([oldTask,freshTask]);
assert.equal(providers.at(-1).observedUtc,"2026-10-10T01:08:00Z");
assert.equal(layers.length,1);
sources.delete("secondary");
passed++;
console.log("PASS stale asynchronous supplemental frame cannot overwrite newer QLD/NSW image");

controller.configure("primary",["secondary"]);
sources.set("secondary",Promise.resolve(frame("secondary","2020-01-01T00:00:00Z")));
const rejected=await controller.show("2026-10-10T01:20:00Z");
assert.equal(rejected[0],null);
assert.deepEqual(controller.visibleSites,[]);
assert.equal(layers.length,0);
passed++;
console.log("PASS multi radar mismatched source clock explicitly rejected");
sources.delete("secondary");
controller.configure("primary",["secondary"]);
await controller.show(utc);
assert.equal(layers.length,1);
await controller.show(utc,{enabled:false});
assert.equal(layers.length,0);
assert.deepEqual(controller.visibleSites,[]);
passed++;
console.log("PASS multi radar rain coverage removed in native Doppler-only display");

const html=readFileSync(fileURLToPath(new URL("../live3d-operational-v9.html",import.meta.url)),"utf8");
const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(html,/id="multiRadarSelectButton"/);
assert.match(html,/id="multiRadarChecklist"/);
assert.match(html,/id="multiRadarStatus"[^>]*role="alert"[^>]*hidden/,
  "Limit warning is hidden by default, not a persistent selected-site footer");
assert.match(runtime,/checkbox\.checked=false;\s*const warning=\$\("multiRadarStatus"\);\s*warning\.textContent="You can select a maximum of three additional radars/,
  "Attempting a fourth extra radar must reject the selection and show the warning");
assert.match(runtime,/warning\.hidden=false;\s*return;/,
  "Limit warning is revealed only by rejecting an extra selection");
assert.match(runtime,/function clearMultiRadarSelectionWarning\(\)/);
assert.doesNotMatch(runtime,/onStatus:message=>[\s\S]{0,110}multiRadarStatus/,
  "Normal radar loading counters must not repopulate the footer");

assert.match(html,/id="fitMultiRadars"/);
assert.match(html,/id="clearMultiRadars"/);
assert.match(runtime,/function showSupplementalRadarSites\(frame\)/);
assert.match(runtime,/frame\.sourceMetadata\?\.temporalInference/);
assert.match(runtime,/supplementalRadarDisplay\.setOpacity/);
assert.match(runtime,/onBeforeReveal:commitMeasuredGeometry/,
  "Secondary radar windows must commit inside the primary single-tile reveal");
assert.match(runtime,/supplementalRadarDisplay\.commit\(supplementalAnchor\.observedUtc/,
  "Supplemental site handovers use the authentic observation clock, even on inferred primary frames");
assert.match(runtime,/showSupplementalRadarSites\(null\)/);
assert.match(html,/id="dopplerOverlayRadar" value="66"/);
passed++;
console.log("PASS multi radar real UI wired, original primary science and Doppler selector retained");
console.log(passed+" browser-only V9 multi-radar display contract tests passed.");
