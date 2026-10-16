// Bounded one-time audit of a genuinely public Queensland Historical Cyclone
// ArcGIS MapServer. Never confuse these archived observed geometries with a
// current Bureau forecast track or official warnings.
const root="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
for(const [type,id] of [["fix",25011],["track",25012],["wind",25013]]){
  for(const detail of ["metadata","sample"]){
    const query=new URLSearchParams({
      where:"1=1",outFields:"*",returnGeometry:"true",
      outSR:"4326",resultRecordCount:"2",f:"geojson"
    });
    const url=detail==="metadata"?root+"/"+id+"?f=pjson":
      root+"/"+id+"/query?"+query;
    const res=await fetch(url,{signal:AbortSignal.timeout(18000)});
    const data=await res.json();
    if(detail==="metadata"){
      console.log(JSON.stringify({type,detail,status:res.status,name:data.name,
        geometryType:data.geometryType,
        fields:data.fields?.map(f=>({name:f.name,type:f.type})),
        supportedQueryFormats:data.supportedQueryFormats,
        copyright:data.copyrightText,error:data.error,
        capabilities:data.capabilities}));
    }else{
      console.log(JSON.stringify({type,detail,status:res.status,
        featureCount:data.features?.length,geometryTypes:data.features?.map(f=>f.geometry?.type),
        sampleProperties:data.features?.map(f=>f.properties),error:data.error,
        firstCoordinate:data.features?.map(f=>JSON.stringify(f.geometry?.coordinates)?.slice(0,70))
      }));
    }
  }
}
