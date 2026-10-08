// Public-only source discovery. Do not use restricted CAD or login-based data.
// Diagnostic prints provenance and published layer renderers, never private events.
const targets=[
 "https://www.fire.qld.gov.au/Current-Incidents",
 "https://www.fire.qld.gov.au/Incident-Dashboard",
 "https://www.arcgis.com/sharing/rest/content/items/b4fa7d3984464dd7aa60c268d279f54e?f=json",
 "https://www.arcgis.com/sharing/rest/content/items/b4fa7d3984464dd7aa60c268d279f54e/data?f=json",
 "https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/ESCAD_Current_Incidents_Public/FeatureServer/0?f=json"
];
async function request(url) {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),14000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json,text/html;q=0.9"}});
  if(!r.ok)throw Error("HTTP "+r.status);
  return {final:r.url,text:await r.text(),type:r.headers.get("content-type")};
 }finally{clearTimeout(timer);}
}
function ids(s){return [...new Set([...String(s).matchAll(/\b[a-f0-9]{32}\b/ig)].map(x=>x[0]))].slice(0,45);}
function renderers(obj,depth=0,path="root",found=[]) {
 if(!obj||typeof obj!=="object"||depth>20||found.length>65)return found;
 if(obj?.renderer||obj?.symbol||obj?.uniqueValueInfos||obj?.drawingInfo){
  found.push({path,keys:Object.keys(obj).slice(0,15),renderer:obj.renderer?.type||obj.drawingInfo?.renderer?.type||null,
    symbols:(obj.uniqueValueInfos||obj.renderer?.uniqueValueInfos||obj.drawingInfo?.renderer?.uniqueValueInfos||[])
      .filter(x=>/RESCUE|ASSIST PUBLIC/i.test(x.value||x.label||""))
      .slice(0,15).map(x=>({value:x.value,label:x.label,type:x.symbol?.type,url:x.symbol?.url,imageDataLength:x.symbol?.imageData?.length}))});
 }
 if(Array.isArray(obj))for(let i=0;i<obj.length&&i<100;i++)renderers(obj[i],depth+1,path+"["+i+"]",found);
 else for(const [k,v] of Object.entries(obj))renderers(v,depth+1,path+"."+k,found);
 return found;
}
const itemIDs=new Set(["b4fa7d3984464dd7aa60c268d279f54e"]);
for(const url of targets) {
 try {
  const r=await request(url); let obj=null;
  try{obj=JSON.parse(r.text)}catch{}
  const refs=ids(r.text);
  for(const id of refs)if(itemIDs.size<40)itemIDs.add(id);
  console.log("PUBLIC_SOURCE",JSON.stringify({url: r.final,bytes:r.text.length,type:r.type,refIds:refs,
    iframe:[...r.text.matchAll(/<iframe\b[^>]*>/gi)].map(x=>x[0].slice(0,600)).slice(0,8),
    metadata:{type:obj?.type,title:obj?.title,access:obj?.access},
    renderers:renderers(obj).slice(0,12)}));
 }catch(e){console.log("PUBLIC_SOURCE_ERROR",url,String(e).slice(0,350));}
}
for(const id of [...itemIDs].slice(0,30)){
 try{
  const url="https://www.arcgis.com/sharing/rest/content/items/"+id+"?f=json";
  const a=JSON.parse((await request(url)).text);
  if(!a?.id || !["Web Map","Web Mapping Application","Dashboard","Web Experience","Feature Service","Map Service"].includes(a.type))continue;
  console.log("PUBLIC_ITEM",JSON.stringify({id,type:a.type,title:a.title,access:a.access}));
  if(a.type==="Web Map"||a.type==="Web Experience"||a.type==="Dashboard"){
   const d=await request("https://www.arcgis.com/sharing/rest/content/items/"+id+"/data?f=json");
   let data=JSON.parse(d.text);
   console.log("PUBLIC_ITEM_CONFIG",JSON.stringify({id,refs:ids(d.text),renderers:renderers(data).slice(0,15),
    operationalLayers:(data?.operationalLayers||[]).slice(0,20).map(x=>({id:x.id,title:x.title,url:x.url,layerType:x.layerType,itemId:x.itemId,rendererType:x.layerDefinition?.drawingInfo?.renderer?.type}))}));
  }
 }catch(e){console.log("PUBLIC_ITEM_ERROR",id,String(e).slice(0,180));}
}
