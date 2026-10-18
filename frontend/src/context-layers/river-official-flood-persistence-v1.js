// Offline/browser-only persistence of source-CONFIRMED flood-class stations.
// Never match by site name. Any newer BoM below-minor observation clears its
// own exact station ID. A stale missing observation is NOT proof of recovery.
import {parseQueenslandObservationTime} from "./river-flood-signals-v1.js?v=20261018-inland-rise";

export const OFFICIAL_FLOOD_STORAGE_KEY="stormtracker.qld-confirmed-flood-stations.v1";
const officialLevels=new Set(["minor","moderate","major"]);
const normalised=value=>String(value??"").trim().toLowerCase();
const stationId=id=>/^(bom|awrc):[a-z0-9_-]+$/i.test(String(id??""));
const validPoint=f=>{
  const p=f?.properties??{};
  const lon=Number(p.long??f?.geometry?.coordinates?.[0]);
  const lat=Number(p.lat??f?.geometry?.coordinates?.[1]);
  return f?.geometry?.type==="Point" && Number.isFinite(lon) &&
    Number.isFinite(lat) && lon>=137 && lon<=154.5 && lat>=-29.5 && lat<=-9;
};
function confirmedObservationAt(f,now){
  const p=f?.properties??{};
  const saved=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  if(Number.isFinite(saved)&&saved>0&&saved<=now+5*60000)return saved;
  return parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
}
function safeRecord(id,record,now){
  const f=record?.feature??record;
  const observedAt=Number(record?.observedAt);
  if(!stationId(id)||String(f?.id)!==String(id)||!validPoint(f) ||
      !officialLevels.has(normalised(f?.properties?.STORMTRACKER_FLOOD_CLASS))||
      !Number.isFinite(observedAt)||observedAt<=0||
      observedAt>now+5*60000)return null;
  return {observedAt,feature:{
    ...f,properties:{...f.properties,
      STORMTRACKER_OFFICIAL_OBSERVED_AT:observedAt}
  }};
}
export function cleanConfirmedFloodStations(input,now=Date.now()){
  const cache={};
  if(!input||typeof input!=="object"||Array.isArray(input))return cache;
  for(const [id,record] of Object.entries(input).slice(0,500)){
    const valid=safeRecord(id,record,now);
    if(valid)cache[id]=valid;
  }
  return cache;
}

// Reuse the last *observed* official classification when a source stops
// reporting. A station must report an explicitly newer below-minor reading to
// be removed. On a new higher/lower official classification, replace the
// record; do not infer recovery from an empty list or an upstream failure.
export function retainConfirmedFloodStations(features,previous={},now=Date.now()){
  const cache=cleanConfirmedFloodStations(previous,now);
  const current=new Map();
  for(const feature of features??[]){
    const id=String(feature?.id??"");
    if(!stationId(id)||!validPoint(feature))continue;
    const p=feature.properties??{};
    const observedAt=confirmedObservationAt(feature,now);
    const previousAt=cache[id]?.observedAt??-Infinity;
    const flood=normalised(p.STORMTRACKER_FLOOD_CLASS);
    if(Number.isFinite(observedAt) && observedAt>=previousAt){
      if(officialLevels.has(flood)){
        cache[id]=safeRecord(id,{observedAt,feature},now);
      }else if(flood==="below-minor"){
        delete cache[id];
      }
    }
    current.set(id,feature);
  }
  for(const [id,record] of Object.entries(cache)){
    // If the latest source observation is not newer than the saved official
    // flood reading, restore only that previously source-backed record.
    const f=current.get(id);
    const t=f?confirmedObservationAt(f,now):null;
    const level=normalised(f?.properties?.STORMTRACKER_FLOOD_CLASS);
    if(!f || !Number.isFinite(t) || t<record.observedAt ||
       (!officialLevels.has(level)&&level!=="below-minor")){
      current.set(id,record.feature);
    }else if(officialLevels.has(level) && t>=record.observedAt){
      current.set(id,{...f,properties:{...f.properties,
        STORMTRACKER_OFFICIAL_OBSERVED_AT:t}});
    }
  }
  // Browser snapshot contains ONLY the stations that have either a current
  // source observation or previously authenticated official flood status.
  return {features:[...current.values()],cache};
}
