// Verifiable importer for Bureau of Meteorology Queensland Flood Services
// Service Level Specification v3.7 (published at the May 2026 URL).
// Extract exact 6-digit station IDs from Schedules 2/3/4 with pdftotext.
// Output excludes 2022 thresholds: a historical gauge-relative stage cannot
// be treated as the observation's AHD/height datum.
import {spawnSync} from "node:child_process";
import {writeFileSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const PDF="https://www.bom.gov.au/sites/default/files/2026-05/service-level-specification-flood-forecasting-warning-services-queensland-v3.7.pdf";
const NUM="(?:\\d+(?:\\.\\s*\\d+)?|N/A|N\\.?A\\.?)";
const rowStages=new RegExp("\\b(?:Automatic|Manual)\\s+("+NUM+")\\s+("+NUM+")\\s+("+NUM+")\\s+(?:Qualitative|Quantitative|High|Medium|Low)\\b","i");
const toNumber=s=>/^(?:N\.?A\.?|N\/A)$/i.test(s)?null:Number(s.replace(/\s+/g,""));
const canonicalKey=id=>"bom:"+id;
const normalise=s=>s.replace(/\s+/g," ").trim();
export function parseMay2026ServiceLevelSpecification(text){
  const byId={},dataOnly=new Set(),unparsed=[],duplicates=[],perSchedule={forecast:0,information:0,data:0};
  const pages=String(text).split(String.fromCharCode(12));
  for(let i=0;i<pages.length;i++){
    const page=pages[i];
    let schedule=0;
    if(/Schedule\s+2:\s*Forecast locations and levels of service/i.test(page))schedule=2;
    else if(/Schedule\s+3:\s*Information locations with flood class levels defined/i.test(page))schedule=3;
    else if(/Schedule\s+4:\s*River data locations/i.test(page))schedule=4;
    if(!schedule)continue;
    const lines=page.split(String.fromCharCode(10));
    const candidates=[];
    for(let j=0;j<lines.length;j++){
      const line=lines[j];
      const hit=line.match(/^\s*(\d{6})\s+(.+)$/);
      if(hit){candidates.push({id:hit[1],text:hit[2]});continue;}
      if(candidates.length && line.trim() && !/^(Schedule |Bureau |Flood |Minor |Moderate |Major |Station |Forecast |Priority|Page:|Service Level Specification|\d{3}\s*[–-])/i.test(line.trim()))
        candidates.at(-1).text+=" "+line.trim();
    }
    for(const item of candidates){
      const id=item.id,key=canonicalKey(id),raw=normalise(item.text);
      if(schedule===4){dataOnly.add(key);perSchedule.data++;continue;}
      const m=raw.match(rowStages);
      if(!m){
        unparsed.push({id,section:schedule,sample:raw.slice(0,180),page:i+1});
        continue;
      }
      const levels={minor:toNumber(m[1]),moderate:toNumber(m[2]),major:toNumber(m[3])};
      if(levels.minor===null)continue;
      if(!Number.isFinite(levels.minor)||
          (levels.moderate!==null&&(!Number.isFinite(levels.moderate)||levels.moderate<levels.minor))||
          (levels.major!==null&&(!Number.isFinite(levels.major)||levels.major<(levels.moderate??levels.minor))))
          throw Error("Invalid levels for "+key+" "+JSON.stringify(levels));
      const nameHint=normalise(raw.slice(0,m.index));
      const row={...levels,sourceSchedule:schedule,sourcePage:i+1,
        nameHint:nameHint.slice(0,140),heightReference:"BoM native station reading",document:"Queensland SLS v3.7"};
      if(byId[key]){
        if(["minor","moderate","major"].some(k=>byId[key][k]!==row[k])){
          duplicates.push({key,prior:byId[key],next:row});
        }
        continue;
      }
      byId[key]=row;
      perSchedule[schedule===2?"forecast":"information"]++;
    }
  }
  for(const item of duplicates)delete byId[item.key]; // never choose conflicting stage
  const dataLocations=[...dataOnly].filter(id=>!byId[id]).sort();
  return {stations:byId,dataLocations,unparsed,duplicates,perSchedule};
}
export function validateMay2026Catalog(result,{strict=true}={}){
  const count=Object.keys(result.stations).length;
  if(strict&&count<450)throw Error("Insufficient 2026 classified stations: "+count);
  if(strict&&result.duplicates.length)throw Error("Conflicting station IDs: "+JSON.stringify(result.duplicates.slice(0,5)));
  const anchor={
    "bom:540610":[98.1,100.7,102.3],
    "bom:540057":[76.2,77.7,79.2],
    "bom:539066":[111.5,115,121],
    "bom:540646":[41.5,42,42.5],
    "bom:540097":[4,5,6],
    "bom:535142":[6,9,12]
  };
  for(const [id,levels] of Object.entries(anchor)){
    const a=result.stations[id];
    if(!a||["minor","moderate","major"].some((k,i)=>a[k]!==levels[i]))
      throw Error("SLS v3.7 critical station mismatch "+id+": "+JSON.stringify(a));
  }
  if(!/NEW BEITH/i.test(result.stations["bom:540097"].nameHint))
    throw Error("540097 station identity must be NEW BEITH, not OXLEY CREEK");
  if(!/OXLEY CREEK/i.test(result.stations["bom:540646"].nameHint))
    throw Error("540646 station identity must be OXLEY CREEK");
  return true;
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  const args=process.argv.slice(2);
  let pdf;
  if(args.includes("--file")){
    const file=args[args.indexOf("--file")+1];pdf=readFileSync(file);
  }else{
    const res=await fetch(PDF,{signal:AbortSignal.timeout(45000)});
    if(!res.ok)throw Error("Official Bureau 2026 PDF HTTP "+res.status);
    pdf=Buffer.from(await res.arrayBuffer());
  }
  if(pdf.toString("ascii",0,4)!=="%PDF")throw Error("2026 source is not PDF");
  const output=spawnSync("pdftotext",["-layout","-","-"],{input:pdf,
    encoding:"utf8",maxBuffer:15*1024*1024});
  if(output.status!==0)throw Error("pdftotext failed "+String(output.stderr).slice(0,500));
  const result=parseMay2026ServiceLevelSpecification(output.stdout);
  validateMay2026Catalog(result);
  const sourceSha256=createHash("sha256").update(pdf).digest("hex");
  const sorted=Object.fromEntries(Object.entries(result.stations).sort(([a],[b])=>a.localeCompare(b)));
  const module="// Official Bureau Queensland SLS v3.7, source PDF sha256: "+sourceSha256+
    "\\n// Reconciled source-station native-level classifications by exact ID.\\n"+
    "export const BOM_2026_CLASSIFICATIONS="+JSON.stringify(sorted)+";\\n"+
    "export const BOM_2026_DATA_ONLY_STATIONS="+JSON.stringify(result.dataLocations)+";\\n";
  const audit={document:PDF,sourceSha256,importedAt:new Date().toISOString(),
    classified:Object.keys(sorted).length,dataOnly:result.dataLocations.length,
    bySchedule:result.perSchedule,ambiguous:result.duplicates,
    unparsedCount:result.unparsed.length,unparsed:result.unparsed.slice(0,100)};
  if(args.includes("--write")){
    writeFileSync("frontend/src/context-layers/river-flood-stages-2026-full-v1.js",module);
    writeFileSync("docs/BOM_2026_FLOOD_CLASSIFICATION_AUDIT.json",JSON.stringify(audit,null,2)+"\\n");
  }
  console.log("SLS_2026_AUDIT "+JSON.stringify({...audit,unparsed:undefined}));
  console.log("SLS_2026_ANCHORS "+JSON.stringify(Object.fromEntries([
    "bom:540610","bom:540057","bom:539066","bom:540646","bom:540097","bom:535142"
  ].map(id=>[id,sorted[id]]))));
}