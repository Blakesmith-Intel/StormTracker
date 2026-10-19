import {qualifiesAepRainfallSnapshot,rainfallBand} from "./significant-rainfall-source-v1.js";
import {classifyRainfallAep} from "./rainfall-ifd-aep-v1.js";
export const SIGNIFICANT_RAINFALL_RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/qld-significant-rainfall";
export const SIGNIFICANT_RAINFALL_REFRESH_MS=300000;
const $=id=>document.getElementById(id);
// Each droplet is coloured by MEASURED millimetres, independent of how
// unusual that amount is for the station and observation period.
export function rainfallRarityDisplay(aep){
 const levels={
  20:["Notable","#39734e","Notable for this area","20%","1 in 5"],
  10:["Unusual","#93751b","Unusual for this area","10%","1 in 10"],
  5:["Rare","#a45c1a","Rare for this area","5%","1 in 20"],
  2:["Very rare","#ad3540","Very rare for this area","2%","1 in 50"],
  1:["Exceptional","#7e399c","Exceptionally rare for this area","1%","1 in 100"]
 };
 const entry=levels[aep?.aepDesignThreshold];
 if(entry){
  const [short,color,description,chance,oneIn]=entry;
  return {short,color,description,chance,oneIn,
   explanation:"At least as rare as the "+chance+
    " design rainfall benchmark ("+oneIn+
    " annual chance) for this location and the selected duration."};
 }
 if(aep?.classification==="below-20pct-aep")
  return {short:"Less rare",color:"#647986",
   description:"Below the local notable-rainfall rarity threshold",
   explanation:"Below the 20% (1 in 5) annual-chance benchmark for the selected duration. Even less rare rainfall may cause flooding."};
 return {short:"Unrated",color:"#66717b",
  description:"Local rarity unavailable",
  explanation:"No verified local rainfall-frequency comparison is available for this station."};
}
export function significantRainfallDisplay(record){
 return {amountColor:record.mm>=100?"#d92d35":"#ed871b",
  amountBand:record.mm>=100?"100 mm or more":"50–99.9 mm",
  rarity:rainfallRarityDisplay(record.aep)};
}
const marker=record=>{
 const {amountColor,rarity}=significantRainfallDisplay(record);
 // Do not round 99.9 mm into an apparent 100 mm red threshold.
 const mm=Number(record.mm.toFixed(1)).toString();
 const size=mm.length>3?9:mm.length>2?12:14;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 124 54">'+
 '<path d="M24 2C14 15 7 23 7 33a17 17 0 0 0 34 0C41 23 34 15 24 2Z" '+
 'fill="'+amountColor+'" stroke="#17242d" stroke-width="2.5"/>'+
 '<text x="24" y="38" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" '+
 'font-weight="700" font-size="'+size+'">'+mm+'</text>'+
 '<rect x="45" y="20" width="78" height="23" rx="6" fill="'+rarity.color+'" '+
 'stroke="#17242d" stroke-width="1.8"/>'+
 '<text x="84" y="35.5" fill="#fff" font-family="Arial,sans-serif" '+
 'font-size="'+(rarity.short.length>9?9:10)+'" font-weight="700" '+
 'text-anchor="middle">'+rarity.short+'</text></svg>';
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
 let ifdGrid=null,ifdLoadedAt=0;
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
  const display=significantRainfallDisplay(record);
  detailRow(rows,"Rainfall measured",record.mm.toFixed(1)+" mm");
  detailRow(rows,"Period",period==="since9am"?"Since 9 am AEST":
   period==="last24Hours"?"Last 24 hours":"Last 1 hour");
  detailRow(rows,"Rainfall amount",display.amountBand);
  detailRow(rows,"How unusual here?",display.rarity.description);
  detailRow(rows,"In everyday terms",display.rarity.chance?
   display.rarity.chance+" annual chance · "+display.rarity.oneIn+
   " in any given year":display.rarity.explanation);
  if(record.aep?.aepDesignThreshold)
   detailRow(rows,"Technical rainfall rating",
    record.aep.aepDesignThreshold+"% AEP (annual exceedance probability)");
  if(record.aep?.classification==="unclassified")
   detailRow(rows,"Local reference missing",record.aep?.reason??
    "Verified local rainfall-frequency reference unavailable.");
  detailRow(rows,"IFD duration",record.aep?.durationMinutes
    ?Number(record.aep.durationMinutes.toFixed(1))+" minutes":"Unverified");
  if(record.aep?.designDepthMm)
    detailRow(rows,"Local design rainfall",record.aep.designDepthMm.toFixed(1)+" mm");
  if(record.aep?.ifdCell)detailRow(rows,"IFD grid cell",record.aep.ifdCell);
  if(record.aep?.interpolatedDuration)
    detailRow(rows,"Duration estimation","Logarithmic interpolation between official IFD durations");
  detailRow(rows,"Interpretation","An annual chance is not a fixed repeat interval, and rainfall rarity is NOT flood severity.");
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
  // ALL stations recording 50+ mm are visible, even if that amount is
  // less rare for the area or a verified local IFD cell is unavailable.
  visibleRows=records.filter(record=>
   qualifiesAepRainfallSnapshot(record,period,now())&&
   rainfallBand(record.mm)!==null).map(record=>{
    const aep=classifyRainfallAep({...record,grid:ifdGrid});
    return {...record,aep,band:rainfallBand(record.mm)};
   });
  collection.entities.removeAll();
  for(const record of visibleRows){
   const entity=collection.entities.add({
    id:"significant-rain:"+period+":"+record.id,
    name:record.name+" · "+record.mm.toFixed(1)+" mm · "+
      rainfallRarityDisplay(record.aep).description,
    position:CesiumRef.Cartesian3.fromDegrees(record.longitude,record.latitude),
    billboard:{
      image:marker(record),width:124,height:54,
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
  const label=period==="since9am"?"since 9 am":
   period==="last24Hours"?"last 24 hours":"last hour";
  const stale=records.filter(record=>!qualifiesAepRainfallSnapshot(record,period,now())).length;
  const high=visibleRows.filter(x=>x.mm>=100).length;
  const rarer=visibleRows.filter(x=>[1,2,5,10].includes(x.aep?.aepDesignThreshold)).length;
  const unknown=visibleRows.filter(x=>x.aep?.classification==="unclassified").length;
  say("Rainfall "+label+": "+visibleRows.length+" stations at 50+ mm"+
   (high?" · "+high+" at 100+ mm":"")+
   (rarer?" · "+rarer+" unusual or rarer locally":"")+
   (unknown?" · "+unknown+" local rarity unavailable":"")+
   (failed?" · "+failed+" regional/period BoM source(s) unavailable":"")+
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
     !Array.isArray(incoming?.observations?.lastHour)||
     !Array.isArray(incoming?.observations?.last24Hours))
      throw Error("Unexpected BoM rainfall source response");
   source=incoming;lastLoadedAt=now();lastError=null;
   if(!ifdLoadedAt||now()-ifdLoadedAt>15*60000){
     ifdLoadedAt=now();
     try{
       const response=await fetchImpl("https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/ifd.json",{cache:"no-store"});
       if(!response.ok)throw Error("BoM IFD grid data HTTP "+response.status);
       const grid=await response.json();
       if(grid?.schema!=="StormTrackerBoM2016IFDCellsV1"||!grid.cells||!grid.source?.includes("BoM IFD"))
         throw Error("Invalid verified IFD grid dataset");
       ifdGrid=grid;
     }catch(error){
       console.warn("Verified rainfall IFD station coverage unavailable; leaving sites unrated",error);
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
  period=["lastHour","last24Hours"].includes(value)?value:"since9am";
  if(collection.show)render();
 }
 function stationIdFromPick(hit){
  const candidates=[hit?.id,hit?.primitive?.id];
  for(const candidate of candidates){
   if(candidate?.stormTrackerRainGaugeId)
    return String(candidate.stormTrackerRainGaugeId);
   const entityId=typeof candidate==="string"?candidate:candidate?.id;
   const match=typeof entityId==="string"?
     /^significant-rain:(?:since9am|lastHour|last24Hours):([0-9]{4,7})$/.exec(entityId):null;
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
  // Never reject a stationary map tap by elapsed wall time. Cesium terrain,
  // radar decoding and WebGL can delay pointerup by seconds on slower devices;
  // the old 800 ms cutoff made otherwise valid gauge clicks disappear.
  // Movement, pointer identity and canvas bounds remain the touch/drag guards.
  const isTap=!pointerTap.moved&&
    Math.hypot(event.clientX-pointerTap.x,event.clientY-pointerTap.y)<12;
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
