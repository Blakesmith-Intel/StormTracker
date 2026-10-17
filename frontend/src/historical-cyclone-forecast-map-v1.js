import {decodeHistoricalBomCycloneGml,cycloneForecastSummary}
 from "./bom-historical-forecast-gml-v1.js?v=source-true-v1";

// Dev-only opt-in historical preview. No network, BoM relay, source timer or
// changes to the existing radar, 3-D, camera controls or original weather layers.
export function createHistoricalCycloneForecastQA({Cesium,viewer,documentRef=document,
  decode=decodeHistoricalBomCycloneGml}){
 const $=id=>documentRef.getElementById(id);
 const button=$("openCycloneForecastQa"),panel=$("cycloneForecastQaPanel");
 if(!button||!panel)throw new Error("Missing historical cyclone QA map UI");
 const input=$("cycloneGmlFile"),status=$("cycloneForecastQaStatus");
 const check72=$("cycloneShow72"),check120=$("cycloneShow120");
 const ds=new Cesium.CustomDataSource("Historical cyclone issued map — NOT LIVE");
 viewer.dataSources.add(ds);
 let loaded=null;
 const stamp=v=>new Date(v).toLocaleString("en-AU",{timeZone:"Australia/Brisbane",
   day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",
   hour12:false})+" AEST";
 const color={
  "72":Cesium.Color.fromCssColorString("#36d1bc"),
  "120":Cesium.Color.fromCssColorString("#edba4b"),
  forecast:Cesium.Color.fromCssColorString("#fff1e4"),
  observed:Cesium.Color.fromCssColorString("#9dc0d0")
 };
 const flatten=geometry=>{
  if(geometry.type==="Point")return [geometry.coordinates];
  if(geometry.type==="LineString")return geometry.coordinates;
  if(geometry.type==="Polygon")return geometry.coordinates.flat();
  if(geometry.type==="MultiPolygon")return geometry.coordinates.flat(2);
  return [];
 };
 function hierarchy(rings){
  return new Cesium.PolygonHierarchy(
   Cesium.Cartesian3.fromDegreesArray(rings[0].flat()),
   rings.slice(1).map(r=>new Cesium.PolygonHierarchy(
     Cesium.Cartesian3.fromDegreesArray(r.flat())))
  );
 }
 function statusText(text){status.textContent=text;}
 function clear(){
  ds.entities.removeAll();
  viewer.scene?.requestRender?.();
 }
 function redraw(){
  clear();
  if(!loaded)return;
  for(const feature of loaded.features){
   const role=feature.role;
   const desc="ARCHIVED BoM ORIGINAL ISSUE · NOT LIVE · "+
      loaded.cycloneName+" · issued "+stamp(loaded.issueUtc);
   if(role==="uncertainty_area"){
    const key=feature.areaKey;
    if(!key||(key==="72"&&!check72.checked)||
      (key==="120"&&!check120.checked))continue;
    const polygons=feature.geometry.type==="Polygon"?
      [feature.geometry.coordinates]:feature.geometry.coordinates;
    polygons.forEach((rings,i)=>{
     const tint=color[key];
     ds.entities.add({
       name:loaded.cycloneName+" · BoM likely tracks up to "+key+" hours",
       description:desc+" · Original BoM likely-tracks polygon · "+key+
         "h · "+rings.reduce((n,r)=>n+r.length,0)+" source vertices (unmodified).",
       polygon:{hierarchy:hierarchy(rings),material:tint.withAlpha(key==="72"?.2:.1),
         classificationType:Cesium.ClassificationType.BOTH},
     });
     rings.forEach((ring,j)=>{
      ds.entities.add({
        name:loaded.cycloneName+" · "+key+"h source uncertainty boundary "+(j?"hole":"outer"),
        description:desc,
        polyline:{positions:Cesium.Cartesian3.fromDegreesArray(ring.flat()),
          width:key==="72"?3:2,clampToGround:true,
          material:tint.withAlpha(j?.7:1)}
      });
     });
    });
   }else if(role==="forecast_track"||role==="observed_track"){
     const isForecast=role==="forecast_track";
     ds.entities.add({
       name:loaded.cycloneName+" · "+(isForecast?"issued forecast track":"observed track"),
       description:desc+" · Original BoM "+role+" geometry (not reconstructed).",
       polyline:{positions:Cesium.Cartesian3.fromDegreesArray(
         feature.geometry.coordinates.flat()),
         width:isForecast?4:2,
         clampToGround:true,
         material:isForecast?color.forecast:color.observed.withAlpha(.7)}
     });
   }else if(role==="forecast_fix"||role==="observed_fix"){
     const future=role==="forecast_fix";
     const lead=feature.leadHours==null?"Forecast":("+"+feature.leadHours+"h");
     ds.entities.add({
      name:loaded.cycloneName+" · "+(future?"forecast ":"observed ")+stamp(feature.validUtc),
      description:desc+" · "+(future?"Published forecast centre ":"Published observed centre ")+
       stamp(feature.validUtc)+(feature.category===null?"":" · Category "+feature.category),
      position:Cesium.Cartesian3.fromDegrees(...feature.geometry.coordinates),
      point:{pixelSize:future?10:5,color:future?color.forecast:color.observed,
        outlineColor:Cesium.Color.BLACK,outlineWidth:2,
        heightReference:Cesium.HeightReference.CLAMP_TO_GROUND},
      ...(future?{label:{
       text:lead+(feature.category===null?"":" · C"+feature.category),
       font:"bold 12px system-ui",fillColor:Cesium.Color.WHITE,
       outlineColor:Cesium.Color.BLACK,outlineWidth:3,
       style:Cesium.LabelStyle.FILL_AND_OUTLINE,
       pixelOffset:new Cesium.Cartesian2(12,-14),
       horizontalOrigin:Cesium.HorizontalOrigin.LEFT,
       disableDepthTestDistance:Number.POSITIVE_INFINITY
      }}:{})
     });
   }
   // Warning, watch and wind polygons are intentionally NOT drawn in this
   // forecast uncertainty renderer; separate classifications are preserved.
  }
  viewer.scene?.requestRender?.();
 }
 function focus(){
   if(!loaded)return;
   const all=loaded.features.filter(f=>
     ["forecast_fix","forecast_track","uncertainty_area"].includes(f.role))
     .flatMap(f=>flatten(f.geometry));
   if(!all.length)return;
   const longs=all.map(v=>v[0]),lats=all.map(v=>v[1]);
   const west=Math.min(...longs),east=Math.max(...longs),
     south=Math.min(...lats),north=Math.max(...lats);
   if(east-west>180)return; // Don't accidentally fly around the whole globe
   viewer.camera.flyTo({destination:Cesium.Rectangle.fromDegrees(
     Math.max(-180,west-1),Math.max(-90,south-1),
     Math.min(180,east+1),Math.min(90,north+1)),duration:1.1});
 }
 function reset(){
  input.value="";loaded=null;clear();
  statusText("Select an original BoM cyclone GML file to view its issued forecast. No source is loaded.");
  $("cycloneForecastQaFocus").disabled=true;
  $("cycloneForecastQaClear").disabled=true;
 }
 function open(next){
   panel.hidden=!next;
   button.setAttribute("aria-expanded",String(next));
   if(next)input.focus();
 }
 button.addEventListener("click",()=>open(panel.hidden));
 $("cycloneForecastQaClose").addEventListener("click",()=>open(false));
 $("cycloneForecastQaFocus").addEventListener("click",focus);
 $("cycloneForecastQaClear").addEventListener("click",reset);
 check72.addEventListener("change",redraw);
 check120.addEventListener("change",redraw);
 input.addEventListener("change",async()=>{
  loaded=null;clear();statusText("Validating original GML…");
  $("cycloneForecastQaFocus").disabled=true;
  $("cycloneForecastQaClear").disabled=true;
  const file=input.files?.[0];
  if(!file){reset();return;}
  try{
   if(file.size>3_000_000)throw new Error("Original BoM GML exceeds 3 MB safety limit");
   const text=await file.text();
   const result=decode(text,{filename:file.name});
   loaded=result;
   const s=cycloneForecastSummary(result);
   statusText(result.cycloneName+" · "+result.productId+"\n"+
     "ISSUED "+stamp(result.issueUtc)+" · ARCHIVED, NOT LIVE\n"+
     s.forecastFixes+" forecast centres · "+s.forecastTracks+" forecast track\n"+
     (s.uncertainty72?("72h: "+s.uncertainty72+" source polygon(s) · "):"72h: no BoM polygon · ")+
     (s.uncertainty120?("120h: "+s.uncertainty120+" source polygon(s)"):
       "120h: no BoM polygon")+
     "\nSource coordinate order: longitude, latitude. No polygons invented.");
   $("cycloneForecastQaFocus").disabled=false;
   $("cycloneForecastQaClear").disabled=false;
   redraw();focus();
  }catch(error){
   reset();
   statusText("Rejected historical GML: "+String(error?.message??error)+
     "\nNothing has been displayed.");
  }
 });
 return {get loaded(){return loaded},clear:reset,render:redraw,
   destroy(){clear();viewer.dataSources.remove(ds,true);open(false)}};
}
