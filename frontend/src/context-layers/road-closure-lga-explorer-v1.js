import {groupRoadClosuresByLga,searchRoadCouncilGroups} from "./road-closure-lga-model-v1.js?v=roads-lga-20261017-v1";
import {roadOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
export function createRoadClosureLgaExplorer({
 viewer,CesiumRef,mapCamera,refresh=()=>Promise.resolve(),getLoadedAt=()=>0,formatTime=()=>"",
}={}){
 const $=id=>document.getElementById(id);
 const dialog=$("roadLgaExplorer"),openButton=$("openRoadLgaExplorer"),
  closeButton=$("closeRoadLgaExplorer"),input=$("roadLgaSearch"),
  list=$("roadLgaResults"),counter=$("roadLgaSummary"),
  status=$("roadLgaFeedStatus"),refreshButton=$("refreshRoadLgaExplorer");
 if(![dialog,openButton,closeButton,input,list,counter,status,refreshButton].every(Boolean))
  throw Error("Road closure LGA explorer controls missing");
 const make=(tag,cls,label)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(label!==undefined)node.textContent=String(label);
  return node;
 };
 let groups=[],feedStatus={kind:"loading",message:"Waiting for QLDTraffic…"},
   loaded=false,destroyed=false,busy=false;
 const openKeys=new Set();
 const sidebarCount=$("sidebarRoadClosureCount");
 function updateSidebarCount(){
  if(!sidebarCount)return;
  if(!loaded){
   sidebarCount.textContent=feedStatus.kind==="error"?"Unavailable":"Checking…";
   return;
  }
  const count=new Set(groups.flatMap(group=>group.items.map(item=>item.id))).size;
  sidebarCount.textContent=count+" closure"+(count===1?"":"s");
  openButton.setAttribute("aria-label","Browse "+count+" unplanned all-traffic road closures by council");
 }

 function addDetail(dl,label,value){
  const text=String(value??"").trim();if(!text)return;
  dl.append(make("dt","",label),make("dd","",text));
 }
 function fly(location){
  if(!Array.isArray(location)||location.length<2)return;
  if(!Number.isFinite(location[0])||!Number.isFinite(location[1]))return;
  dialog.close();
  if($("measureToggle")?.getAttribute("aria-pressed")==="true")
    $("measureClose")?.click();
  // The managed StormTracker camera is authoritative. A raw Cesium flyTo
  // gets cancelled by its camera correction guard before the map can move.
  if (!mapCamera?.setView) throw Error("Managed map navigation is unavailable");
  mapCamera.setView({
   longitude:location[0],latitude:location[1],targetHeight:0,
   range:20000,heading:0,pitch:CesiumRef.Math.toRadians(-75)
  });
 }
 function render(){
  if(!dialog.open||destroyed)return;
  list.replaceChildren();
  const matching=searchRoadCouncilGroups(groups,input.value);
  counter.textContent=loaded
   ?`${matching.length} council areas · ${new Set(matching.flatMap(g=>g.items.map(i=>i.id))).size} distinct closures`
   :"Waiting for road closure information";
  if(!loaded||!matching.length)
   list.append(make("p","outage-empty",!loaded
    ?"Road closure data has not loaded. Press Refresh to retry."
    :input.value?"No matching council, locality or road.":"No current unplanned all-traffic closures in the available source."));
  for(const group of matching){
    const parent=make("details","outage-suburb outage-council");
    parent.open=openKeys.has("c:"+group.key);
    parent.addEventListener("toggle",()=>parent.open?openKeys.add("c:"+group.key):openKeys.delete("c:"+group.key));
    const header=make("summary","outage-suburb-title");
    header.append(make("span","outage-suburb-name",group.name),
      make("span","outage-suburb-count",`${group.items.length} closure${group.items.length===1?"":"s"}`));
    parent.append(header);
    const inner=make("div","outage-suburb-inner outage-lga-inner");
    for(const suburb of group.suburbs){
      const section=make("details","outage-suburb outage-locality");
      section.open=openKeys.has("s:"+group.key+":"+suburb.key);
      section.addEventListener("toggle",()=>section.open?
        openKeys.add("s:"+group.key+":"+suburb.key):
        openKeys.delete("s:"+group.key+":"+suburb.key));
      const name=make("summary","outage-suburb-title");
      name.append(make("span","outage-suburb-name",suburb.name),
        make("span","outage-suburb-count",String(suburb.items.length)));
      section.append(name);
      const content=make("div","road-closure-list");
      for(const item of suburb.items){
        const {summary:s,location}=item;
        const wrap=make("div","road-closure-item");
        const button=make("button","outage-row-locate",s.roadName||"Unnamed road");
        button.type="button";
        button.disabled=!Array.isArray(location);
        button.title=button.disabled?"Location unavailable":"Jump to this road closure on map";
        button.addEventListener("click",()=>fly(location));
        const subtitle=make("div","road-closure-caption",
          [s.impactSubtype||s.impactType,s.eventDueTo||s.eventSubtype||s.eventType].filter(Boolean).join(" · "));
        wrap.append(button,subtitle);
        const detail=make("details","outage-event");
        detail.append(make("summary","","Details"));
        const dl=make("dl","outage-event-attributes");
        addDetail(dl,"Location",s.locality);
        addDetail(dl,"Cause",s.eventDueTo||s.eventSubtype||s.eventType);
        addDetail(dl,"Closure",s.impactSubtype||s.impactType);
        addDetail(dl,"Direction",s.direction);
        addDetail(dl,"Started",formatTime(s.startTime));
        addDetail(dl,"Expected end",formatTime(s.endTime));
        addDetail(dl,"Last updated",formatTime(s.lastUpdated));
        addDetail(dl,"Next inspection",formatTime(s.nextInspection));
        addDetail(dl,"Advice",s.advice||s.information||s.description);
        detail.append(dl);
        const official=make("a","outage-source-link","QLDTraffic source");
        official.href=roadOfficialUrl(s.webLink);
        official.target="_blank"; official.rel="noopener noreferrer";
        detail.append(official);wrap.append(detail);content.append(wrap);
      }
      section.append(content);inner.append(section);
    }
    parent.append(inner);list.append(parent);
  }
 }
 function updateFeatures(features){groups=groupRoadClosuresByLga(features);loaded=true;updateSidebarCount();render();}
 function updateStatus(next){
  if(next)feedStatus=next;
  status.textContent=feedStatus.message||"QLDTraffic operational closure feed";
  status.dataset.kind=feedStatus.kind||"normal";
  if(feedStatus.kind==="error"&&/source expired|old closure markers removed/i.test(feedStatus.message||""))
   {loaded=false;groups=[];}
  updateSidebarCount();
  render();
 }
 const open=()=>{dialog.showModal();render();input.focus();if(!getLoadedAt()&&!busy)reload();};
 const close=()=>dialog.close(),search=()=>render();
 const reload=()=>{
  if(busy)return;
  busy=true;refreshButton.disabled=true;
  Promise.resolve().then(()=>refresh()).catch(error=>{
   status.dataset.kind="error";status.textContent="Refresh failed: "+error.message;
  }).finally(()=>{busy=false;refreshButton.disabled=false;});
 };
 openButton.addEventListener("click",open);
 closeButton.addEventListener("click",close);
 input.addEventListener("input",search);
 refreshButton.addEventListener("click",reload);
 updateSidebarCount();
 return {updateFeatures,updateStatus,destroy(){
  destroyed=true;
  openButton.removeEventListener("click",open);
  closeButton.removeEventListener("click",close);
  input.removeEventListener("input",search);
  refreshButton.removeEventListener("click",reload);
  if(dialog.open)dialog.close();
 }};
}
