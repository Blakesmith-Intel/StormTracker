import { fetchQueenslandPopulationCentres } from "./qld-population-centres-v2.js?v=9.12.3";
import { fetchNswTowns } from "./nsw-town-places-v1.js?v=9.18.0";
import { fetchNswNearbyLocalities, nswLocalityViewBounds, expandNswLocalityBounds }
  from "./nsw-nearby-localities-v1.js?v=9.18.0";
import { rankQueenslandTowns, sameGeographicSettlement, layoutTownLabels, townLabelTypography }
  from "./qld-town-label-declutter-v1.js?v=9.16.12";
import { fetchQldNearbyLocalities, expandLocalityBounds, localityBoundsContain,
  qldLocalityViewBounds } from "./qld-nearby-localities-v1.js?v=9.18.5-adaptive-bounds";

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
// Street and national satellite use ONE shared screen-space label and
// collision budget for Queensland and NSW. No two DOM overlays can overlap.
export function createQueenslandTownLabelLayer({
  viewer,CesiumRef=globalThis.Cesium,fetchImpl=globalThis.fetch,
  documentRef=globalThis.document,container=viewer?.container?.parentElement,
  mode="street",onStatus=()=>{},deferLocalityDuringNavigation=false
}={}) {
  if(!viewer?.scene?.postRender || !CesiumRef?.SceneTransforms ||
     !CesiumRef?.EllipsoidalOccluder || !container ||
     typeof documentRef?.createElement!=="function")
    throw new TypeError("Cross-border town labels require a Cesium scene and map container");

  const scene=viewer.scene;
  const root=documentRef.createElement("div");
  root.className="qld-place-foreground";
  root.setAttribute("aria-hidden","true");
  container.appendChild(root);

  let destroyed=false,started=null,places=[],selectedIds=[],displayedPlaces=[];
  let currentMode=mode,lastFingerprint="",lastCalculation=0,calculationCount=0;
  let resizeDisposer=null,postRenderDisposer=null,localityCoverage=null;
  let localityBusy=false,lastLocalityRequest=0,localityRequestVersion=0;
  let nswLocalityCoverage=null,nswLocalityBusy=false;
  let lastNswLocalityRequest=0,nswLocalityVersion=0;
  let navigating=false,settleTimer=null,nextLocalityRetryAt=0,lastQldError=0;
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
    if(destroyed || localityBusy || !places.length ||
       (deferLocalityDuringNavigation && navigating) ||
       Date.now()<nextLocalityRetryAt)return;
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
      if(destroyed)return;
      // A saturated/temporarily unavailable upstream gazetteer is NOT a
      // reason to repeat the same expensive query during active panning.
      // Keep last known good labels; back off for sixty seconds.
      if(deferLocalityDuringNavigation)nextLocalityRetryAt=Date.now()+60000;
      if(!deferLocalityDuringNavigation ||
         !lastQldError || Date.now()-lastQldError>60000) {
        console.warn("Nearby QLD localities unavailable:",error?.message??error);
        lastQldError=Date.now();
      }
    }).finally(()=>{if(version===localityRequestVersion)localityBusy=false;});
  }
  // NSW localities follow the same small-scale, viewport-bounded gazetteer
  // rules as QLD. Both enter the SAME shared candidate list and collision pass.
  function maybeLoadNswNearby() {
    if(destroyed||nswLocalityBusy||!places.length ||
      (deferLocalityDuringNavigation&&navigating))return;
    const ellipsoid=scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84;
    const view=nswLocalityViewBounds(scene.camera,CesiumRef,ellipsoid);
    if(!view||localityBoundsContain(nswLocalityCoverage,view))return;
    const now=Date.now();
    if(now-lastNswLocalityRequest<2500)return;
    lastNswLocalityRequest=now;
    const bounds=expandNswLocalityBounds(view);
    const version=++nswLocalityVersion;
    nswLocalityBusy=true;
    void fetchNswNearbyLocalities({bounds,fetchImpl}).then(records=>{
      if(destroyed||version!==nswLocalityVersion)return;
      for(const p of places.filter(x=>x.fromNswLocality)){
        elements.get(String(p.id))?.remove();
        elements.delete(String(p.id));
      }
      places=places.filter(x=>!x.fromNswLocality);
      for(const item of records){
        if(places.some(p=>sameGeographicSettlement(p,item,25)))continue;
        places.push({...item,fromNswLocality:true,
          position:CesiumRef.Cartesian3.fromDegrees(item.longitude,item.latitude,0)});
      }
      nswLocalityCoverage=bounds;
      lastFingerprint="";
      draw(true);
    }).catch(error=>{
      if(!destroyed)console.warn("Nearby NSW localities unavailable:",error);
    }).finally(()=>{if(version===nswLocalityVersion)nswLocalityBusy=false;});
  }
  function draw(force=false){
    if(destroyed || !places.length)return [];
    // Camera tracking is deliberately not gated on the layout fingerprint
    // or the 170ms decluttering interval; this fixes map-pan label drift.
    followCamera();
    // Geographic positions still follow EVERY Cesium frame, but don't
    // rescan thousands of QLD/NSW label candidates mid-gesture.
    if(deferLocalityDuringNavigation&&navigating)return selectedIds;
    const key=fingerprint();
    if(!force && key===lastFingerprint)return selectedIds;
    const now=Date.now();
    // While a phone is moving, keep geographic anchors following EVERY
    // render but run the expensive QLD+NSW declutter scan less often.
    // Desktop remains at its established 170ms layout cadence.
    const layoutIntervalMs=(scene.canvas?.clientWidth??0)<700?360:170;
    if(!force && now-lastCalculation<layoutIntervalMs)return selectedIds;
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
    maybeLoadNswNearby();
    return selectedIds;
  }
  function setNavigationActive(active){
    if(!deferLocalityDuringNavigation || destroyed)return;
    if(settleTimer!==null){clearTimeout(settleTimer);settleTimer=null;}
    navigating=Boolean(active);
    if(!navigating){
      // One settled screen-space declutter, followed by an optional
      // viewport-bounded official locality load.
      // Respect the gazetteer rate limit, but schedule the FINAL load rather
      // than silently skipping it if the last request was recent.
      const afterThrottle=Math.max(650,lastLocalityRequest+2550-Date.now());
      settleTimer=setTimeout(()=>{
        settleTimer=null;
        if(destroyed||navigating)return;
        draw(true);
      },afterThrottle);
    }
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
        // Do not suppress Queensland labels if the NSW public service
        // temporarily fails (or vice versa). Each source is independent.
        const [qldResponse,nswResponse]=await Promise.allSettled([
          fetchQueenslandPopulationCentres({fetchImpl}),
          fetchNswTowns({fetchImpl})
        ]);
        if(destroyed)return 0;
        if(qldResponse.status==="rejected"&&nswResponse.status==="rejected")
          throw Error("Both official settlement sources unavailable");
        for(const [state,answer] of [["QLD",qldResponse],["NSW",nswResponse]]){
          if(answer.status==="rejected")
            console.warn(state+" town labels unavailable:",answer.reason);
        }
        const records=rankQueenslandTowns([
          ...(qldResponse.status==="fulfilled"?qldResponse.value:[]),
          ...(nswResponse.status==="fulfilled"?nswResponse.value:[])
        ]);
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
          try{draw();}catch(error){console.warn("Regional place label placement skipped:",error);}
        });
        if(typeof window!=="undefined" && typeof window.addEventListener==="function"){
          resizeDisposer=()=>draw(true);
          window.addEventListener("resize",resizeDisposer,{passive:true});
        }
        draw(true);
        const qldCount=places.filter(p=>!p.fromNsw).length;
        const nswCount=places.length-qldCount;
        onStatus({kind:(qldCount&&nswCount)?"ok":"warning",
          message:"Place names: QLD "+qldCount+" · NSW "+nswCount+
            " · shared collision-aware layout"+
            (nswCount?"":" (NSW catalogue unavailable)")});
        return places.length;
      }catch(error){
        if(!destroyed)onStatus({kind:"warning",message:
          "QLD/NSW place names unavailable: "+(error?.message??error)});
        throw error;
      }
    })();
    return started;
  }
  function destroy(){
    if(destroyed)return;
    destroyed=true;localityRequestVersion++;nswLocalityVersion++;
    if(settleTimer!==null){clearTimeout(settleTimer);settleTimer=null;}
    postRenderDisposer?.();
    if(resizeDisposer && typeof window!=="undefined")
      window.removeEventListener("resize",resizeDisposer);
    elements.clear();activePlacements.clear();
    root.remove();places=[];selectedIds=[];displayedPlaces=[];
  }
  return {start,draw,setMode,setNavigationActive,destroy,
    get count(){return places.length;},
    get visibleCount(){return selectedIds.length;},
    get visibleIds(){return [...selectedIds];},
    get visibleLabels(){return displayedPlaces.map(p=>({...p}));},
    get calculationCount(){return calculationCount;},
    get gazetteerCount(){return places.filter(p=>p.fromGazetteer||p.fromNswLocality).length;},
    get nswCount(){return places.filter(p=>p.fromNsw).length;},
    get mode(){return currentMode;},
    get cameraHeight(){return scene.camera?.positionCartographic?.height??null;},
    get cameraPitchDegrees(){return cameraLookDownDegrees(
      scene.camera,CesiumRef,scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84);}
  };
}
