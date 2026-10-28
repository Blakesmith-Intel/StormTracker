// One-off verification: official BoM GIS2Web WFS is registered; find whether
// QLD emergency services' publicly exposed ArcGIS replica has CURRENT
// source-exact BoM severe storm polygons, not stale archived data.
const items=[
 ["qld-bom-gis-replica","https://www.arcgis.com/sharing/rest/content/items/dc27bc1fbc0e46cfba2a63c5cd3a396a?f=json"],
 ["qld-bom-gis-itemdata","https://www.arcgis.com/sharing/rest/content/items/dc27bc1fbc0e46cfba2a63c5cd3a396a/data?f=json"],
 ["bom-gis2web-data","https://www.bom.gov.au/resources/data-services"],
 ["qld-arcgis-item","https://services.arcgis.com/sharing/rest/content/items/dc27bc1fbc0e46cfba2a63c5cd3a396a?f=json"]
];
const safe=x=>String(x??"").slice(0,240);
async function query(label,url){
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"}});
  const text=await res.text();let j=null;try{j=JSON.parse(text);}catch{}
  console.log("ENDPOINT",JSON.stringify({label,status:res.status,bodyLength:text.length,
   type:res.headers.get("content-type"),error:j?.error?.message,
   serviceUrl:j?.url,modified:j?.modified,created:j?.created,
   typeKeywords:j?.typeKeywords?.slice(0,10), title:j?.title,
   resultKeys:j?Object.keys(j).slice(0,25):[],isJSON:!!j,
   htmlHeader:j?undefined:safe(text.replace(/<[^>]+>/g," "))}));
  return j;
 }catch(e){console.log("ENDPOINT_ERROR",JSON.stringify({label,error:safe(e)}));return null;}
}
let item=null;
for(const [label,url] of items){const data=await query(label,url);if(label==="qld-bom-gis-replica")item=data;}
if(item?.url){
 const u=item.url.replace(/\/+$/,"");
 const root=await query("arcgis-service-metadata",u+"?f=pjson");
 const levels=Array.isArray(root?.layers)?root.layers:[];
 console.log("LAYERS",JSON.stringify(levels.map(x=>({name:x.name,id:x.id,geometryType:x.geometryType}))));
 for(const layer of levels.filter(x=>/thunder|weather|warning/i.test(x.name)).slice(0,6)){
  const meta=await query("layer-metadata-"+layer.id,u+"/"+layer.id+"?f=pjson");
  console.log("LAYER_FIELDS",JSON.stringify({name:layer.name,id:layer.id,
   fields:meta?.fields?.map(f=>({name:f.name,type:f.type})),
   extent:meta?.extent,editingInfo:meta?.editingInfo,
   maxRecordCount:meta?.maxRecordCount}));
  const data=await query("layer-count-"+layer.id,u+"/"+layer.id+"/query?f=json&where=1%3D1&returnCountOnly=true");
  console.log("LAYER_COUNT",JSON.stringify({layer:layer.id,count:data?.count}));
  const features=await query("layer-record-"+layer.id,u+"/"+layer.id+"/query?f=json&where=1%3D1&outFields=*&returnGeometry=false&resultRecordCount=3");
  console.log("FEATURES",JSON.stringify({layer:layer.id,attrs:features?.features?.slice(0,3).map(f=>f.attributes)}));
 }
 
  const now=Date.now();
  for(const [layer,product] of [[3,"IDQ65654"],[3,"IDQ65650"],[2,"IDQ65272"],[2,"IDQ65277"]]){
   const geoUrl=u+"/"+layer+"/query?f=geojson&where="+encodeURIComponent("product='"+product+"'")+
    "&outFields="+encodeURIComponent("product,validfrom_utc,validto_utc,phenomena,warning,FMETimestamp,OBJECTID")+
    "&outSR=4326&returnGeometry=true&resultRecordCount=100";
   const features=await query("geometry-"+product,geoUrl);
   const list=features?.features??[];
   console.log("PRODUCT_GEOMETRY",JSON.stringify({product,type:features?.type,count:list.length,
      err:features?.error,geometryTypes:[...new Set(list.map(x=>x.geometry?.type))],
      live:list.filter(x=>x.properties?.validto_utc>now&&x.properties?.validfrom_utc<=now).length,
      bounds:list.map(x=>x.geometry?.coordinates?.[0]?.[0]?.[0]).slice(0,5),
      details:list.slice(0,8).map(x=>({id:x.id,properties:x.properties,
       type:x.geometry?.type,rings:x.geometry?.coordinates?.length,points:x.geometry?.coordinates?.[0]?.[0]?.length,
       example:x.geometry?.coordinates?.[0]?.[0]?.slice(0,3)}))}));
  }
}
