// Public Queensland historical cyclone geometry and BoM best-track schema
// audit. Prints schema names and a tiny sample of cyclone rows only.
const base="https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer";
for(const [name,id] of [["Koji fix",26011],["Koji track",26012],["Koji wind",26013]]){
  const controller=AbortSignal.timeout(18000);
  for(const [mode,url] of [["metadata",base+"/"+id+"?f=pjson"],["sample",base+"/"+id+"/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2&f=geojson"]]){
    try{
      const response=await fetch(url,{signal:controller});
      const data=await response.json();
      const info=mode==="metadata"?{
        name:data.name,geometryType:data.geometryType,
        copyright:data.copyrightText,fields:data.fields?.map(x=>x.name),
        maxRecordCount:data.maxRecordCount,error:data.error
      }:{
        count:data.features?.length,error:data.error,
        geometryTypes:data.features?.map(x=>x.geometry?.type),
        propertyNames:data.features?.[0]?Object.keys(data.features[0].properties??{}):[],
        firstProperties:data.features?.[0]?.properties,
        firstCoords:JSON.stringify(data.features?.[0]?.geometry?.coordinates??[]).slice(0,120)
      };
      console.log(JSON.stringify({name,mode,status:response.status,...info}));
    }catch(error){console.log(JSON.stringify({name,mode,error:String(error)}));}
  }
}
const source="https://www.bom.gov.au/clim_data/IDCKMSTM0S.csv";
try{
  const response=await fetch(source,{signal:AbortSignal.timeout(45000)});
  const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending="",rows=0,header=[],koji=[],yasi=[];
  const start=Date.now();
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    pending+=value;
    let index;
    while((index=pending.indexOf("\n"))>=0){
      const line=pending.slice(0,index).trim();pending=pending.slice(index+1);
      if(rows<18){
        console.log(JSON.stringify({bomHeaderLine:rows,text:line.slice(0,520)}));
        if(line.includes(",")&&!header.length)header=line.split(",");
      }
      if(/koji/i.test(line)&&koji.length<4)koji.push(line.slice(0,850));
      if(/yasi/i.test(line)&&yasi.length<4)yasi.push(line.slice(0,850));
      rows++;
    }
    if(Date.now()-start>30000)break;
  }
  await reader.cancel();
  console.log(JSON.stringify({bomArchiveStatus:response.status,contentType:response.headers.get("content-type"),lines:rows,koji,yasi}));
}catch(error){console.log(JSON.stringify({bomArchiveError:String(error)}));}
