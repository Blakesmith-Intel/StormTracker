// Read-only current flood and published road-crossing report.
// Never classify an unmatched gauge by name or by its neighbour's level.
import {stationFloodLevels,observedFloodClass}
 from "./river-flood-thresholds-v1.js?v=20261020-new-beith-ahd-v2";
import {parseQueenslandObservationTime,FLOOD_SIGNAL_MAX_AGE_MS}
 from "./river-flood-signals-v1.js?v=9.13.2";
export const FLOOD_CROSSINGS_SCHEMA="StormTrackerBoMQldCrossingHeightsV1";
const grades=new Set(["major","moderate"]);
const finite=v=>typeof v==="number"&&Number.isFinite(v);
export function buildNotableFloodGaugeReport(features,catalogue,now=Date.now()){
 const entries=catalogue?.schema===FLOOD_CROSSINGS_SCHEMA?
  catalogue.entries??{}:{};
 const rows=new Map(),excludedStale=[];
 for(const f of features??[]){
  const id=String(f?.id??""),p=f?.properties??{};
  if(!/^(bom|awrc):[a-z0-9_-]+$/i.test(id))continue;
  const height=p.STORMTRACKER_HEIGHT_METRES;
  if(!finite(height))continue;
  const reportedTime=Number(p.STORMTRACKER_OFFICIAL_OBSERVED_AT);
  const observedAt=finite(reportedTime)&&reportedTime>0&&reportedTime<=now+5*60000
   ?reportedTime:parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,now);
  if(!finite(observedAt)||now-observedAt>FLOOD_SIGNAL_MAX_AGE_MS||
     observedAt>now+5*60000){excludedStale.push(id);continue;}
  const measured=observedFloodClass(height,stationFloodLevels(f));
  const originalClass=String(p.STORMTRACKER_FLOOD_CLASS??"").trim().toLowerCase();
  // Measured station-specific official thresholds beat repeated old
  // bulletin classes; if stages unavailable, trust only a current published
  // moderate/major class, never infer from another gauge.
  const floodClass=measured!==undefined?measured:originalClass;
  const stageNotable=grades.has(floodClass);
  const sourceNum=id.startsWith("bom:")?id.slice(4):null;
  const rawNum=String(p.bom_stn_num??"").trim();
  const consistentId=sourceNum && (!rawNum || /^\d{1,6}$/.test(rawNum)&&
    rawNum.padStart(6,"0")===sourceNum) && !p.STORMTRACKER_IDENTITY_WARNING;
  const crossing=consistentId?entries[id]:null;
  const crossingValid=crossing&&["B","C","X"].includes(crossing.type)&&
    finite(crossing.heightMetres);
  const crossed=Boolean(crossingValid && height>=crossing.heightMetres);
  if(!stageNotable&&!crossed)continue;
  const severity=floodClass==="major"?"major":
    floodClass==="moderate"?"moderate":"crossing";
  const row={
   id,name:String(p.name??f.name??id),
   latitude:Number(f.geometry?.coordinates?.[1]),
   longitude:Number(f.geometry?.coordinates?.[0]),
   heightMetres:height,observedAt,
   tendency:String(p.STORMTRACKER_TENDENCY??""),
   floodClass:grades.has(floodClass)?floodClass:
     ["minor","below-minor"].includes(floodClass)?floodClass:"unclassified",
   severity,bridgeOrCausewayReached:crossed,
   crossing:crossingValid?{
    name:String(crossing.crossingName??"Published crossing"),
    type:crossing.type,levelMetres:crossing.heightMetres,
    amountAboveMetres:Math.round((height-crossing.heightMetres)*100)/100
   }:null,
   sourceProduct:String(p.STORMTRACKER_SOURCE_PRODUCT??"")
  };
  const previous=rows.get(id);
  if(!previous||row.observedAt>previous.observedAt)rows.set(id,row);
 }
 const byPriority={major:0,moderate:1,crossing:2};
 const ranked=[...rows.values()].sort((a,b)=>
  byPriority[a.severity]-byPriority[b.severity]||
  Number(b.bridgeOrCausewayReached)-Number(a.bridgeOrCausewayReached)||
  a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 return {
  total:ranked.length,
  groups:[{key:"major",title:"Major flooding",rows:ranked.filter(x=>x.severity==="major")},
   {key:"moderate",title:"Moderate flooding",rows:ranked.filter(x=>x.severity==="moderate")},
   {key:"crossing",title:"Published bridge / causeway / crossing level reached",
    rows:ranked.filter(x=>x.severity==="crossing")}],
  crossedCount:ranked.filter(x=>x.bridgeOrCausewayReached).length,
  excludedStaleCount:excludedStale.length,
  crossingSourceAvailable:catalogue?.schema===FLOOD_CROSSINGS_SCHEMA,
  crossingSourceDate:catalogue?.sourceDate??null
 };
}
