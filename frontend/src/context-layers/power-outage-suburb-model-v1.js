// Presentation-only projections of the EXISTING currently-filtered outage layer.
// Never fetches a second feed, reclassifies events, or allocates affected
// customers across suburbs when a provider reports one shared event.
import {powerOutageSummary} from "./power-outages-v1.js?v=9.13.4";

const blank="Suburb not supplied";
export function splitOutageSuburbs(value){
  if(Array.isArray(value)){
    return [...new Set(value.flatMap(splitOutageSuburbs))];
  }
  // Provider field is usually a delimited list; never split suburb names on
  // spaces, hyphens, ampersands or slashes (e.g. 'Mermaid Waters').
  const names=String(value??"")
    .split(/[,;|\n]+/)
    .map(x=>x.replace(/\s+/g," ").trim())
    .filter(Boolean);
  if(!names.length)return [blank];
  const unique=new Map();
  for(const name of names)unique.set(name.toLocaleLowerCase("en-AU"),name);
  return [...unique.values()];
}
export function groupOutagesBySuburb(features){
  const groups=new Map();
  const seen=new Set();
  for(const feature of Array.isArray(features)?features:[]){
    const summary=powerOutageSummary(feature);
    if(summary.type!=="UNPLANNED")continue;
    const id=String(summary.id||"");
    if(!id || seen.has(id))continue;
    seen.add(id);
    const suburbs=splitOutageSuburbs(summary.suburbs);
    for(const suburb of suburbs){
      const key=suburb.toLocaleLowerCase("en-AU");
      if(!groups.has(key))groups.set(key,{key,name:suburb,items:[],shared:0});
      const group=groups.get(key);
      group.items.push({
        id,summary,feature,shared:suburbs.length>1
      });
      if(suburbs.length>1)group.shared++;
    }
  }
  return [...groups.values()].sort((a,b)=>
    a.name.localeCompare(b.name,"en-AU",{sensitivity:"base",numeric:true}));
}
export function filterOutageSuburbGroups(groups,query){
  const term=String(query||"").toLocaleLowerCase("en-AU").trim();
  if(!term)return groups;
  return groups.map(group=>{
    if(group.name.toLocaleLowerCase("en-AU").includes(term))return group;
    const items=group.items.filter(item=>
      [item.summary.provider,item.summary.streets,item.summary.eventId,
        item.summary.reason,item.summary.status]
        .some(v=>String(v||"").toLocaleLowerCase("en-AU").includes(term)));
    return items.length?{...group,items}:null;
  }).filter(Boolean);
}
// GeoJSON geometries are already in lon/lat. Centre is a navigation aid,
// not a surveyed premise, route or guaranteed outage centre.
export function outageLocation(feature){
  const geometry=feature?.geometry;
  if(!geometry || !Array.isArray(geometry.coordinates))return null;
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity,count=0;
  const visit=(value,depth)=>{
    if(depth>7 || !Array.isArray(value))return;
    if(typeof value[0]==="number" && typeof value[1]==="number"){
      const [lon,lat]=value;
      if(Number.isFinite(lon)&&Number.isFinite(lat)&&
          lon>=110&&lon<=160&&lat>=-45&&lat<=-8){
        west=Math.min(west,lon);east=Math.max(east,lon);
        south=Math.min(south,lat);north=Math.max(north,lat);count++;
      }
      return;
    }
    for(const nested of value)visit(nested,depth+1);
  };
  visit(geometry.coordinates,0);
  if(!count)return null;
  return {longitude:(west+east)/2,latitude:(south+north)/2};
}
