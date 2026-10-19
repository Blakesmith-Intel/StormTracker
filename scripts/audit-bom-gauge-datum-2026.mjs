// Per-station production audit. 2026 authoritative table categories must
// cover each live BoM ID as forecast, classified information, data only,
// or explicitly unmatched. Do NOT infer an LGA, flood class or datum by name.
import {writeFileSync} from "node:fs";
import {BOM_2026_CLASSIFICATIONS,BOM_2026_DATA_ONLY_STATIONS}
  from "../frontend/src/context-layers/river-flood-stages-2026-full-v1.js";
import {parseQueenslandObservationTime}
  from "../frontend/src/context-layers/river-flood-signals-v1.js";
import {observedFloodClass}
  from "../frontend/src/context-layers/river-flood-thresholds-v1.js";
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const id=value=>{
  const v=String(value??"").trim();
  return /^\\d{1,6}$/.test(v)?"bom:"+v.padStart(6,"0"):null;
};
async function load(path){
  const res=await fetch(base+path,{
    headers:{Accept:"application/json",Origin:"https://blakesmith-intel.github.io"},
    signal:AbortSignal.timeout(25000)
  });
  if(!res.ok)throw Error(path+" source HTTP "+res.status);
  return res.json();
}
const now=Date.now();
const metadata=await load("/river-gauge-metadata");
const bulletins=await load("/river-height-bulletins");
const officialDataOnly=new Set(BOM_2026_DATA_ONLY_STATIONS);
const features=(metadata.features??[]).filter(f=>
  String(f.properties?.state??"").toUpperCase()==="QLD"&&f.geometry?.type==="Point");
if(features.length<100)throw Error("BoM live gauge metadata incomplete: "+features.length);
const all=new Map();
for(const f of features){
 const station=id(f.properties?.bom_stn_num);
 if(!station)continue;
 if(all.has(station))throw Error("Duplicate BoM station ID in live metadata "+station);
 const record=BOM_2026_CLASSIFICATIONS[station];
 all.set(station,{name:String(f.properties?.name??""),kind:record?
    (record.sourceSchedule===2?"forecast":"information"):
    officialDataOnly.has(station)?"data-only":"unmatched",
  sourceProduct:null,observedHeight:null,observedAt:null,
  explicitClass:null,measuredStage:null,datumWarning:null,
  minor:record?.minor??null,moderate:record?.moderate??null,
  major:record?.major??null});
}
for(const prod of bulletins.products??[])
 for(const o of prod.observations??[]){
   const station=id(o.stationId),site=all.get(station);
   if(!site||!Number.isFinite(o.heightMetres))continue;
   const at=parseQueenslandObservationTime(o.observedText,now);
   if(at===null||(site.observedAt!==null&&at<=site.observedAt))continue;
   site.observedAt=at;site.observedHeight=o.heightMetres;
   site.explicitClass=o.floodClass||null;site.sourceProduct=o.sourceProduct||prod.product||null;
   if(site.kind==="information"||site.kind==="forecast"){
     const stage=observedFloodClass(o.heightMetres,BOM_2026_CLASSIFICATIONS[station]);
     site.measuredStage=stage??(stage===null?"below-minor":null);
     if(["minor","moderate","major"].includes(site.explicitClass)&&
         stage!==site.explicitClass)
       site.datumWarning="Official reported class disagrees with newest measured height versus SLS 2026; do not assume datum equivalence";
   }
 }
const allStations=[...all].sort(([a],[b])=>a.localeCompare(b)).map(([station,s])=>({station,...s}));
const byKind=Object.fromEntries(["forecast","information","data-only","unmatched"].map(kind=>
 [kind,allStations.filter(s=>s.kind===kind).length]));
const warnings=allStations.filter(s=>s.datumWarning).map(s=>({
  station:s.station,name:s.name,measured:s.observedHeight,official:s.explicitClass,
  calculated:s.measuredStage,reason:s.datumWarning
}));
const audit={format:"StormTracker2026LiveBoMGaugeAuditV1",
  source:"Official BoM QLD SLS v3.7, Schedule 2/3/4 and live matched source observations",
  auditedAt:new Date().toISOString(),totalLiveLocations:features.length,
  uniqueBomStations:all.size,byKind,
  stations:allStations,datumConflicts:warnings,
  unmatchedCount:byKind.unmatched};
if(process.argv.includes("--write"))
  writeFileSync("docs/BOM_2026_GAUGE_COVERAGE_AUDIT.json",JSON.stringify(audit,null,2)+"\\n");
console.log("LIVE_2026_COVERAGE "+JSON.stringify({totalLiveLocations:features.length,
  uniqueBomStations:all.size,byKind,datumConflictCount:warnings.length,
  unmatchedExamples:allStations.filter(s=>s.kind==="unmatched").slice(0,16).map(s=>s.station),
  conflicts:warnings.slice(0,20)}));
