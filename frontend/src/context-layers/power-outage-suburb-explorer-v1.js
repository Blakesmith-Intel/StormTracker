import {powerOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {groupOutagesBySuburb,filterOutageSuburbGroups,outageLocation}
  from "./power-outage-suburb-model-v1.js?v=suburb-explorer-20261017-v1";

// View over the EXISTING layer snapshot; no duplicate requests, no map pick,
// no new Cesium entities, no weather-frame redraws.
export function createPowerOutageSuburbExplorer({
  viewer,CesiumRef,refresh=()=>Promise.resolve(),getLoadedAt=()=>0,formatTime=()=>""
}={}){
  const byId=id=>document.getElementById(id);
  const dialog=byId("powerOutageExplorer");
  const opener=byId("openPowerOutageExplorer");
  const close=byId("closePowerOutageExplorer");
  const search=byId("outageSuburbSearch");
  const results=byId("outageSuburbResults");
  const summary=byId("outageSuburbSummary");
  const state=byId("outageSuburbFeedStatus");
  const more=byId("outageSuburbMore");
  const reload=byId("refreshPowerOutageExplorer");
  if(!dialog || !opener || !close || !search || !results || !summary || !state || !more || !reload)
    throw new Error("Power outage suburb explorer controls missing");
  const create=(tag,className,text)=>{
    const item=document.createElement(tag);
    if(className)item.className=className;
    if(text!==undefined)item.textContent=String(text);
    return item;
  };
  const number=v=>Number(v??0).toLocaleString("en-AU");
  let groups=[],status={kind:"loading",message:"Waiting for live outage feed…"};
  let openKeys=new Set(),visibleLimit=60,hasSnapshot=false;
  let loading=false,disposed=false;
  function field(grid,label,value){
    const text=String(value??"").trim();
    if(!text)return;
    const dt=create("dt","",label),dd=create("dd","",text);
    grid.append(dt,dd);
  }
  function render(){
    if(!dialog.open || disposed)return;
    results.replaceChildren();
    const matching=filterOutageSuburbGroups(groups,search.value);
    const listed=matching.slice(0,visibleLimit);
    const unique=new Set(matching.flatMap(g=>g.items.map(i=>i.id)));
    summary.textContent=hasSnapshot
      ? `${matching.length} suburbs · ${unique.size} distinct outages`
      : "Waiting for outage information";
    if(!hasSnapshot){
      results.append(create("p","outage-empty","Outage data hasn't loaded. Press Refresh to retry."));
    }else if(!matching.length){
      results.append(create("p","outage-empty",search.value
        ? "No matching suburbs or outage details.":
          "No unplanned outages are currently reported in this feed."));
    }
    for(const group of listed){
      const section=create("details","outage-suburb");
      section.open=openKeys.has(group.key);
      section.addEventListener("toggle",()=>{
        if(section.open)openKeys.add(group.key);
        else openKeys.delete(group.key);
      });
      const title=create("summary","outage-suburb-title");
      title.append(
        create("span","outage-suburb-name",group.name),
        create("span","outage-suburb-count",
          `${group.items.length} outage${group.items.length===1?"":"s"}`)
      );
      section.append(title);
      const inner=create("div","outage-suburb-inner");
      if(group.shared){
        inner.append(create("p","outage-suburb-note",
          "Shared events may affect several suburbs. Customer figures are provider-wide per event, not suburb totals."));
      }
      const table=create("table","outage-suburb-table");
      const head=create("thead"),hrow=create("tr");
      for(const name of ["Outage","Customers","Restoration"]) {
        const th=create("th","",name);th.scope="col";hrow.append(th);
      }
      head.append(hrow);table.append(head);
      const tbody=create("tbody");
      for(const item of group.items){
        const {summary:info}=item;
        const row=create("tr");
        const eventCell=create("td");
        const detail=create("details","outage-event");
        const label=create("summary","",info.provider+
          (info.eventId?` · #${info.eventId}`:" · Fault"));
        detail.append(label);
        const attrs=create("dl","outage-event-attributes");
        field(attrs,"Status",info.status);
        field(attrs,"Street(s)",info.streets);
        field(attrs,"Reason",info.reason);
        field(attrs,"Started",formatTime(info.start,info.provider));
        field(attrs,"Estimated restoration",formatTime(info.estimatedFix,info.provider));
        field(attrs,"Provider",info.attribution);
        detail.append(attrs);
        if(item.shared)detail.append(create("p","outage-suburb-note","Reported customer count covers the entire event, not this suburb alone."));
        const actions=create("div","outage-event-actions");
        const coords=outageLocation(item.feature);
        if(coords){
          const locate=create("button","outage-locate","Show on map");
          locate.type="button";
          locate.addEventListener("click",()=>{
            dialog.close();
            // A measurement shield intentionally blocks map taps while active.
            // Leave it off when navigating to an outage from the explorer.
            if(byId("measureToggle")?.getAttribute("aria-pressed")==="true")
              byId("measureDone")?.click();
            viewer.camera.flyTo({
              destination:CesiumRef.Cartesian3.fromDegrees(
                coords.longitude,coords.latitude,55000),
              orientation:{heading:0,pitch:CesiumRef.Math.toRadians(-55),roll:0},
              duration:0.9
            });
          });
          actions.append(locate);
        }
        const href=powerOfficialUrl(info.provider);
        if(href){
          const official=create("a","outage-source-link","Official provider");
          official.href=href; official.target="_blank";
          official.rel="noopener noreferrer";
          actions.append(official);
        }
        detail.append(actions);eventCell.append(detail);
        const customers=create("td","outage-customers",number(info.customersAffected));
        if(item.shared)customers.title="Shared incident: affected customer count is not assigned per suburb";
        const eta=create("td","outage-eta",
          formatTime(info.estimatedFix,info.provider)||"Not supplied");
        row.append(eventCell,customers,eta);tbody.append(row);
      }
      table.append(tbody);inner.append(table);section.append(inner);
      results.append(section);
    }
    more.hidden=visibleLimit>=matching.length;
    if(!more.hidden)more.textContent=`Show more suburbs (${matching.length-visibleLimit} remaining)`;
  }
  function updateFeatures(features){
    groups=groupOutagesBySuburb(features);
    hasSnapshot=true; // [] from the layer means none, or stale data was removed.
    if(dialog.open)render();
  }
  function updateStatus(next){
    if(next)status=next;
    if(status.kind==="error" && /source expired|old outage markers removed/i.test(status.message||""))hasSnapshot=false;
    const kind=status.kind||"normal";
    state.dataset.kind=kind;
    state.textContent=status.message||"Current unplanned outage data";
    // Expired snapshots were already cleared by createPowerOutageLayer.onUpdate([]).
    if(dialog.open)render();
  }
  function open(){
    if(disposed)return;
    if(!dialog.open)dialog.showModal();
    visibleLimit=60;
    render();
    search.focus();
    // Reuse the already running 15-minute polling of the same outage layer.
    // Only request an immediate source refresh when there has been no load.
    if(!getLoadedAt() && !loading){
      loading=true;
      Promise.resolve().then(()=>refresh()).catch(()=>{
        if(!hasSnapshot)state.textContent="Unable to load outages. Try Refresh.";
      }).finally(()=>{loading=false;});
    }
  }
  const onOpen=()=>open();
  const onClose=()=>dialog.close();
  const onSearch=()=>{visibleLimit=60;render();};
  const onMore=()=>{visibleLimit+=60;render();};
  const onRefresh=()=>{
    if(loading)return;
    loading=true;reload.disabled=true;
    refresh().catch(()=>{
      if(!hasSnapshot)state.textContent="Unable to load outages. Try Refresh.";
    }).finally(()=>{loading=false;reload.disabled=false;});
  };
  opener.addEventListener("click",onOpen);
  close.addEventListener("click",onClose);
  search.addEventListener("input",onSearch);
  more.addEventListener("click",onMore);
  reload.addEventListener("click",onRefresh);
  const destroy=()=>{
    disposed=true;
    opener.removeEventListener("click",onOpen);
    close.removeEventListener("click",onClose);
    search.removeEventListener("input",onSearch);
    more.removeEventListener("click",onMore);
    reload.removeEventListener("click",onRefresh);
    if(dialog.open)dialog.close();
  };
  return {updateFeatures,updateStatus,destroy};
}
