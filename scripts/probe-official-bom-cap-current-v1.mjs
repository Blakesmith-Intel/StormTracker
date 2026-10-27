// Single live-source capability audit for the optional severe-warning feature.
// Never log warning text, issue bulletin contents, or personal data.
import {bomCapRssLinks,parseOfficialBomCap}
 from "../frontend/src/context-layers/bom-warning-cap-source-v1.js";
const rssUrl="https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml";
const nowMs=Date.now();
try{
 const response=await fetch(rssUrl,{signal:AbortSignal.timeout(17000)});
 const xml=await response.text();
 const links=bomCapRssLinks(xml,{nowMs});
 console.log(JSON.stringify({source:"WMO-authority-BoM-CAP",http:response.status,
   contentType:response.headers.get("content-type"),rssValid:true,
   recentSevereWarningCandidates:links.length,nowUtc:new Date(nowMs).toISOString()}));
 let checked=0,actualCap=0,activeGenuine=0;
 for(const url of links.slice(0,6)){
  checked++;
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(12000)});
   const content=await r.text();
   const valid=content.includes("<")&&/(?:<|:)alert[\s>]/i.test(content);
   if(valid)actualCap++;
   const compact=key=>(content.match(new RegExp("<(?:[\\w-]+:)?"+key+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+key+">","i"))?.[1]??"").trim();
   const sent=Date.parse(compact("sent")),expires=Date.parse(compact("expires"));
   const context={issuerVerified:/bom\.gov\.au/i.test(compact("sender"))||
     /Bureau of Meteorology/i.test(compact("senderName")),
     statusActual:/^actual$/i.test(compact("status")),
     msgTypeUpdateOrAlert:/^(update|alert)$/i.test(compact("msgType")),
     eventThunderstorm:/severe\s+thunderstorm/i.test(compact("event")),
     eventSevereWeather:/severe\s+weather/i.test(compact("event")),
     issuedAgeHours:Number.isFinite(sent)?Math.round((nowMs-sent)/3600000):null,
     expiryRemainingHours:Number.isFinite(expires)?Math.round((expires-nowMs)/3600000):null,
     originalPolygonElements:(content.match(/<(?:[\w-]+:)?polygon[\s>]/gi)||[]).length,
     hasSourceWeb:/bom\.gov\.au/i.test(compact("web")),
     hasInfo:/(?:<|:)info[\s>]/i.test(content)};
   const accepted=valid?parseOfficialBomCap(content,{nowMs}):[];
   console.log(JSON.stringify({candidate:checked,diagnostics:context}));
   activeGenuine+=accepted.length;
   console.log(JSON.stringify({candidate:checked,http:r.status,capFormat:valid,
     activeVerifiedPolygons:accepted.length,
     hasOriginalVertices:accepted.some(w=>w.geometry?.coordinates?.length>0)}));
  }catch(e){console.log(JSON.stringify({candidate:checked,error:String(e).slice(0,90)}));}
 }
 console.log("BOM_CAP_SOURCE_RESULT "+JSON.stringify({feedReachable:true,
  actualCapDocuments:actualCap,activeGenuinePolygons:activeGenuine,
  limitation:links.length===0?"No recent severe-warning CAP candidates in RSS":"Authentic CAP may not include valid BoM weather warning polygons at sample time"}));
}catch(e){
 console.log("BOM_CAP_SOURCE_RESULT "+JSON.stringify({feedReachable:false,
  error:String(e).slice(0,160)}));
}
