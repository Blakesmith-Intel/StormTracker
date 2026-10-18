// One-shot, bounded BoM rainfall source audit. No routine CI network polling.
const endpoints=[
 ["QLD Flood map","https://www.bom.gov.au/qld/flood/"],
 ["QLD rain river data","https://www.bom.gov.au/qld/flood/rain_river.shtml"],
 ["1h Brisbane","https://www.bom.gov.au/fwo/IDQ60336.html"],
 ["1h Gold Coast","https://www.bom.gov.au/fwo/IDQ60335.html"],
 ["daily bulletin","https://www.bom.gov.au/fwo/IDQ60129.html"],
 ["QLD flood map js","https://www.bom.gov.au/qld/flood/floodmap.js"],
 ["QLD metadata","https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-gauge-metadata"],
];
for(const [name,url]of endpoints){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:"text/html,application/json"}});
  const body=await r.text(),out={name,status:r.status,chars:body.length,contentType:r.headers.get("content-type")};
  if(name==="QLD metadata"){
   try{const f=JSON.parse(body).features;out.total=f.length;
     out.rainGaugeSamples=f.filter(x=>/rain/i.test(x.properties?.location_types||"")).slice(0,4).map(x=>({id:x.id,properties:x.properties,geometry:x.geometry}));}
   catch(e){out.error=String(e);out.snippet=body.slice(0,400);}
  }else{
   out.snippet=body.slice(0,1500);
   out.scripts=[...body.matchAll(/<script\b[^>]*src=["']([^"']+)["']/ig)].map(m=>m[1]).slice(0,55);
   out.rainMatches=body.split(/\n/).filter(x=>/since.?9|last.?1|rainfall|r9am|1hr|map.*data|hydro|gauge|\.js|\.json|\.kml|\.xml/i.test(x)).map(x=>x.trim().slice(0,350)).slice(0,55);
   out.productInfo=body.slice(body.indexOf("Station"),body.indexOf("Station")+1400);
  }
  console.log("AUDIT",JSON.stringify(out).slice(0,12000));
 }catch(e){console.log("SOURCE_ERROR",name,String(e))}
}
