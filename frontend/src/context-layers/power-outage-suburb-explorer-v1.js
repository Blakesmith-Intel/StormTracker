import {formatIncidentRefreshTime} from "./incident-refreshed-time-v1.js?v=20261017-refresh-v1";
import {groupOutagesByLga,filterLgaGroups,councilOutageCustomerSummary,localityKey,resolveQueenslandLocalityLgas,UNKNOWN_LGA}
 from "./incident-lga-model-v1.js?v=council-customers-20261017-v1";
import {powerOfficialUrl} from "./official-source-links-v1.js?v=9.13.2";
import {resolveOutageCouncilNames} from "./outage-lga-geographic-fallback-v1.js?v=outage-spatial-councils-20261017-v1";
import {groupOutagesBySuburb,filterOutageSuburbGroups,outageLocation}
  from "./power-outage-suburb-model-v1.js?v=suburb-explorer-20261017-v1";

// View over the EXISTING layer snapshot; no duplicate requests, no map pick,
// no new Cesium entities, no weather-frame redraws.
export function createPowerOutageSuburbExplorer({
  viewer,CesiumRef,mapCamera,refresh=()=>Promise.resolve(),getLoadedAt=()=>0,formatTime=()=>""
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
  const sidebarOutages=byId("sidebarPowerOutageCount");
  const sidebarCustomers=byId("sidebarPowerCustomerCount");
  const refreshEl=byId("sidebarPowerLastRefresh");
  let lastSuccessfulAt=0;
  function updateSourceRefreshLabel(){
    if(!refreshEl)return;
    const report=status;
    const failed=report.kind==="error";
    const expired=failed&&/source expired|old .* markers removed/i.test(report.message||"");
    const ms=lastSuccessfulAt||Number(getLoadedAt());
    refreshEl.textContent=formatIncidentRefreshTime(ms,{failed,expired});
    if(ms>0)refreshEl.dateTime=new Date(ms).toISOString();
    else refreshEl.removeAttribute("datetime");
  }
  function updateSidebarCounters(){
    if(!sidebarOutages||!sidebarCustomers)return;
    if(!hasSnapshot){
      sidebarOutages.textContent=status.kind==="error"?"Unavailable":"Checking…";
      sidebarCustomers.textContent="Customers: —";
      return;
    }
    const seen=new Map();
    for(const suburb of suburbGroups)
      for(const item of suburb.items)if(!seen.has(item.id))seen.set(item.id,item);
    const count=seen.size;
    const total=[...seen.values()].reduce((sum,item)=>{
      const value=Number(item.summary.customersAffected);
      return sum+(Number.isFinite(value)&&value>=0?value:0);
    },0);
    sidebarOutages.textContent=count+" outage"+(count===1?"":"s");
    sidebarCustomers.textContent=total.toLocaleString("en-AU")+" customers affected";
    opener.setAttribute("aria-label",
      "Browse "+count+" unplanned power outages affecting "+total+" customers by council");
  }

  let groups=[],suburbGroups=[],lgaCache=new Map(),attempted=new Set(),lookupBusy=false;
  let status={kind:"loading",message:"Waiting for live outage feed…"};
  let openKeys=new Set(),visibleLimit=60,hasSnapshot=false;
  let loading=false,disposed=false;
  // Suburb name is a direct route to its published outage geometry.
  // The disclosure arrow/count remain for expanding the incident table.
  function focusPublishedOutages(items){
    const points=[...new Map((items||[]).map(item=>[item.id,item])
      .map(([id,item])=>[id,outageLocation(item.feature)])
      .filter(([,coord])=>coord)).values()];
    if(!points.length)return false;
    dialog.close();
    if(byId("measureToggle")?.getAttribute("aria-pressed")==="true")
      byId("measureClose")?.click();
    // Reuse the existing map layer visibility control. Never change map
    // picking, polygon handlers or the provider's incident geometries.
    const checkbox=byId("showPowerOutages");
    if(checkbox && !checkbox.checked)checkbox.click();
    // Cesium camera.flyTo is overridden by StormTracker's managed camera
    // state on the next correction tick. Navigate through the controller.
    if (!mapCamera?.setView) throw Error("Managed map navigation is unavailable");
    const lons=points.map(point=>point.longitude);
    const lats=points.map(point=>point.latitude);
    const west=Math.min(...lons),east=Math.max(...lons);
    const south=Math.min(...lats),north=Math.max(...lats);
    const latitude=(south+north)/2;
    const longitude=(west+east)/2;
    const spanMetres=Math.max(
      (east-west)*111320*Math.cos(latitude*Math.PI/180),
      (north-south)*111320
    );
    mapCamera.setView({
      longitude,latitude,targetHeight:0,heading:0,
      pitch:CesiumRef.Math.toRadians(-80),
      range:Math.min(5000000,Math.max(13000,13000+spanMetres*2.5))
    });
    return true;
  }

  function field(grid,label,value){
    const text=String(value??"").trim();
    if(!text)return;
    const dt=create("dt","",label),dd=create("dd","",text);
    grid.append(dt,dd);
  }
  function render(){
    if(!dialog.open || disposed)return;
    results.replaceChildren();
    const matching=filterLgaGroups(groups,search.value);
    const listed=matching.slice(0,visibleLimit);
    const unique=new Set(matching.flatMap(g=>g.items.map(i=>i.id)));
    summary.textContent=hasSnapshot
      ? `${matching.length} council areas · ${unique.size} distinct outages`
      : "Waiting for outage information";
    if(!hasSnapshot){
      results.append(create("p","outage-empty","Outage data hasn't loaded. Press Refresh to retry."));
    }else if(!matching.length){
      results.append(create("p","outage-empty",search.value
        ? "No matching council areas, suburbs or outage details.":
          "No unplanned outages are currently reported in this feed."));
    }
    for(const council of listed){
      const parent=create("details","outage-suburb outage-council");
      parent.open=openKeys.has("lga:"+council.key);
      parent.addEventListener("toggle",()=>parent.open
        ?openKeys.add("lga:"+council.key):openKeys.delete("lga:"+council.key));
      const parentTitle=create("summary","outage-suburb-title");
      const totals=councilOutageCustomerSummary(council,groups);
      const badges=create("span","outage-council-metrics");
      badges.append(
        create("span","outage-suburb-count",
          `${totals.outages} outage${totals.outages===1?"":"s"}`),
        create("span","outage-council-customers",
          `${number(totals.customers)} customer${totals.customers===1?"":"s"}`)
      );
      if(totals.crossCouncilEvents){
        badges.append(create("span","outage-council-shared","Shared*"));
        badges.title="Includes outage-wide customer totals for events listed in more than one council. These are not council-specific customer allocations.";
      } else {
        badges.title="Unique outage IDs within this council; customers affected as reported by the electricity providers.";
      }
      parentTitle.append(create("span","outage-suburb-name",council.name),badges);
      parent.append(parentTitle);
      const parentInner=create("div","outage-suburb-inner outage-lga-inner");
      if(council.name===UNKNOWN_LGA)
        parentInner.append(create("p","outage-suburb-note",
          "Council could not be verified from the official Queensland locality data."));
      if(totals.crossCouncilEvents)
        parentInner.append(create("p","outage-suburb-note",
          "* Shared outages can appear under multiple councils. Customer totals represent entire provider events, not customers allocated to each council."));
      for(const group of council.suburbs){
      const section=create("details","outage-suburb outage-locality");
      section.open=openKeys.has(group.key);
      section.addEventListener("toggle",()=>{
        if(section.open)openKeys.add(group.key);
        else openKeys.delete(group.key);
      });
      const title=create("summary","outage-suburb-title");
      const suburbName=create("button","outage-suburb-map",group.name+" ↗");
      suburbName.type="button";
      const hasMappedEvent=group.items.some(item=>Boolean(outageLocation(item.feature)));
      suburbName.disabled=!hasMappedEvent;
      suburbName.title=hasMappedEvent
        ?"Show this suburb's published outage locations on the map"
        :"No geographic outage location was published";
      suburbName.setAttribute("aria-label",
        "Show outages for "+group.name+" on the map");
      suburbName.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        focusPublishedOutages(group.items);
      });
      title.append(
        suburbName,
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
        const coords=outageLocation(item.feature);
        // Incident title is the primary map-navigation action; expanding the
        // suburb or the secondary Details expander never navigates.
        const navigate=()=>focusPublishedOutages([item]);
        const title=create("button","outage-row-locate",
          info.provider+(info.eventId?` · #${info.eventId}`:" · Fault"));
        title.type="button";
        title.disabled=!coords;
        title.title=coords?"Go to the outage on the map":"Location not provided by outage source";
        title.setAttribute("aria-label",coords
          ?`Show ${info.provider} outage ${info.eventId||""} in ${group.name} on map`
          :`Location unavailable for ${info.provider} outage`);
        if(coords)title.addEventListener("click",navigate);
        eventCell.append(title);
        const detail=create("details","outage-event");
        const label=create("summary","","Details");
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
        row.append(eventCell,customers,eta);
        if(coords){
          row.classList.add("outage-clickable-row");
          row.title="Tap this outage row to view its location on the map";
          row.addEventListener("click",event=>{
            if(event.target.closest("button,a,summary,details"))return;
            navigate();
          });
        }
        tbody.append(row);
      }
      table.append(tbody);inner.append(table);section.append(inner);
      parentInner.append(section);
      }
      parent.append(parentInner);
      results.append(parent);
    }
    more.hidden=visibleLimit>=matching.length;
    if(!more.hidden)more.textContent=`Show more council areas (${matching.length-visibleLimit} remaining)`;
  }
  let latestFeatures=[];
  function updateFeaturesFromLatest(){updateFeatures(latestFeatures);}
  function updateFeatures(features){
    latestFeatures=features;
    suburbGroups=groupOutagesBySuburb(features);
    updateSidebarCounters();
    groups=groupOutagesByLga(suburbGroups,lgaCache);
    // A missing or ambiguous locality remains explicitly unverified.
    // Locality attributes are looked up only for names present in the SAME feed.
    const unknown=suburbGroups.map(g=>g.name).filter(name=>{
      const key=localityKey(name);
      return key!=="SUBURB NOT SUPPLIED"&&(!lgaCache.has(key)||lgaCache.get(key)===UNKNOWN_LGA)&&!attempted.has(key);
    });
    if(unknown.length&&!lookupBusy){
      unknown.forEach(name=>attempted.add(localityKey(name)));
      lookupBusy=true;
      state.textContent=(status.message||"")+" · Verifying council areas…";
      resolveOutageCouncilNames(unknown,suburbGroups,{existing:lgaCache}).then(result=>{
        if(disposed)return;
        for(const [key,value] of result)lgaCache.set(key,value);
        groups=groupOutagesByLga(suburbGroups,lgaCache);
        const verified=groups.filter(group=>group.name!==UNKNOWN_LGA).length;
        const stillUnknown=groups.some(group=>group.name===UNKNOWN_LGA);
        state.textContent=(status.message||"")+" · "+verified+" LGAs verified"+
          (stillUnknown?" · Unresolved locations retained":"");
        if(dialog.open)render();
      }).catch(error=>{
        console.warn("Official outage LGA lookup unavailable:",error.message);
        state.textContent=(status.message||"")+" · Council lookup unavailable (unverified shown)";
      }).finally(()=>{
        lookupBusy=false;
        // A newer outage snapshot may have arrived while the lookup was in
        // progress. Resolve its additional localities without waiting for
        // another 15-minute polling cycle.
        if(!disposed && hasSnapshot){
          const remaining=suburbGroups.map(g=>g.name).filter(name=>{
            const key=localityKey(name);
            return key!=="SUBURB NOT SUPPLIED"&&!lgaCache.has(key)&&!attempted.has(key);
          });
          if(remaining.length)updateFeaturesFromLatest();
        }
      });
    }
    hasSnapshot=true; // [] from the layer means none, or stale data was removed.
    if(dialog.open)render();
  }
  function updateStatus(next){
    if(next)status=next;
  const checkedAt=Number(status.loadedAt);
  if(Number.isFinite(checkedAt) && checkedAt>0)lastSuccessfulAt=checkedAt;
    if(status.kind==="error" && /source expired|old outage markers removed/i.test(status.message||"")){hasSnapshot=false;groups=[];suburbGroups=[];openKeys.clear();}
    const kind=status.kind||"normal";
    state.dataset.kind=kind;
    state.textContent=status.message||"Current unplanned outage data";
    updateSourceRefreshLabel();
    updateSidebarCounters();
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
  const onOpen=()=>{
    // Give a previously failed official lookup another chance whenever the
    // user opens this panel, without a hot-loop of automatic retries.
    attempted.clear();
    if(hasSnapshot)updateFeaturesFromLatest();
    open();
  };
  const onClose=()=>dialog.close();
  const onSearch=()=>{visibleLimit=60;render();};
  const onMore=()=>{visibleLimit+=60;render();};
  const onRefresh=()=>{
    if(loading)return;
    attempted.clear();
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
  updateSourceRefreshLabel();
  updateSidebarCounters();
  return {updateFeatures,updateStatus,destroy};
}
