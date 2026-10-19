import {qualifiesRainfallSnapshot,rainfallBand} from "./significant-rainfall-source-v1.js";
export const SIGNIFICANT_RAINFALL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-significant-rainfall";
export const SIGNIFICANT_RAINFALL_REFRESH_MS=300000;
const $=id=>document.getElementById(id);
const marker=(band)=>{
 const color=band==="red"?"#d92d35":"#ed871b";
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 54">'+
 '<path d="M22 2C12 16 5 24 5 34a17 17 0 0 0 34 0C39 24 32 16 22 2Z" '+
 'fill="'+color+'" stroke="#192934" stroke-width="2.6"/>'+
 '<path d="M15 34q0 8 8 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'+
 '</svg>';
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
};
function formatted(iso){
 if(!iso||!Number.isFinite(Date.parse(iso)))return "Unverified";
 return new Intl.DateTimeFormat("en-AU",{
  timeZone:"Australia/Brisbane",day:"2-digit",month:"short",year:"numeric",
  hour:"2-digit",minute:"2-digit",hour12:false,timeZoneName:"short"
 }).format(new Date(iso));
}
function detailRow(holder,label,value){
 const key=document.createElement("span"),val=document.createElement("strong");
 key.textContent=label;val.textContent=String(value);
 holder.append(key,val);
}
export function initialiseOperationalSignificantRainfall({
 viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
 now=()=>Date.now(),refreshMs=SIGNIFICANT_RAINFALL_REFRESH_MS
}={}){
 if(!viewer||!CesiumRef)throw Error("Rainfall layer requires Cesium viewer");
 const checkbox=$("showSignificantRainfall"),select=$("significantRainfallPeriod");
 const status=$("significantRainfallStatus"),info=$("significantRainfallInfo");
 const rows=$("significantRainfallInfoRows"),title=$("significantRainfallInfoTitle");
 const collection=new CesiumRef.CustomDataSource("significant-rainfall");
 collection.show=false;viewer.dataSources.add(collection);
 let lastLoadedAt=0,lastError=null,waiting=null,timer=null,selectedId="";
 let source=null,visibleRows=[],period="since9am",started=false;
 const say=(text,kind="normal")=>{
  if(!status)return;status.textContent=text;status.dataset.kind=kind;
 };
 function hideInfo(){
  selectedId="";if(info)info.hidden=true;
 }
 function showInfo(record){
  if(!record){hideInfo();return;}
  selectedId=record.id;
  if(!info||!rows)return;
  title.textContent=record.name;
  rows.replaceChildren();
  detailRow(rows,"Observed rainfall",record.mm.toFixed(1)+" mm");
  detailRow(rows,"Period",period==="since9am"?"Since 9 am AEST":"Last 1 hour (BoM map)");
  detailRow(rows,"Threshold",record.band==="red"?"100 mm or more":"50–99.9 mm");
  detailRow(rows,"BoM station number",record.id);
  detailRow(rows,"Source map issued",formatted(record.sourceCreatedAt));
  detailRow(rows,"Source region",record.region);
  detailRow(rows,"Caution","BoM automatic observations; limited quality control. These are station totals, not radar estimates.");
  const link=document.createElement("a");
  link.href="https://www.bom.gov.au/qld/flood/"+record.region+".shtml";
  link.target="_blank";link.rel="noopener noreferrer";
  link.textContent="Official BoM rainfall map";
  rows.append(link);
  for(const other of ["riverGaugeInfo","qfdTechnicalRescueInfo","powerOutageInfo","floodRoadClosureInfo"]){
    $(other)?.setAttribute("hidden","");
  }
  info.hidden=false;
 }
 function render(){
  const records=source?.observations?.[period]??[];
  visibleRows=records.filter(record=>qualifiesRainfallSnapshot(record,period,now()));
  collection.entities.removeAll();
  for(const record of visibleRows){
   const entity=collection.entities.add({
    id:"significant-rain:"+period+":"+record.id,
    name:record.name+" · "+record.mm.toFixed(1)+" mm",
    position:CesiumRef.Cartesian3.fromDegrees(record.longitude,record.latitude),
    billboard:{
      image:marker(record.band),width:25,height:31,
      verticalOrigin:CesiumRef.VerticalOrigin?.BOTTOM,
      heightReference:CesiumRef.HeightReference?.CLAMP_TO_GROUND,
      disableDepthTestDistance:Number.POSITIVE_INFINITY
    }
   });
   entity.stormTrackerRainGaugeId=record.id;
  }
  viewer.scene.requestRender();
  if(selectedId)showInfo(visibleRows.find(x=>x.id===selectedId)??null);
  const failed=source?.failed?.length??0;
  const label=period==="since9am"?"since 9 am":"last hour";
  const stale=(records.length-visibleRows.length);
  say("Significant rain "+label+": "+visibleRows.length+" station(s) ≥50 mm"+
    (failed?" · "+failed+" regional BoM source(s) unavailable":"")+
    (stale?" · "+stale+" stale readings excluded":"")+
    " · checked "+formatted(source?.checkedAt),
    failed||stale?"warning":"ok");
 }
 async function refresh(force=false){
  if(!collection.show&&!force)return visibleRows.slice();
  if(waiting)return waiting;
  say("Checking BoM significant rainfall…");
  waiting=(async()=>{
   const response=await fetchImpl(SIGNIFICANT_RAINFALL_RELAY,{
     mode:"cors",cache:"no-store",signal:AbortSignal.timeout(25000)
   });
   if(!response.ok)throw Error("BoM rainfall relay HTTP "+response.status);
   const incoming=await response.json();
   if(incoming?.format!=="StormTrackerSignificantRainfallV1"||
     !Array.isArray(incoming?.observations?.since9am)||
     !Array.isArray(incoming?.observations?.lastHour))
      throw Error("Unexpected BoM rainfall source response");
   source=incoming;lastLoadedAt=now();lastError=null;render();
   return visibleRows.slice();
  })();
  try{return await waiting;}
  catch(error){
   lastError=error;
   // Do not leave old qualifying rainfall markers indefinitely visible.
   if(lastLoadedAt && now()-lastLoadedAt>=90*60000){
     source=null;render();
   }
   say("Significant rainfall unavailable · "+String(error?.message??error).slice(0,125)+
     (lastLoadedAt?" · previous valid observations retained until stale":""),
     "warning");
   throw error;
  }finally{waiting=null;}
 }
 function setVisible(yes){
  collection.show=Boolean(yes);
  if(!collection.show){hideInfo();say("Significant rainfall off");}
  else if(!lastLoadedAt||now()-lastLoadedAt>=refreshMs)refresh().catch(()=>{});
  else render();
  viewer.scene.requestRender();
 }
 function setPeriod(value){
  period=value==="lastHour"?"lastHour":"since9am";
  if(collection.show)render();
 }
 // Resolve rain symbols by explicit station ID; avoid using the position
 // or label as a substitute for the source's authoritative gauge identifier.
 function stationIdFromPick(hit){
  const candidates=[hit?.id,hit?.primitive?.id];
  for(const candidate of candidates){
   if(candidate?.stormTrackerRainGaugeId)
    return String(candidate.stormTrackerRainGaugeId);
   const entityId=typeof candidate==="string"?candidate:candidate?.id;
   const match=typeof entityId==="string"?
     /^significant-rain:(?:since9am|lastHour):([0-9]{4,7})$/.exec(entityId):null;
   if(match)return match[1];
  }
  return "";
 }
 function pickAt(position,{width=28,height=28}={}){
  if(!collection.show||!visibleRows.length)return false;
  const hits=viewer.scene.drillPick?.(position,24,width,height)??[];
  // In real Cesium multiple layers can overlap one billboard; a single
  // scene.pick is a fallback if the requested drill size returned nothing.
  const primary=viewer.scene.pick?.(position,width,height);
  for(const hit of [...hits,primary]){
   const id=stationIdFromPick(hit);
   const found=id?visibleRows.find(x=>String(x.id)===id):null;
   if(found){showInfo(found);return true;}
  }
  return false;
 }
 const canvas=viewer.scene.canvas;
 const mapContainer=viewer.container??canvas.parentElement;
 const pointerTap={id:null,x:0,y:0,started:0,moved:false};
 const interactiveControls=
   "button,a,input,select,textarea,[role=button],.map-info-card,"+
   "#controlSidebar,#legendDock,#sidebarToggle,#cesiumCredits";
 function clearTap(){pointerTap.id=null;}
 function pointerDown(event){
  if(!collection.show||!mapContainer?.contains(event.target)||
      event.target?.closest?.(interactiveControls))return;
  if(event.button!==undefined&&event.button!==0)return;
  pointerTap.id=event.pointerId;
  pointerTap.x=event.clientX;pointerTap.y=event.clientY;
  pointerTap.started=Date.now();pointerTap.moved=false;
 }
 function pointerMove(event){
  if(pointerTap.id!==event.pointerId)return;
  if(Math.hypot(event.clientX-pointerTap.x,event.clientY-pointerTap.y)>12)
    pointerTap.moved=true;
 }
 function pointerUp(event){
  if(pointerTap.id!==event.pointerId)return;
  const isTap=!pointerTap.moved&&
    Math.hypot(event.clientX-pointerTap.x,event.clientY-pointerTap.y)<12&&
    Date.now()-pointerTap.started<800;
  clearTap();
  if(!isTap||!collection.show)return;
  const rect=canvas.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||
     event.clientY<rect.top||event.clientY>rect.bottom)return;
  const position=new CesiumRef.Cartesian2(event.clientX-rect.left,event.clientY-rect.top);
  const width=event.pointerType==="touch"?42:28;
  pickAt(position,{width,height:width});
 }
 function start(){
  if(started)return;started=true;
  checkbox?.addEventListener("change",e=>setVisible(e.target.checked));
  select?.addEventListener("change",e=>setPeriod(e.target.value));
  $("refreshSignificantRainfallButton")?.addEventListener("click",()=>refresh(true).catch(()=>{}));
  $("closeSignificantRainfallInfo")?.addEventListener("click",hideInfo);
  // Cesium map gestures may retarget pointerup away from the canvas.
  // Capture at window level like the proven flood-gauge layer, but only
  // process taps that began within the actual map (never sidebar UI).
  window.addEventListener("pointerdown",pointerDown,{capture:true,passive:true});
  window.addEventListener("pointermove",pointerMove,{capture:true,passive:true});
  window.addEventListener("pointerup",pointerUp,{capture:true,passive:true});
  window.addEventListener("pointercancel",clearTap,{capture:true,passive:true});
  timer=setInterval(()=>{
   if(!document.hidden&&collection.show)refresh().catch(()=>{});
  },refreshMs);
  say("Significant rainfall off · BoM station measurements");
 }
 function stop(){
  if(timer!==null)clearInterval(timer);timer=null;
  window.removeEventListener("pointerdown",pointerDown,true);
  window.removeEventListener("pointermove",pointerMove,true);
  window.removeEventListener("pointerup",pointerUp,true);
  window.removeEventListener("pointercancel",clearTap,true);
 }
 window.addEventListener("pagehide",stop,{once:true});
 start();
 return {dataSource:collection,refresh,setVisible,setPeriod,stop,pickAt,
  get features(){return visibleRows.slice();},get period(){return period;},
  get lastLoadedAt(){return lastLoadedAt;},get error(){return lastError;}};
}
