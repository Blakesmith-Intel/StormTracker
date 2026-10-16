import fs from "node:fs/promises";
import path from "node:path";

// Only original observed source archives. Never manufacture forecast
// positions or claim archived cyclone wind areas are thunderstorm warnings.
const ROOT="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
const archive="https://www.bom.gov.au/clim_data/IDCKMSTM0S.csv";
const destination="frontend/data/cyclone-history";
await fs.mkdir(destination,{recursive:true});

function csvFields(line){
  const values=[];let text="",inQuotes=false;
  for(let k=0;k<line.length;k++){
    const char=line[k];
    if(char==='"'){
      if(inQuotes&&line[k+1]==='"'){text+='"';k++;}
      else inQuotes=!inQuotes;
    }else if(char===","&&!inQuotes){values.push(text.trim());text="";}
    else text+=char;
  }
  values.push(text.trim());
  return values;
}
const toUtc=value=>{
  if(!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(value))return null;
  const t=value.replace(" ","T")+":00Z";
  return Number.isFinite(Date.parse(t))?t:null;
};
const decimal=value=>value&&!isNaN(Number(value))?Number(value):null;
const fromMs=value=>typeof value==="number"&&Number.isFinite(value)?
  new Date(value).toISOString():null;

async function getJson(url){
  const r=await fetch(url,{signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw Error("GIS request "+r.status+" "+url.slice(0,125));
  const d=await r.json();
  if(d.error||!Array.isArray(d.features))throw Error("GIS rejected query "+
    JSON.stringify(d.error).slice(0,200));
  return d;
}
async function qldLayer(id,fields="*"){
  const params=new URLSearchParams({
    where:"dist_id = 'AU202526_12U'",outFields:fields,
    returnGeometry:"true",outSR:"4326",resultRecordCount:"4000",f:"geojson"
  });
  return getJson(ROOT+"/"+id+"/query?"+params);
}
const [kojiFix,kojiTrack,kojiWind]=await Promise.all([
  qldLayer(26011),qldLayer(26012),qldLayer(26013)
]);
const check=(feature,expectedType)=>{
  if(feature?.type!=="Feature"||feature.geometry?.type!==expectedType)
    throw Error("Unexpected source geometry; abort historical fixture");
  if(feature.properties?.dist_id!=="AU202526_12U"||
    feature.properties?.dist_name!=="Koji")
    throw Error("Cyclone Koji source identity mismatch");
};
for(const f of kojiFix.features)check(f,"Point");
for(const f of kojiTrack.features)check(f,"LineString");
for(const f of kojiWind.features)
  if(f.geometry?.type!=="Polygon" && f.geometry?.type!=="MultiPolygon")
    throw Error("Unexpected wind-area geometry type");

const fixPoints=kojiFix.features
  .filter(f=>f.properties?.fix_type==="Observed")
  .map(f=>({
    id:String(f.properties.objectid),
    position:f.geometry.coordinates,
    utc:fromMs(f.properties.fix_time),
    category:f.properties.category,
    type:f.properties.symbol??"Unknown"
  }))
  .filter(x=>x.utc)
  .sort((a,b)=>a.utc.localeCompare(b.utc));
if(fixPoints.length<3||kojiTrack.features.length<1)
  throw Error("No genuine Koji observed historical track");

const observedTrack=kojiTrack.features.filter(f=>
  String(f.properties?.track_type).toLowerCase()==="observed"
).map(f=>({
  geometry:f.geometry,
  startUtc:fromMs(f.properties.start_time),
  endUtc:fromMs(f.properties.end_time)
}));
if(!observedTrack.length)throw Error("Koji archive contains no observed track");

// Select up to six distinct genuine archive issue times across its history.
// This is a TEMPORAL QA SAMPLE, not a claim of complete archived warning
// coverage; retain every vertex and every severity band in chosen snapshots.
const groups=new Map();
for(const f of kojiWind.features){
  const time=fromMs(f.properties.issue_time)||
    fromMs(f.properties.fix_time);
  if(!time)continue;
  const group=groups.get(time)||[];
  group.push(f);groups.set(time,group);
}
const issueTimes=[...groups.keys()].sort();
const selected=[...new Set([0,1,2,3,4,5].map(j=>
  issueTimes[Math.round(j*(issueTimes.length-1)/5)]).filter(Boolean))];
const windAreas=[];
for(const time of selected){
  for(const f of groups.get(time)){
    const {properties:p}=f;
    windAreas.push({
      id:String(p.objectid),
      issueUtc:fromMs(p.issue_time),validUtc:fromMs(p.fix_time),
      windType:p.wind_type,marineType:p.marine_type,
      fixType:p.fix_type,geometry:f.geometry
    });
  }
}
if(windAreas.length<2)throw Error("Insufficient original Koji wind polygons");
const koji={
  schema:"stormtracker-historical-cyclone-qa-v1",
  title:"Tropical Cyclone Koji 2026",
  id:"koji-2026",
  historical:true,
  notLive:true,
  sources:[
    ROOT+"/26011",ROOT+"/26012",ROOT+"/26013",
    "https://www.bom.gov.au/cyclone/history/Koji_2026.shtml"
  ],
  archiveLimitations:"Time-sampled historical issued cyclone wind areas; archive explicitly incomplete. Not severe-thunderstorm warnings or a live forecast.",
  kind:"observed-cyclone-archive",
  track:observedTrack,
  fixes:fixPoints,
  windAreas,
  windAreaAvailableTimes:selected,
  attribution:"Queensland Government historical cyclone GIS; underlying BoM public cyclone data"
};

// BoM entire archive: read streaming and extract only exact 2011 Yasi ID.
const r=await fetch(archive,{signal:AbortSignal.timeout(60000)});
if(!r.ok)throw Error("BoM archive HTTP "+r.status);
const reader=r.body.pipeThrough(new TextDecoderStream()).getReader();
let pending="",header=null,rows=[],lineNumber=0;
let headers=[];
while(true){
  const {done,value}=await reader.read();
  pending+=value??"";
  let ix;
  while((ix=pending.indexOf("\n"))>=0){
    const line=pending.slice(0,ix).replace(/\r$/,"");
    pending=pending.slice(ix+1);lineNumber++;
    if(!header){
      if(line.startsWith("NAME,DISTURBANCE_ID,TM,")){
        headers=csvFields(line);
        header=Object.fromEntries(headers.map((n,i)=>[n,i]));
      }
      continue;
    }
    if(!line.startsWith("Yasi ,") && !line.startsWith("Yasi,"))continue;
    const cols=csvFields(line);
    if(cols[header.DISTURBANCE_ID]!=="AU201011_14U")continue;
    const utc=toUtc(cols[header.TM]);
    const lat=decimal(cols[header.LAT]),lon=decimal(cols[header.LON]);
    if(!utc||lat===null||lon===null||lat< -90||lat>90||lon< -180||lon>180)
      continue;
    rows.push({
      utc,position:[lon,lat],
      centralPressureHpa:decimal(cols[header.CENTRAL_PRES]),
      // Explicitly retain original measured source categories/fields;
      // only display category if BoM database supplies a direct field.
      cycloneType:cols[header.CYC_TYPE]??null
    });
  }
  if(done)break;
}
await reader.cancel();
rows.sort((a,b)=>a.utc.localeCompare(b.utc));
if(rows.length<8)throw Error("BoM Yasi database returned too few official observed positions");
const yasi={
  schema:"stormtracker-historical-cyclone-qa-v1",
  title:"Severe Tropical Cyclone Yasi 2011",
  id:"yasi-2011",historical:true,notLive:true,
  sources:[archive,"https://www.bom.gov.au/cyclone/history/"],
  archiveLimitations:"BoM post-storm best-track positions connected for display; connecting line is a visual join, NOT an archived cyclone forecast path or warning area. No verified historical Yasi warning polygons included.",
  kind:"bom-reanalysed-best-track",
  track:[{geometry:{type:"LineString",coordinates:rows.map(x=>x.position)},
    startUtc:rows[0].utc,endUtc:rows.at(-1).utc}],
  fixes:rows.map((r,i)=>({
    id:String(i+1),utc:r.utc,position:r.position,
    centralPressureHpa:r.centralPressureHpa,cycloneType:r.cycloneType
  })),
  windAreas:[],windAreaAvailableTimes:[],
  attribution:"Bureau of Meteorology Australian Tropical Cyclone Database (best track)"
};
await fs.writeFile(path.join(destination,"koji-2026.json"),JSON.stringify(koji));
await fs.writeFile(path.join(destination,"yasi-2011.json"),JSON.stringify(yasi));
console.log(JSON.stringify({
  status:"historical-source-snapshots-generated",
  kojiFixes:koji.fixes.length,kojiTracks:koji.track.length,
  kojiArchiveWindPolygons:windAreas.length,
  kojiWindIssueSamples:selected.length,kojiArchiveRawWindPolygons:kojiWind.features.length,
  yasiFixes:yasi.fixes.length,
  dateYasi:[rows[0].utc,rows.at(-1).utc],
  archiveColumns:headers.filter(x=>/WIND|CATEGORY|CYC_TYPE|CENTRAL_PRES/.test(x)),
  files:[
    [destination+"/koji-2026.json",(await fs.stat(destination+"/koji-2026.json")).size],
    [destination+"/yasi-2011.json",(await fs.stat(destination+"/yasi-2011.json")).size]
  ]
}));
