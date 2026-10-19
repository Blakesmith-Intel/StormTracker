// BoM Queensland 2026 flood-class stages, keyed ONLY by exact BoM station ID.
// Published table: Queensland Flood Forecasting & Warning Services SLS v3.7.
// All stages and current BoM height observations are in each station's native
// reporting reference; do not mix different gauges or historical AHD offsets.
import {BOM_2026_CLASSIFICATIONS,BOM_2026_DATA_ONLY_STATIONS}
  from "./river-flood-stages-2026-full-v1.js?v=20261020-sls-2026-clean-v2";

export const OFFICIAL_MAY_2026_STAGES_URL=
  "https://www.bom.gov.au/sites/default/files/2026-05/service-level-specification-flood-forecasting-warning-services-queensland-v3.7.pdf";
export const BOM_2026_VERIFIED_CLASSIFICATION_COUNT=
  Object.keys(BOM_2026_CLASSIFICATIONS).length;
export const BOM_2026_DATA_ONLY_COUNT=BOM_2026_DATA_ONLY_STATIONS.length;

// Only genuinely unmatched Warilda ALERT is carried from BoM's published
// older network table. It is labelled as historical; it can never supersede
// a station classified by SLS 2026. No spatial/name-derived thresholds.
export const HISTORICAL_EXACT_ID_EXCEPTIONS=Object.freeze({
  "bom:544058":Object.freeze({minor:3,moderate:4,major:5})
});
const dataOnlyIds=new Set(BOM_2026_DATA_ONLY_STATIONS);
const normaliseNumber=value=>{
  if(value===null||value===undefined||value==="")return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0&&n<=1000?n:null;
};
export function cleanFloodLevels(value){
  if(!value||typeof value!=="object")return null;
  const minor=normaliseNumber(value.minor);
  const moderate=normaliseNumber(value.moderate);
  const major=normaliseNumber(value.major);
  if(minor===null&&moderate===null&&major===null)return null;
  if(minor!==null&&moderate!==null&&moderate<minor)return null;
  if(major!==null&&(moderate??minor)!==null&&major<(moderate??minor))return null;
  return {minor,moderate,major};
}
function exactStationId(feature){
  const id=String(feature?.id??"");
  if(!/^bom:\d{6}$/.test(id))return null;
  const source=String(feature?.properties?.bom_stn_num??"").trim();
  if(source&&(!/^\d{1,6}$/.test(source)||
      source.padStart(6,"0")!==id.slice(4)))return null;
  return id;
}
export function stationFloodLevels(feature){
  const id=exactStationId(feature);
  if(!id||dataOnlyIds.has(id))return null;
  return cleanFloodLevels(BOM_2026_CLASSIFICATIONS[id])??
    cleanFloodLevels(HISTORICAL_EXACT_ID_EXCEPTIONS[id])??null;
}
export function withStationFloodLevels(features){
  return (features??[]).map(feature=>{
    const id=exactStationId(feature);
    const properties={...feature.properties};
    // Replace, never merge, previously cached 2022 or other gauges' levels.
    for(const key of ["STORMTRACKER_MINOR_FLOOD_METRES",
      "STORMTRACKER_MODERATE_FLOOD_METRES",
      "STORMTRACKER_MAJOR_FLOOD_METRES",
      "STORMTRACKER_THRESHOLD_SOURCE",
      "STORMTRACKER_THRESHOLD_SOURCE_DATE",
      "STORMTRACKER_THRESHOLD_STATUS",
      "STORMTRACKER_IDENTITY_WARNING"])delete properties[key];
    const levels=stationFloodLevels(feature);
    const modern=Boolean(id&&BOM_2026_CLASSIFICATIONS[id]);
    const historical=Boolean(id&&HISTORICAL_EXACT_ID_EXCEPTIONS[id]&&!modern);
    properties.STORMTRACKER_THRESHOLD_VERIFIED=modern;
    properties.STORMTRACKER_THRESHOLD_STATUS=modern?"2026-station-native":
      historical?"historical-exact-id-caution":
      id&&dataOnlyIds.has(id)?"2026-data-only":"2026-station-not-reconciled";
    properties.STORMTRACKER_2026_OFFICIAL_NAME=
      id?BOM_2026_CLASSIFICATIONS[id]?.nameHint??"":"";
    if(id==="bom:540097"&&/oxley/i.test(String(properties.name??"")))
      properties.STORMTRACKER_IDENTITY_WARNING=
        "540097 is NEW BEITH in BoM SLS, not Oxley Creek";
    if(!id&&String(feature?.id??"").startsWith("bom:"))
      properties.STORMTRACKER_IDENTITY_WARNING=
        "BoM source station ID disagrees with the mapped gauge ID";
    if(levels){
      properties.STORMTRACKER_MINOR_FLOOD_METRES=levels.minor;
      properties.STORMTRACKER_MODERATE_FLOOD_METRES=levels.moderate;
      properties.STORMTRACKER_MAJOR_FLOOD_METRES=levels.major;
      properties.STORMTRACKER_THRESHOLD_SOURCE=modern?
        OFFICIAL_MAY_2026_STAGES_URL:
        "https://www.bom.gov.au/qld/flood/networks/section4.shtml";
      properties.STORMTRACKER_THRESHOLD_SOURCE_DATE=
        modern?"2026-05":"2022-01-05";
    }
    return {...feature,properties};
  });
}
export function observedFloodClass(height,levels){
  const t=cleanFloodLevels(levels);
  if(!t||typeof height!=="number"||!Number.isFinite(height))
    return undefined;
  if(t.major!==null&&height>=t.major)return "major";
  if(t.moderate!==null&&height>=t.moderate)return "moderate";
  if(t.minor===null)return undefined;
  return height<t.minor?null:"minor";
}
