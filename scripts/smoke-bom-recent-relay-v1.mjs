import assert from "node:assert/strict";
const endpoint="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-recent-history";
const query="?product=IDQ65388&station=540576";
let result=null;
for(let attempt=0;attempt<5;attempt++){
 const r=await fetch(endpoint+query,{
  signal:AbortSignal.timeout(30000),
  headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"}
 });
 if(r.ok){
  result=await r.json();
  assert.equal(r.headers.get("access-control-allow-origin"),
    "https://blakesmith-intel.github.io");
  assert.equal(r.headers.get("Cache-Control"),"public, max-age=300");
  break;
 }
 console.log("BoM history relay deployment not yet ready",r.status,
  (await r.text()).slice(0,180));
 await new Promise(resolve=>setTimeout(resolve,3000));
}
assert.ok(result,"Existing relay must provide the new public BoM station history");
assert.equal(result.format,"StormTrackerBomRecentRiverHistoryV1");
assert.equal(result.station,"540576");
assert.equal(result.product,"IDQ65388");
assert.ok(result.samples.length>=8,"Live Moreton Bay tidal table requires >=8 real observations");
const latest=result.samples.at(-1);
assert.ok(Date.now()-latest.time<36*3600000,
 "BoM returned only stale recent history for selected tide gauge");
assert.ok(result.samples.every(x=>Number.isFinite(x.time)&&Number.isFinite(x.height)));
assert.ok(result.samples.every((s,i)=>i===0||s.time>result.samples[i-1].time));
const rejection=await fetch(endpoint+"?product=IDQ65388&station=../bad",{
 signal:AbortSignal.timeout(10000)});
assert.equal(rejection.status,400);
console.log("Deployed existing BoM Worker recent-history route passed:",
  result.samples.length,"timestamped AEST water levels, last reading",
  new Date(latest.time).toISOString(),", invalid station rejected and browser CORS enabled.");
