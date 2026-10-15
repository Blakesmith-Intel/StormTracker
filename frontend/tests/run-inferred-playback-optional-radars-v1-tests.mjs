import assert from "node:assert/strict";
import {createContinuousPlayback} from "../src/continuous-playback-v1.js";
import {
  supplementalObservedAnchor,shouldPrepareSupplementalForPlayback
} from "../src/supplemental-observed-anchor-v1.js";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const utc=n=>new Date(Date.parse("2026-10-15T02:00:00Z")+n*60000).toISOString();
const measured={observedUtc:utc(0),sourceMetadata:{region:"66"}};
const inferred=n=>({observedUtc:utc(n),sourceMetadata:{
  region:"66",temporalInference:{displayOnly:true}
}});
const frames=[measured,inferred(5),inferred(10)];
// Optional WMTS can hang independently: it MUST NOT block the two inferred
// display steps or cause a stopped/stuck main playback clock.
const optionalNeverCompletes=new Promise(()=>{});
let index=0;
const committed=[];
let finish;
const done=new Promise(resolve=>finish=resolve);
const playback=createContinuousPlayback({
  count:()=>frames.length,currentIndex:()=>index,delay:()=>1,
  showFrame:async target=>{
    const anchor=supplementalObservedAnchor(frames[target],frames,15);
    if(shouldPrepareSupplementalForPlayback(anchor))
      await optionalNeverCompletes;
    index=target;
    committed.push({index:target,anchor});
    if(committed.length===2){playback.pause();finish();}
    return true;
  }
});
playback.play();
await Promise.race([done,new Promise((_,reject)=>setTimeout(
  ()=>reject(Error("Secondary radar download blocked inferred playback")),700))]);
await playback.pause();
assert.deepEqual(committed.map(item=>item.index),[1,2]);
assert.deepEqual(committed.map(item=>item.anchor.observedUtc),[utc(0),utc(0)]);
assert.ok(committed.every(item=>item.anchor.held));
const source=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(source,/const extraPreparation=shouldPrepareSupplementalForPlayback\(supplementalAnchor\)/);
assert.match(source,/await extraPreparation;/);
assert.match(source,/supplementalRadarDisplay\.targetTime!==supplementalAnchor\.observedUtc/);
assert.match(source,/supplementalRadarDisplay\.commit\(supplementalAnchor\.observedUtc/);
console.log("PASS inferred BoM display frames advance despite a never-ending supplemental request, preserving genuine source anchors.");
