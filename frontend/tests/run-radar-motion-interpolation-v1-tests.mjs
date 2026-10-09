import assert from "node:assert/strict";
import {canMotionInterpolateRadar,createRadarMotionTransition,radarMotionStepsForSpeed} from "../src/radar-motion-interpolation-v1.js";
const base={width:64,height:64,georef:{projection:"EPSG:3857",minX:1,maxX:2,minY:3,maxY:4},
 radarId:"66",sourceMetadata:{provider:"BoM"}};
const make=(stamp,dx)=>{const data=new Uint8Array(64*64);
  for(let y=18;y<43;y++)for(let x=16;x<33;x++)data[y*64+x+dx]=x%3===0?9:6;
  return {...base,observedUtc:stamp,categories:data};
};
const before=make("2026-10-09T00:00:00Z",0),after=make("2026-10-09T00:05:00Z",6);
assert.equal(canMotionInterpolateRadar(before,after),true);
const t=createRadarMotionTransition(before,after,{blockSize:32});
const mid=t.frame(.5);
const centre=f=>{let sum=0,n=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)
  if(f.categories[y*64+x]>=4){sum+=x;n++}return sum/n};
const x0=centre(before),x1=centre(mid),x2=centre(after);
assert.ok(x1>x0+.8&&x1<x2-.8,"echo moves spatially: "+[x0,x1,x2]);
assert.equal(mid.sourceMetadata.temporalInference.method,"motion-compensated-category-warp");
assert.equal(mid.sourceMetadata.temporalInference.displayOnly,true);
assert.deepEqual(before.categories,make(before.observedUtc,0).categories);
assert.deepEqual([1,2,3].map(radarMotionStepsForSpeed),[1,0,0]);
assert.equal(canMotionInterpolateRadar(before,{...after,observedUtc:"2026-10-09T00:20:00Z"}),false);
assert.throws(()=>t.frame(1),RangeError);
console.log("PASS moving radar echoes, unchanged observed scans, display-only provenance, speed selection, invalid source guards.");
