import {
  HISTORICAL_CYCLONE_IDS,validateHistoricalCycloneBundle,
  historicalCycloneMoments,historicalCycloneSnapshot,
  nestedHistoricalPolygonPositions
} from "./historical-cyclone-replay-v1.js?v=koji-yasi-historical-v1";

// Isolated, opt-in QA layer. No polling, no background renderer work,
// no mutation of the primary or secondary BoM imagery and 3-D layers.
export function mountHistoricalCycloneQA({Cesium,viewer,sidebar,documentRef=document,fetchRef=fetch}){
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
  panel.appendChild(create("summary","Historical cyclones — QA only"));
  const notice=create("p","HISTORICAL REPLAY · NOT LIVE · NOT A WARNING. Archived cyclone wind areas are NOT severe-thunderstorm warning polygons.");
  notice.style.cssText="margin:8px 0;font-size:11px;line-height:1.5;color:#ffd78c";
  panel.appendChild(notice);
  const pick=create("select");pick.id="historicalCycloneSelect";
  pick.style.cssText="width:100%;max-width:100%;padding:6px;margin:4px 0";
  for(const [id,name] of [["koji-2026","TC Koji (Jan 2026)"],["yasi-2011","Severe TC Yasi (2011)"]]){
    const opt=create("option",name);
    opt.value=id;pick.appendChild(opt);
  }
  panel.appendChild(pick);
  const toggleLabel=create("label");
  toggleLabel.style.cssText="display:flex;align-items:center;gap:6px;margin:6px 0";
  const toggle=create("input");toggle.type="checkbox";toggle.id="historicalCycloneEnabled";
  toggleLabel.append(toggle,documentRef.createTextNode("Display authentic archived track"));
  panel.appendChild(toggleLabel);
  const windLabel=create("label");
  windLabel.style.cssText="display:flex;align-items:center;gap:6px;margin:6px 0";
  const showWind=create("input");showWind.type="checkbox";showWind.checked=true;
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
  function clearEntities(){
    for(const entity of entities)viewer.entities.remove(entity);
    entities=[];
    viewer.scene?.requestRender?.();
  }
  function add(entity){const created=viewer.entities.add(entity);entities.push(created);return created;}
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
    clearEntities();
    if(!toggle.checked||!bundle||!moments.length)return;
    const index=Math.min(moments.length-1,Math.max(0,Number(range.value)||0));
    const snapshot=historicalCycloneSnapshot(bundle,moments[index]);
    // The entire archived line is historical context, never a future
    // forecast at the scrubber's time. Only observed fixes through the
    // selected actual timestamp receive visible position points.
    for(const track of bundle.track){
      const line=track.geometry.coordinates;
      add({
        name:bundle.title+" — full observed historical best track",
        description:"Complete post-event observed/reanalysed track. Not a historical forecast.",
        polyline:{
          positions:Cesium.Cartesian3.fromDegreesArray(line.flatMap(p=>p.slice(0,2))),
          width:3,clampToGround:true,
          material:Cesium.Color.CYAN.withAlpha(0.85)
        }
      });
    }
    for(const f of snapshot.fixesSoFar){
      const isCurrent=f===snapshot.latestFix;
      const category=Number.isInteger(f.category)?f.category:null;
      const label=isCurrent?bundle.title+" · "+stamp(f.utc):undefined;
      add({
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
      });
    }
    let polygons=0;
    if(showWind.checked){
      for(const area of snapshot.windAtIssue){
        const fill=colours[area.windType]??Cesium.Color.YELLOW;
        // All original source vertices and inner holes are preserved.
        // Multiple geometry parts remain separate on the globe.
        const hierarchies=nestedHistoricalPolygonPositions(area.geometry,Cesium);
        for(const hierarchy of hierarchies){
          add({
            name:bundle.title+" — archived "+area.windType+" cyclone winds",
            description:"HISTORICAL CYCLONE WIND FOOTPRINT, NOT a thunderstorm warning. Original issued "+stamp(area.issueUtc)+"; archived valid time "+stamp(area.validUtc??area.issueUtc)+".",
            polygon:{
              hierarchy,
              material:fill.withAlpha(0.28),
              outline:true,outlineColor:fill.withAlpha(0.95),
              classificationType:Cesium.ClassificationType.BOTH,
              zIndex:15
            }
          });polygons++;
        }
      }
    }
    status.textContent=[
      "Historical "+bundle.title+" · NOT LIVE",
      "Selected: "+stamp(snapshot.utc),
      "Recorded positions through time: "+snapshot.fixesSoFar.length+"/"+bundle.fixes.length,
      "Archived wind polygons at this exact issue: "+polygons,
      bundle.id==="yasi-2011"?
        "Yasi wind/warning polygons are not in this source. None are fabricated.":
        "Koji wind areas are cyclone impact footprints, NOT severe thunderstorm warnings.",
      "Source: "+snapshot.originalSourceLabel
    ].join("\n");
    viewer.scene?.requestRender?.();
  }
  async function load(){
    const mine=++seq;
    clearEntities();bundle=null;moments=[];range.disabled=true;
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
      range.value=String(Math.max(0,moments.length-1));
      range.disabled=false;
      showWind.disabled=id==="yasi-2011";
      draw();
    }catch(error){
      if(mine!==seq)return;
      status.textContent="Historical archive unavailable: "+String(error?.message??error);
    }
  }
  function focus(){
    if(!bundle)return;
    const points=bundle.fixes.map(f=>f.position);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const margin=bundle.id==="yasi-2011"?2.4:1.5;
    viewer.camera.flyTo({
      destination:Cesium.Rectangle.fromDegrees(
        Math.min(...xs)-margin,Math.min(...ys)-margin,
        Math.max(...xs)+margin,Math.max(...ys)+margin
      ),duration:0.6
    });
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
