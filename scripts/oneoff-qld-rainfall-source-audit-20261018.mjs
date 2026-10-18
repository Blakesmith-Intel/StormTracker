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

const urls=[
 ["QLD flood JS","https://www.bom.gov.au/scripts/disaster_mitigation/flood.js"],
 ["QLD flood page","https://www.bom.gov.au/qld/flood/"],
 ["1h rainfall Brisbane","https://www.bom.gov.au/fwo/IDQ60336.html"],
 ["24h rainfall Brisbane","https://www.bom.gov.au/fwo/IDQ60360.html"],
 ["1h rainfall Mackay","https://www.bom.gov.au/fwo/IDQ60340.html"],
 ["Rain gauges other","https://www.bom.gov.au/qld/flood/gauges.shtml"]
];
for(const [name,url] of urls){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
  const body=await r.text();
  const inspect={name,status:r.status,size:body.length};
  if(name==="QLD flood page"){
    inspect.anchorSnippets=["id=\"since\"","id=\"m1hr\"","name=\"since\"","f24hr","id=\"rivers\""].map(a=>{
      const idx=body.indexOf(a);return {anchor:a,found:idx>=0,snippet:idx>=0?body.slice(idx-350,idx+1750):""};
    });
    inspect.mapTags=body.match(/<map\b[^>]*>/gi)?.slice(0,20);
    inspect.datasetStrings=body.split("\n").filter(x=>/href=.*?(xml|json|fwo|flood|rain)|<area|map name|image-map|src=.*?(rain|flood)|<script/i.test(x)).map(x=>x.trim().slice(0,240)).slice(-90);
  }else if(name==="QLD flood JS")inspect.full=body.slice(0,14500);
  else{
    inspect.head=body.slice(0,6000);
    inspect.ids=body.match(/(?:bom_stn_num|stn|Station No|No\.|AWRC|[a-zA-Z]*_[A-Z]+)\D{0,15}\d{5,7}/g)?.slice(0,15);
    inspect.trSample=body.slice(body.indexOf("<table"),body.indexOf("<table")+2400);
  }
  console.log("DEEP_AUDIT",JSON.stringify(inspect).slice(0,17800));
 }catch(e){console.log("DEEP_ERROR",name,String(e))}
}
