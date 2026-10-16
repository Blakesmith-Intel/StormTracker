// Read-only coverage audit for public QLD government cyclone archive.
// The output is high-level source completeness only; do not confuse archived
// wind footprints with verified official live warning/watch polygons.
const root="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
const cases=[
 ["Alfred 2025",25011],
 ["Jasper 2023",23011],
 ["Koji 2026",26011],
 ["Narelle 2026",26021],
 ["Kirrily 2024",24011],
 ["Megan 2024",24031],
 ["Debbie 2017",17011],
 ["Niran 2021",21021],
 ["Tiffany 2022",22011]
];
const msToUtc=v=>v!=null&&Number.isFinite(Number(v))?
 new Date(Number(v)).toISOString():null;
for(const [name,first] of cases){
 const stats={cyclone:name,source:"Qld CycloneHistorical MapServer",layers:{}};
 for(const [kind,offset] of [["fix",0],["track",1],["wind",2]]){
  const layer=first+offset;
  try{
   const query=new URLSearchParams({where:"1=1",outFields:"*",returnGeometry:"false",
     resultRecordCount:"4000",f:"json"});
   const response=await fetch(`${root}/${layer}/query?${query}`,{
     signal:AbortSignal.timeout(14000)});
   const data=await response.json();
   if(!response.ok||data.error)throw Error(String(response.status)+" "+JSON.stringify(data.error??"").slice(0,130));
   const records=data.features??[];
   const keys=[...new Set(records.flatMap(x=>Object.keys(x.attributes??{})))].slice(0,45);
   const attrs=records.map(x=>x.attributes??{});
   const counts=field=>Object.fromEntries([...new Set(attrs.map(a=>a[field]).filter(v=>v!=null))]
     .map(v=>[String(v),attrs.filter(a=>a[field]===v).length]).slice(0,15));
   const dates=field=>[...new Set(attrs.map(a=>msToUtc(a[field])).filter(Boolean))].sort();
   const fields=["fix_time","issue_time","fcast_time","start_time","end_time"];
   const timeline={};
   for(const field of fields){
    const d=dates(field);
    if(d.length)timeline[field]={unique:d.length,first:d[0],last:d.at(-1)};
   }
   stats.layers[kind]={sourceLayer:layer,records:records.length,
     truncated:Boolean(data.exceededTransferLimit),attributes:keys,
     fixTypes:counts("fix_type"),trackTypes:counts("track_type"),
     windTypes:counts("wind_type"),marineTypes:counts("marine_type"),
     categories:counts("category"),times:timeline};
  }catch(e){stats.layers[kind]={error:String(e)};}
 }
 console.log("CYCLONE_AUDIT "+JSON.stringify(stats));
}
