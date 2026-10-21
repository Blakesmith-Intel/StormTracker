// Use one scene-level BillboardCollection for flood + significant rainfall.
// DataSource.raiseToTop() does not reliably order overlapping Cesium billboards:
// separate data sources can still render a low-severity icon over a high one.
// A shared collection inserts all visible markers from low to high severity,
// giving overlapping billboards a deterministic display order.
const byViewer=new WeakMap();
export const FLOOD_ICON_PRIORITY=Object.freeze({unverified:0,"rapid-rise":1,minor:2,moderate:4,major:6});
export const floodIconPriority=state=>FLOOD_ICON_PRIORITY[String(state)]??0;
export function rainfallIconPriority(aep){
 if(aep?.classification==="below-20pct-aep")return 1;
 return ({20:2,10:3,5:4,2:5,1:6})[aep?.aepDesignThreshold]??0;
}
const resolve=(property,time)=>typeof property?.getValue==="function"?
 property.getValue(time):property;
// Pure, screen-space priority collision guard. A slight edge touch is allowed;
// a material overlap of 15% of the smaller marker reserves that footprint for
// its higher severity neighbour. Equal rarity favours the higher mm total.
export function chooseVisibleSeverityMarkers(items){
 const accepted=[],visible=new Set();
 const ordered=[...items].sort((a,b)=>b.rank-a.rank||
   Number(b.mm??0)-Number(a.mm??0)||
   String(b.owner).localeCompare(String(a.owner))||
   String(a.id).localeCompare(String(b.id)));
 for(const item of ordered){
  const a=item.rect;
  const blocked=a&&accepted.some(b=>{
   const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
   const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
   const small=Math.min(
    (a.right-a.left)*(a.bottom-a.top),
    (b.right-b.left)*(b.bottom-b.top));
   return small>0 && w*h>=small*.15;
  });
  if(!blocked){visible.add(item.id);if(a)accepted.push(a);}
 }
 return visible;
}
const BILLBOARD_OPTIONS=["width","height","horizontalOrigin","verticalOrigin",
 "heightReference","disableDepthTestDistance","pixelOffset","scale","eyeOffset",
 "distanceDisplayCondition","scaleByDistance","translucencyByDistance"];
export function createSeverityMarkerLayers({viewer,CesiumRef,owner,priorities,visible=false}){
 if(!viewer?.dataSources||!CesiumRef?.CustomDataSource)throw Error("Missing Cesium viewer/data source");
 let registry=byViewer.get(viewer);
 if(!registry){registry={layers:[],billboards:null,rendered:[],watching:false};byViewer.set(viewer,registry);}
 const sources=new Map();
 for(const rank of [...new Set(priorities)].sort((a,b)=>a-b)){
  const source=new CesiumRef.CustomDataSource(owner+"-severity-"+rank);
  source.show=Boolean(visible);
  viewer.dataSources.add(source);
  sources.set(rank,source);
  registry.layers.push({rank,owner,source});
 }
 function stack(){
  if(typeof viewer.dataSources.raiseToTop==="function")
   for(const entry of [...registry.layers].sort((a,b)=>
     a.rank-b.rank||a.owner.localeCompare(b.owner)))
    viewer.dataSources.raiseToTop(entry.source);
 }
 function redrawBillboards(){
  const scene=viewer.scene;
  if(!scene?.primitives||!CesiumRef.BillboardCollection)return;
  if(!registry.billboards)
   registry.billboards=scene.primitives.add(new CesiumRef.BillboardCollection({scene}));
  const display=registry.billboards;
  display.removeAll();
  registry.rendered=[];
  const time=viewer.clock?.currentTime??CesiumRef.JulianDate?.now();
  for(const entry of [...registry.layers].sort((a,b)=>
    a.rank-b.rank||a.owner.localeCompare(b.owner))){
   for(const entity of entry.source.entities.values){
    const graphics=entity.billboard;
    if(!graphics)continue;
    const position=resolve(entity.position,time);
    const image=resolve(graphics.image,time);
    // Keep the entity as the existing station/pick metadata, but draw its
    // visual ONLY in the shared order-preserving scene billboard collection.
    graphics.show=false;
    if(!entry.source.show||!position||!image)continue;
    const options={id:entity,position,image};
    for(const key of BILLBOARD_OPTIONS){
     const value=resolve(graphics[key],time);
     if(value!==undefined&&value!==null)options[key]=value;
    }
    const billboard=display.add(options);
    registry.rendered.push({id:entity.id,rank:entry.rank,owner:entry.owner,
      mm:entity.stormTrackerRainGaugeMm??0,billboard});
   }
  }
  scene.primitives.raiseToTop?.(display);
  scene.requestRender?.();
 }
 // Cesium 3D does not expose a guaranteed billboard z-index. Protect the
 // higher-rarity icon when geographic perspective/texture sorting causes actual
 // screen-space overlap. Lower-priority gauges remain in the data model and
 // reappear automatically as soon as the camera separates their icons.
 function safeguardOverlap(){
  if(!registry.rendered.length)return;
  const entries=[];
  for(const item of registry.rendered){
   let rect=null;
   try{
    const p=item.billboard.computeScreenSpacePosition?.(viewer.scene);
    if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){
     const w=item.billboard.width??40,h=item.billboard.height??40;
     const vertical=item.billboard.verticalOrigin;
     const bottom=vertical===CesiumRef.VerticalOrigin?.BOTTOM;
     const top=vertical===CesiumRef.VerticalOrigin?.TOP;
     const y=bottom?p.y-h:top?p.y:p.y-h/2;
     rect={left:p.x-w/2,right:p.x+w/2,top:y,bottom:y+h};
    }
   }catch{ /* Unprojectable icons cannot occlude a verified higher marker. */ }
   entries.push({...item,rect});
  }
  const visible=chooseVisibleSeverityMarkers(entries);
  let changed=false;
  for(const item of entries){
   const show=visible.has(item.id);
   if(item.billboard.show!==show){item.billboard.show=show;changed=true;}
  }
  if(changed)viewer.scene.requestRender?.();
 }
 if(!registry.watching&&viewer.scene?.postRender?.addEventListener){
  viewer.scene.postRender.addEventListener(safeguardOverlap);
  registry.watching=true;
 }
 const list=[...sources.values()];stack();
 return {dataSource:list[0],dataSources:list,
  sourceFor(rank){const s=sources.get(rank);if(!s)throw Error("Unknown rank "+rank);return s;},
  clear(){for(const s of list){s.entities.suspendEvents?.();s.entities.removeAll();}},
  finish(){for(const s of list)s.entities.resumeEvents?.();stack();redrawBillboards();},
  setVisible(yes){for(const s of list)s.show=Boolean(yes);stack();redrawBillboards();}
 };
}
