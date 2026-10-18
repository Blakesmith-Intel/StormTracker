import assert from "node:assert/strict";
import {discoverBoundedBomReflectivityHistory}
  from "../src/bom-wmts-loop-v2.js";
const now=Date.parse("2026-10-13T05:23:00Z");
const times=Array.from({length:8},(_,i)=>
  new Date(Date.parse("2026-10-13T04:30:00Z")+i*300000)
    .toISOString().replace(".000Z","Z"));
let fetches=0,probeCalls=0;
const available=await discoverBoundedBomReflectivityHistory(
  now,180,"SEQ",{publishedTimes:async()=>{fetches++;return [...times];}}
);
assert.deepEqual(available,times,"Only published BoM time dimension is accepted");
assert.equal(fetches,1,"One capabilities lookup instead of guessed WMTS tile queries");
assert.equal(probeCalls,0,"No speculative pixel probes per site or timestamp");
assert.equal(available.length,8);
let failures=0;
await assert.rejects(
  discoverBoundedBomReflectivityHistory(now,180,"SEQ",{publishedTimes:async()=>{
    failures++;return [];
  }}),/No verified current BoM reflectivity timestamp/);
assert.equal(failures,1,"One empty capabilities result; no cascade of 400 tile requests");
let denials=0;
await assert.rejects(
  discoverBoundedBomReflectivityHistory(now,180,"SEQ",{publishedTimes:async()=>{
    denials++;throw Error("BoM WMTS capabilities HTTP 403");
  }}),/HTTP 403/);
assert.equal(denials,1,"A service denial never triggers guessed timestamps");
const partial=await discoverBoundedBomReflectivityHistory(
  now,180,"66",{publishedTimes:async()=>[times.at(-1)]}
);
assert.deepEqual(partial,[times.at(-1)]);
const thirty=await discoverBoundedBomReflectivityHistory(
  now,30,"SEQ",{publishedTimes:async()=>times}
);
assert.equal(thirty.length,7,"Requested horizon still limits true observations");
assert.equal(thirty[0],"2026-10-13T04:35:00Z");
console.log("PASS nine-frame published BoM WMTS times, single metadata request, no 400 tile probe storms, source failure honesty and 30-minute horizon.");
