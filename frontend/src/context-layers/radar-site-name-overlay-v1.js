// Geographically anchored, accessible BoM radar-dish icons. Station names
// remain available by hover/long-press and to screen readers. No radar
// imagery, frame history or map-camera state is modified by this overlay.
export function createRadarSiteNameOverlay({
  scene,CesiumRef,container,documentRef=globalThis.document,
  sites,onSelect,getPrimary=()=>null,onStatus=()=>{}
}={}){
  if(!scene?.postRender?.addEventListener || !CesiumRef?.Cartesian3?.fromDegrees ||
    !CesiumRef?.SceneTransforms?.worldToWindowCoordinates ||
    !documentRef?.createElement || !container || !sites)
    throw new TypeError("Radar-site labels need Cesium scene and map container");
  const root=documentRef.createElement("div");
  root.className="radar-site-labels";
  root.setAttribute("aria-label","Radar locations – select to load as primary radar");
  container.appendChild(root);
  const points=Object.values(sites).map(site=>({
    site,position:CesiumRef.Cartesian3.fromDegrees(site.longitude,site.latitude,0)
  }));
  const elements=new Map();
  let destroyed=false,visibleIds=[];
  for(const item of points){
    const btn=documentRef.createElement("button");
    btn.type="button";
    btn.className="radar-site-label";
    btn.dataset.radarSiteId=item.site.id;
    btn.textContent="📡"; // Small, borderless dish glyph; no permanent name or box.
    btn.title="Switch primary radar to "+item.site.name+
      (item.site.state==="NSW"?" (NSW)":" (QLD)");
    btn.setAttribute("aria-label","Load "+item.site.name+" as primary radar");
    btn.setAttribute("aria-keyshortcuts","Enter Space");
    btn.addEventListener("pointerdown",event=>event.stopPropagation());
    btn.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      if(!destroyed)onSelect(item.site.id);
    });
    btn.hidden=true;
    elements.set(item.site.id,btn);
    root.appendChild(btn);
  }
  function redraw(){
    if(destroyed)return;
    const width=scene.canvas?.clientWidth??0,height=scene.canvas?.clientHeight??0;
    const ellipsoid=scene.globe?.ellipsoid??CesiumRef.Ellipsoid?.WGS84;
    const eye=scene.camera?.positionWC;
    const occluder=eye && ellipsoid && CesiumRef.EllipsoidalOccluder
      ? new CesiumRef.EllipsoidalOccluder(ellipsoid,eye):null;
    const primary=getPrimary();
    // Prioritise the current radar, then give remaining stations stable order.
    const ordered=points.slice().sort((a,b)=>
      Number(b.site.id===primary)-Number(a.site.id===primary) ||
      a.site.name.localeCompare(b.site.name));
    const boxes=[];
    const visible=[];
    for(const {site,position} of ordered){
      const button=elements.get(site.id);
      button.dataset.primary=String(site.id===primary);
      if(width<100 || height<100 || (occluder && !occluder.isPointVisible(position))){
        button.hidden=true;continue;
      }
      const point=CesiumRef.SceneTransforms.worldToWindowCoordinates(scene,position);
      if(!point || !Number.isFinite(point.x)||!Number.isFinite(point.y) ||
         point.x<16||point.y<16||point.x>width-16||point.y>height-16){
        button.hidden=true;continue;
      }
      const box={left:point.x-13,right:point.x+13,
        top:point.y-13,bottom:point.y+13};
      if(boxes.some(prior=>
        box.left<prior.right+6 && box.right>prior.left-6 &&
        box.top<prior.bottom+6 && box.bottom>prior.top-6)){
        button.hidden=true;continue;
      }
      boxes.push(box);
      button.style.left=point.x.toFixed(1)+"px";
      button.style.top=point.y.toFixed(1)+"px";
      button.hidden=false;
      visible.push(site.id);
    }
    visibleIds=visible;
  }
  const unlisten=scene.postRender.addEventListener(redraw);
  redraw();
  onStatus({count:points.length});
  return {
    redraw,
    destroy(){
      if(destroyed)return;
      destroyed=true;
      unlisten?.();
      root.remove();
      visibleIds=[];
      elements.clear();
    },
    get siteCount(){return points.length;},
    get visibleRadarIds(){return [...visibleIds];}
  };
}
