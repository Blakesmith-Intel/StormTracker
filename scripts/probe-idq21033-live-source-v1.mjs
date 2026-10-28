import {parseBomCapProductNotice,parseOfficialBomCap} from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";
// One-off direct government-source diagnostic. Logs only source shape,
// canonical links, product identities and page asset paths, NOT warning text.
const capRss="https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml";
const targets=[
 ["wmo-cap",capRss],
 ["bom-warning","https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033"],
 ["bom-fwo-html","https://www.bom.gov.au/fwo/IDQ21033.html"],
 ["bom-fwo-xml","https://www.bom.gov.au/fwo/IDQ21033.xml"],
 ["bom-products-html","https://www.bom.gov.au/products/IDQ21033.shtml"],
 ["bom-qld-warnings","https://www.bom.gov.au/qld/warnings/"],
 ["qld-gov-cap","https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings_capau.xml"],
 ["wmo-web-root","https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/"]
];
const compact=(v,max=330)=>String(v??"").replace(/\s+/g," ").slice(0,max);
const matches=(str,re,n=6)=>[...str.matchAll(re)].slice(0,n).map(x=>x[1]??x[0]);
const tag=(str,name)=>(str.match(new RegExp("<(?:[\\w-]+:)?"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+name+">","i"))?.[1]??"").trim();
async function load(name,url,timeout=14000){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(timeout),redirect:"follow",headers:{"User-Agent":"StormTracker-Source-Audit/1.0 (+https://github.com/Blakesmith-Intel/StormTracker)"}});
  const body=await r.text();
  const meta={name,http:r.status,length:body.length,type:r.headers.get("content-type"),
    redirect:r.url,polygonTags:(body.match(/<(?:[\w-]+:)?polygon[\s>]/gi)||[]).length,
    areaTags:(body.match(/<(?:[\w-]+:)?area[\s>]/gi)||[]).length,
    idq21033:body.includes("IDQ21033"),idq65654:body.includes("IDQ65654"),
    scriptUrls:matches(body,/<script\b[^>]*\bsrc=["']([^"']+)/gi,13),
    nextData:/__NEXT_DATA__|__next_f|__NUXT__|window\.__INITIAL_STATE__|astro-island/i.test(body),
    endpoints:matches(body,/(?:["'])([^"'\s]{0,140}(?:\/api\/|\/warnings\/|\/warning\/|geojson|featureServer|wfs|GIS2Web)[^"'\s]{0,150})(?:["'])/gi,12).map(x=>compact(x,200)),
    svg:(body.match(/<svg\b/gi)||[]).length};
  if(name==="wmo-cap"){
   const items=[...body.matchAll(/<(?:[\w-]+:)?item\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?item>/gi)]
    .map(x=>x[1]);
   const q=items.filter(x=>/severe\s+thunderstorm|severe\s+weather|IDQ21033|IDQ21035/i.test(x));
   meta.itemCount=items.length;meta.severeItems=q.length;
   meta.top=q.slice(0,12).map(x=>({title:compact(tag(x,"title"),90),link:compact(tag(x,"link"),150),pubDate:compact(tag(x,"pubDate"),50)}));
   for(const [i,item] of q.slice(0,8).entries()){
    const link=tag(item,"link");
    if(!/^https:\/\/(severeweather\.wmo\.int|www\.bom\.gov\.au)\//.test(link))continue;
    try{
     const resp=await fetch(link,{signal:AbortSignal.timeout(11000)});
     const xml=await resp.text();
     const texts=matches(xml,/<(?:[\w-]+:)?(?:event|headline|areaDesc)\b[^>]*>([^<]*)/gi,4);
     const notice=parseBomCapProductNotice(xml,{nowMs:Date.now()});
     const polygons=parseOfficialBomCap(xml,{nowMs:Date.now()});
     console.log("CAP_MODEL",JSON.stringify({index:i,recognized:!!notice,
       code:notice?.productCode,status:notice?.status,
       headlineLength:notice?.headline?.length??0,adviceLength:notice?.instruction?.length??0,
       bulletinUrl:notice?.bulletinUrl,originalPolygons:polygons.length}));
     console.log("CAP_ITEM",JSON.stringify({index:i,http:resp.status,length:xml.length,
      identifier:compact(tag(xml,"identifier"),130),sender:compact(tag(xml,"sender"),80),
      status:compact(tag(xml,"status"),45),msgType:compact(tag(xml,"msgType"),45),
      sent:tag(xml,"sent"),expires:tag(xml,"expires"),
      events:texts.map(s=>compact(s,120)),polygonCount:(xml.match(/<(?:[\w-]+:)?polygon[\s>]/gi)||[]).length,
      circleCount:(xml.match(/<(?:[\w-]+:)?circle[\s>]/gi)||[]).length,
      web:compact(tag(xml,"web"),160),
      descriptionChars:tag(xml,"description").length,instructionChars:tag(xml,"instruction").length,
      areaDescriptionCount:(xml.match(/<(?:[\\w-]+:)?areaDesc[\\s>]/gi)||[]).length,
      geocodeTags:(xml.match(/<(?:[\\w-]+:)?geocode[\\s>]/gi)||[]).length,
      resourceTags:(xml.match(/<(?:[\\w-]+:)?resource[\\s>]/gi)||[]).length,
      codeRefs:(xml.match(/ID[QDNVSW]\\d{5}/gi)||[]).slice(0,14)}));
    }catch(e){console.log("CAP_ITEM_ERROR",JSON.stringify({index:i,error:String(e).slice(0,120)}));}
   }
  }
  if(name==="bom-warning"){
   meta.bomImgLinks=matches(body,/<img[^>]*src=["']([^"']+)/gi,6);
   meta.embeddedProductId=matches(body,/IDQ21033.{0,90}/gi,4).map(x=>compact(x,90));
   meta.hasInlineSourceGeo=/\bcoordinates\b|featureCollection|<polygon|\bgeometry\b/i.test(body);
  }
  console.log("SOURCE",JSON.stringify(meta));
 }catch(e){console.log("SOURCE_ERROR",JSON.stringify({name,error:String(e).slice(0,150)}));}
}
for(const [name,url] of targets)await load(name,url);
