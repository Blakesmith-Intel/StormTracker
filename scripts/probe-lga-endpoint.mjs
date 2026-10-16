const base="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/2/query";
const requests=[
  ["existing",{
    where:"locality IN ('ORMEAU','CLONCURRY','GIRU')",outFields:"locality,lga",
    returnGeometry:"false",f:"json",resultRecordCount:"200"}],
  ["upper",{
    where:"UPPER(locality) IN ('ORMEAU','CLONCURRY','GIRU')",
    outFields:"locality,lga",returnGeometry:"false",f:"json",resultRecordCount:"200"}],
  ["point",{
    geometry:JSON.stringify({x:153.27,y:-27.77,spatialReference:{wkid:4326}}),
    geometryType:"esriGeometryPoint",inSR:"4326",spatialRel:"esriSpatialRelIntersects",
    outFields:"locality,lga",returnGeometry:"false",f:"json"}]
];
for(const [key,params] of requests){
 const target=new URL(base);
 for(const [a,b] of Object.entries(params))target.searchParams.set(a,b);
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
 try {
 const result=await fetch(target,{
  signal:c.signal,headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"}});
 const body=await result.text();
 console.log(JSON.stringify({query:key,status:result.status,
  cors:result.headers.get("access-control-allow-origin"),
  preview:body.slice(0,900)}));
 }catch(e){console.log(JSON.stringify({query:key,error:e.message,cause:e.cause?.message}));}
 finally{clearTimeout(timer);}
}
