// Assign power outages to Queensland councils by their actual published
// affected-area geometry, NEVER from a suburb name or an event-wide centroid.
// Government layer: AdministrativeBoundaries MapServer/1 (LGA polygons).
import {localityKey,lgaName,UNKNOWN_LGA}
  from "./incident-lga-model-v1.js?v=case-insensitive-lga-20261017-v2";
import {OFFICIAL_QLD_LGA_POLYGONS,officialLgaPointUrl}
  from "./outage-lga-geographic-fallback-v1.js?v=outage-spatial-councils-20261017-v1";

const valid=(p)=>Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  p[0]>=136&&p[0]<=155.5&&p[1]>=-29.7&&p[1]<=-9;
const samePoint=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
  a[0]===b[0]&&a[1]===b[1];
export function outageGeometrySignature(feature){
  const raw=JSON.stringify(feature?.geometry??null);
  // The identity covers ALL vertices, not merely the bounding rectangle.
  let hash=2166136261;
  for(let i=0;i<raw.length;i++){
    hash=Math.imul(hash^raw.charCodeAt(i),16777619)>>>0;
  }
  return raw.length+":"+hash.toString(16);
}
export function outageLgaSpatialQuery(feature){
  const geometry=feature?.geometry??{};
  const params=new URLSearchParams({
    f:"json",outFields:"lga",returnGeometry:"false",
    spatialRel:"esriSpatialRelIntersects",inSR:"4326"
  });
  if(geometry.type==="Point"&&valid(geometry.coordinates)){
    // A genuine provider point is spatial evidence for one council.
    const url=officialLgaPointUrl({
      longitude:geometry.coordinates[0],latitude:geometry.coordinates[1]
    });
    return url?{url,method:"GET",body:null,kind:"point"}:null;
  }
  let rings=[];
  if(geometry.type==="Polygon")rings=geometry.coordinates;
  else if(geometry.type==="MultiPolygon")
    rings=(geometry.coordinates??[]).flatMap(p=>p);
  else return null; // lines, nulls and fabricated centroids do not qualify
  if(!Array.isArray(rings)||!rings.length||rings.length>600)return null;
  let count=0;
  for(const ring of rings){
    if(!Array.isArray(ring)||ring.length<4||!ring.every(valid)||
       !samePoint(ring[0],ring.at(-1)))return null;
    count+=ring.length;
    if(count>20000)return null;
  }
  // POST is essential for large outage polygons: GET would exceed URL limits.
  params.set("geometryType","esriGeometryPolygon");
  params.set("geometry",JSON.stringify({
    rings,spatialReference:{wkid:4326}
  }));
  return {url:OFFICIAL_QLD_LGA_POLYGONS,method:"POST",
    body:params.toString(),kind:"provider-polygon"};
}
export function parseOutageLgaIntersection(payload){
  if(payload?.error||payload?.exceededTransferLimit||
     !Array.isArray(payload?.features))
    throw Error("Official council polygon lookup unavailable/incomplete");
  return [...new Set(payload.features.map(f=>lgaName(f?.attributes?.lga))
    .filter(x=>x&&x!==UNKNOWN_LGA))].sort((a,b)=>a.localeCompare(b,"en-AU"));
}
export async function resolveLgasForOutageGeometry(feature,{
  fetchImpl=globalThis.fetch,timeoutMs=14000
}={}){
  const request=outageLgaSpatialQuery(feature);
  if(!request)return [];
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetchImpl(request.url,{
      method:request.method,
      ...(request.body!==null?{body:request.body,
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
          Accept:"application/json"}}:
        {headers:{Accept:"application/json"}}),
      signal:controller?.signal
    });
    if(!response.ok)throw Error("Official council geometry lookup HTTP "+response.status);
    return parseOutageLgaIntersection(await response.json());
  }finally{if(timer!==null)clearTimeout(timer);}
}
export function uniqueOutageEvents(suburbGroups){
  const events=new Map();
  for(const suburb of suburbGroups??[])
    for(const item of suburb.items??[]){
      if(!events.has(item.id))events.set(item.id,item);
    }
  return events;
}
export async function resolveOutageEventLgas(suburbGroups,{
  existing=new Map(),fetchImpl=globalThis.fetch,timeoutMs=14000,
  retryEmpty=false
}={}){
  const result=new Map(existing);
  const jobs=[...uniqueOutageEvents(suburbGroups)].filter(([id,item])=>{
    const previous=existing.get(id),signature=outageGeometrySignature(item.feature);
    return previous?.signature!==signature ||
      (retryEmpty&&!previous?.councils?.length);
  });
  let index=0;
  await Promise.all(Array.from({length:Math.min(5,jobs.length)},async()=>{
    while(index<jobs.length){
      const [id,item]=jobs[index++];
      const signature=outageGeometrySignature(item.feature);
      let councils=[],verified=false;
      try{
        councils=await resolveLgasForOutageGeometry(item.feature,{fetchImpl,timeoutMs});
        verified=councils.length>0;
      }catch(error){
        // Never borrow a suburb's council or silently substitute a centroid
        // on ArcGIS failure. The event remains in the unlocated section.
        console.warn("Power outage council polygon lookup:",id,error?.message);
      }
      result.set(id,{signature,councils,verified});
    }
  }));
  return result;
}
export function groupOutagesByVerifiedGeometry(suburbGroups,
  eventLgas=new Map(),localityLgas=new Map()){
  const events=new Map();
  for(const suburb of suburbGroups??[]){
    for(const item of suburb.items??[]){
      if(!events.has(item.id))
        events.set(item.id,{item,reported:new Map()});
      events.get(item.id).reported.set(localityKey(suburb.name),suburb.name);
    }
  }
  const councils=new Map(),unlocated=[];
  const add=(name,suburbName,item)=>{
    const key=localityKey(name);
    if(!councils.has(key))councils.set(key,{
      name,key,suburbs:new Map(),items:new Map(),shared:false
    });
    const group=councils.get(key);
    const sk=localityKey(suburbName);
    if(!group.suburbs.has(sk))group.suburbs.set(sk,{
      name:suburbName,key:sk,items:[],shared:0
    });
    const s=group.suburbs.get(sk);
    if(!s.items.some(v=>v.id===item.id))s.items.push(item);
    if(item.shared)s.shared++;
    group.items.set(item.id,item);
    if(item.shared)group.shared=true;
  };
  for(const [id,{item,reported}] of events){
    const current=eventLgas.get(id);
    const validGeometry=current?.signature===outageGeometrySignature(item.feature);
    const names=validGeometry?current.councils??[]:[];
    if(!names.length){unlocated.push(item);continue;}
    const matched=new Map(names.map(name=>[localityKey(name),[]]));
    const mismatched=[];
    for(const [key,suburbName] of reported){
      const localityCouncil=localityLgas.get(key);
      const match=names.find(name=>localityKey(name)===localityKey(localityCouncil));
      if(match)matched.get(localityKey(match)).push(suburbName);
      else if(localityCouncil && localityCouncil!==UNKNOWN_LGA)
        mismatched.push(suburbName);
    }
    const enriched={...item,providerLocationConflicts:mismatched};
    for(const council of names){
      const suburbs=matched.get(localityKey(council));
      if(suburbs.length){
        for(const suburb of suburbs)add(council,suburb,enriched);
      }else add(council,"Mapped affected area",enriched);
    }
  }
  const groups=[...councils.values()].map(g=>({
    ...g,suburbs:[...g.suburbs.values()].sort((a,b)=>
      a.name.localeCompare(b.name,"en-AU")),
    items:[...g.items.values()]
  })).sort((a,b)=>a.name.localeCompare(b.name,"en-AU"));
  return {groups,unlocated};
}
