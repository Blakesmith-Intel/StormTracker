import assert from "node:assert/strict";
const source="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-crossing-heights";
let lastError;
for(let attempt=1;attempt<=6;attempt++){
 try{
  const response=await fetch(source,{headers:{
   Origin:"https://blakesmith-intel.github.io",Accept:"application/json"
  },signal:AbortSignal.timeout(25000)});
  assert(response.ok,"Live crossing relay HTTP "+response.status);
  assert.equal(response.headers.get("access-control-allow-origin"),
   "https://blakesmith-intel.github.io","Crossing reference must work from production browser");
  const data=await response.json();
  assert.equal(data.schema,"StormTrackerBoMQldCrossingHeightsV1");
  assert.equal(data.sourceDate,"2022-01-05");
  assert(Object.keys(data.entries??{}).length>=40);
  assert.equal(data.entries["bom:540063"]?.heightMetres,2.67);
  assert.equal(data.entries["bom:540291"]?.heightMetres,-0.03);
  console.log("PASS live BoM crossing references from original source",
    Object.keys(data.entries).length,"station IDs");
  process.exit(0);
 }catch(err){
  lastError=err;
  if(attempt<6)await new Promise(resolve=>setTimeout(resolve,10000));
 }
}
throw lastError;
