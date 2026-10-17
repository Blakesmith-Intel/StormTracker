// Temporary source discovery. DO NOT publish source coordinates or products.
// Qld Govt's archive is officially marked OBSERVED ONLY; never relabel.
const base="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
async function run(name,url,seconds=14){
 const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),seconds*1000);
 try{
  const r=await fetch(url,{signal:ac.signal});
  const data=await r.json();
  const arr=data.features??[],one=arr[0]??{};
  const typeCounts={};
  for(const x of arr){
   const p=x.properties??x.attributes??{};
   const type=String(p.fix_type??p.track_type??p.wind_type??p.area_type??p.windType??"unclassified");
   typeCounts[type]=(typeCounts[type]??0)+1;
  }
  console.log(JSON.stringify({name,http:r.status,features:arr.length,
    properties:one.properties??one.attributes??null,geometryType:one.geometry?.type??null,
    geometryExample:one.geometry?.type==="Point"?one.geometry.coordinates:
      one.geometry?.type==="LineString"?one.geometry.coordinates?.slice(0,3):
      one.geometry?.type==="Polygon"?one.geometry.coordinates?.[0]?.slice(0,2):null,
    typeCounts,error:data.error??null}));
 }catch(e){console.log(JSON.stringify({name,error:String(e).slice(0,350)}))}
 finally{clearTimeout(timer);}
}
for(const [label,id] of [["Jasper fixes",23011],["Jasper observed tracks",23012],["Jasper wind",23013],
 ["Alfred fixes",25011],["Alfred observed tracks",25012],["Alfred wind",25013]]){
 const url=base+"/"+id+"/query?"+new URLSearchParams({
   where:"1=1",outFields:"*",returnGeometry:"true",outSR:"4326",
   f:"geojson",resultRecordCount:"4000"});
 await run(label,url);
}
for(const [label,id] of [["Jasper fixes structure",23011],["Jasper track structure",23012],
 ["Alfred fixes structure",25011],["Alfred track structure",25012]]){
 await run(label,base+"/"+id+"?f=pjson");
}
for(const [label,url]of [
 ["Wayback 2023 Jasper GML","https://web.archive.org/cdx/search/cdx?url=ftp.bom.gov.au/anon/gen/fwo/IDQ65248.gml&output=json&filter=statuscode:200&filter=timestamp:202312&collapse=timestamp:6"],
 ["Wayback 2025 Alfred GML","https://web.archive.org/cdx/search/cdx?url=ftp.bom.gov.au/anon/gen/fwo/IDQ65248.gml&output=json&filter=statuscode:200&filter=timestamp:202503&collapse=timestamp:6"]]){
 const ac=new AbortController();const timeout=setTimeout(()=>ac.abort(),6000);
 try{
 const resp=await fetch(url,{signal:ac.signal});
 console.log(JSON.stringify({name:label,http:resp.status,head:(await resp.text()).slice(0,380)}));
 }catch(e){console.log(JSON.stringify({name:label,error:String(e).slice(0,200)}))}
 finally{clearTimeout(timeout)}
}
