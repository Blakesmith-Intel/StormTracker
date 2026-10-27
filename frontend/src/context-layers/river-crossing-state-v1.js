// Bridge/causeway/crossing references from exact BoM station IDs only.
// Neither a crossing reference nor its exceedance is an official flood class.
export const CROSSING_SCHEMA="StormTrackerBoMQldCrossingHeightsV1";
const validType=new Set(["B","C","X","R","A"]);
const validHeight=n=>typeof n==="number"&&Number.isFinite(n)&&n>=-10&&n<=300;
function cleanCrossing(value){
  if(!value||!validType.has(value.type)||!validHeight(value.heightMetres))return null;
  const fallback={B:"Published bridge",C:"Published causeway",X:"Published crossing",
    R:"Published road approaches",A:"Published approaches"};
  return {type:value.type,heightMetres:value.heightMetres,
    crossingName:String(value.crossingName||fallback[value.type]).slice(0,110),
    source:String(value.source||"BoM published crossing reference").slice(0,130)};
}
// Called on the VERIFIED HEADER of the same official table used for recent
// observations. A station-number mismatch must fail closed.
export function parseBoMStationCrossingHeader(raw,station){
  const header=String(raw??"").replace(/<br\s*\/?>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;|&#xA0;/gi," ")
    .replace(/&amp;/gi,"&").replace(/\s+/g," ");
  const identity=header.match(/Station\s*Number\s*:\s*(\d{5,7})\b/i);
  if(!identity||identity[1]!==String(station))return null;
  const label=/Crossing\s*Levels?\s*:/i.exec(header);
  if(!label)return null;
  const tail=header.slice(label.index+label[0].length).split(/Data\s+from\s+the\s+previous|About\s+this\s+table/i)[0].slice(0,700);
  const values=[];
  const pattern=/\b(Road\s+Approaches?|Approaches?|Bridge|Causeway|Crossing)\s*:\s*(-?\d{1,3}(?:\.\d{1,2})?)\s*m\b/gi;
  for(const match of tail.matchAll(pattern)){
    const heightMetres=Number(match[2]),kind=match[1].toLowerCase();
    const type=kind==="bridge"?"B":kind==="causeway"?"C":
      kind.startsWith("road ")?"R":kind.startsWith("approach")?"A":"X";
    if(validHeight(heightMetres))values.push({type,heightMetres,
      crossingName:"BoM station "+kind+" level",source:"BoM station river-height table"});
  }
  // Use the lowest published road-crossing reference for this station.
  // NEVER infer heights from graph pixels, nearby sites or dam spillways.
  values.sort((a,b)=>a.heightMetres-b.heightMetres);
  return cleanCrossing(values[0]);
}
export function publishedCrossingForFeature(feature,catalogue){
  const id=String(feature?.id??""),p=feature?.properties??{};
  if(!/^bom:\d{6}$/.test(id)||p.STORMTRACKER_IDENTITY_WARNING)return null;
  const raw=String(p.bom_stn_num??"").trim();
  if(raw&&(!/^\d{1,6}$/.test(raw)||raw.padStart(6,"0")!==id.slice(4)))return null;
  // The current station's own BoM table overrides the older 2022 catalogue.
  const fromTable=cleanCrossing(p.STORMTRACKER_PLOT_CROSSING);
  if(fromTable)return fromTable;
  if(catalogue?.schema!==CROSSING_SCHEMA)return null;
  return cleanCrossing(catalogue.entries?.[id]);
}
