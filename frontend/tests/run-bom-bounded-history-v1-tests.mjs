import assert from "node:assert/strict";
import {discoverBoundedBomReflectivityHistory}
 from "../src/bom-wmts-loop-v2.js";
const now=Date.parse("2026-10-13T05:15:00Z");
const times=Array.from({length:8},(_,i)=>
 new Date(Date.parse("2026-10-13T04:30:00Z")+i*300000)
   .toISOString().replace(".000Z","Z"));
let fetches=0,probeCalls=0,fallBacks=0;
const verified=async(time,region)=>{
 probeCalls++;
 assert(times.includes(time));
 assert.equal(region,"SEQ");
 return true;
};
const archive=async()=>{fallBacks++;return [times.at(-1)]};
const available=await discoverBoundedBomReflectivityHistory(
 now,180,"SEQ",{publishedTimes:async()=>{fetches++;return [...times]},
 verifyNationalTile:verified,ftpHistory:archive}
);
assert.deepEqual(available,times,
 "Only official published national timestamps with a real verified tile are accepted");
assert.equal(fetches,1,"One official GetCapabilities lookup");
assert.equal(probeCalls,1,"One source PNG probe rather than speculative tile storms");
assert.equal(fallBacks,0,"Verified national feed never mixes in old FTP source times");
await assert.rejects(
 discoverBoundedBomReflectivityHistory(now,180,"SEQ",{
  publishedTimes:async()=>[],verifyNationalTile:verified,ftpHistory:archive
 }),/no verified current observation timestamp/i,
 "Missing high-resolution source MUST NOT display downgraded FTP imagery");
assert.equal(probeCalls,1,"No guesses when official times are absent");
let denied=0;
await assert.rejects(discoverBoundedBomReflectivityHistory(now,180,"SEQ",{
 publishedTimes:async()=>{denied++;throw Error("BoM WMTS capabilities HTTP 403")},
 verifyNationalTile:verified,ftpHistory:archive
}),/HTTP 403/);
assert.equal(denied,1);
assert.equal(fallBacks,0,"Legacy low-resolution source must never be called");
const partial=await discoverBoundedBomReflectivityHistory(now,180,"66",{
 publishedTimes:async()=>[times.at(-1)],
 verifyNationalTile:async(time,region)=>{
  assert.equal(region,"66");assert.equal(time,times.at(-1));return true;
 },
 ftpHistory:archive
});
assert.deepEqual(partial,[times.at(-1)]);
const thirty=await discoverBoundedBomReflectivityHistory(now,30,"SEQ",{
 publishedTimes:async()=>times,verifyNationalTile:verified,ftpHistory:archive
});
assert.equal(thirty.length,7);
assert.equal(thirty[0],"2026-10-13T04:35:00Z");
console.log("PASS national observed-only WMTS verification, no guessed timestamps, no low-resolution fallback when WMTS is stale, 30-minute window");
