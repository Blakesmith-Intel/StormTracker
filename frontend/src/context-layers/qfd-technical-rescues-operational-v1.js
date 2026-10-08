import {
  fetchQfdPublicIncidents,QFD_REFRESH_MS,QFD_MAX_SNAPSHOT_MS,
  QFD_PUBLIC_GROUPS,QFD_PUBLIC_GROUP_NAMES,qfdPublicGroupCounts
} from "./qfd-technical-rescues-v1.js?v=9.15.0";
import {fetchQfdPublicSymbolCatalog,qfdSymbolFor} from "./qfd-public-symbols-v1.js?v=9.15.1";
import {sourceSnapshotState,checkedAtAest} from "./source-freshness-v1.js?v=9.14.0";
import {addOfficialSourceRow,OFFICIAL_SOURCE_LINKS} from "./official-source-links-v1.js?v=9.15.0";

const $=id=>document.getElementById(id);
const statusNode=()=>$("qfdTechnicalRescueStatus");
const infoNode=()=>$("qfdTechnicalRescueInfo");
const RESCUE_SOURCE_NOTE="QFD public GroupedType is a broad incident classification. Location is approximate; rescue subtypes, road closures and SES involvement are not independently confirmed.";

function setStatus({kind="normal",message=""}={}) {
  const el=statusNode();
  if(!el)return;
  el.dataset.kind=kind;
  el.textContent=message;
}
function fmtDate(iso) {
  if(!iso)return "";
  return new Intl.DateTimeFormat("en-AU",{
    timeZone:"Australia/Brisbane",day:"2-digit",month:"short",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:false,timeZoneName:"short"
  }).format(new Date(iso));
}
function detailRow(parent,label,value) {
  if(value==null || String(value).trim()==="")return;
  const key=document.createElement("span"),text=document.createElement("strong");
  key.textContent=label;text.textContent=String(value);
  parent.append(key,text);
}
function hideOtherPanels() {
  for(const id of ["floodRoadClosureInfo","powerOutageInfo","riverGaugeInfo"])
    $(id)?.setAttribute("hidden","");
}
export function initialiseOperationalQfdTechnicalRescues({
  viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
  refreshMs=QFD_REFRESH_MS,now=()=>Date.now()
}={}) {
  if(!viewer || !CesiumRef)throw new Error("QFD incidents layer needs Cesium viewer");
  const checkbox=$("showQfdTechnicalRescues");
  const info=infoNode();
  const dataSource=new CesiumRef.CustomDataSource("qfd-public-incidents");
  dataSource.show=Boolean(checkbox?.checked);
  viewer.dataSources.add(dataSource);
  const canvas=viewer.scene.canvas;
  let records=[],lastLoadedAt=0,lastStatus=null,loading=null,timer=null,selectedId="";
  let officialSymbols={},symbolLookup=null;
  function symbolsAreOfficial(){return Object.keys(officialSymbols).length===QFD_PUBLIC_GROUP_NAMES.length;}
  function updateSymbolLegend(){
    for(const group of QFD_PUBLIC_GROUP_NAMES){
      const img=document.querySelector('[data-qfd-group-icon="'+group+'"]');
      if(!img)continue;
      img.src=qfdSymbolFor(group,officialSymbols);
      img.alt=QFD_PUBLIC_GROUPS[group].label;
      img.title=officialSymbols[group]?"QFD public ArcGIS symbol":"Provisional symbol — QFD icon unavailable";
    }
    const note=$("qfdSymbolStatus");
    if(note)note.textContent=symbolsAreOfficial()
      ?"Official QFD incident icons · public ArcGIS GroupedType renderer"
      :"Provisional icons · QFD symbology temporarily unavailable";
  }
  async function loadOfficialSymbols(){
    // Legend metadata is independent of whether current incidents are visible.
    // A transient request failure must not permanently lock in fallback icons.
    if(symbolsAreOfficial())return officialSymbols;
    if(symbolLookup)return symbolLookup;
    symbolLookup=fetchQfdPublicSymbolCatalog({fetchImpl}).then(catalog=>{
      officialSymbols=catalog;
      updateSymbolLegend();
      if(records.length)render(records);
      return catalog;
    }).finally(()=>{
      // A partial/failed public renderer lookup is retryable on tab resume or
      // the next regular refresh, even when the incident layer stays off.
      symbolLookup=null;
    });
    return symbolLookup;
  }
  let started=false;

  function report(state){lastStatus=state;setStatus(state);}
  function showInfo(item) {
    if(!info)return;
    if(!item){selectedId="";info.hidden=true;info.dataset.rescueId="";return;}
    selectedId=item.id;
    info.dataset.rescueId=item.id;
    const cardIcon=$("qfdTechnicalRescueInfoIcon");
    if(cardIcon)cardIcon.src=qfdSymbolFor(item.groupedType,officialSymbols);
    $("qfdTechnicalRescueInfoTitle").textContent=item.locality||"Queensland";
    const rows=$("qfdTechnicalRescueInfoRows");
    if(!rows)return;
    rows.replaceChildren();
    detailRow(rows,"QFD grouped type",item.groupedType);
    if(item.groupedType==="RESCUE TECHNICAL")
      detailRow(rows,"Detailed rescue type","Not specified by QFD public data");
    detailRow(rows,"Status",item.status);
    detailRow(rows,"Public area",item.location);
    detailRow(rows,"Jurisdiction",item.jurisdiction);
    detailRow(rows,"Response",fmtDate(item.responseAt));
    detailRow(rows,"Last source update",fmtDate(item.lastUpdatedAt));
    detailRow(rows,"QFD incident",item.id);
    detailRow(rows,"Units assigned",item.vehiclesAssigned);
    detailRow(rows,"Units en route",item.vehiclesOnRoute);
    detailRow(rows,"Units at scene",item.vehiclesOnScene);
    detailRow(rows,"Location","General incident area only — not an exact rescue site");
    detailRow(rows,"Source advisory",RESCUE_SOURCE_NOTE);
    addOfficialSourceRow(rows,"Source","QFD active incidents",OFFICIAL_SOURCE_LINKS.qfd);
    hideOtherPanels();
    info.hidden=false;
  }
  function render(features) {
    records=features.slice();
    dataSource.entities.removeAll();
    for(const item of records){
      const entity=dataSource.entities.add({
        id:"qfd-incident:"+item.id,
        name:"QFD "+item.groupLabel,
        position:CesiumRef.Cartesian3.fromDegrees(item.longitude,item.latitude),
        billboard:{
          image:qfdSymbolFor(item.groupedType,officialSymbols),
          width:28,height:28,verticalOrigin:CesiumRef.VerticalOrigin?.BOTTOM,
          heightReference:CesiumRef.HeightReference?.CLAMP_TO_GROUND,
          disableDepthTestDistance:Number.POSITIVE_INFINITY
        }
      });
      entity.stormTrackerQfdRescueId=item.id;
    }
    viewer.scene.requestRender();
    if(selectedId)showInfo(records.find(x=>x.id===selectedId)??null);
  }
  function expire() {
    if(!sourceSnapshotState({lastLoadedAt,maxAgeMs:QFD_MAX_SNAPSHOT_MS,nowMs:now()}).expired)return false;
    if(records.length){render([]);}
    report({kind:"error",message:"QFD public feed expired · incident markers cleared · last checked "+checkedAtAest(lastLoadedAt)});
    return true;
  }
  async function refresh({force=false}={}){
    if(!dataSource.show&&!force)return records.slice();
    if(loading)return loading;
    loading=(async()=>{
      report({kind:"loading",message:"Checking QFD grouped incidents…"});
      // Obtain the verified QFD GroupedType renderer before drawing incidents.
      // Avoid a temporary flash of provisional icons on a normal connection.
      await loadOfficialSymbols();
      const next=await fetchQfdPublicIncidents({fetchImpl});
      render(next);
      lastLoadedAt=now();
      const counts=qfdPublicGroupCounts(next);
      report({kind:"ok",message:"QFD "+next.length+" · Technical "+counts["RESCUE TECHNICAL"]+
        " · Road crash "+counts["RESCUE ROAD CRASH"]+" · Assist public "+counts["ASSIST PUBLIC"]+
        " · checked "+checkedAtAest(lastLoadedAt)});
      return records.slice();
    })();
    try{return await loading;}
    catch(error){
      if(!expire()){
        const cause=String(error?.message??error).slice(0,140);
        report(lastLoadedAt
          ? {kind:"warning",message:"QFD feed unavailable · cached incidents UNVERIFIED · "+cause}
          : {kind:"error",message:"QFD feed unavailable · no verified incidents · "+cause});
      }
      throw error;
    }finally{loading=null;}
  }
  function setVisible(value){
    expire();
    dataSource.show=Boolean(value);
    viewer.scene.requestRender();
    if(!dataSource.show){
      showInfo(null);
      setStatus({message:"QFD grouped incidents hidden"});
    }else if(!lastLoadedAt || now()-lastLoadedAt>=refreshMs) {
      loadOfficialSymbols().catch(()=>{});
      refresh().catch(()=>{});
    }else if(lastStatus){
      loadOfficialSymbols().catch(()=>{});
      setStatus(lastStatus);
    }
  }
  // Pick only records explicitly tagged by this layer. Never convert
  // unrelated map imagery, tracks or other incidents into rescue markers.
  function pickAt(position) {
    if(!dataSource.show)return false;
    const picks=viewer.scene.drillPick(position,12,26,26)||[];
    for(const picked of picks){
      const item=picked?.id??picked?.primitive?.id;
      const id=item?.stormTrackerQfdRescueId;
      if(id){
        const match=records.find(x=>x.id===id);
        if(match){showInfo(match);return true;}
      }
    }
    return false;
  }
  const blocked="#nav,#qfdTechnicalRescueInfo,#floodRoadClosureInfo,#powerOutageInfo,#riverGaugeInfo";
  const tap={id:null,x:0,y:0,time:0,moved:false};
  function onDown(event){
    if(event.button!=null&&event.button!==0)return;
    if(!canvas.parentElement?.contains(event.target)||event.target?.closest?.(blocked))return;
    tap.id=event.pointerId;tap.x=event.clientX;tap.y=event.clientY;
    tap.time=performance.now();tap.moved=false;
  }
  function onMove(event) {
    if(tap.id===event.pointerId&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>12)tap.moved=true;
  }
  function onUp(event) {
    if(event.pointerId!==tap.id)return;
    const click=!tap.moved&&performance.now()-tap.time<=700;
    tap.id=null;
    if(!click)return;
    const rect=canvas.getBoundingClientRect();
    pickAt(new CesiumRef.Cartesian2(event.clientX-rect.left,event.clientY-rect.top));
  }
  const onCancel=()=>{tap.id=null;};
  const onVisibility=()=>{
    if(document.hidden)return;
    expire();
    if(!symbolsAreOfficial())loadOfficialSymbols().catch(()=>{});
    if(dataSource.show)refresh().catch(()=>{});
  };
  function start(){
    if(started)return;
    started=true;
    window.addEventListener("pointerdown",onDown,{capture:true,passive:true});
    window.addEventListener("pointermove",onMove,{capture:true,passive:true});
    window.addEventListener("pointerup",onUp,{capture:true,passive:true});
    window.addEventListener("pointercancel",onCancel,{capture:true,passive:true});
    document.addEventListener("visibilitychange",onVisibility);
    // Fetch official QFD icon samples immediately, irrespective of checkbox.
    // This request changes only the legend; no incident feed is started while
    // the layer remains off. Leave the other map layers entirely unaffected.
    loadOfficialSymbols().catch(()=>{});
    if(dataSource.show)refresh().catch(()=>{});
    else setStatus({kind:"normal",message:"QFD technical rescue / road crash / assist public · off by default"});
    timer=setInterval(()=>{
      if(!document.hidden){
        expire();
        if(!symbolsAreOfficial())loadOfficialSymbols().catch(()=>{});
        if(dataSource.show)refresh().catch(()=>{});
      }
    },refreshMs);
  }
  function stop(){
    if(timer!==null)clearInterval(timer);
    timer=null;started=false;
    window.removeEventListener("pointerdown",onDown,true);
    window.removeEventListener("pointermove",onMove,true);
    window.removeEventListener("pointerup",onUp,true);
    window.removeEventListener("pointercancel",onCancel,true);
    document.removeEventListener("visibilitychange",onVisibility);
  }
  checkbox?.addEventListener("change",event=>setVisible(event.target.checked));
  $("refreshQfdTechnicalRescuesButton")?.addEventListener("click",()=>refresh({force:true}).catch(()=>{}));
  $("closeQfdTechnicalRescueInfo")?.addEventListener("click",()=>showInfo(null));
  window.addEventListener("pagehide",stop,{once:true});
  start();
  return {dataSource,refresh,setVisible,stop,start,pickAt,
    get features(){return records.slice();},
    get lastLoadedAt(){return lastLoadedAt;}
  };
}
