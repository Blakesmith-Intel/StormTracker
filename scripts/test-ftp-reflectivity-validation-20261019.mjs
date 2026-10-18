import assert from "node:assert/strict";
import {inspectFtpReflectivityFrame} from "../frontend/src/ftp-reflectivity-validation-20261019.js";
const now=Date.UTC(2026,9,18,23,32);
const create=()=>({width:512,height:512,data:new Uint8ClampedArray(512*512*4)});
const sample=create();for(let p=0;p<sample.width*sample.height;p++){const i=p*4;sample.data.set(p%11?[245,245,255,255]:[192,192,192,255],i)}
const result=inspectFtpReflectivityFrame({filename:"IDR663.T.202610182329.png",imageData:sample,now});
assert.equal(result.site,"66");assert.equal(result.range,"3");
assert.equal(result.categories[0],0);assert.equal(result.categories[1],1);
assert.equal(result.renderEligible,false);assert.equal(result.georefVerified,false);
assert.throws(()=>inspectFtpReflectivityFrame({filename:"IDR66I.T.202610182329.png",imageData:sample,now}),/Unsupported/);
assert.throws(()=>inspectFtpReflectivityFrame({filename:"IDR663.T.202607130000.png",imageData:sample,now}),/stale/);
assert.throws(()=>inspectFtpReflectivityFrame({filename:"IDR663.T.202610182329.png",imageData:{...sample,width:256},now}),/geometry/);
const other=create();other.data.fill(255);
assert.throws(()=>inspectFtpReflectivityFrame({filename:"IDR663.T.202610182329.png",imageData:other,now}),/palette incompatible/);
console.log("PASS FTP: exact dBZ bands, stripped annotations, UTC/freshness, reject Doppler/stale/wrong-geometry/incompatible palette, rendering quarantined");
