import {createWarningImageryProvider,warningContainsPoint} from "./bom-warning-terrain-imagery-v1.js";
import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
const SOURCE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
const SCHEMA="StormTrackerOfficialBoMWarningPolygonsV1",INTERVAL_MS=15*60*1000;
export const PRODUCT_FILTERS=Object.freeze(["all","IDQ21035","IDQ21033"]);
export function filterOfficialWarnings(warnings,productCode="all"){
 if(!PRODUCT_FILTERS.includes(productCode))return [];
 return (Array.isArray(warnings)?warnings:[]).filter(w=>
   productCode==="all"||w?.productCode===productCode);
}
export function warningProductAffectedGroups(warnings,productCode="all"){
 const visible=filterOfficialWarnings(warnings,productCode);
 const ldmgs=new Set(),ddmgs=new Set();
 let ldmgComplete=true,ddmgComplete=true;
 for(const w of visible){
  if(w.ldmgStatus!=="verified")ldmgComplete=false;
  if(w.ddmgStatus!=="verified")ddmgComplete=false;
  for(const name of w.ldmgs??w.lgas??[])if(String(name).trim())ldmgs.add(String(name).trim());
  for(const name of w.ddmgs??[])if(String(name).trim())ddmgs.add(String(name).trim());
 }
 return {count:visible.length,ldmgs:[...ldmgs].sort((a,b)=>a.localeCompare(b,"en-AU")),
  ddmgs:[...ddmgs].sort((a,b)=>a.localeCompare(b,"en-AU")),
  ldmgComplete,ddmgComplete};
}
const $=id=>document.getElementById(id);
const fmt=iso=>iso?formatAgencyTimestamp(iso,"bom-issued"):"Not supplied";
const officialUrl=x=>{
 try{const u=new URL(x);return u.protocol==="https:"&&/(^|\.)bom\.gov\.au$/.test(u.hostname)?u.href:""}
 catch{return ""}
};
export function isVerifiedActiveBomWarning(warning,nowMs=Date.now()){
 return warning?.official===true&&warning.issuer==="Bureau of Meteorology"&&
  ["severe-thunderstorm","severe-weather"].includes(warning.type)&&
  ["Polygon","MultiPolygon"].includes(warning.geometry?.type)&&
  officialUrl(warning.bulletinUrl)&&
  Number.isFinite(Date.parse(warning.issuedUtc))&&
  Number.isFinite(Date.parse(warning.expiresUtc))&&
  Date.parse(warning.issuedUtc)<=nowMs&&Date.parse(warning.expiresUtc)>nowMs;
}
const textRow=(node,label,value)=>{
 const s=String(value??"").trim();
 if(!s)return;
 const k=document.createElement("dt"),v=document.createElement("dd");
 k.textContent=label;v.textContent=s;node.append(k,v);
};
export function initialiseOfficialBomWarningPolygons({viewer,CesiumRef=globalThis.Cesium,
 fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
 const toggle=$("showOfficialBomWarnings"),state=$("officialBomWarningsStatus"),
   panel=$("officialBomWarningInfo"),content=$("officialBomWarningInfoRows"),
   title=$("officialBomWarningInfoTitle"),dismiss=$("closeOfficialBomWarningInfo"),
   refreshBtn=$("refreshOfficialBomWarnings"),filter=$("officialBomWarningProduct"),
   reportButton=$("openOfficialBomWarningGroups"),reportDialog=$("officialBomWarningGroupsReport"),
   reportClose=$("closeOfficialBomWarningGroupsReport"),reportBody=$("officialBomWarningGroupsBody");
 if(!viewer||!CesiumRef||![toggle,state,panel,content,title,dismiss,refreshBtn,filter,reportButton,reportDialog,reportClose,reportBody].every(Boolean))
  return {destroy(){}};
 let warnings=[],imagery=null,lastAttemptAt=0,pending=null,timer=null,activeId="",destroyed=false,sourceStatus="unavailable",productStatuses={};
 const canvas=viewer.scene.canvas;
 const report=(message,kind="normal")=>{
  state.textContent=message;state.dataset.kind=kind;
 };
 const statusForProduct=(code)=>{
  const status=productStatuses?.[code]?.status??"unavailable";
  return status==="cancelled"?"Cancelled by BoM · no current polygons":
    status==="no-active"?"0 current polygons verified":
    status==="active"?"Active warning polygons":
    status==="geometry-unavailable"?"Warning issued · original polygon unavailable":
    "Warning verification unavailable";
 };
 function showProductStatus(){
  if(!toggle.checked){report("BoM warning polygons off");return;}
  const selected=filter.value,visible=filterOfficialWarnings(warnings,selected);
  const summary=selected==="all"?"All BoM products":selected;
  const detail=selected==="all"?
    ["IDQ21035","IDQ21033"].map(code=>code+": "+statusForProduct(code)).join(" · "):
    statusForProduct(selected);
  const uncertain=sourceStatus==="partial-source-unavailable"||
    sourceStatus==="unavailable"||
    (selected==="all"?["IDQ21035","IDQ21033"].some(code=>
      ["unavailable","geometry-unavailable"].includes(productStatuses?.[code]?.status)):
      ["unavailable","geometry-unavailable"].includes(productStatuses?.[selected]?.status));
  report(summary+" · "+visible.length+" active polygon(s) · "+detail+
    " · automatic check every 15 min; manual refresh available",uncertain?"warning":"normal");
 }
 const discard=()=>{
  if(imagery){
   viewer.imageryLayers.remove(imagery,true);imagery=null;
  }
  viewer.scene.requestRender();
 };
 function display(){
  discard();
  const visible=filterOfficialWarnings(warnings,filter.value);
  if(!toggle.checked||!visible.length)return;
  imagery=new CesiumRef.ImageryLayer(createWarningImageryProvider(CesiumRef,visible),{
   alpha:1,show:true
  });
  // First terrain basemap is below us; radar surfaces dynamically rise to TOP.
  // This never changes the existing radar handover or opacity logic.
  viewer.imageryLayers.add(imagery,Math.min(1,viewer.imageryLayers.length));
  viewer.scene.requestRender();
 }
 function openInfo(warning){
  if(!warning){panel.hidden=true;activeId="";return;}
  activeId=warning.id;
  title.textContent=warning.headline||warning.event;
  content.replaceChildren();
  textRow(content,"Official warning",warning.event);
  textRow(content,"BoM product",warning.productCode||"Not verified");
  textRow(content,"Product",warning.productType==="detailed"?
   "Detailed SEQ thunderstorm (IDQ21035)":warning.productType==="regional"?
   "Regional QLD thunderstorm (IDQ21033)":"BoM severe weather");
  textRow(content,"Issued",fmt(warning.issuedUtc));
  textRow(content,"Expires",fmt(warning.expiresUtc));
  textRow(content,"Severity / certainty",[warning.severity,warning.certainty].filter(Boolean).join(" · "));
  textRow(content,"Warning area",warning.areaDescription);
  textRow(content,"BoM warning details",warning.description);
  textRow(content,"Safety advice",warning.instruction);
  textRow(content,"Affected LDMGs (by LGA)",warning.ldmgStatus==="verified"?
   (warning.ldmgs??warning.lgas??[]).length?(warning.ldmgs??warning.lgas).join(" · "):
    "None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Affected Queensland LGAs",warning.lgaStatus==="verified"?
   warning.lgas.length?warning.lgas.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Affected disaster districts (DDMGs)",warning.ddmgStatus==="verified"?
   warning.ddmgs.length?warning.ddmgs.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Intersection rule","Every genuine intersecting LDMG/LGA and DDMG, regardless of overlap size.");
  const link=document.createElement("a");
  link.href=officialUrl(warning.bulletinUrl);
  link.textContent="Read official BoM warning";link.target="_blank";link.rel="noopener noreferrer";
  content.append(link);
  panel.hidden=false;
 }
 function trimExpired(){
  const valid=warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
  if(valid.length!==warnings.length){
   warnings=valid;display();renderGroupsReport();
   if(activeId&&!warnings.some(w=>w.id===activeId))openInfo(null);
   report(valid.length?valid.length+" active BoM warning area(s)":
     "Published warnings expired · no verified current warning polygons", "warning");
  }
 }
 async function refresh({force=false}={}){
  if(!toggle.checked||destroyed)return;
  if(pending)return pending;
  if(!force&&lastAttemptAt&&now()-lastAttemptAt<INTERVAL_MS){trimExpired();return;}
  report("Checking issued Bureau of Meteorology warning polygons…","loading");
  lastAttemptAt=now(); // Respect 15-minute cadence after timeouts as well.
  pending=(async()=>{
   try{
    const res=await fetchImpl(SOURCE,{cache:"no-store",signal:AbortSignal.timeout(27000)});
    if(!res.ok)throw Error("Official warning transport HTTP "+res.status);
    const data=await res.json();
    if(data?.schema!==SCHEMA||!Array.isArray(data.warnings)||
      !["active","no-verified-current-polygons","partial-source-unavailable"].includes(data.status))
      throw Error(data?.message||"Official CAP source unavailable");
    warnings=data.warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
    sourceStatus=data.status;
    productStatuses=data.products??{};
    display();renderGroupsReport();
    if(activeId)openInfo(warnings.find(w=>w.id===activeId)??null);
    showProductStatus();
   }catch(error){
    // Fail closed: no stale polygons linger under radar as current warnings.
    warnings=[];sourceStatus="unavailable";productStatuses={};display();renderGroupsReport();openInfo(null);
    report("Warning polygons unavailable — "+String(error?.message??error).slice(0,120)+
       " · check official BoM warnings","error");
   }finally{pending=null;}
  })();
  return pending;
 }
 const groupLabel=code=>code==="IDQ21035"?
    "IDQ21035 — Detailed SEQ thunderstorms":code==="IDQ21033"?
    "IDQ21033 — Regional QLD thunderstorms":"Other BoM severe weather warnings";
 function renderGroupsReport(){
  reportBody.replaceChildren();
  if(!reportDialog.open)return;
  const codes=filter.value==="all"?["IDQ21035","IDQ21033","other"]:[filter.value];
  for(const code of codes){
   const subset=code==="other"?warnings.filter(w=>!["IDQ21035","IDQ21033"].includes(w.productCode)):
     filterOfficialWarnings(warnings,code);
   if(code==="other"&&!subset.length)continue;
   const result=warningProductAffectedGroups(subset);
   const productStatus=productStatuses[code]?.status??"unavailable";
   const section=document.createElement("section");
   const heading=document.createElement("h3");heading.textContent=groupLabel(code);
   section.append(heading);
   const count=document.createElement("p");
   count.textContent=sourceStatus==="unavailable"||productStatus==="unavailable"?
     "Warning verification unavailable — not an all-clear":
     productStatus==="geometry-unavailable"?
       "Warning issued, but genuine warning geometry unavailable":
     productStatus==="cancelled"?
       "Cancelled by BoM · 0 active polygons":
       result.count+" active verified polygon"+(result.count===1?"":"s");
   section.append(count);
   for(const [label,items,complete] of [
     ["LDMGs — local council disaster-management groups",result.ldmgs,result.ldmgComplete],
     ["DDMGs — district disaster-management groups",result.ddmgs,result.ddmgComplete]]){
    const title=document.createElement("h4");title.textContent=label;
    section.append(title);
    const info=document.createElement("p");
    info.textContent=!complete?"Boundary verification incomplete — affected groups may be missing":
       !result.count?"No currently verified polygon in this product":
       !items.length?"No intersecting Queensland groups reported":"";
    section.append(info);
    if(items.length){
     const list=document.createElement("ul");
     for(const name of items){
      const li=document.createElement("li");li.textContent=name;list.append(li);
     }
     section.append(list);
    }
   }
   reportBody.append(section);
  }
 }
 const onProductChange=()=>{
  display();renderGroupsReport();showProductStatus();
  if(activeId){
   const match=filterOfficialWarnings(warnings,filter.value).find(w=>w.id===activeId);
   openInfo(match??null);
  }
 };
 const openGroups=()=>{
  if(!reportDialog.open)reportDialog.showModal();
  renderGroupsReport();
 };
 const closeGroups=()=>reportDialog.close();
 const onToggle=()=>{
  if(!toggle.checked){warnings=[];productStatuses={};sourceStatus="unavailable";discard();openInfo(null);renderGroupsReport();
   report("BoM warning polygons off");return;}
  void refresh({force:true});
 };
 const onRefresh=()=>{void refresh({force:true});};
 const onClose=()=>openInfo(null);
 let pointerStart=null;
 const down=e=>{
  if(e.button!==undefined&&e.button!==0)return;
  pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};
 };
 const up=e=>{
  if(!toggle.checked||!warnings.length||!pointerStart||pointerStart.id!==e.pointerId)return;
  const p=pointerStart;pointerStart=null;
  if(Math.hypot(p.x-e.clientX,p.y-e.clientY)>12||performance.now()-p.time>850)return;
  if(e.target?.closest?.("#nav,#controlSidebar,#officialBomWarningInfo,#floodRoadClosureInfo,#powerOutageInfo,#riverGaugeInfo,#qfdTechnicalRescueInfo"))return;
  const rect=canvas.getBoundingClientRect(),xy=new CesiumRef.Cartesian2(e.clientX-rect.left,e.clientY-rect.top);
  // Existing operational incident markers take selection priority.
  const picked=viewer.scene.drillPick(xy,8,18,18)||[];
  if(picked.some(x=>{const entity=x.id??x.primitive?.id;
   return entity?.stormTrackerRoadClosureId||entity?.stormTrackerPowerOutageId||
    entity?.stormTrackerRiverGaugeId||entity?.stormTrackerRainGaugeId||
    entity?.stormTrackerQfdRescueId;}))return;
  const ray=viewer.camera.getPickRay(xy);
  const hit=ray?viewer.scene.globe.pick(ray,viewer.scene):null;
  if(!hit)return;
  const loc=CesiumRef.Cartographic.fromCartesian(hit),lng=CesiumRef.Math.toDegrees(loc.longitude),
    lat=CesiumRef.Math.toDegrees(loc.latitude);
  const matching=filterOfficialWarnings(warnings,filter.value)
    .filter(w=>warningContainsPoint(w.geometry,lng,lat));
  if(matching.length)openInfo(matching.at(-1));
 };
 toggle.addEventListener("change",onToggle);
 filter.addEventListener("change",onProductChange);
 reportButton.addEventListener("click",openGroups);
 reportClose.addEventListener("click",closeGroups);
 refreshBtn.addEventListener("click",onRefresh);
 dismiss.addEventListener("click",onClose);
 canvas.addEventListener("pointerdown",down);
 canvas.addEventListener("pointerup",up);
 timer=setInterval(()=>{trimExpired();if(toggle.checked&&now()-lastAttemptAt>=INTERVAL_MS)void refresh();},60000);
 report("BoM warning polygons off");
 return {refresh,destroy(){
  destroyed=true;if(timer)clearInterval(timer);discard();warnings=[];openInfo(null);
  toggle.removeEventListener("change",onToggle);
  filter.removeEventListener("change",onProductChange);
  reportButton.removeEventListener("click",openGroups);
  reportClose.removeEventListener("click",closeGroups);
  if(reportDialog.open)reportDialog.close();
  refreshBtn.removeEventListener("click",onRefresh);
  dismiss.removeEventListener("click",onClose);
  canvas.removeEventListener("pointerdown",down);
  canvas.removeEventListener("pointerup",up);
 }};
}
