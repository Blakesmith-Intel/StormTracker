// One-off read-only audit. No production background activity.
const relay="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const sources=[
 ["relay gauge metadata",relay+"/river-gauge-metadata"],
 ["relay observations",relay+"/river-height-bulletins"],
 ["DataQuoll public gauge summary","https://dataquoll.io/api/v1/gauges?state=QLD&limit=10000"],
 ["BoM river height official page","https://www.bom.gov.au/qld/flood/rain_river.shtml"]
];
const results={};
for(const [name,url]of sources){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(16000),
    headers:{Accept:name.includes("page")?"text/html":"application/json"}});
  const txt=await r.text();
  console.log("SOURCE",name,r.status,txt.length,r.headers.get("content-type"));
  if(!r.ok){console.log("SOURCE_ERROR",name,txt.slice(0,300));continue;}
  if(name.includes("page")){continue;}
  try{results[name]=JSON.parse(txt)}catch{
    console.log("NOT_JSON",name,txt.slice(0,400));}
 }catch(e){console.log("SOURCE_TRANSPORT",name,String(e))}
}
const g=results["relay gauge metadata"],b=results["relay observations"];
if(g&&b){
 const gauges=g.features||[],observations=(b.products||[]).flatMap(p=>p.observations||[]);
 const classed=observations.filter(o=>["minor","moderate","major"].includes(
  String(o.floodClass).toLowerCase()));
 console.log("META_AND_BULLETINS",JSON.stringify({gauges:gauges.length,
  observations:observations.length,classified:classed.length,
  classifiedRows:classed.map(x=>({stationName:x.stationName,stationId:x.stationId,
     floodClass:x.floodClass,heightMetres:x.heightMetres,
     observedText:x.observedText,sourceProduct:x.sourceProduct})),
  failed:b.failed,partial:b.partial}));
 const idSet=new Map();
 for(const f of gauges){
  const p=f.properties||{};
  for(const n of [p.bom_stn_num,p.awrc_stateid]){
    if(n!==null&&n!==undefined&&String(n).trim()){
      const id=String(n).trim().replace(/^0+(?=\d)/,"").toUpperCase();
      if(idSet.has(id))idSet.set(id,null);
      else idSet.set(id,f);
    }
  }
 }
 const unmatched=observations.filter(o=>!idSet.get(String(o.stationId||"").trim()
   .replace(/^0+(?=\d)/,"").toUpperCase()));
 console.log("UNMATCHED_SUMMARY",JSON.stringify({count:unmatched.length,
  classed:unmatched.filter(x=>["minor","moderate","major"].includes(x.floodClass)),
  first:unmatched.slice(0,35).map(o=>[o.stationName,o.stationId,o.floodClass])}));
 console.log("CLASSIFIED_MATCH_AUDIT",JSON.stringify(classed.map(o=>{
  const f=idSet.get(String(o.stationId||"").trim().replace(/^0+(?=\d)/,"").toUpperCase());
  return {name:o.stationName,id:o.stationId,location:f?.properties?.name||null,
    classification:f?.properties?.forecast_site_classification||null,
    types:f?.properties?.location_types||null,lat:f?.properties?.lat,
    lon:f?.properties?.long,hasGeo:!!f?.geometry};
 })));
}
const third=results["DataQuoll public gauge summary"];
if(third){
 const rows=Array.isArray(third)?third:
   (third.gauges||third.data||third.results||third.items||[]);
 console.log("THIRD_PARTY_GAUGE_FORMAT",JSON.stringify(
 {keys:Object.keys(third).slice(0,18),total:rows.length,sample:rows[0]}).slice(0,1200));
 const qualifying=rows.filter(x=>/^(minor|moderate|major)$/i.test(
   String(x.floodClass||x.flood_class||x.floodStatus||"")));
 console.log("THIRD_PARTY_MINOR_SAMPLES",JSON.stringify(qualifying.slice(0,45)).slice(0,8500));
}
console.log("DONE diagnostic no code mutations");
