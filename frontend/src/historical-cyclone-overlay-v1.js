import {
  HISTORICAL_CYCLONE_IDS,validateHistoricalCycloneBundle,
  historicalCycloneMoments,historicalCycloneSnapshot,
  nestedHistoricalPolygonPositions
} from "./historical-cyclone-replay-v1.js?v=representative-cyclones-qa-v1";

// Isolated, opt-in QA layer. No polling, no background renderer work,
// no mutation of the primary or secondary BoM imagery and 3-D layers.
export function mountHistoricalCycloneQA({Cesium,viewer,sidebar,documentRef=document,fetchRef=fetch,
  caseIds=HISTORICAL_CYCLONE_IDS,defaultWind=true,onStateChange=()=>{},
  focusCoordinates=null}){
  if(!Array.isArray(caseIds)||!caseIds.length||
    caseIds.some(id=>!HISTORICAL_CYCLONE_IDS.includes(id)))
    throw new Error("Invalid Queensland historical case selection");
  if(!sidebar||!viewer?.entities||!Cesium)
    throw new TypeError("Historical cyclone QA requires Cesium and a sidebar");
  const create=(tag,text)=>{
    const el=documentRef.createElement(tag);
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const panel=create("details");
  panel.id="historicalCycloneQaPanel";
  panel.style.cssText="margin:8px 0;padding:8px;border:1px solid #426579;border-radius:7px;min-width:0;overflow-wrap:anywhere";
  panel.appendChild(create("summary","Queensland observed archive · no forecast"));
  const notice=create("p","QUEENSLAND / BoM OBSERVED archive. NOT a forecast, NOT a cyclone uncertainty cone, NOT LIVE. Optional actual issued wind areas are distinct from forecast uncertainty.");
  notice.style.cssText="margin:8px 0;font-size:11px;line-height:1.5;color:#ffd78c";
  panel.appendChild(notice);
  const pick=create("select");pick.id="historicalCycloneSelect";
  pick.style.cssText="width:100%;max-width:100%;padding:6px;margin:4px 0";
  for(const [id,name] of [
    ["alfred-2025","PRIMARY — TC Alfred 2025 (SE QLD / NSW)"],
    ["narelle-2026","STRESS — TC Narelle 2026 (severe wind footprints)"],
    ["jasper-2023","FAR NORTH — TC Jasper 2023"],
    ["koji-2026","SMOKE TEST — TC Koji 2026"],
    ["yasi-2011","BEST TRACK ONLY — TC Yasi 2011"]
  ].filter(([id])=>caseIds.includes(id))){
    const opt=create("option",name);
    opt.value=id;pick.appendChild(opt);
  }
  pick.value=caseIds[0];
  panel.appendChild(pick);
  const toggleLabel=create("label");
  toggleLabel.style.cssText="display:flex;align-items:center;gap:6px;margin:6px 0";
  const toggle=create("input");toggle.type="checkbox";toggle.id="historicalCycloneEnabled";
  toggleLabel.append(toggle,documentRef.createTextNode("Display authentic archived track"));
  panel.appendChild(toggleLabel);
  const windLabel=create("label");
  windLabel.style.cssText="display:flex;align-items:center;gap:6px;margin:6px 0";
  const showWind=create("input");showWind.type="checkbox";showWind.checked=Boolean(defaultWind);
  showWind.id="historicalCycloneWindPolygons";
  windLabel.append(showWind,documentRef.createTextNode("Show issued historical cyclone wind footprints"));
  panel.appendChild(windLabel);
  const timeLabel=create("label","Archived observation / issue time");
  timeLabel.style.cssText="display:block;margin:8px 0 2px;font-size:11px";
  panel.appendChild(timeLabel);
  const range=create("input");
  range.type="range";range.min="0";range.max="0";range.value="0";range.step="1";
  range.id="historicalCycloneTime";range.style.cssText="width:100%;margin:3px 0";
  range.disabled=true;panel.appendChild(range);
  const button=create("button","Focus cyclone");
  button.type="button";button.style.cssText="max-width:100%;padding:7px 10px;margin:3px 0";
  panel.appendChild(button);
  const status=create("p","Select a historical cyclone, then enable the archived track.");
  status.id="historicalCycloneStatus";
  status.style.cssText="margin:7px 0;font:11px/1.55 system-ui;white-space:pre-wrap;overflow-wrap:anywhere";
  panel.appendChild(status);
  const links=create("p");
  links.style.cssText="margin:5px 0;font-size:10px";
  const a=create("a","BoM cyclone database");
  a.href="https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/";
  a.target="_blank";a.rel="noopener noreferrer";links.appendChild(a);
  panel.appendChild(links);
  sidebar.appendChild(panel);

  const cache=new Map();
  let seq=0,bundle=null,moments=[],entities=[];
  const activeEntities=new Map();
  let sourceGeometryCache=new WeakMap();
  function clearEntities(){
    for(const entity of activeEntities.values())viewer.entities.remove(entity);
    activeEntities.clear();
    entities=[];
    // Free old source-specific geometry references when switching cases.
    sourceGeometryCache=new WeakMap();
    viewer.scene?.requestRender?.();
  }
  function retain(key,entityFactory,needed){
    needed.add(key);
    if(activeEntities.has(key))return activeEntities.get(key);
    const created=viewer.entities.add(entityFactory());
    activeEntities.set(key,created);
    entities.push(created);
    return created;
  }
  function retireStale(needed){
    for(const [key,entity] of activeEntities){
      if(needed.has(key))continue;
      viewer.entities.remove(entity);
      activeEntities.delete(key);
    }
    entities=[...activeEntities.values()];
  }
  const colours={
    Damaging:Cesium.Color.fromCssColorString("#eeb936"),
    Destructive:Cesium.Color.fromCssColorString("#ec583c"),
    "Very Destructive":Cesium.Color.fromCssColorString("#b32cd5")
  };
  const stamp=utc=>{
    if(!utc)return "No time";
    const date=new Date(utc);
    return date.toLocaleString("en-AU",{timeZone:"Australia/Brisbane",
      year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})+" AEST";
  };
  function draw(){
    if(!toggle.checked||!bundle||!moments.length){
      clearEntities();onStateChange(null);return;
    }
    const needed=new Set();
    const index=Math.min(moments.length-1,Math.max(0,Number(range.value)||0));
    const snapshot=historicalCycloneSnapshot(bundle,moments[index]);
    // The entire archived line is historical context, never a future
    // forecast at the scrubber's time. Only observed fixes through the
    // selected actual timestamp receive visible position points.
    for(let trackNumber=0;trackNumber<bundle.track.length;trackNumber++){
      const track=bundle.track[trackNumber];
      const line=track.geometry.coordinates;
      retain("track:"+trackNumber,()=>({
        name:bundle.title+" — full observed historical best track",
        description:"Complete post-event observed/reanalysed track. Not a historical forecast.",
        polyline:{
          positions:Cesium.Cartesian3.fromDegreesArray(line.flatMap(p=>p.slice(0,2))),
          width:3,clampToGround:true,
          material:Cesium.Color.CYAN.withAlpha(0.85)
        }
      }),needed);
    }
    for(const f of snapshot.fixesSoFar){
      const isCurrent=f===snapshot.latestFix;
      const category=Number.isInteger(f.category)?f.category:null;
      const label=isCurrent?bundle.title+" · "+stamp(f.utc):undefined;
      retain("fix:"+f.id+":"+(isCurrent?"active":"past"),()=>({
        name:bundle.title+" — observed fix",
        description:"ARCHIVED observed/reanalysed position · "+stamp(f.utc)+
          (category===null?"":(" · Category "+category))+
          (f.centralPressureHpa==null?"":(" · Central pressure "+f.centralPressureHpa+" hPa")),
        position:Cesium.Cartesian3.fromDegrees(f.position[0],f.position[1]),
        point:{
          pixelSize:isCurrent?12:6,
          color:category===null?Cesium.Color.CYAN:
            category>=4?Cesium.Color.MAGENTA:
            category>=2?Cesium.Color.RED:Cesium.Color.YELLOW,
          outlineColor:Cesium.Color.BLACK,outlineWidth:2,
          heightReference:Cesium.HeightReference.CLAMP_TO_GROUND
        },
        ...(label?{label:{
          text:label,font:"bold 13px sans-serif",
          horizontalOrigin:Cesium.HorizontalOrigin.LEFT,
          pixelOffset:new Cesium.Cartesian2(12,-20),
          fillColor:Cesium.Color.WHITE,
          outlineColor:Cesium.Color.BLACK,outlineWidth:3,
          style:Cesium.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance:Number.POSITIVE_INFINITY
        }}:{})
      }),needed);
    }
    let polygons=0;
    if(showWind.checked){
      for(const area of snapshot.windAtIssue){
        const fill=colours[area.windType]??Cesium.Color.YELLOW;
        // All original source vertices and inner holes are preserved.
        // Multiple geometry parts remain separate on the globe.
        let drawn=sourceGeometryCache.get(area);
        if(!drawn){
          // Original source polygons and complete inner-hole rings are
          // converted to Cesium positions once for the archive's lifetime,
          // not reallocated across every slider movement or Cesium tick.
          const polygonParts=area.geometry.type==="Polygon"
            ?[area.geometry.coordinates]:area.geometry.coordinates;
          drawn={
            hierarchies:nestedHistoricalPolygonPositions(area.geometry,Cesium),
            boundaries:polygonParts.map(part=>part.map(ring=>
              Cesium.Cartesian3.fromDegreesArray(ring.flatMap(p=>p.slice(0,2)))
            ))
          };
          sourceGeometryCache.set(area,drawn);
        }
        drawn.hierarchies.forEach((hierarchy,partIndex)=>{
          const key="wind:"+area.id+":"+partIndex;
          retain(key,()=>({
            name:bundle.title+" — archived "+area.windType+" cyclone winds",
            description:"HISTORICAL CYCLONE WIND FOOTPRINT, NOT a thunderstorm warning. Original issued "+stamp(area.issueUtc)+"; archived valid time "+stamp(area.validUtc??area.issueUtc)+".",
            polygon:{
              hierarchy,
              material:fill.withAlpha(0.28),
              // Cesium cannot draw polygon outline:true on clamped terrain
              // and warns on every generated Entity. Use a separate true
              // terrain-following source-vertex polyline for each boundary.
              classificationType:Cesium.ClassificationType.BOTH,
              zIndex:15
            }
          }),needed);
          drawn.boundaries[partIndex].forEach((positions,ringIndex)=>{
            retain("wind-border:"+area.id+":"+partIndex+":"+ringIndex,()=>({
              name:bundle.title+" — archived "+area.windType+" boundary",
              description:"Original full-resolution archived cyclone wind boundary. Not live.",
              polyline:{
                positions,
                width:2,
                clampToGround:true,
                material:fill.withAlpha(0.95)
              }
            }),needed);
          });
          polygons++;
        });
      }
    }
    // Diff the existing Cesium entities instead of rebuilding full 1405-
    // vertex storm polygons and their GPU buffers on every scrub step.
    retireStale(needed);
    status.textContent=[
      "Historical "+bundle.title+" · NOT LIVE",
      "Selected: "+stamp(snapshot.utc),
      "Recorded positions through time: "+snapshot.fixesSoFar.length+"/"+bundle.fixes.length,
      "Archived wind polygons at this exact issue: "+polygons,
      bundle.id==="yasi-2011"?
        "Yasi wind/warning polygons are not in this source. None are fabricated.":
        "ARCHIVED cyclone wind footprints, NOT severe-thunderstorm warnings. Original issue times only.",
      "Source: "+snapshot.originalSourceLabel
    ].join("\n");
    viewer.scene?.requestRender?.();
    onStateChange(bundle.id);
  }
  async function load(){
    const mine=++seq;
    clearEntities();bundle=null;moments=[];range.disabled=true;
    onStateChange(null);
    if(!toggle.checked){
      status.textContent="Historical cyclone overlay off.";
      return;
    }
    const id=pick.value;
    if(!HISTORICAL_CYCLONE_IDS.includes(id))return;
    status.textContent="Loading authentic historical cyclone archive...";
    try{
      let data=cache.get(id);
      if(!data){
        const response=await fetchRef("./data/cyclone-history/"+id+".json",{cache:"force-cache"});
        if(!response.ok)throw new Error("Historical source unavailable ("+response.status+")");
        data=validateHistoricalCycloneBundle(await response.json());
        cache.set(id,data);
      }
      if(mine!==seq||!toggle.checked)return;
      bundle=data;moments=historicalCycloneMoments(bundle);
      range.max=String(moments.length-1);
      // Choose the last genuine archived wind issuance to demonstrate
      // real original polygons immediately (rather than a final fix after
      // all source wind issuance has ceased).
      const selectedTime=showWind.checked&&bundle.windAreaAvailableTimes.length
        ?bundle.windAreaAvailableTimes.at(-1):moments.at(-1);
      range.value=String(Math.max(0,moments.indexOf(selectedTime)));
      range.disabled=false;
      showWind.disabled=id==="yasi-2011";
      draw();
    }catch(error){
      if(mine!==seq)return;
      status.textContent="Historical archive unavailable: "+String(error?.message??error);
      onStateChange(null);
    }
  }
  function focus(){
    if(!bundle)return;
    const points=bundle.fixes.map(f=>f.position);
    const margin=bundle.id==="yasi-2011"?2.4:1.5;
    // This app disables Cesium native camera inputs. The camera guardian
    // restores unauthorized direct camera.flyTo() motion after 250ms.
    // Feed the original archived fixes to the owning controller instead.
    if(typeof focusCoordinates!=="function"){
      status.textContent="Focus unavailable: StormTracker camera controller not ready.";
      return;
    }
    focusCoordinates(points,{marginDegrees:margin});
  }
  toggle.addEventListener("change",load);
  pick.addEventListener("change",load);
  showWind.addEventListener("change",draw);
  range.addEventListener("input",draw);
  button.addEventListener("click",focus);
  return {
    panel,pick,toggle,range,showWind,status,load,draw,focus,
    dispose(){seq++;clearEntities();panel.remove();},
    get entityCount(){return entities.length;},
    get activeCase(){return bundle?.id??null;}
  };
}
