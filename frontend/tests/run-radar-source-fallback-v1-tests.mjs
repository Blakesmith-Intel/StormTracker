import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveSourceDiscovery} from "../src/radar-source-fallback-v1.js";
import {discoverBoundedBomReflectivityHistory}
  from "../src/bom-wmts-loop-v2.js";

const cache=[{observedUtc:"2026-10-13T04:00:00Z",
  categories:new Uint8Array([1,2]),sourceMetadata:{provider:"Australian Bureau of Meteorology"}}];
const sourceError=Error("Image request failed: HTTP 400");
assert.deepEqual(
  resolveSourceDiscovery({outcome:{times:["2026-10-13T05:00:00Z"]},cachedFrames:cache}),
  {times:["2026-10-13T05:00:00Z"],keepCurrent:false,cachedOnly:false});
assert.deepEqual(
  resolveSourceDiscovery({outcome:{error:sourceError},cachedFrames:cache}),
  {times:[],keepCurrent:false,cachedOnly:true},
  "No invented timestamps; load only real source frames already cached locally");
assert.deepEqual(
  resolveSourceDiscovery({outcome:{error:sourceError},cachedFrames:cache,automatic:true}),
  {times:[],keepCurrent:true,cachedOnly:false},
  "Automatic source failures must retain last real on-screen scan, not rebuild");
assert.throws(
  ()=>resolveSourceDiscovery({outcome:{error:sourceError},cachedFrames:[]}),
  /no prior genuine radar observation cached/,
  "Cold start with unavailable BoM source must report that accurately");
assert.throws(()=>resolveSourceDiscovery({}),TypeError);
const currentTime=Date.parse("2026-10-13T05:20:00Z");
let attempts=0,archiveAttempts=0;
await assert.rejects(
  discoverBoundedBomReflectivityHistory(currentTime,180,"SEQ",{
    publishedTimes:async()=>{attempts++;return []},
    ftpHistory:async()=>{archiveAttempts++;throw Error("No verified source frames available")}
  }),
  /No verified source frames available/
);
assert.equal(attempts,1,"A failed national mosaic startup checks one capabilities source");
assert.equal(archiveAttempts,1,"Then check one independent verified FTP source, never speculate WMTS timestamps");
const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(runtime,/BOUNDED_RADAR_RECOVERY_QA/);
assert.match(runtime,/discoverBoundedBomReflectivityHistory\(now,5,region\)/,
  "Automatic new-scan checks must be bounded too");
assert.match(runtime,/discoverBoundedBomReflectivityHistory\(now,180,region\)/);
assert.match(runtime,/resolveSourceDiscovery\(\{outcome:sourceResult,cachedFrames,automatic\}\)/);
console.log("PASS source-outage recovery: four probes maximum, real cached frames only, automatic last-frame retention and isolated route.");
