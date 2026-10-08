import assert from "node:assert/strict";
import worker from "../../relay/worker.js";
const originalFetch=globalThis.fetch;
const now=new Date();
const qld=new Date(Date.now()+10*3600000);
const dd=String(qld.getUTCDate()).padStart(2,"0");
const mm=String(qld.getUTCMonth()+1).padStart(2,"0");
const yy=qld.getUTCFullYear();
const hh=String(qld.getUTCHours()).padStart(2,"0");
const minute=String(qld.getUTCMinutes()).padStart(2,"0");
const time=`${dd}/${mm}/${yy} ${hh}:${minute}`;
const sample='<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'
  +`<tr><td>${time}</td><td>0.92</td></tr></table>`;
const targets=[];
globalThis.fetch=async url=>{
  targets.push(String(url));
  assert.equal(String(url),
    "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540384.tbl.shtml");
  return new Response(sample,{status:200,headers:{"Content-Type":"text/html"}});
};
try {
  const target="https://relay.invalid/river-recent-history?product=IDQ65388&station=540384";
  const response=await worker.fetch(new Request(target,{
    headers:{Origin:"https://blakesmith-intel.github.io"}
  }),{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("access-control-allow-origin"),
    "https://blakesmith-intel.github.io");
  assert.equal(response.headers.get("Cache-Control"),"public, max-age=300");
  const json=await response.json();
  assert.equal(json.format,"StormTrackerBomRecentRiverHistoryV1");
  assert.equal(json.product,"IDQ65388");
  assert.equal(json.station,"540384");
  assert.equal(json.samples.length,1);
  assert.equal(json.samples[0].height,0.92);
  assert.equal(targets.length,1);
  const head=await worker.fetch(new Request(target,{method:"HEAD"}),{});
  assert.equal(head.status,200);
  assert.equal(await head.text(),"");
  for(const bad of [
    "product=IDN65388&station=540384",
    "product=IDQ65388&station=540384x",
    "product=IDQ65388&station=https://evil.example",
    "product=IDQ65387&station=540384",
    "product=IDQ65399&station=0000"
  ]) {
    const r=await worker.fetch(new Request(
      "https://relay.invalid/river-recent-history?"+bad
    ),{});
    assert.equal(r.status,400,"Reject invalid country/product/station before upstream call");
  }
  assert.equal(targets.length,2,"No extra upstream fetches for invalid station inputs");
  const blocked=await worker.fetch(new Request(target,{
    headers:{Origin:"https://evil.example"}
  }),{});
  assert.equal(blocked.status,403);
}finally {
  globalThis.fetch=originalFetch;
}
console.log("BoM recent-history relay checks passed: existing CORS origin policy, fixed QLD 12-product IDs, station sanitization, AEST table parsing, 5-min cache and HEAD response.");
