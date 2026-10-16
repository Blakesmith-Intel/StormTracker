import {floodRoadClosureSummary} from "./flood-road-closure-filter-v1.js?v=9.15.0-unplanned";
import {floodRoadClosureMarkerCoordinate} from "./flood-road-closures-v1.js?v=9.15.0-unplanned";
import {lgaName,localityKey,UNKNOWN_LGA} from "./incident-lga-model-v1.js?v=official-lga-20261017-v1";
export function groupRoadClosuresByLga(features){
 const councils=new Map(),seen=new Set();
 for(const feature of Array.isArray(features)?features:[]){
   const summary=floodRoadClosureSummary(feature),id=String(summary.id??"");
   if(!id||seen.has(id))continue;seen.add(id);
   // The QLDTraffic source explicitly reports road_summary.local_government_area.
   const name=lgaName(summary.localGovernmentArea)||UNKNOWN_LGA;
   const key=localityKey(name),locality=lgaName(summary.locality)||"Locality not supplied";
   if(!councils.has(key))councils.set(key,{key,name,suburbs:new Map(),items:[]});
   const council=councils.get(key),localityId=localityKey(locality);
   if(!council.suburbs.has(localityId))
     council.suburbs.set(localityId,{key:localityId,name:locality,items:[]});
   const item={id,summary,feature,location:floodRoadClosureMarkerCoordinate(feature)};
   council.items.push(item);
   council.suburbs.get(localityId).items.push(item);
 }
 return [...councils.values()].map(g=>({...g,suburbs:[...g.suburbs.values()]
   .sort((a,b)=>a.name.localeCompare(b.name,"en-AU"))}))
  .sort((a,b)=>a.name===UNKNOWN_LGA?1:b.name===UNKNOWN_LGA?-1:
   a.name.localeCompare(b.name,"en-AU"));
}
export function searchRoadCouncilGroups(groups,term){
 const query=lgaName(term).toLocaleLowerCase("en-AU");
 if(!query)return groups;
 return groups.map(g=>{
   if(g.name.toLocaleLowerCase("en-AU").includes(query))return g;
   const suburbs=g.suburbs.map(s=>{
     if(s.name.toLocaleLowerCase("en-AU").includes(query))return s;
     const items=s.items.filter(i=>[i.summary.roadName,i.summary.eventType,
       i.summary.eventSubtype,i.summary.eventDueTo,i.summary.advice,i.summary.direction]
       .some(v=>String(v??"").toLocaleLowerCase("en-AU").includes(query)));
     return items.length?{...s,items}:null;
   }).filter(Boolean);
   return suburbs.length?{...g,suburbs,
    items:[...new Map(suburbs.flatMap(s=>s.items).map(i=>[i.id,i])).values()]}:null;
 }).filter(Boolean);
}
