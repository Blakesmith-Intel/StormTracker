// BoM Queensland flood stages, keyed strictly by Bureau station ID.
import {OFFICIAL_QLD_FLOOD_THRESHOLDS_2022}
  from "./river-flood-thresholds-snapshot-v1.js?v=20261020-qld-bom-stages-v1";
import {VERIFIED_MAY_2026_STAGES,OFFICIAL_MAY_2026_STAGES_URL}
  from "./river-flood-stages-2026-verified-v1.js?v=20261020-2026-gauge-datum-v1";
export const VERIFIED_STATEWIDE_FLOOD_LEVELS=OFFICIAL_QLD_FLOOD_THRESHOLDS_2022;
export const FLOOD_LEVEL_SOURCE="https://www.bom.gov.au/qld/flood/networks/section4.shtml";
export const FLOOD_LEVEL_FETCH_SOURCE="https://reg.bom.gov.au/qld/flood/networks/section4.shtml";
export const FLOOD_LEVEL_SOURCE_DATE="2022-01-05";
export const FLOOD_LEVEL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-flood-thresholds";
// Exact authoritative fallback station IDs, not name-based matches.
export const VERIFIED_FLOOD_LEVELS={
  "bom:535142":{minor:6,moderate:9,major:12},
  "bom:035271":{minor:6,moderate:9,major:12},
  "bom:544058":{minor:3,moderate:4,major:5},
  "bom:044208":{minor:3,moderate:4,major:5}
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
  const conflicts=new Set();
  for(const line of lines){
    const id=line.slice(27,33);
    if(!/^\d{6}$/.test(id)||line[33]!==" ")continue;
    const get=(a,b)=>{
      const v=line.slice(a,b).trim();
      return /^\d+(?:\.\d+)?$/.test(v)?number(v):null;
    };
    // Strict fixed-width FLOOD columns: crops (88..95) and town impacts
    // (105..111) are different fields and must never become flood levels.
    const levels=cleanFloodLevels({
      minor:get(80,87),moderate:get(96,104),major:get(111,120)
    });
    if(levels){
      const key="bom:"+id;
      if(conflicts.has(key))continue;
      if(out[key]&&JSON.stringify(out[key])!==JSON.stringify(levels)){
        delete out[key];conflicts.add(key);
      }else out[key]=levels;
    }
  }
  return out;
}
export function stationFloodLevels(feature,catalog={}){
  const id=String(feature?.id??""),p=feature?.properties??{};
  // Explicit newer BoM May 2026 station classifications supersede
  // historical 2022 bulletin table values AND stale cached feature fields.
  return cleanFloodLevels(VERIFIED_MAY_2026_STAGES[id])??
    cleanFloodLevels(catalog?.[id])??
    cleanFloodLevels({minor:p.STORMTRACKER_MINOR_FLOOD_METRES,
      moderate:p.STORMTRACKER_MODERATE_FLOOD_METRES,
      major:p.STORMTRACKER_MAJOR_FLOOD_METRES})??
    cleanFloodLevels(VERIFIED_STATEWIDE_FLOOD_LEVELS[id])??
    VERIFIED_FLOOD_LEVELS[id]??null;
}
export function withStationFloodLevels(features,catalog={}){
  return (features??[]).map(f=>{
    const t=stationFloodLevels(f,catalog);
    return t?{...f,properties:{...f.properties,
      STORMTRACKER_MINOR_FLOOD_METRES:t.minor,
      STORMTRACKER_MODERATE_FLOOD_METRES:t.moderate,
      STORMTRACKER_MAJOR_FLOOD_METRES:t.major,
      STORMTRACKER_THRESHOLD_SOURCE:VERIFIED_MAY_2026_STAGES[String(f?.id??"")]?
        OFFICIAL_MAY_2026_STAGES_URL:FLOOD_LEVEL_SOURCE,
      STORMTRACKER_THRESHOLD_SOURCE_DATE:
        VERIFIED_MAY_2026_STAGES[String(f?.id??"")]?"2026-05":FLOOD_LEVEL_SOURCE_DATE
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
