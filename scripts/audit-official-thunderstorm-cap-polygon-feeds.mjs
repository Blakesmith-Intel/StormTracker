// Anonymous publicly documented alert feed availability and polygon-shape
// audit ONLY. No live product integration, copying or warning content logging.
// Queensland AWS warnings aren't necessarily Bureau meteorological products.
const feeds=[
  ["qld-government-cap-au","https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings_capau.xml"],
  ["wmo-australia-bom-cap","https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml"]
];
for(const [name,url] of feeds){
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(18000)});
    const contentType=response.headers.get("content-type");
    if(!response.ok){console.log(JSON.stringify({name,httpStatus:response.status,readyForMap:false}));continue;}
    const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
    let sample="",bytes=0;
    while(sample.length<250000){
      const {value,done}=await reader.read();
      if(done)break;
      sample+=value;bytes+=value.length;
    }
    await reader.cancel();
    const count=tag=>[...sample.matchAll(new RegExp("<(?:[\\w]+:)?"+tag+"\\b","gi"))].length;
    const parts=[...sample.matchAll(/<(?:[\w]+:)?polygon\b[^>]*>([^<]{0,5000})<\/(?:[\w]+:)?polygon>/gi)];
    const geometrySample=parts[0]?.[1]?.trim()??"";
    const points=geometrySample.split(/\s+/).filter(Boolean);
    const validPolygonPairs=points.length>=4&&points.every(p=>
      /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(p));
    console.log(JSON.stringify({
      name,httpStatus:response.status,contentType,firstSampleChars:sample.length,
      detectedRoot:sample.match(/<(?:(?:\?xml[^>]*>\s*)|(?:[\w]+:))?([\w]+)[\s>]/)?.[1]??"unknown",
      rssItemTags:count("item"),alertTags:count("alert"),infoTags:count("info"),
      areaTags:count("area"),polygonTags:count("polygon"),
      circleTags:count("circle"),activePairShapeLooksCap:validPolygonPairs,
      readyForMap:false,
      reason:"Only source reachability/shape studied; active valid BoM warning issue and authorized geometry not yet independently established"
    }));
  }catch(error){console.log(JSON.stringify({name,sourceError:String(error),readyForMap:false}));}
}
