// Official BoM 2016 IFD point-depth retrieval. No nearest-neighbour substitution.
const BASE="https://www.bom.gov.au/water/designRainfalls/revised-ifd/";
const DURATIONS=new Set([1,2,3,4,5,10,15,20,25,30,45,60,90,120,180,270,360,540,720,1080,1440]);
const clean=s=>String(s).replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim();
export function parseOfficialIfdPoint(html){
 if(!/IFD\s+Design\s+Rainfall\s+Depth/i.test(html)||
    !/Annual Exceedance Probability/i.test(clean(html)))
   throw Error("Official BoM IFD depth table missing");
 for(const match of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){
  const table=match[0];
  if(!["20","10","5","2","1"].every(a=>new RegExp("\\b"+a+"\\s*%").test(clean(table))))continue;
  const depthsMmByMinutes={};
  for(const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1]));
   if(cells.length<8||/factor/i.test(cells[0]))continue;
   const duration=cells[0].match(/^(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h|days?|d)\b/i);
   if(!duration)continue;
   const unit=duration[2].toLowerCase();
   const minutes=Number(duration[1])*(unit.startsWith("min")?1:unit.startsWith("d")?1440:60);
   if(!DURATIONS.has(minutes))continue;
   const vals=cells.slice(-5).map(v=>/^\d+(?:\.\d+)?$/.test(v)?Number(v):NaN);
   if(vals.some(x=>!Number.isFinite(x)||x<=0||x>=3000)||
     vals.some((x,i)=>i&&x<vals[i-1]))continue;
   depthsMmByMinutes[String(minutes)]=Object.fromEntries(["20","10","5","2","1"].map((a,i)=>[a,vals[i]]));
  }
  if(Object.keys(depthsMmByMinutes).length<20||!["1","5","10","15","30","45","60","1440"].every(k=>depthsMmByMinutes[k]))continue;
  const keys=Object.keys(depthsMmByMinutes).map(Number).sort((a,b)=>a-b);
  if(["20","10","5","2","1"].some(a=>keys.some((k,i)=>i&&depthsMmByMinutes[k][a]<depthsMmByMinutes[keys[i-1]][a])))continue;
  return depthsMmByMinutes;
 }
 throw Error("Complete authoritative BoM IFD point table unavailable");
}
export function officialIfdCell(value){
 if(!Number.isFinite(value))throw RangeError("Invalid IFD coordinate");
 return Number((Math.floor(Number((value/.025).toFixed(8)))*.025+.0125).toFixed(4));
}
export async function relayOfficialIfdPoint(request,url,origin,corsHeaders,errorResponse){
 if(request.method!=="GET")return errorResponse("GET required",405,origin);
 const lat=Number(url.searchParams.get("lat")),lon=Number(url.searchParams.get("lon"));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<=-30||lat>=-9||lon<=137||lon>=155||
   !/^-?\d+(?:\.\d+)?$/.test(url.searchParams.get("lat")??"")||
   !/^\d+(?:\.\d+)?$/.test(url.searchParams.get("lon")??""))
   return errorResponse("Invalid Queensland IFD coordinate",400,origin);
 const latitude=officialIfdCell(lat),longitude=officialIfdCell(lon);
 const query=new URLSearchParams({coordinate_type:"dd",latitude:String(latitude),longitude:String(longitude),
   design:"ifds",year:"2016",caveat:"true",conditions:"true",sdmin:"true",sdhr:"true",sdday:"true"});
 try{
  const response=await fetch(BASE+"?"+query,{headers:{Accept:"text/html"},
   signal:AbortSignal.timeout(18000),cf:{cacheEverything:true,cacheTtl:86400}});
  if(!response.ok)throw Error("Official IFD HTTP "+response.status);
  const size=Number(response.headers.get("content-length"))||0;
  if(size>6000000)throw Error("Oversized official IFD response");
  const body=await response.text();
  if(body.length>6000000)throw Error("Oversized official IFD response");
  const depthsMmByMinutes=parseOfficialIfdPoint(body);
  const headers=corsHeaders(origin);
  headers.set("Content-Type","application/json; charset=utf-8");
  headers.set("Cache-Control","public, max-age=86400");
  return new Response(JSON.stringify({schema:"StormTrackerBoM2016IFDPointV1",
   cell:latitude.toFixed(4)+","+longitude.toFixed(4),
   source:"Bureau of Meteorology 2016 Design Rainfall Data System",
   verifiedUtc:new Date().toISOString(),depthsMmByMinutes}),{headers});
 }catch(e){return errorResponse("Authoritative IFD unavailable: "+String(e.message).slice(0,100),503,origin)}
}
