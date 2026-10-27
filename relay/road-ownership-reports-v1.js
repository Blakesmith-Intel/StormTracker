// Read-only QLDTraffic HTML reports: same event IDs as events_v2.geojson.
// This feed NEVER changes StormTracker's existing unplanned/all-traffic filter.
const REPORT_URLS=Object.freeze({
 operational:"https://data.qldtraffic.qld.gov.au/htmlreports/operationalstatus.html",
 highways:"https://data.qldtraffic.qld.gov.au/htmlreports/statehighways.html"
});
export const ROAD_OWNERSHIP_SCHEMA="StormTrackerQLDTrafficRoadClassV1";
const clean=text=>String(text??"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
 .replace(/<[^>]*>/g," ").replace(/&(?:nbsp|#160|#xA0);/gi," ")
 .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
 .replace(/\s+/g," ").trim();
const cellsOf=row=>[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
 .map(x=>clean(x[1]));
const rowsOf=html=>[...String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
 .map(x=>cellsOf(x[1])).filter(x=>x.length);
const validId=value=>/^\d{5,9}$/.test(String(value??"").trim());
const update=(acc,id,kind)=>{
 const prior=acc[id]??{state:false,local:false,highway:false};
 prior[kind]=true;acc[id]=prior;
};
// The official operational report's penultimate field is "Affects
// state-controlled road" (Yes/No). There may be several road segments per
// event. Never classify from road-name suffixes or geography.
export function parseOperationalRoadReport(html){
 const src=String(html??"");
 if(!/Operational Status of (?:QUEENSLAND|Queensland) Road Network/i.test(clean(src))||
    !/Affects state-controlled road/i.test(clean(src)))
   throw Error("QLDTraffic operational report identity/columns unverified");
 const out={};
 for(const c of rowsOf(src)){
   if(c.length<9||!validId(c[0]))continue;
   const flag=c.at(-2)?.trim().toLowerCase();
   if(flag==="yes")update(out,c[0],"state");
   else if(flag==="no")update(out,c[0],"local");
 }
 if(!Object.keys(out).length)throw Error("No verifiable operational event IDs");
 return out;
}
export function parseStateHighwaysReport(html){
 const src=String(html??"");
 if(!/State Controlled Highways and Motorways Report/i.test(clean(src))||
    !/Closure\/Restriction Reason/i.test(clean(src)))
   throw Error("QLDTraffic state-highways report identity unverified");
 const ids=new Set();
 for(const c of rowsOf(src)){
   if(c.length<5)continue;
   // Last data cell is "Id", not the road name, date or image.
   const id=c.at(-1);
   if(validId(id))ids.add(id);
 }
 return ids;
}
export function buildRoadOwnershipSnapshot(operationalHtml,highwaysHtml,checkedAt=new Date().toISOString()){
 const flags=parseOperationalRoadReport(operationalHtml);
 const highways=parseStateHighwaysReport(highwaysHtml);
 for(const id of highways)update(flags,id,"highway");
 const entries={};
 for(const [id,value] of Object.entries(flags)){
   // Official highway/motorway membership overrides an operational row
   // showing "No" for affects-state-controlled-road (e.g. Donohue Hwy).
   // Conflicting operational Yes/No rows alone are genuinely ambiguous.
   entries[id]=value.highway?"state-highway":
     value.state&&value.local?"unverified":
     value.state?"state-controlled":value.local?"local":"unverified";
 }
 return {schema:ROAD_OWNERSHIP_SCHEMA,checkedAt,source:"QLDTraffic TMR",
   sources:REPORT_URLS,entries};
}
export async function relayRoadOwnershipReports(request,origin,corsHeaders,errorResponse){
 const urls=[REPORT_URLS.operational,REPORT_URLS.highways];
 const responses=await Promise.allSettled(urls.map(url=>fetch(url,{
   headers:{Accept:"text/html"},signal:AbortSignal.timeout(17000),
   cf:{cacheTtl:300,cacheEverything:true}
 })));
 if(responses.some(r=>r.status==="rejected"||!r.value.ok))
   return errorResponse("QLDTraffic ownership reports unavailable",502,origin);
 try{
   const text=await Promise.all(responses.map(r=>r.value.text()));
   if(text.some(x=>x.length>4000000||x.length<150))
     throw Error("Unexpected HTML report length");
   const payload=buildRoadOwnershipSnapshot(text[0],text[1]);
   const headers=corsHeaders(origin);
   headers.set("Content-Type","application/json; charset=utf-8");
   headers.set("Cache-Control","public, max-age=300");
   return new Response(request.method==="HEAD"?null:JSON.stringify(payload),{
     status:200,headers
   });
 }catch(error){
   return errorResponse("QLDTraffic road classification source could not be validated",502,origin);
 }
}
