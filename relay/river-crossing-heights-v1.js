// Read-only official BoM Queensland Section 5 (5 January 2022).
// Type B=bridge; C=causeway; X=road crossing. R=road approaches,
// A=approaches, S=spillway, F=dam and T=tide are deliberately excluded.
// This is a station-specific published reference, NOT a road-closure signal.
export const QLD_CROSSING_SOURCE=
 "https://www.bom.gov.au/qld/flood/networks/section5.shtml";
export const QLD_CROSSING_SCHEMA="StormTrackerBoMQldCrossingHeightsV1";
export const QLD_CROSSING_SOURCE_DATE="2022-01-05";
export function parseBomQueenslandCrossings(html){
 const raw=String(html??"");
 if(!/DETAILS\s+OF\s+CROSSINGS/i.test(raw.replace(/<[^>]*>/g," "))) 
   throw Error("Official BoM crossing table heading missing");
 const text=raw.replace(/<br\s*\/?>/gi,"\n")
  .replace(/<\/(?:div|pre|p|tr|table)>/gi,"\n")
  .replace(/<[^>]+>/g,"")
  .replace(/&nbsp;|&#160;|&#xA0;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/\r/g,"");
 const entries={};
 const conflicting=new Set();
 for(const line of text.split("\n")){
  const row=line.replace(/[\t ]+/g," ").trim();
  // Keep a source row intact; never join an unrelated wrapped station or
  // accept a height from the next station's line.
  const m=row.match(/(?:^|\s)(\d{6})\s+(.{3,155}?)\s+(-?\d{1,3}(?:\.\d{1,2})?)\s+([BCX])(?:\s+(.{0,105}))?$/);
  if(!m)continue;
  const id="bom:"+m[1],height=Number(m[3]),type=m[4];
  if(!Number.isFinite(height)||height< -10||height>300)continue;
  const name=String(m[5]??"").trim().slice(0,100);
  const entry={heightMetres:height,type,
    crossingName:name||({B:"Published bridge",C:"Published causeway",X:"Published crossing"})[type]};
  if(entries[id] && (entries[id].heightMetres!==height||entries[id].type!==type))
   conflicting.add(id);
  else entries[id]=entry;
 }
 for(const id of conflicting)delete entries[id];
 return entries;
}
export async function relayQldCrossingHeights(request,origin,corsHeaders,errorResponse){
 if(request.method!=="GET"&&request.method!=="HEAD")
  return errorResponse("GET required",405,origin);
 try{
  const result=await fetch(QLD_CROSSING_SOURCE,{
   headers:{Accept:"text/html"},
   signal:AbortSignal.timeout(16000),
   cf:{cacheEverything:true,cacheTtl:86400}
  });
  if(!result.ok)throw Error("BoM crossings HTTP "+result.status);
  const html=await result.text();
  if(html.length>2000000)throw Error("Oversized BoM crossing reference");
  const entries=parseBomQueenslandCrossings(html);
  if(Object.keys(entries).length<40)
   throw Error("Official BoM crossing reference incomplete");
  const headers=new Headers(corsHeaders(origin));
  headers.set("Content-Type","application/json;charset=utf-8");
  headers.set("Cache-Control","public,max-age=3600");
  return new Response(request.method==="HEAD"?null:JSON.stringify({
   schema:QLD_CROSSING_SCHEMA,source:QLD_CROSSING_SOURCE,
   sourceDate:QLD_CROSSING_SOURCE_DATE,
   retrievedAt:new Date().toISOString(),entries
  }),{status:200,headers});
 }catch(error){
  return errorResponse("BoM crossing reference unavailable: "+
   String(error?.message??error).slice(0,150),503,origin);
 }
}
