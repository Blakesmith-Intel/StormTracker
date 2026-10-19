// BoM Queensland flood stages, keyed strictly by Bureau station ID.
export const FLOOD_LEVEL_SOURCE="https://www.bom.gov.au/qld/flood/networks/section4.shtml";
export const FLOOD_LEVEL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-flood-thresholds";
// Exact authoritative fallback station IDs, not name-based matches.
export const VERIFIED_FLOOD_LEVELS={
  "bom:535142":{minor:6,moderate:9,major:12},
  "bom:035271":{minor:6,moderate:9,major:12}
};
const number=v=>v===null||v===undefined||v===""?null:
  Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1000?Number(v):null;
export function cleanFloodLevels(value){
  if(!value||typeof value!=="object")return null;
  const minor=number(value.minor),moderate=number(value.moderate),major=number(value.major);
  if(minor===null||(moderate!==null&&moderate<minor)||
     (major!==null&&major<(moderate??minor)))return null;
  return {minor,moderate,major};
}
export function parseQldOfficialFloodLevels(html){
  // Official BoM Section 4 fixed-column 2022 network table.
  // No confusion with bridge, grazing, town or first-report heights.
  const s=String(html??"");
  const pre=s.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1]??s;
  const lines=pre.replace(/<br\s*\/?\s*>/gi,"\n")
    .replace(/<[^>]*>/g,"").replace(/&nbsp;|&#160;/gi," ").split(/\r?\n/);
  const out={};
  for(const line of lines){
    const id=line.slice(31,37);
    if(!/^\d{6}$/.test(id)||line[37]!==" ")continue;
    const get=(a,b)=>{
      const v=line.slice(a,b).trim();
      return /^\d+(?:\.\d+)?$/.test(v)?number(v):null;
    };
    const levels=cleanFloodLevels({minor:get(81,90),moderate:get(97,106),major:get(113,121)});
    if(levels)out["bom:"+id]=levels;
  }
  return out;
}
export function stationFloodLevels(feature,catalog={}){
  const id=String(feature?.id??""),p=feature?.properties??{};
  return cleanFloodLevels(catalog?.[id])??
    cleanFloodLevels({minor:p.STORMTRACKER_MINOR_FLOOD_METRES,
      moderate:p.STORMTRACKER_MODERATE_FLOOD_METRES,
      major:p.STORMTRACKER_MAJOR_FLOOD_METRES})??
    VERIFIED_FLOOD_LEVELS[id]??null;
}
export function withStationFloodLevels(features,catalog={}){
  return (features??[]).map(f=>{
    const t=stationFloodLevels(f,catalog);
    return t?{...f,properties:{...f.properties,
      STORMTRACKER_MINOR_FLOOD_METRES:t.minor,
      STORMTRACKER_MODERATE_FLOOD_METRES:t.moderate,
      STORMTRACKER_MAJOR_FLOOD_METRES:t.major,
      STORMTRACKER_THRESHOLD_SOURCE:FLOOD_LEVEL_SOURCE
    }}:f;
  });
}
export function observedFloodClass(height,levels){
  const t=cleanFloodLevels(levels);
  if(!t||typeof height!=="number"||!Number.isFinite(height))return undefined;
  if(height<t.minor)return null;
  if(t.major!==null&&height>=t.major)return "major";
  if(t.moderate!==null&&height>=t.moderate)return "moderate";
  return "minor";
}
