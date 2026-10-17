import {chooseScaleDistance,formatMapDistance,sumSurfaceDistances} from "./map-measure-math-v1.js?v=simple-ui-20261017-v1";

// Only manages UI and a dedicated optional map-measurement data source.
// Does not inspect or modify BoM observation, Doppler, storm tracking or 3-D.
export function createFriendlyMapTools({viewer,Cesium}) {
  const el=id=>document.getElementById(id);
  const startButton=el("measureToggle");
  const panel=el("mapMeasurePanel");
  const surface=el("measureSurface");
  const status=el("measureStatus");
  const scale=el("mapScaleBar");
  const scaleLine=el("mapScaleLine");
  const scaleLabel=el("mapScaleLabel");
  if (!startButton || !panel || !surface || !status || !scale) {
    throw new Error("Friendly map controls are missing from the page");
  }

  const scene=viewer.scene;
  const ellipsoid=Cesium.Ellipsoid.WGS84;
  const source=new Cesium.CustomDataSource("StormTracker manual map distance");
  viewer.dataSources.add(source);
  let active=false;
  let points=[];
  let temporary=null;
  let pathEntity=null;
  let previewEntity=null;
  let scheduledScale=false;
  let scheduledPreview=false;
  let pendingPreview=null;
  let destroyed=false;

  // Permanent operator interface. No expanded-mode switch or alternative
  // control tree exists; map tools depend only on their own DOM and Cesium.
  // The static simple-ui class names the approved responsive stylesheet.
  document.body.classList.add("simple-ui");

  function cartesianAt(x,y) {
    const pixel=new Cesium.Cartesian2(x,y);
    const ray=viewer.camera.getPickRay(pixel);
    const picked=ray && scene.globe?.pick(ray,scene);
    const position=picked || viewer.camera.pickEllipsoid(pixel,ellipsoid);
    if (!position) return null;
    const cartographic=ellipsoid.cartesianToCartographic(position);
    if (!cartographic ||
        !Number.isFinite(cartographic.longitude) ||
        !Number.isFinite(cartographic.latitude)) return null;
    // Project onto the reference ellipsoid: displayed distance is horizontal
    // geodesic map distance, not terrain slope or a route along roads.
    return ellipsoid.cartographicToCartesian(new Cesium.Cartographic(
      cartographic.longitude,cartographic.latitude,0));
  }
  function pickEvent(event) {
    const rect=scene.canvas.getBoundingClientRect();
    return cartesianAt(event.clientX-rect.left,event.clientY-rect.top);
  }
  function segmentLength(path){
    return sumSurfaceDistances(path,ellipsoid,Cesium.EllipsoidGeodesic);
  }
  function setStatus(){
    if (!points.length) {
      status.textContent=active?"Tap the map to start.":"Tap Measure to start.";
    } else {
      const length=formatMapDistance(segmentLength(points));
      status.textContent=active
        ? `${length} · Tap the map for the next point.`
        : `${length} · Measurement finished.`;
    }
    el("measureUndo").disabled=points.length===0;
    el("measureDone").disabled=!active;
    el("measureClear").disabled=points.length===0;
  }
  function redraw(){
    source.entities.removeAll();
    pathEntity=null;
    previewEntity=null;
    if(points.length>1){
      pathEntity=source.entities.add({
        polyline:{
          positions:points.slice(),width:4,clampToGround:true,
          material:Cesium.Color.CYAN
        }
      });
    }
    for(let i=0;i<points.length;i++){
      source.entities.add({
        position:points[i],
        point:{
          pixelSize:i===0?11:9,
          color:i===0?Cesium.Color.YELLOW:Cesium.Color.CYAN,
          outlineColor:Cesium.Color.BLACK,outlineWidth:2,
          heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance:Number.POSITIVE_INFINITY
        }
      });
    }
    setStatus();
    scene.requestRender();
  }
  function preview(position){
    if(!active || !points.length || !position)return;
    const array=[points[points.length-1],position];
    if(!previewEntity){
      previewEntity=source.entities.add({
        polyline:{positions:array,width:2,clampToGround:true,material:Cesium.Color.YELLOW.withAlpha(.85)}
      });
    }else previewEntity.polyline.positions=array;
    const total=segmentLength(points)+segmentLength(array);
    status.textContent=`${formatMapDistance(total)} to pointer · Tap to add next point.`;
    scene.requestRender();
  }
  function clear(){
    points=[];
    temporary=null;
    pendingPreview=null;
    redraw();
  }
  function setActive(next){
    active=Boolean(next);
    document.body.classList.toggle("measure-active",active);
    surface.hidden=!active;
    panel.hidden=false;
    startButton.setAttribute("aria-pressed",String(active));
    startButton.textContent=active?"Measuring…":"Measure";
    el("measureDone").textContent="Done";
    el("measureDone").setAttribute("aria-label","Finish measuring and return to map navigation");
    if(!active && previewEntity){source.entities.remove(previewEntity);previewEntity=null;}
    setStatus();
    scene.requestRender();
  }
  startButton.addEventListener("click",()=>{
    if(active){setActive(false);return;}
    clear();
    setActive(true);
  });
  el("measureDone").addEventListener("click",()=>setActive(false));
  el("measureUndo").addEventListener("click",()=>{
    if(points.length)points.pop();
    pendingPreview=null;
    redraw();
  });
  el("measureClear").addEventListener("click",clear);
  el("measureClose").addEventListener("click",()=>{
    setActive(false);clear();panel.hidden=true;
  });
  surface.addEventListener("pointerup",event=>{
    if(!active || event.button!==0)return;
    // When a mouse moves or a finger taps, only this measurement shield
    // receives the gesture; existing radar/cyclone/site click handlers do not.
    const position=pickEvent(event);
    if(!position) {
      status.textContent="No map surface here. Try another spot.";
      return;
    }
    points.push(position);
    redraw();
  });
  surface.addEventListener("pointermove",event=>{
    if(!active || event.pointerType==="touch" || !points.length)return;
    pendingPreview=pickEvent(event);
    if(!pendingPreview || scheduledPreview)return;
    scheduledPreview=true;
    requestAnimationFrame(()=>{
      scheduledPreview=false;
      if(!destroyed && pendingPreview)preview(pendingPreview);
    });
  });
  surface.addEventListener("pointerleave",()=>{
    pendingPreview=null;
    if(previewEntity){source.entities.remove(previewEntity);previewEntity=null;setStatus();scene.requestRender();}
  });
  const onKey=event=>{
    if(event.key==="Escape" && active){setActive(false);startButton.focus();}
  };
  document.addEventListener("keydown",onKey);

  function updateScale(){
    if(destroyed || !scaleLine || !scaleLabel)return;
    const width=scene.canvas.clientWidth;
    const height=scene.canvas.clientHeight;
    if(width<160 || height<100){scale.hidden=true;return;}
    const y=Math.max(25,height-72);
    const a=cartesianAt(Math.max(14,width*.30),y);
    const b=cartesianAt(Math.max(14,width*.30)+100,y);
    if(!a || !b){scale.hidden=true;return;}
    const metres=segmentLength([a,b]);
    const config=chooseScaleDistance(metres/100,110);
    if(!config){scale.hidden=true;return;}
    scale.hidden=false;
    scaleLine.style.width=`${Math.min(140,Math.max(12,config.pixels))}px`;
    scaleLabel.textContent=config.label;
    scale.title=`Approximate horizontal ground scale here: ${config.label}`;
  }
  function queueScale(){
    if(scheduledScale || destroyed)return;
    scheduledScale=true;
    requestAnimationFrame(()=>{scheduledScale=false;updateScale();});
  }
  const removeChanged=viewer.camera.changed.addEventListener(queueScale);
  const removeMoveEnd=viewer.camera.moveEnd.addEventListener(queueScale);
  window.addEventListener("resize",queueScale);
  const resizeObserver=typeof ResizeObserver==="function"
    ?new ResizeObserver(queueScale):null;
  resizeObserver?.observe(scene.canvas);
  queueScale();

  const destroy=()=>{
    destroyed=true;setActive(false);
    document.removeEventListener("keydown",onKey);
    window.removeEventListener("resize",queueScale);
    removeChanged();
    removeMoveEnd();
    resizeObserver?.disconnect();
    viewer.dataSources.remove(source,true);
  };
  window.addEventListener("pagehide",destroy,{once:true});
  return {destroy};
}
