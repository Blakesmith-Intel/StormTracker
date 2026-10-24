// One-off operational diagnosis: exact station 535162, no guessed data.
// Logs station-specific results, no persistence or production side effects.
const worker="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const origin={"Origin":"https://blakesmith-intel.github.io","Accept":"application/json"};
async function read(path){
 const start=Date.now();
 try{
  const res=await fetch(worker+path,{headers:origin,signal:AbortSignal.timeout(65000)});
  const body=await res.text();let data;
  try{data=JSON.parse(body)}catch{data={raw:body.slice(0,320)}}
  console.log("ENDPOINT",path,"HTTP",res.status,"MS",Date.now()-start,"CORS",res.headers.get("access-control-allow-origin"));
  return {status:res.status,data};
 }catch(e){console.log("ENDPOINT ERROR",path,e.message);return {status:0,data:null};}
}
const [recent,bulletins,metadata]=await Promise.all([
 read("/river-recent-history?product=IDQ65392&station=535162"),
 read("/river-height-bulletins?force=1"),
 read("/river-gauge-metadata")
]);
console.log("RECENT",JSON.stringify({schema:recent.data?.format,availability:recent.data?.availability,
 code:recent.data?.code,reason:recent.data?.message,number:recent.data?.station,
 crossing:recent.data?.crossing,sampleCount:recent.data?.samples?.length,
 first:recent.data?.samples?.[0],last:recent.data?.samples?.at?.(-1)}));
const matches=bulletins.data?.products?.flatMap(x=>(x.observations??[]).filter(y=>
 String(y.stationId??"") === "535162").map(y=>({product:x.product??x.sourceProduct,
 stationId:y.stationId,height:y.heightMetres,tendency:y.tendency,
 time:y.observedText,href:y.recentDataHref})))??[];
console.log("BULLETINS",JSON.stringify({format:bulletins.data?.format,
 failed:bulletins.data?.failed,products:bulletins.data?.products?.length,
 totalObs:bulletins.data?.products?.reduce((n,p)=>n+(p.observations?.length??0),0),
 matches}));
const stations=(metadata.data?.features??[]).filter(f=>
 String(f.properties?.bom_stn_num??"") === "535162").map(f=>({
 name:f.properties?.name,number:f.properties?.bom_stn_num,
 coordinates:f.geometry?.coordinates,types:f.properties?.location_types,
 forecast:f.properties?.forecast_site_classification}));
console.log("METADATA",JSON.stringify({total:metadata.data?.features?.length,stations}));
