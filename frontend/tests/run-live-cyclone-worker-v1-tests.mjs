import assert from "node:assert/strict";
import {cycloneSnapshotResponse} from "../../relay/cyclone-live-v1.js";
const now=Date.parse("2026-10-18T01:00:00Z");
const base={
 schema:"stormtracker-internal-cyclone-source-v1",status:"no-active-products",
 generatedUtc:new Date(now-3*60000).toISOString(),
 sourceDirectoryVerified:true,warningSummaryConfirmed:true,
 warningAdviceProductNamesPresent:[],complete:true,products:[],
 failedProductIds:[],verifiedProductIds:[]
};
const cors=(origin)=>{const h=new Headers();h.set("Access-Control-Allow-Origin",origin);return h;};
async function check(data){
 const env={CYCLONE_KV:{get:async()=>typeof data==="string"?data:JSON.stringify(data)}};
 return cycloneSnapshotResponse(env,"https://blakesmith-intel.github.io",cors,now);
}
const okay=await check(base);
assert.equal(okay.status,200);
assert.equal((await okay.json()).status,"no-active-products");
assert.equal(okay.headers.get("cache-control"),"no-store, max-age=0");
assert.equal(okay.headers.get("access-control-allow-origin"),"https://blakesmith-intel.github.io");
for(const data of [
 {...base,complete:false},
 {...base,warningSummaryConfirmed:false},
 {...base,sourceDirectoryVerified:false},
 {...base,warningAdviceProductNamesPresent:["IDQ20023.TXT"]},
 {...base,products:[{}]},
 {...base,generatedUtc:new Date(now-31*60000).toISOString()},
 {...base,generatedUtc:new Date(now+6*60000).toISOString()},
 {...base,schema:"unknown"},
 {...base,status:"source-unavailable"},
 {...base,status:"active"},
 "{not-json",
 ""
]){
 const r=await check(data);
 assert.equal(r.status,503,"Unsafe/stale/no-source payload must never look current");
 assert.equal((await r.json()).status,"source-unavailable");
}
const disconnected=await cycloneSnapshotResponse({},
 "https://blakesmith-intel.github.io",cors,now);
assert.equal(disconnected.status,503);
const active=await check({...base,status:"active",complete:true,warningSummaryConfirmed:false,
 products:[{productId:"IDQ65248"}]});
assert.equal(active.status,200);
const failing=await cycloneSnapshotResponse({CYCLONE_KV:{get:async()=>{throw Error("KV outage");}}},
 "https://blakesmith-intel.github.io",cors,now);
assert.equal(failing.status,503);
console.log("PASS existing Cloudflare cyclone KV endpoint: active/empty, no false all-clear, stale/disconnected/failed transport");
