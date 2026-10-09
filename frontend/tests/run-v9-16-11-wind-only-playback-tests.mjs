import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {buildDopplerOnlySchedule} from "../src/doppler-available-window-v1.js";
import {buildOperationalWindowChoices} from "../src/operational-window-choices-v1.js";
import {createDopplerLayerTransition} from "../src/doppler-layer-transition-v1.js";
import {buildIndependentDopplerFrames} from "../src/independent-doppler-loop-v1.js";
const read=path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const runtime=read("../src/live3d-operational-v9.js");
const wind=[15,20,25,30,35,40,45].map(m=>({observedUtc:new Date(Date.UTC(2026,9,10,2,m)).toISOString()}));
// The BoM "locations"/"range" GUI layers are separate from the
// timestamped transparent PNG velocity frames. Latest GIF is a COMPOSITE
// and is never an animation source, even if newer than the PNGs.
const pngFrames=wind.map((frame,index)=>({
  ...frame,filename:`IDR66I.T.2026101002${String(15+index*5).padStart(2,"0")}.png`
}));
const compositeGif={observedUtc:new Date(Date.UTC(2026,9,10,2,58)).toISOString(),
  filename:"IDR66I.gif"};
const rawOnly=buildIndependentDopplerFrames({frames:pngFrames},null);
assert.equal(rawOnly.length,pngFrames.length);
assert.ok(rawOnly.every(frame=>frame.source_kind==="history" &&
  frame.filename.endsWith(".png")));
assert.ok(!rawOnly.some(frame=>frame.filename==="IDR66I.gif"));
assert.equal(buildIndependentDopplerFrames({frames:pngFrames},compositeGif).length,
  pngFrames.length+1,"source module still supports independently timestamped composite for other callers");
assert.match(runtime,/const frames=buildIndependentDopplerFrames\(\s*sources\.histories\.get\(radarId\),null\)/,
  "animated Doppler source MUST NOT append the latest composite GIF");
assert.match(runtime,/maskAnnotationRows:true/,
  "genuine historical Doppler scans need a display-only mask for burned-in UTC/range metadata");
assert.match(runtime,/frame\.source_kind==="latest"/,
  "original latest composite remains accessible only to legacy science/source metadata");
assert.deepEqual(buildDopplerOnlySchedule(wind).map(step=>step.dopplerObservedUtc),
  wind.map(frame=>frame.observedUtc),"every observed Doppler scan must appear exactly once");
assert.equal(buildDopplerOnlySchedule([]).length,0);
assert.equal(buildDopplerOnlySchedule([wind[0],wind[0],wind[1]]).length,2);
assert.equal(buildOperationalWindowChoices({combinedAvailable:true})[0].label,
  "Doppler — All available");
assert.match(runtime,/count: \(\) => isNativeDopplerPlayback\(\) \? windPlaybackFrames\.length/);
assert.match(runtime,/currentIndex: \(\) => isNativeDopplerPlayback\(\) \? independentDopplerIndexValue/);
assert.match(runtime,/showFrame: index => isNativeDopplerPlayback\(\) \? showDopplerOnlyFrame\(index\)/);
assert.match(runtime,/if\(selectedLoopSelection\(\)===DOPPLER_AVAILABLE_LOOP_VALUE\)\s*return loadDopplerSequence\(automatic\)/);
assert.match(runtime,/radarImageryHandover\.setOpacity\(0\);/);
assert.match(runtime,/hybridSource\.show=false/);
assert.match(runtime,/if\(inferredCollection\) inferredCollection\.show=false/);
assert.match(runtime,/const plan=buildDopplerOnlySchedule\(independentDopplerFrames\)/);
assert.match(runtime,/if\(isNativeDopplerPlayback\(\)\) return playbackDelayForSpeed\(selectedPlaybackSpeed\(\)\)/);
assert.match(runtime,/await dopplerOverlayTransition\.replacePrepared\(/);
assert.match(runtime,/durationMs:dopplerCrossfadeDurationMs\(\)/);
assert.match(runtime,/isNativeDopplerPlayback\(\) \? showDopplerOnlyFrame\(index\) : showHybridFrame\(index\)/);
assert.match(runtime,/if\(!isNativeDopplerPlayback\(\)\) renderHybridTracks\(hybridFrameIndex\)/);
assert.match(runtime,/if\(isNativeDopplerPlayback\(\)\)\{/);

// Staging must retain the visible previous wind image until the NEW source
// has had actual Cesium render opportunities. No blank-frame swap allowed.
const layers=[],callbacks=new Map(),postRender=new Set();
let now=0,nextId=1,renders=0;
const imageryLayers={
  add(layer,index=layers.length){layers.splice(index,0,layer);return layer;},
  indexOf(layer){return layers.indexOf(layer);},
  remove(layer){const i=layers.indexOf(layer);if(i>=0)layers.splice(i,1);return true;}
};
const scene={postRender:{addEventListener(fn){postRender.add(fn);return ()=>postRender.delete(fn)}}};
const driver=createDopplerLayerTransition({
  imageryLayers,scene,requestRender:()=>renders++,
  requestFrame:fn=>{const id=nextId++;callbacks.set(id,fn);return id;},
  cancelFrame:id=>callbacks.delete(id),now:()=>now
});
function tick(ms){now+=ms;const q=[...callbacks.values()];callbacks.clear();q.forEach(fn=>fn(now))}
function render(){[...postRender].forEach(fn=>fn())}
const a={name:"actual Doppler A",alpha:1};
driver.replace({layer:a,key:"A",alpha:.5});
assert.equal(driver.currentLayer,a);
const b={name:"actual Doppler B",alpha:1};
const pending=driver.replacePrepared({layer:b,key:"B",alpha:.5,durationMs:160});
assert.equal(driver.currentLayer,a,"old genuine wind remains visible during staging");
assert.equal(a.alpha,.5);
assert.equal(b.alpha,.001,"incoming wind staged beneath previous scan");
assert.equal(layers.length,2);
render();render();assert.equal(driver.currentLayer,a);
render();
const success=await pending;
assert.equal(success.changed,true);
assert.equal(driver.currentLayer,b);
assert.equal(layers.length,2,"old wind still visible during smooth blend");
tick(80);
assert.ok(a.alpha>0 && b.alpha>0,"both genuine source images overlap during fade");
tick(80);
assert.deepEqual(layers,[b]);
const c={name:"stale",alpha:1};
const abandoned=driver.replacePrepared({layer:c,key:"C",alpha:.5});
driver.clear();
render();
const aborted=await abandoned;
assert.equal(aborted.cancelled,true,"mode switch cancels a stale staged wind image");
assert.equal(layers.length,0,"no stale wind persists after rain-only switch");
assert.equal(postRender.size,0,"all Cesium listeners removed");
assert.ok(renders>=3);
// Native Doppler no longer supports adjustable opacity. Keep full coverage
// during a 180ms crossfade: new scan fades ON TOP of the old opaque scan.
const stack=[],frames=new Map();let clock2=0,next2=1;
const imagery2={
  add(layer,index=stack.length){stack.splice(index,0,layer);return layer;},
  indexOf(layer){return stack.indexOf(layer);},
  remove(layer){const i=stack.indexOf(layer);if(i>=0)stack.splice(i,1);},
  raiseToTop(layer){const i=stack.indexOf(layer);if(i>=0){
    stack.splice(i,1);stack.push(layer);
  }}
};
const full=createDopplerLayerTransition({
  imageryLayers:imagery2,
  requestFrame:callback=>{let id=next2++;frames.set(id,callback);return id;},
  cancelFrame:id=>frames.delete(id),
  now:()=>clock2
});
const base={name:"wind observation one",alpha:1};
full.replace({layer:base,key:"full-one",alpha:1,durationMs:180});
const incoming={name:"wind observation two",alpha:1};
full.replace({layer:incoming,key:"full-two",alpha:1,durationMs:180});
assert.deepEqual(stack,[base,incoming],
  "new scan must be ABOVE previous scan at the start of the blend");
clock2=90;
let step=[...frames.values()];frames.clear();step.forEach(fn=>fn(clock2));
assert.equal(base.alpha,1,"old Doppler stays fully opaque");
assert.ok(incoming.alpha>0&&incoming.alpha<1,
  "only incoming wind is gradually revealed");
assert.equal(1-(1-base.alpha)*(1-incoming.alpha),1,
  "total image coverage never becomes semitransparent");
clock2=180;
step=[...frames.values()];frames.clear();step.forEach(fn=>fn(clock2));
assert.deepEqual(stack,[incoming],"old imagery removed only after replacement is opaque");
assert.equal(incoming.alpha,1);
assert.match(runtime,/alpha:1, \/\/ native standalone Doppler is always fully opaque/);
assert.match(runtime,/const opacity=1; \/\/ standalone Doppler is fixed at 100%/);
assert.doesNotMatch(runtime,/\$\("dopplerOpacity"\)/,
  "no runtime may read a discarded wind transparency slider");
const html=read("../live3d-operational-v9.html");
assert.doesNotMatch(html,/id="dopplerOpacity"/,
  "Doppler transparency control has been removed");
assert.match(html,/id="radarOpacity"/,
  "rain-only transparency remains an independent control");

console.log("PASS original Doppler-only timeline, 100% permanent wind coverage, source handovers without basemap bleed-through, source metadata and mode cancellation.");
