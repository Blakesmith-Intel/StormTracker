// Build source-authentic QA fixtures for StormTracker's objectively selected
// live-like cyclone archive cases. No synthetic track forecasts or warnings.
// Each input is an actual QLD/BoM-sourced CycloneHistorical feature, with
// full original geometry and separate issuance versus valid UTC.
import fs from "node:fs/promises";
import path from "node:path";

const ROOT="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
const CASES=[
  {id:"alfred-2025",name:"Alfred",first:25011,year:2025,
    title:"Severe Tropical Cyclone Alfred (2025)",purpose:"Primary: prolonged SE Queensland / northern NSW, slow turns and many genuine wind issue times"},
  {id:"narelle-2026",name:"Narelle",first:26021,year:2026,
    title:"Severe Tropical Cyclone Narelle (2026)",purpose:"Stress: three cyclone wind severity bands and severe rapid development / multiple landfalls"},
  {id:"jasper-2023",name:"Jasper",first:23011,year:2023,
    title:"Severe Tropical Cyclone Jasper (2023)",purpose:"Supplemental: far-north Queensland landfall and inland decay"}
];
const out="frontend/data/cyclone-history";
await fs.mkdir(out,{recursive:true});
const iso=ms=>ms!=null&&Number.isFinite(Number(ms))?
  new Date(Number(ms)).toISOString():null;
async function query(layer){
  const params=new URLSearchParams({where:"1=1",outFields:"*",
    returnGeometry:"true",outSR:"4326",resultRecordCount:"4000",f:"geojson"});
  const url=ROOT+"/"+layer+"/query?"+params;
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
      if(!response.ok)throw Error("HTTP "+response.status);
      const json=await response.json();
      if(json.error||json.type!=="FeatureCollection"||
        !Array.isArray(json.features)||json.exceededTransferLimit)
        throw Error("Incomplete or rejected ArcGIS geoJSON: "+JSON.stringify(json.error));
      return json.features;
    }catch(error){last=error;if(attempt<3)await new Promise(r=>setTimeout(r,1000*attempt));}
  }
  throw Error("Official archived layer "+layer+" unavailable: "+String(last));
}
function validateFeature(f,name,allowed){
  if(f.type!=="Feature"||!allowed.includes(f.geometry?.type)||
     String(f.properties?.dist_name??"").toLowerCase()!==name.toLowerCase())
    throw Error("Incorrect storm identity or geometry from archive: "+name);
}
function selectedIssuances(items){
  const byIssue=new Map();
  for(const f of items){
    const when=iso(f.properties?.issue_time);
    if(!when)continue;
    const arr=byIssue.get(when)??[];arr.push(f);byIssue.set(when,arr);
  }
  const all=[...byIssue.keys()].sort();
  if(!all.length)throw Error("No original issued wind geometry");
  const picks=new Set(
    Array.from({length:7},(_,i)=>all[Math.round(i*(all.length-1)/6)])
      .filter(Boolean)
  );
  // Explicitly test a real Very Destructive product, if this archive has it.
  const severe=all.find(t=>byIssue.get(t).some(f=>
    f.properties?.wind_type==="Very Destructive"));
  if(severe)picks.add(severe);
  const richest=[...byIssue.entries()].sort((a,b)=>b[1].length-a[1].length)[0]?.[0];
  if(richest)picks.add(richest);
  return {byIssue,all,selected:[...picks].sort()};
}
for(const c of CASES){
 const [fixesSource,tracksSource,windsSource]=await Promise.all([
  query(c.first),query(c.first+1),query(c.first+2)
 ]);
 for(const f of fixesSource)validateFeature(f,c.name,["Point"]);
 for(const f of tracksSource)validateFeature(f,c.name,["LineString","MultiLineString"]);
 for(const f of windsSource)validateFeature(f,c.name,["Polygon","MultiPolygon"]);
 const fixes=fixesSource.filter(f=>["Observed","Current"].includes(f.properties.fix_type))
   .map(f=>({
     id:String(f.properties.objectid),utc:iso(f.properties.fix_time),
     position:f.geometry.coordinates.slice(0,2),
     category:f.properties.category??null,
     type:f.properties.fix_type,
     issueUtc:iso(f.properties.issue_time)
   })).filter(f=>f.utc).sort((a,b)=>a.utc.localeCompare(b.utc));
 if(fixes.length<4)throw Error("Insufficient observed fix positions for "+c.name);
 const observedTracks=tracksSource.filter(f=>
   String(f.properties?.track_type).toLowerCase()==="observed");
 let track,trackOrigin;
 if(observedTracks.length){
   trackOrigin="original-archived-observed-line";
   track=observedTracks.flatMap(f=>{
     const coords=f.geometry.coordinates;
     const lines=f.geometry.type==="MultiLineString"?coords:[coords];
     return lines.map(line=>({
       geometry:{type:"LineString",coordinates:line},
       startUtc:iso(f.properties.start_time),endUtc:iso(f.properties.end_time)
     }));
   });
 }else{
   // Valid measured best-track FIXES may be joined geometrically for QA
   // only; this is explicitly NOT an archived forecast/observed line layer.
   trackOrigin="connected-real-observed-fixes-no-archived-track";
   track=[{geometry:{type:"LineString",coordinates:fixes.map(f=>f.position)},
     startUtc:fixes[0].utc,endUtc:fixes.at(-1).utc}];
 }
 const {all,byIssue,selected}=selectedIssuances(windsSource);
 const windAreas=[];
 for(const time of selected){
   for(const f of byIssue.get(time)){
     const p=f.properties;
     windAreas.push({
       id:String(p.objectid),issueUtc:iso(p.issue_time),
       validUtc:iso(p.fix_time),forecastValidUtc:iso(p.fcast_time),
       expiryHours:p.expiry_hrs??null,
       windType:p.wind_type,marineType:p.marine_type,
       fixType:p.fix_type,geometry:f.geometry
     });
   }
 }
 if(!windAreas.length)throw Error("No source-issued areas for "+c.name);
 const source={
   schema:"stormtracker-historical-cyclone-qa-v1",
   title:c.title,id:c.id,historical:true,notLive:true,
   sources:[ROOT+"/"+c.first,ROOT+"/"+(c.first+1),ROOT+"/"+(c.first+2)],
   archiveLimitations:`An exact-vertex temporal QA subset of ${windsSource.length} source cyclone wind features across ${all.length} issues. Queensland archive may be incomplete; no unverified forecast-cone data, Yasi warnings or severe thunderstorm warnings. This historical case is not an active cyclone.`,
   purpose:c.purpose,
   kind:"observed-cyclone-archive",trackOrigin,
   track,fixes,windAreas,windAreaAvailableTimes:selected,
   totalArchivedWindAreaFeatures:windsSource.length,totalArchivedIssueTimes:all.length,
   attribution:"Queensland Government historical cyclone GIS, original BoM source"
 };
 const file=path.join(out,c.id+".json");
 await fs.writeFile(file,JSON.stringify(source));
 console.log("CASE_DATA "+JSON.stringify({case:c.id,fixes:fixes.length,
   tracks:track.length,trackOrigin,windPolygons:windAreas.length,
   allHistoricalWindPolygons:windsSource.length,sampledIssueTimes:selected.length,
   allIssueTimes:all.length,windsByType:Object.fromEntries(
    [...new Set(windAreas.map(a=>a.windType))].map(t=>[t,windAreas.filter(a=>a.windType===t).length])),
   firstFix:fixes[0].utc,lastFix:fixes.at(-1).utc,
   size:(await fs.stat(file)).size
 }));
}
