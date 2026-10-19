// Release smoke for a NEW route on the one existing Cloudflare Worker.
const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-significant-rainfall";
const response=await fetch(url,{
 headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"},
 signal:AbortSignal.timeout(50000)
});
if(response.status!==200)throw Error("Rainfall route HTTP "+response.status);
if(response.headers.get("access-control-allow-origin")!=="https://blakesmith-intel.github.io")
 throw Error("Rainfall relay CORS mismatch");
const payload=await response.json();
if(payload.format!=="StormTrackerSignificantRainfallV1"||
   !Array.isArray(payload.regional)||!payload.regional.length||
   !Array.isArray(payload.failed) ||
   !Array.isArray(payload.observations?.since9am)||
   !Array.isArray(payload.observations?.lastHour))
 throw Error("Rainfall relay schema or source regions missing");
for(const period of ["since9am","lastHour"]){
 for(const item of payload.observations[period]){
  if(item.period!==period||!item.id||!Number.isFinite(item.latitude)||
      !Number.isFinite(item.longitude)||!Number.isFinite(item.mm)||item.mm<0||item.mm>3000||
      item.band!==(item.mm>=100?"red":item.mm>=50?"orange":null)||
      !Number.isFinite(Date.parse(item.sourceCreatedAt)))
   throw Error("Unverified BoM rainfall observation");
 }
}
console.log("PASS production QLD rainfall relay",JSON.stringify({
  loaded:payload.regional.map(x=>x.region),failed:payload.failed.map(x=>x.region),
  since9am:payload.observations.since9am.length,lastHour:payload.observations.lastHour.length
}));
