import {qualifiesAepRainfallSnapshot,rainfallBand} from "./significant-rainfall-source-v1.js";
import {classifyRainfallAep} from "./rainfall-ifd-aep-v1.js";
export const SIGNIFICANT_RAINFALL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-significant-rainfall";
export const SIGNIFICANT_RAINFALL_REFRESH_MS=300000;
const $=id=>document.getElementById(id);
const marker=(band)=>{
 const color=({purple:"#a12cf2",red:"#d92d35",orange:"#ed871b",yellow:"#e6be28",green:"#3faf65",unclassified:"#929da6"})[band]??"#929da6";
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
 let ifdGrid=null,ifdLoadAttempted=false;
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
  detailRow(rows,"Rainfall rarity",record.aep?.aepDesignThreshold
    ?"Meets "+record.aep.aepDesignThreshold+"% AEP IFD design depth"
    :record.aep?.classification==="below-20pct-aep"
      ?"Below 20% AEP design depth":"Not rated — verified local IFD unavailable");
  detailRow(rows,"IFD duration",record.aep?.durationMinutes
    ?Number(record.aep.durationMinutes.toFixed(1))+" minutes":"Unverified");
  if(record.aep?.designDepthMm)
    detailRow(rows,"Local design rainfall",record.aep.designDepthMm.toFixed(1)+" mm");
  if(record.aep?.ifdCell)detailRow(rows,"IFD grid cell",record.aep.ifdCell);
  if(record.aep?.interpolatedDuration)
    detailRow(rows,"Duration estimation","Logarithmic interpolation between official IFD durations");
  detailRow(rows,"Rainfall interpretation","AEP is rainfall rarity, not a prediction of flood height or severity.");
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
  const assessed=records.filter(record=>qualifiesAepRainfallSnapshot(record,period,now()))
    .map(record=>{
      const aep=classifyRainfallAep({...record,grid:ifdGrid});
      return {...record,aep,band:aep.band??(aep.classification==="unclassified"&&rainfallBand(record.mm)?"unclassified":null)};
    });
  // Unverified grid cells retain only neutral historical total markers.
  // A low mm value is never upgraded by invented IFD climatology.
  visibleRows=assessed.filter(record=>record.band);
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
  const stale=records.filter(record=>!qualifiesAepRainfallSnapshot(record,period,now())).length;
  const rated=visibleRows.filter(x=>x.aep?.band).length;
  const unrated=visibleRows.length-rated;
  say("Rainfall AEP "+label+": "+rated+" locally graded"+
    (unrated?" · "+unrated+" neutral (IFD missing)":"")+
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
   source=incoming;lastLoadedAt=now();lastError=null;
   if(!ifdLoadAttempted){
     ifdLoadAttempted=true;
     try{
       const response=await fetchImpl("./data/ifd-2016-verified-points-v1.json",{cache:"force-cache"});
       if(!response.ok)throw Error("BoM IFD grid data HTTP "+response.status);
       const grid=await response.json();
       if(grid?.schema!=="StormTrackerBoM2016IFDCellsV1"||!grid.cells)
         throw Error("Invalid verified IFD grid dataset");
       ifdGrid=grid;
     }catch(error){
       console.warn("AEP IFD grid unavailable: leaving rainfall rarity unclassified",error);
     }
   }
   render();
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
 function pickAt(position){
  if(!collection.show)return false;
  const hits=viewer.scene.drillPick(position,12,30,30)||[];
  for(const hit of hits){
   const id=(hit?.id??hit?.primitive?.id)?.stormTrackerRainGaugeId;
   const found=visibleRows.find(x=>x.id===id);
   if(found){showInfo(found);return true;}
  }
  return false;
 }
 // One click/tap handler; no continuous Cesium picking on mouse movement.
 const canvas=viewer.scene.canvas;
 let down=null;
 const pointerDown=e=>{down={id:e.pointerId,x:e.clientX,y:e.clientY,at:Date.now()};};
 const pointerUp=e=>{
  if(!down||down.id!==e.pointerId)return;
  const wasTap=Math.hypot(e.clientX-down.x,e.clientY-down.y)<12&&
    Date.now()-down.at<800;down=null;
  if(!wasTap||!collection.show)return;
  const rect=canvas.getBoundingClientRect();
  pickAt(new CesiumRef.Cartesian2(e.clientX-rect.left,e.clientY-rect.top));
 };
 function start(){
  if(started)return;started=true;
  checkbox?.addEventListener("change",e=>setVisible(e.target.checked));
  select?.addEventListener("change",e=>setPeriod(e.target.value));
  $("refreshSignificantRainfallButton")?.addEventListener("click",()=>refresh(true).catch(()=>{}));
  $("closeSignificantRainfallInfo")?.addEventListener("click",hideInfo);
  canvas.addEventListener("pointerdown",pointerDown,{passive:true});
  canvas.addEventListener("pointerup",pointerUp,{passive:true});
  timer=setInterval(()=>{
   if(!document.hidden&&collection.show)refresh().catch(()=>{});
  },refreshMs);
  say("Significant rainfall off · BoM station measurements");
 }
 function stop(){
  if(timer!==null)clearInterval(timer);timer=null;
  canvas.removeEventListener("pointerdown",pointerDown);
  canvas.removeEventListener("pointerup",pointerUp);
 }
 window.addEventListener("pagehide",stop,{once:true});
 start();
 return {dataSource:collection,refresh,setVisible,setPeriod,stop,pickAt,
  get features(){return visibleRows.slice();},get period(){return period;},
  get lastLoadedAt(){return lastLoadedAt;},get error(){return lastError;}};
}
