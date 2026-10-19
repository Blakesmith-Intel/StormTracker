#!/usr/bin/env node
// Production acceptance: read the real BoM anonymous FTP live directory and
// one genuine source PNG THROUGH the existing Cloudflare Worker.
import assert from "node:assert/strict";
const BASE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const origin={"Origin":"https://blakesmith-intel.github.io","Accept":"application/json"};
async function get(url,headers=origin){
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(45000),cache:"no-store"});
 if(!response.ok)throw Error("Direct live FTP HTTP "+response.status+" "+(await response.text()).slice(0,300));
 return response;
}
const manifest=await(await get(BASE+"/ftp-live-manifest")).json();
assert.equal(manifest.schema,"StormTrackerBoMFtpReflectivityManifestV1");
assert.equal(manifest.sourceKind,"ftp-live-direct-relay");
assert(Date.now()-Date.parse(manifest.generatedUtc)<3*60000);
assert(manifest.siteGeoreference?.["66"]?.controlPoints);
for(const site of ["08","50","66"])assert(manifest.siteFrameHistory[site]?.length>=1,"Missing live BoM radar "+site);
const record=manifest.siteFrameHistory["66"].at(-1);
assert(record.imageUrl.startsWith(BASE+"/ftp-live-frame?file="));
assert(Date.now()-Date.parse(record.observedUtc)<45*60000);
const picture=await(await get(record.imageUrl,{Origin:"https://blakesmith-intel.github.io"})).arrayBuffer();
const bytes=new Uint8Array(picture);
assert(bytes.byteLength>=30);
assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
const view=new DataView(picture);
assert.equal(view.getUint32(16),512);
assert.equal(view.getUint32(20),512);
console.log("BOM_DIRECT_FTP_RELAY_LIVE_SOURCE_PASS",JSON.stringify({
 frame:record.filename,sourceTime:record.observedUtc,siteCount:Object.keys(manifest.siteFrameHistory).length,
 liveBytes:bytes.byteLength,publishedAt:manifest.generatedUtc}));
