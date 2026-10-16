// Fallback when the Queensland Government Locality layer has no usable name
// match (provider may report stations, informal settlements or route names).
// Uses the SAME Queensland Government Administrative Boundaries service's
// authoritative Local government POLYGON layer (ID 1) and its spatial query.
import {localityKey,UNKNOWN_LGA,lgaName,resolveQueenslandLocalityLgas}
 from "./incident-lga-model-v1.js?v=case-insensitive-lga-20261017-v2";
import {outageLocation} from "./power-outage-suburb-model-v1.js?v=suburb-explorer-20261017-v1";

export const OFFICIAL_QLD_LGA_POLYGONS=
 "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/1/query";

export function officialLgaPointUrl(location){
 const lon=Number(location?.longitude),lat=Number(location?.latitude);
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||
   lon<136||lon>156||lat> -9||lat< -30)return "";
 const url=new URL(OFFICIAL_QLD_LGA_POLYGONS);
 url.searchParams.set("f","json");
 url.searchParams.set("geometry",JSON.stringify({
   x:lon,y:lat,spatialReference:{wkid:4326}
 }));
 url.searchParams.set("geometryType","esriGeometryPoint");
 url.searchParams.set("inSR","4326");
 url.searchParams.set("spatialRel","esriSpatialRelIntersects");
 url.searchParams.set("outFields","lga");
 url.searchParams.set("returnGeometry","false");
 return url.href;
}
export function parseOfficialLgaPoint(payload){
 if(payload?.error||payload?.exceededTransferLimit||!Array.isArray(payload?.features))
  throw Error("Incomplete government LGA boundary response");
 const unique=[...new Set(payload.features.map(feature=>lgaName(feature?.attributes?.lga)).filter(Boolean))];
 return unique.length===1?unique[0]:UNKNOWN_LGA;
}
export async function resolveQueenslandLgaAtPoint(location,{
 fetchImpl=globalThis.fetch,timeoutMs=11000
}={}){
 const url=officialLgaPointUrl(location);
 if(!url)return UNKNOWN_LGA;
 const controller=typeof AbortController==="function"?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
 try{
   const res=await fetchImpl(url,{
     headers:{Accept:"application/json"},signal:controller?.signal
   });
   if(!res.ok)throw Error("LGA boundary lookup HTTP "+res.status);
   return parseOfficialLgaPoint(await res.json());
 }finally{if(timer!==null)clearTimeout(timer);}
}
function eventIndex(suburbGroups){
 const events=new Map();
 for(const suburb of suburbGroups||[])
  for(const item of suburb.items||[]){
   if(!events.has(item.id))events.set(item.id,{suburbs:new Set(),item});
   events.get(item.id).suburbs.add(localityKey(suburb.name));
  }
 return events;
}
export function fallbackPointForSuburb(suburb,suburbGroups,officialLookup){
 // A shared outage polygon may span several councils. Its single centre
 // is not sufficient to assign a missing suburb to that centre's LGA.
 const all=eventIndex(suburbGroups);
 for(const item of suburb.items||[]){
   const event=all.get(item.id);
   if(!event)continue;
   const known=new Set([...event.suburbs].map(key=>officialLookup.get(key))
     .filter(name=>name&&name!==UNKNOWN_LGA));
   if(known.size>1)continue;
   // For a multi-locality event, a point may be used only as corroboration
   // of an already verified single council. Never infer it from the point
   // alone when there are no independently resolved suburbs.
   if(event.suburbs.size>1&&known.size===0)continue;
   const point=outageLocation(item.feature);
   if(!point)continue;
   return {point,requiredCouncil:known.size===1?[...known][0]:null};
 }
 return null;
}
export async function resolveOutageCouncilNames(unresolved,suburbGroups,{
  fetchImpl=globalThis.fetch,timeoutMs=11000,existing=new Map()
}={}){
 const names=[...new Set(unresolved.map(localityKey))];
 if(!names.length)return new Map();
 const official=await resolveQueenslandLocalityLgas(names,{fetchImpl,timeoutMs});
 const joined=new Map([...existing,...official]);
 const pending=names.filter(key=>official.get(key)===UNKNOWN_LGA);
 const byKey=new Map((suburbGroups||[]).map(s=>[localityKey(s.name),s]));
 // Deduplicate repeated event-point requests; at most 3 concurrent requests.
 const placeCache=new Map();
 const jobs=pending.map(key=>{
  const option=fallbackPointForSuburb(byKey.get(key)||{items:[]},suburbGroups,joined);
  return {key,option};
 });
 let next=0;
 const workers=Array.from({length:Math.min(3,jobs.length)},async()=>{
   while(next<jobs.length){
     const {key,option}=jobs[next++];
     if(!option)continue;
     const positionKey=[option.point.longitude.toFixed(5),option.point.latitude.toFixed(5)].join(",");
     if(!placeCache.has(positionKey))
       placeCache.set(positionKey,resolveQueenslandLgaAtPoint(option.point,{fetchImpl,timeoutMs})
         .catch(error=>{console.warn("LGA boundary fallback unavailable:",error.message);return UNKNOWN_LGA;}));
     const name=await placeCache.get(positionKey);
     if(name!==UNKNOWN_LGA&&(!option.requiredCouncil||
       localityKey(name)===localityKey(option.requiredCouncil)))
       official.set(key,name);
   }
 });
 await Promise.all(workers);
 return official;
}
