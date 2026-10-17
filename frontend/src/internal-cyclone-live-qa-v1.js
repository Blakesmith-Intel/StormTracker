import {validateInternalCycloneSnapshot}
 from "./internal-cyclone-feed-v1.js";
import {focusCycloneThroughController}
 from "./cyclone-camera-focus-v1.js";

// Isolated internal QA only: no network call or map overlay until manually
// enabled. Authentication and same-origin feed delivery belong to the
// organisation's access-controlled host, NOT this public source repository.
export function createInternalCycloneLiveQA({
  Cesium, viewer, cameraController, documentRef=document,
  fetchRef=fetch, now=()=>new Date()
}) {
  const panel=documentRef.getElementById("cycloneForecastQaPanel");
  const mapPanel=documentRef.getElementById("mapPanel");
  if(!panel || !mapPanel || !Cesium || !viewer) throw new Error("Missing cyclone QA hosts");
  const el=(tag,label)=>{
    const node=documentRef.createElement(tag);
    if(label!==undefined)node.textContent=label;
    return node;
  };
  const container=el("section");
  container.id="internalCycloneQa";
  container.style.cssText="border:1px solid #516a79;padding:9px;margin:10px 0;border-radius:8px;line-height:1.45";
  const heading=el("strong","BoM tropical cyclone forecasts");
  heading.style.cssText="display:block;font-size:12px;margin-bottom:4px";
  container.appendChild(heading);
  const notice=el("p","Original BoM forecast maps only. Check current warnings and cyclone advice directly with BoM. No forecasts are generated or extrapolated.");
  notice.style.cssText="font-size:11px;color:#ffd38a;margin:4px 0";
  container.appendChild(notice);
  const line=el("label");
  line.style.cssText="display:flex;align-items:center;gap:8px;font-size:12px";
  const toggle=el("input");
  toggle.id="internalCycloneLiveToggle";
  toggle.type="checkbox";
  toggle.checked=false;
  line.append(toggle,documentRef.createTextNode("Show live cyclone forecasts"));
  container.append(line);
  const sourceRow=el("div");
  sourceRow.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin:7px 0";
  const reload=el("button","Refresh source");
  reload.type="button";
  reload.disabled=true;
  reload.id="internalCycloneRefresh";
  const focus=el("button","Focus cyclone");
  focus.type="button";
  focus.disabled=true;
  focus.id="internalCycloneFocus";
  sourceRow.append(reload,focus);
  container.appendChild(sourceRow);
  const selectLabel=el("label","Original active source:");
  selectLabel.style.cssText="display:block;font-size:11px";
  const select=el("select");
  select.id="internalCycloneSelectedSystem";
  select.disabled=true;
  select.style.cssText="width:100%;padding:5px;background:#1b3645;color:#fff";
  selectLabel.appendChild(select);
  container.appendChild(selectLabel);
  const status=el("p","Live cyclone layer off. Select Show live cyclone forecasts to check the official source.");
  status.id="internalCycloneQaStatus";
  status.style.cssText="font-size:11px;white-space:pre-line;color:#cfecf7;overflow-wrap:anywhere;margin-top:7px";
  status.setAttribute("role","status");
  container.appendChild(status);\n  const bomLink=el("a","Open BoM tropical cyclone warnings");\n  bomLink.href="https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/tropical-cyclone";\n  bomLink.target="_blank";bomLink.rel="noopener noreferrer";\n  bomLink.style.cssText="display:block;margin:5px 0;font-size:11px;color:#9bdef9";\n  container.appendChild(bomLink);
  panel.insertBefore(container,panel.querySelector(".cyclone-qld-cases")??null);
  const mapStamp=el("div","");
  mapStamp.id="internalLiveCycloneMapStamp";
  mapStamp.style.cssText="position:absolute;z-index:12;left:12px;top:58px;max-width:min(70vw,500px);padding:5px 9px;background:#052433e8;color:#fff;pointer-events:none;font-size:11px;border:1px solid #76c5cf;border-radius:6px";
  mapStamp.hidden=true;
  mapPanel.appendChild(mapStamp);
  const layer=new Cesium.CustomDataSource("INTERNAL · ORIGINAL BoM cyclone forecast");
  viewer.dataSources.add(layer);
  const shade72=Cesium.Color.fromCssColorString("#36d1bc");
  const shade120=Cesium.Color.fromCssColorString("#edba4b");
  const forecast=Cesium.Color.fromCssColorString("#fff1e4");
  const observed=Cesium.Color.fromCssColorString("#9dc0d0");
  let storms=[],activeId=null, controller=null, timer=null, sequence=0, destroyed=false;
  const fmt=t=>new Date(t).toLocaleString("en-AU",{
    timeZone:"Australia/Brisbane",day:"2-digit",month:"short",
    hour:"2-digit",minute:"2-digit",year:"numeric",hour12:false})+" AEST";
  function clearEntities(){
    layer.entities.removeAll();mapStamp.hidden=true;
    viewer.scene?.requestRender?.();
  }
  function clear(){
    storms=[];activeId=null;select.replaceChildren();select.disabled=true;
    focus.disabled=true;clearEntities();
  }
  function polygonHierarchy(rings){
    return new Cesium.PolygonHierarchy(
      Cesium.Cartesian3.fromDegreesArray(rings[0].flat()),
      rings.slice(1).map(r=>new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray(r.flat())))
    );
  }
  function currentStorm(){
    return storms.find(s=>s.systemId===activeId)??null;
  }
  function vertices(g){
    if(g.type==="Point")return [g.coordinates];
    if(g.type==="LineString")return g.coordinates;
    if(g.type==="Polygon")return g.coordinates.flat();
    if(g.type==="MultiPolygon")return g.coordinates.flat(2);
    return [];
  }
  function draw(){
    clearEntities();
    if(!toggle.checked)return;
    const s=currentStorm();
    if(!s)return;
    if(Date.parse(s.expiresUtc)<=now().getTime()){
      clear();status.textContent="Issued cyclone map has expired. Refreshing or unavailable.";
      return;
    }
    const provenance="ORIGINAL BoM cyclone forecast · INTERNAL LIVE QA · "+
      s.productId+" · issued "+fmt(s.issueUtc)+" · expiry "+fmt(s.expiresUtc);
    for(const f of s.features){
      if(f.role==="uncertainty_area"){
        const tint=f.areaKey==="72"?shade72:shade120;
        const parts=f.geometry.type==="Polygon"?
          [f.geometry.coordinates]:f.geometry.coordinates;
        for(const rings of parts){
          layer.entities.add({
            name:s.cycloneName+" · genuine issued "+f.areaKey+"h likely-tracks area",
            description:provenance,
            polygon:{hierarchy:polygonHierarchy(rings),
              material:tint.withAlpha(f.areaKey==="72"?.20:.10),
              classificationType:Cesium.ClassificationType.BOTH}
          });
          for(const ring of rings){
            layer.entities.add({name:s.cycloneName+" original forecast uncertainty edge",
              description:provenance,polyline:{
                positions:Cesium.Cartesian3.fromDegreesArray(ring.flat()),
                material:tint,width:2,clampToGround:true}});
          }
        }
      } else if(f.role==="forecast_track"||f.role==="observed_track"){
        const future=f.role==="forecast_track";
        layer.entities.add({name:s.cycloneName+" · "+f.role,
          description:provenance,polyline:{
            positions:Cesium.Cartesian3.fromDegreesArray(f.geometry.coordinates.flat()),
            width:future?4:2,clampToGround:true,
            material:future?forecast:observed.withAlpha(.7)}});
      } else if(f.role==="forecast_fix"||f.role==="observed_fix"){
        const future=f.role==="forecast_fix";
        layer.entities.add({name:s.cycloneName+" · "+f.role,
          description:provenance+" · fix "+fmt(f.validUtc),
          position:Cesium.Cartesian3.fromDegrees(...f.geometry.coordinates),
          point:{pixelSize:future?10:6,color:future?forecast:observed,
            outlineColor:Cesium.Color.BLACK,outlineWidth:2,
            heightReference:Cesium.HeightReference.CLAMP_TO_GROUND},
          ...(future?{label:{
            text:(f.leadHours!=null?"+"+f.leadHours+"h":"Forecast")+
              (f.category==null?"":" C"+f.category),
            font:"bold 12px system-ui",fillColor:Cesium.Color.WHITE,
            outlineColor:Cesium.Color.BLACK,outlineWidth:3,
            style:Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset:new Cesium.Cartesian2(12,-14),
            horizontalOrigin:Cesium.HorizontalOrigin.LEFT,
            disableDepthTestDistance:Number.POSITIVE_INFINITY}}:{})
        });
      }
    }
    mapStamp.textContent="INTERNAL LIVE BoM SOURCE · "+s.cycloneName+
      " · issued "+fmt(s.issueUtc)+" · NOT a standalone official warning";
    mapStamp.hidden=false;focus.disabled=false;
    viewer.scene?.requestRender?.();
  }
  function options(){
    select.replaceChildren();
    for(const s of storms){
      const option=el("option",s.cycloneName+" · "+s.productId+" · "+fmt(s.issueUtc));
      option.value=s.systemId;select.appendChild(option);
    }
    select.disabled=!storms.length;
    activeId=storms.find(s=>s.systemId===activeId)?.systemId??storms[0]?.systemId??null;
    select.value=activeId??"";
    draw();
  }
  async function refresh(){
    if(!toggle.checked||destroyed)return;
    const id=++sequence;
    controller?.abort();
    controller=new AbortController();
    status.textContent="Checking original BoM tropical cyclone forecasts…";
    try{
      // This path needs a real browser-accessible feed; no placeholder data.
      const response=await fetchRef("/internal/cyclones.json",{
        method:"GET",credentials:"same-origin",cache:"no-store",
        headers:{Accept:"application/json"},signal:controller.signal
      });
      if(id!==sequence||destroyed||!toggle.checked)return;
      if(!response.ok||response.redirected||
        !String(response.headers.get("content-type")).includes("application/json"))
        throw new Error(response.status===401||response.status===403
          ?"Internal authorisation required":"No authenticated cyclone JSON feed available");
      if(Number(response.headers.get("content-length")||0)>16000000)
        throw new Error("Internal feed exceeds safety size");
      const raw=await response.text();
      if(raw.length>16000000)throw new Error("Internal feed exceeds safety size");
      const parsed=validateInternalCycloneSnapshot(JSON.parse(raw),{
        nowUtc:now().toISOString()});
      if(id!==sequence||destroyed||!toggle.checked)return;
      if(!["active","active-partial"].includes(parsed.status)){
        clear();
        status.textContent=parsed.status==="no-active-products"\n          ?"Currently no tropical cyclone warnings"\n          :"Unable to verify current tropical cyclone warnings. Check BoM directly.";
        return;
      }
      storms=parsed.storms;
      options();
      status.textContent=parsed.message+" · "+
        storms.length+" original cyclone forecast(s).\n"+
        (currentStorm()?.cycloneName??"")+" · "+
        (currentStorm()?fmt(currentStorm().issueUtc):"")+
        "\nSource: Bureau of Meteorology. Advisory text is a separate product.";
    }catch(error){
      if(id!==sequence||destroyed||!toggle.checked)return;
      clear();
      status.textContent="Unable to verify current tropical cyclone warnings. Check BoM directly.\n"+
        String(error?.message??error);
    }
  }
  function disable(){
    sequence++;
    controller?.abort();controller=null;
    if(timer!==null)clearInterval(timer);
    timer=null;clear();reload.disabled=true;
    status.textContent="Live cyclone layer off. No live source has been checked.";
  }
  toggle.addEventListener("change",()=>{
    if(!toggle.checked){disable();return;}
    reload.disabled=false;
    void refresh();
    timer=setInterval(()=>{
      if(currentStorm()&&Date.parse(currentStorm().expiresUtc)<=now().getTime()){
        clear();status.textContent="Original BoM forecast expired. Checking new issue…";
      }
      void refresh();
    },300000);
  });
  reload.addEventListener("click",()=>void refresh());
  select.addEventListener("change",()=>{activeId=select.value;draw();});
  focus.addEventListener("click",()=>{
    const s=currentStorm();
    if(!s)return;
    const all=s.features.filter(f=>
      ["forecast_fix","forecast_track","uncertainty_area"].includes(f.role))
      .flatMap(f=>vertices(f.geometry));
    if(!all.length)return;
    try{focusCycloneThroughController({
      coordinates:all,controller:cameraController,viewer,marginDegrees:1});}
    catch(error){status.textContent="Cannot focus source cyclone: "+String(error);}
  });
  return {
    refresh,
    get enabled(){return toggle.checked;},
    destroy(){destroyed=true;disable();viewer.dataSources.remove(layer,true);
      mapStamp.remove();container.remove();}
  };
}
