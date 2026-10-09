import { fetchQueenslandPopulationCentres } from "./qld-population-centres-v2.js?v=9.12.3";
import { rankQueenslandTowns, sameGeographicSettlement, layoutTownLabels, townLabelTypography }
  from "./qld-town-label-declutter-v1.js?v=9.16.12";
import { fetchQldNearbyLocalities, expandLocalityBounds, localityBoundsContain,
  qldLocalityViewBounds } from "./qld-nearby-localities-v1.js?v=9.13.4";

// Cesium camera.pitch is not reliable following lookAt frame transforms.
// Measure actual line of sight relative to the ellipsoid surface normal.
export function cameraLookDownDegrees(camera,CesiumRef,ellipsoid) {
  const fallback=Number.isFinite(camera?.pitch)?camera.pitch*180/Math.PI:-90;
  const pos=camera?.positionWC,dir=camera?.directionWC;
  const normalAt=ellipsoid?.geodeticSurfaceNormal, Cartesian3=CesiumRef?.Cartesian3;
  if(!pos || !dir || typeof normalAt!=="function" ||
     typeof Cartesian3?.dot!=="function") return fallback;
  const normal=normalAt.call(ellipsoid,pos,new Cartesian3());
  if(!normal)return fallback;
  const cosine=Cartesian3.dot(dir,normal);
  return Number.isFinite(cosine)?
    Math.asin(Math.max(-1,Math.min(1,cosine)))*180/Math.PI:fallback;
}

// Foreground HTML text is intentionally above ALL WebGL weather imagery,
// Cesium 3-D points, radar sprites and terrain. Updating a small DOM subset
// on camera changes is independent of expensive volume/radar frame playback.
// The OSM and QLD satellite modes share precisely one place-label mechanism.
export function createQueenslandTownLabelLayer({
  viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
  documentRef=globalThis.document,container=viewer?.container?.parentElement,
  mode="street",onStatus=()=>{}
}={}) {
  if(!viewer?.scene?.postRender || !CesiumRef?.SceneTransforms ||
     !CesiumRef?.EllipsoidalOccluder || !container ||
     typeof documentRef?.createElement!=="function")
    throw new TypeError("Queensland town labels require a Cesium scene and map container");

  const scene=viewer.scene;
  const root=documentRef.createElement("div");
  root.className="qld-place-foreground";
  root.setAttribute("aria-hidden","true");
  container.appendChild(root);

  let destroyed=false,started=null,places=[],selectedIds=[],displayedPlaces=[];
  let currentMode=mode,lastFingerprint="",lastCalculation=0,calculationCount=0;
  let resizeDisposer=null,postRenderDisposer=null,localityCoverage=null;
  let localityBusy=false,lastLocalityRequest=0,localityRequestVersion=0;
  const elements=new Map();
  const activePlacements=new Map();

  // The Cesium camera can shift by several pixels between decluttering
  // updates. Reproject ONLY the handful of visible, already-selected town
  // anchors on EVERY Cesium render. Layout/collision selection stays
  // throttled, but geographical positions must never lag behind panning.
  function followCamera() {
    const width=scene.canvas?.clientWidth??0,height=scene.canvas?.clientHeight??0;
    for(const [id,place] of activePlacements) {
      const el=elements.get(id);
      if(!el)continue;
      const pos=CesiumRef.SceneTransforms.worldToWindowCoordinates(scene,place.position);
      if(!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) ||
         pos.x<0 || pos.y<0 || pos.x>width || pos.y>height) {
        el.style.display="none";
        continue;
      }
      if(el.style.display!=="")el.style.display="";
      const left=Math.round(pos.x*10)/10+"px",top=Math.round(pos.y*10)/10+"px";
      if(el.style.left!==left)el.style.left=left;
      if(el.style.top!==top)el.style.top=top;
    }
  }

  function visibleInStreet(place){
    // Native OpenStreetMap already labels major population centres. Add
    // remote settlements and localities missing from its sparse rural tiles.
    return currentMode!=="street" || (place.population??0)<25000;
  }
  function makeElement(place) {
    let element=elements.get(String(place.id));
    if(element)return element;
    element=documentRef.createElement("span");
    element.className="qld-place-name";
    element.textContent=place.name;
    element.setAttribute("data-place-id",String(place.id));
    element.style.position="absolute";
    elements.set(String(place.id),element);
    root.appendChild(element);
    return element;
  }
  function fingerprint(){
    const p=scene.camera?.positionWC,d=scene.camera?.directionWC,c=scene.canvas;
    if(!p||!d||!c)return "";
    return [Math.round(p.x),Math.round(p.y),Math.round(p.z),
      Math.round(d.x*10000),Math.round(d.y*10000),Math.round(d.z*10000),
      c.clientWidth,c.clientHeight,currentMode,places.length].join(":");
  }
  function maybeLoadNearby(){
    if(destroyed || localityBusy || !places.length)return;
    const ellipsoid=scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84;
    const view=qldLocalityViewBounds(scene.camera,CesiumRef,ellipsoid);
    if(!view||localityBoundsContain(localityCoverage,view))return;
    const now=Date.now();
    if(now-lastLocalityRequest<2500)return;
    lastLocalityRequest=now;
    const bounds=expandLocalityBounds(view);
    const version=++localityRequestVersion;
    localityBusy=true;
    void fetchQldNearbyLocalities({bounds,fetchImpl}).then(records=>{
      if(destroyed||version!==localityRequestVersion)return;
      const old=places.filter(p=>p.fromGazetteer);
      for(const p of old){
        const el=elements.get(String(p.id));el?.remove();elements.delete(String(p.id));
      }
      places=places.filter(p=>!p.fromGazetteer);
      const unique=new Set();
      for(const item of records){
        if(places.some(p=>sameGeographicSettlement(p,item,25)))continue;
        const identity=item.name.toLowerCase()+":"+item.latitude.toFixed(3)+":"+
          item.longitude.toFixed(3);
        if(unique.has(identity) ||
           places.some(p=>sameGeographicSettlement(p,item,25)))continue;
        unique.add(identity);
        places.push({...item,fromGazetteer:true,
          position:CesiumRef.Cartesian3.fromDegrees(item.longitude,item.latitude,0)});
      }
      localityCoverage=bounds;
      lastFingerprint="";
      draw(true);
    }).catch(error=>{
      if(!destroyed)console.warn("Nearby QLD localities unavailable:",error);
    }).finally(()=>{if(version===localityRequestVersion)localityBusy=false;});
  }
  function draw(force=false){
    if(destroyed || !places.length)return [];
    // Camera tracking is deliberately not gated on the layout fingerprint
    // or the 170ms decluttering interval; this fixes map-pan label drift.
    followCamera();
    const key=fingerprint();
    if(!force && key===lastFingerprint)return selectedIds;
    const now=Date.now();
    if(!force && now-lastCalculation<170)return selectedIds;
    lastCalculation=now;lastFingerprint=key;
    const camera=scene.camera,canvas=scene.canvas;
    const width=canvas?.clientWidth??0,height=canvas?.clientHeight??0;
    const cameraHeight=Math.max(0,camera?.positionCartographic?.height??0);
    const ellipsoid=scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84;
    const cameraPitchDegrees=cameraLookDownDegrees(camera,CesiumRef,ellipsoid);
    const candidates=[];
    if(camera?.positionWC && width>=180 && height>=140){
      const occluder=new CesiumRef.EllipsoidalOccluder(ellipsoid,camera.positionWC);
      for(const place of places){
        if(!visibleInStreet(place) || !occluder.isPointVisible(place.position))continue;
        const screen=CesiumRef.SceneTransforms.worldToWindowCoordinates(scene,place.position);
        if(!screen)continue;
        candidates.push({...place,x:screen.x,y:screen.y});
      }
    }
    const accepted=layoutTownLabels({candidates,width,height,cameraHeight,
      cameraPitchDegrees,mode:currentMode,previousVisible:selectedIds});
    const nextIds=new Set(accepted.map(p=>String(p.id)));
    activePlacements.clear();
    for(const [id,element] of elements){
      if(!nextIds.has(id)){element.remove();elements.delete(id);}
    }
    for(const place of accepted){
      const id=String(place.id);
      activePlacements.set(id,place);
      const el=makeElement(place),type=townLabelTypography(width,place.population);
      el.style.font=type.font;
    }
    followCamera();
    selectedIds=accepted.map(p=>String(p.id));
    displayedPlaces=accepted.map(p=>({id:p.id,name:p.name,
      x:p.x,y:p.y,population:p.population,font:townLabelTypography(width,p.population).font}));
    calculationCount++;
    maybeLoadNearby();
    return selectedIds;
  }
  function setMode(nextMode){
    if(destroyed)return;
    const mode=nextMode==="qld-imagery"?"qld-imagery":"street";
    if(currentMode!==mode){currentMode=mode;lastFingerprint="";draw(true);}
  }
  async function start(){
    if(started)return started;
    started=(async()=>{
      try{
        const records=rankQueenslandTowns(await fetchQueenslandPopulationCentres({fetchImpl}));
        if(destroyed)return 0;
        const identities=new Set();
        for(const item of records){
          const identity=item.name.toLowerCase()+":"+item.latitude.toFixed(2)+":"+
            item.longitude.toFixed(2);
          if(identities.has(identity) ||
             places.some(p=>sameGeographicSettlement(p,item,25)))continue;
          identities.add(identity);
          places.push({...item,position:CesiumRef.Cartesian3.fromDegrees(
            item.longitude,item.latitude,0)});
        }
        postRenderDisposer=scene.postRender.addEventListener(()=>{
          try{draw();}catch(error){console.warn("QLD label placement skipped:",error);}
        });
        if(typeof window!=="undefined" && typeof window.addEventListener==="function"){
          resizeDisposer=()=>draw(true);
          window.addEventListener("resize",resizeDisposer,{passive:true});
        }
        draw(true);
        onStatus({kind:"ok",message:"Queensland place names ready · "+
          places.length+" locations, collision-aware"});
        return places.length;
      }catch(error){
        if(!destroyed)onStatus({kind:"warning",message:
          "Queensland place names unavailable: "+(error?.message??error)});
        throw error;
      }
    })();
    return started;
  }
  function destroy(){
    if(destroyed)return;
    destroyed=true;localityRequestVersion++;
    postRenderDisposer?.();
    if(resizeDisposer && typeof window!=="undefined")
      window.removeEventListener("resize",resizeDisposer);
    elements.clear();activePlacements.clear();
    root.remove();places=[];selectedIds=[];displayedPlaces=[];
  }
  return {start,draw,setMode,destroy,
    get count(){return places.length;},
    get visibleCount(){return selectedIds.length;},
    get visibleIds(){return [...selectedIds];},
    get visibleLabels(){return displayedPlaces.map(p=>({...p}));},
    get calculationCount(){return calculationCount;},
    get gazetteerCount(){return places.filter(p=>p.fromGazetteer).length;},
    get mode(){return currentMode;},
    get cameraHeight(){return scene.camera?.positionCartographic?.height??null;},
    get cameraPitchDegrees(){return cameraLookDownDegrees(
      scene.camera,CesiumRef,scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84);}
  };
}
