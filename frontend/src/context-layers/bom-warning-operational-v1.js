import {createWarningImageryProvider,warningContainsPoint} from "./bom-warning-terrain-imagery-v1.js";
import {formatAgencyTimestamp} from "./agency-source-time-v1.js?v=20261027-agency-panels-v1";
const SOURCE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
const SCHEMA="StormTrackerOfficialBoMWarningPolygonsV1",INTERVAL_MS=5*60*1000;
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
   refreshBtn=$("refreshOfficialBomWarnings");
 if(!viewer||!CesiumRef||![toggle,state,panel,content,title,dismiss,refreshBtn].every(Boolean))
  return {destroy(){}};
 let warnings=[],imagery=null,loadedAt=0,pending=null,timer=null,activeId="",destroyed=false;
 const canvas=viewer.scene.canvas;
 const report=(message,kind="normal")=>{
  state.textContent=message;state.dataset.kind=kind;
 };
 const discard=()=>{
  if(imagery){
   viewer.imageryLayers.remove(imagery,true);imagery=null;
  }
  viewer.scene.requestRender();
 };
 function display(){
  discard();
  if(!toggle.checked||!warnings.length)return;
  imagery=new CesiumRef.ImageryLayer(createWarningImageryProvider(CesiumRef,warnings),{
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
  textRow(content,"Product",warning.productType==="detailed"?
   "Detailed BoM warning":"BoM warning area");
  textRow(content,"Issued",fmt(warning.issuedUtc));
  textRow(content,"Expires",fmt(warning.expiresUtc));
  textRow(content,"Severity / certainty",[warning.severity,warning.certainty].filter(Boolean).join(" · "));
  textRow(content,"Warning area",warning.areaDescription);
  textRow(content,"BoM warning details",warning.description);
  textRow(content,"Safety advice",warning.instruction);
  textRow(content,"Affected Queensland LGAs",warning.lgaStatus==="verified"?
   warning.lgas.length?warning.lgas.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Affected disaster districts (DDMGs)",warning.ddmgStatus==="verified"?
   warning.ddmgs.length?warning.ddmgs.join(" · "):"None intersect the published polygon":
   "Official boundary verification unavailable — not an all-clear");
  textRow(content,"Intersection rule","Every genuine intersecting LGA/DDMG, regardless of overlap size.");
  const link=document.createElement("a");
  link.href=officialUrl(warning.bulletinUrl);
  link.textContent="Read official BoM warning";link.target="_blank";link.rel="noopener noreferrer";
  content.append(link);
  panel.hidden=false;
 }
 function trimExpired(){
  const valid=warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
  if(valid.length!==warnings.length){
   warnings=valid;display();
   if(activeId&&!warnings.some(w=>w.id===activeId))openInfo(null);
   report(valid.length?valid.length+" active BoM warning area(s)":
     "Published warnings expired · no verified current warning polygons", "warning");
  }
 }
 async function refresh({force=false}={}){
  if(!toggle.checked||destroyed)return;
  if(pending)return pending;
  if(!force&&loadedAt&&now()-loadedAt<INTERVAL_MS){trimExpired();return;}
  report("Checking issued Bureau of Meteorology warning polygons…","loading");
  pending=(async()=>{
   try{
    const res=await fetchImpl(SOURCE,{cache:"no-store",signal:AbortSignal.timeout(27000)});
    if(!res.ok)throw Error("Official warning transport HTTP "+res.status);
    const data=await res.json();
    if(data?.schema!==SCHEMA||!Array.isArray(data.warnings)||
      !["active","no-verified-current-polygons","partial-source-unavailable"].includes(data.status))
      throw Error(data?.message||"Official CAP source unavailable");
    warnings=data.warnings.filter(w=>isVerifiedActiveBomWarning(w,now()));
    loadedAt=now();display();
    if(activeId)openInfo(warnings.find(w=>w.id===activeId)??null);
    report(warnings.length?
       warnings.length+" current BoM warning polygon(s) · refreshed "+fmt(data.checkedAt)+
        (data.sourceFailures?" · some CAP products unavailable":""):
       "No currently verified BoM warning polygons in this source · check official BoM warnings",
       data.sourceFailures?"warning":"normal");
   }catch(error){
    // Fail closed: no stale polygons linger under radar as current warnings.
    warnings=[];loadedAt=0;display();openInfo(null);
    report("Warning polygons unavailable — "+String(error?.message??error).slice(0,120)+
       " · check official BoM warnings","error");
   }finally{pending=null;}
  })();
  return pending;
 }
 const onToggle=()=>{
  if(!toggle.checked){warnings=[];discard();openInfo(null);
   report("BoM warning polygons off");return;}
  void refresh({force:true});
 };
 const onRefresh=()=>{loadedAt=0;void refresh({force:true});};
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
  const matching=warnings.filter(w=>warningContainsPoint(w.geometry,lng,lat));
  if(matching.length)openInfo(matching.at(-1));
 };
 toggle.addEventListener("change",onToggle);
 refreshBtn.addEventListener("click",onRefresh);
 dismiss.addEventListener("click",onClose);
 canvas.addEventListener("pointerdown",down);
 canvas.addEventListener("pointerup",up);
 timer=setInterval(()=>{trimExpired();if(toggle.checked&&now()-loadedAt>=INTERVAL_MS)void refresh();},60000);
 report("BoM warning polygons off");
 return {refresh,destroy(){
  destroyed=true;if(timer)clearInterval(timer);discard();warnings=[];openInfo(null);
  toggle.removeEventListener("change",onToggle);
  refreshBtn.removeEventListener("click",onRefresh);
  dismiss.removeEventListener("click",onClose);
  canvas.removeEventListener("pointerdown",down);
  canvas.removeEventListener("pointerup",up);
 }};
}
