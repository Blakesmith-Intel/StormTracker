import {parseQldOfficialFloodLevels} from "../frontend/src/context-layers/river-flood-thresholds-v1.js";
const urls=[
"https://www.bom.gov.au/qld/flood/networks/section4.shtml",
"https://reg.bom.gov.au/qld/flood/networks/section4.shtml",
"https://r.jina.ai/https://www.bom.gov.au/qld/flood/networks/section4.shtml",
"https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-flood-thresholds"];
for(const url of urls){
 const res=await fetch(url,{headers:{Origin:"https://blakesmith-intel.github.io"},
   signal:AbortSignal.timeout(20000)});
 console.log("URL",url,"HTTP",res.status,"type",res.headers.get("content-type"));
 if(!res.ok){console.log("Source unavailable",url,res.status);continue;}
 if(!url.includes("/river-flood-thresholds")){
  const html=await res.text();
  console.log("BoM length",html.length,"header",JSON.stringify(html.slice(0,180)));
  for(const id of ["535142","544058","540319","540054","540640","040846"]){
   const line=html.split(String.fromCharCode(10)).find(x=>x.includes(id));
   console.log("Raw line",id,JSON.stringify(line?.slice(0,145)??"MISSING"));
   if(line){
     console.log("  Indexed fields",JSON.stringify(line.slice(26,40)),
       JSON.stringify(line.slice(73,95)),JSON.stringify(line.slice(95,112)),
       JSON.stringify(line.slice(112,132)));
     console.log("  ID index",line.indexOf(id),"char37",JSON.stringify(line[37]),
       "cols",line.length);
   }
  }
  const levels=parseQldOfficialFloodLevels(html);
  console.log("BoM parser matched",Object.keys(levels).length,
    "stations, samples",JSON.stringify(Object.fromEntries(
      ["bom:535142","bom:544058","bom:540319","bom:540054","bom:540640","bom:040846"].map(k=>[k,levels[k]]))));
 }else{
  const j=await res.json();
  console.log("Relay official count",j.statewideThresholdCount,
    "complete",j.complete,"delivered",Object.keys(j.thresholds||{}).length,
    "keys",JSON.stringify(Object.fromEntries(["bom:535142","bom:544058",
      "bom:540319","bom:540054"].map(k=>[k,j.thresholds?.[k]]))));
 }
}
