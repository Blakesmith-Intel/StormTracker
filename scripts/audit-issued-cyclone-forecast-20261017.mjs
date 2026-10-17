// SOURCE DISCOVERY ONLY: BoM-attributed, publicly hosted historic original
// forecast issue fields and BoM public sample directory. Do not infer polygons.
// Remove the CI hook when the audit has been read.
const HOST="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
const fetchWithTimeout=async(url,seconds=12)=>{
 const c=new AbortController();const t=setTimeout(()=>c.abort(),seconds*1000);
 try{return await fetch(url,{signal:c.signal,headers:{Accept:"application/json,*/*"}})}
 finally{clearTimeout(t)}
};
const args=[
 [25011,"Alfred 2025 position fixes",["objectid","fix_time","time_offset","fix_type","category","fcast_time","issue_time","expiry_hrs","dist_name"]],
 [25012,"Alfred 2025 forecast/past track",["objectid","track_type","start_time","end_time","fcast_time","issue_time","expiry_hrs","dist_name"]],
 [26011,"Koji 2026 position fixes",["objectid","fix_time","time_offset","fix_type","category","fcast_time","issue_time","dist_name"]],
 [26012,"Koji 2026 track",["objectid","track_type","start_time","end_time","fcast_time","issue_time","dist_name"]]
];
const iso=ms=>ms?new Date(ms).toISOString():null;
for(const [id,label,columns]of args){
 try{
  const url=new URL(HOST+"/"+id+"/query");
  url.search=new URLSearchParams({where:"1=1",outFields:columns.join(","),returnGeometry:"true",outSR:"4326",f:"geojson",resultRecordCount:"200"});
  const res=await fetchWithTimeout(url);
  const txt=await res.text();const data=JSON.parse(txt);
  const feats=data.features??[];
  const kinds={};const issues=new Set(), forecasts=0;
  for(const x of feats){
   const p=x.properties??{};const k=String(p.fix_type??p.track_type??"?");kinds[k]=(kinds[k]??0)+1;
   if(p.issue_time)issues.add(iso(p.issue_time));
  }
  // Prefer a feature labelled FORECAST, not a retrospective best track;
  // coordinates are original BoM-sourced geographic vertices.
  const chosen=feats.filter(f=>/forecast|predicted|future/i.test(String(f.properties?.fix_type??f.properties?.track_type??"")))
   .slice(0,4).map(f=>({attributes:f.properties,
    geometry:f.geometry?.type,
    coordinates:f.geometry?.type==="Point"?f.geometry.coordinates:
      f.geometry?.type==="LineString"?f.geometry.coordinates.slice(0,8):null}));
  console.log(JSON.stringify({label,id,status:res.status,returned:feats.length,kinds,issueCount:issues.size,issueSamples:[...issues].slice(0,5),actualForecastExamples:chosen,arcgisError:data.error??null}));
 }catch(e){console.log(JSON.stringify({label,error:String(e).slice(0,350)}))}
}
const sampleHosts=[
 "ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/",
 "https://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/",
 "https://www.bom.gov.au/cyclone/cxmlinfo/CXML_example.xml"
];
for(const url of sampleHosts){
 try{const r=await fetchWithTimeout(url,7);let b=(await r.text()).slice(0,65000);
  const names=[...new Set([...b.matchAll(/(?:href=["']([^"']+)["']|\b(ID[QDWN]\d{5}[^\s<]+))/ig)]
   .map(x=>x[1]||x[2]))].slice(0,35);
  console.log(JSON.stringify({resource:url,status:r.status,type:r.headers.get("content-type"),sampleLength:b.length,
   root:b.match(/<([A-Za-z_][\w:.-]*)\b/)?.[1]??null,sampleLinks:names}));
 }catch(e){console.log(JSON.stringify({resource:url,error:String(e).slice(0,160)}));}
}
