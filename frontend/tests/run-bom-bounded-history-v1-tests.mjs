import assert from "node:assert/strict";
import {discoverBoundedBomReflectivityHistory}
  from "../src/bom-wmts-loop-v2.js";
const now=Date.parse("2026-10-13T05:23:00Z");
const seen=[],earliest=Date.parse("2026-10-13T04:30:00Z");
const newest=Date.parse("2026-10-13T05:05:00Z");
const available=await discoverBoundedBomReflectivityHistory(
  now,180,"SEQ",{probe:async (time,region)=>{
    assert.equal(region,"SEQ");seen.push(time);
    const at=Date.parse(time);
    if(at<earliest||at>newest)throw Error("Image request failed: HTTP 400");
    return true;
  }}
);
assert.equal(available.length,8,"Eight genuinely published observations retained");
assert.equal(available[0],"2026-10-13T04:30:00Z");
assert.equal(available.at(-1),"2026-10-13T05:05:00Z");
assert.ok(seen.length<=10,"No legacy 48-timestamp history probing");
assert.equal(new Set(seen).size,seen.length,"No duplicate source requests");
let failedCount=0;
await assert.rejects(
  discoverBoundedBomReflectivityHistory(now,180,"SEQ",{probe:async()=>{
    failedCount++;
    throw Error("Image request failed: HTTP 400");
  }}),/No verified current BoM reflectivity timestamp/);
assert.equal(failedCount,4,
  "When BoM rejects every candidate, stop after four probes rather than 48");
let forbiddenCount=0;
await assert.rejects(
  discoverBoundedBomReflectivityHistory(now,180,"SEQ",{probe:async()=>{
    forbiddenCount++;
    throw Error("Image request failed: HTTP 403");
  }}),/temporarily unavailable/);
assert.equal(forbiddenCount,1,"HTTP 403 never starts another automatic probe");
const gaps=[];
const partial=await discoverBoundedBomReflectivityHistory(
  now,180,"66",{probe:async timestamp=>{
    gaps.push(timestamp);
    return timestamp==="2026-10-13T05:05:00Z";
  }}
);
assert.deepEqual(partial,["2026-10-13T05:05:00Z"]);
assert.equal(gaps.length,4,"Stop at two genuine published-history misses");
const thirty=await discoverBoundedBomReflectivityHistory(
  now,30,"SEQ",{probe:async timestamp=>timestamp<="2026-10-13T05:05:00Z"}
);
assert.equal(thirty.length,7,"Requested horizon still limits verified observations");
console.log("PASS bounded 9-frame BoM rolling WMTS discovery, 400 flood prevention, 403 fast-stop, gaps and 30-minute horizon.");
