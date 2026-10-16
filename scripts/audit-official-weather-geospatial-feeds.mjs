#!/usr/bin/env node
// Deliberate, bounded one-off network audit. This is NOT a runtime feed;
// Do not probe/use api.weather.bom.gov.au: its access notice requires express
// permission for use/sharing and no such permission has been verified.
// no radar, warning or cyclone data are redistributed by this audit.
const endpoints=[
  ["bom-cyclone-gml-idq65248","https://www.bom.gov.au/fwo/IDQ65248.xml"],
  ["qld-active-prod-cyclone","https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneActive/MapServer?f=pjson"],
  ["qld-historical-cyclone-reference","https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer?f=pjson"]
];
for(const [name,url] of endpoints){
  const t=Date.now();
  try{
    const response=await fetch(url,{
      method:"GET",signal:AbortSignal.timeout(8500),
      headers:{"Accept":"application/json,application/xml,text/xml;q=0.8,*/*;q=0.3"}
    });
    const mime=response.headers.get("content-type")||"";
    const size=response.headers.get("content-length")||"unknown";
    // Limit audit memory and avoid copying potentially-sensitive current
    // warning content to public CI logs. Only inspect source metadata.
    const reader=response.body?.getReader();
    let sample="",total=0,fullyRead=false;
    if(reader){
      const decoder=new TextDecoder();
      while(sample.length<32768){
        const item=await reader.read();
        if(item.done){fullyRead=true;break;}
        const bytes=item.value;
        total+=bytes.length;
        sample+=decoder.decode(bytes.slice(0,Math.max(0,32768-sample.length)),{stream:true});
      }
      await reader.cancel();
    }
    let schema="unverified",firstItemKeys=[],attributesKeys=[];
    let jsonItemCount=null,geometryInItems=false;
    if(sample.trimStart().startsWith("{")){
      try{
        if(!fullyRead)throw Error("Truncated sample");
        const parsed=JSON.parse(sample);
        schema=Object.keys(parsed).slice(0,15).join(",");
        if(Array.isArray(parsed.data)){
          jsonItemCount=parsed.data.length;
          const first=parsed.data[0];
          firstItemKeys=first&&typeof first==="object"?Object.keys(first).slice(0,30):[];
          attributesKeys=first?.attributes&&typeof first.attributes==="object"?
            Object.keys(first.attributes).slice(0,35):[];
          geometryInItems=Boolean(first?.geometry||first?.attributes?.geometry||
            first?.attributes?.geojson||first?.attributes?.polygon);
        }
      }catch{schema="JSON-looking; full schema not sampled";}
    }else if(sample.trimStart().startsWith("<")){
      const head=sample.match(/^\s*(?:<\?xml[^>]*>\s*)?<([\w:-]+)/);
      schema=head?head[1]:"markup or HTML";
    }
    // Many 200 responses are HTML challenge pages; no live-ready conclusion.
    console.log(JSON.stringify({
      name,status:response.status,contentType:mime,
      contentLength:size,firstBytes:total,schema,
      jsonItemCount,firstItemKeys,attributesKeys,geometryInItems,
      elapsedMs:Date.now()-t,
      trustedForLive:false
    }));
  }catch(error){
    console.log(JSON.stringify({
      name,status:"inaccessible",errorName:error?.name??"Error",
      elapsedMs:Date.now()-t,trustedForLive:false
    }));
  }
}
console.log("NOTE: Availability and content-type are NOT authoritative schema, usage rights, UTC or current live cyclone verification. Human/source review required.");
