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
const BILLBOARD_OPTIONS=["width","height","horizontalOrigin","verticalOrigin",
 "heightReference","disableDepthTestDistance","pixelOffset","scale","eyeOffset",
 "distanceDisplayCondition","scaleByDistance","translucencyByDistance"];
export function createSeverityMarkerLayers({viewer,CesiumRef,owner,priorities,visible=false}){
 if(!viewer?.dataSources||!CesiumRef?.CustomDataSource)throw Error("Missing Cesium viewer/data source");
 let registry=byViewer.get(viewer);
 if(!registry){registry={layers:[],billboards:null};byViewer.set(viewer,registry);}
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
    display.add(options);
   }
  }
  scene.primitives.raiseToTop?.(display);
  scene.requestRender?.();
 }
 const list=[...sources.values()];stack();
 return {dataSource:list[0],dataSources:list,
  sourceFor(rank){const s=sources.get(rank);if(!s)throw Error("Unknown rank "+rank);return s;},
  clear(){for(const s of list){s.entities.suspendEvents?.();s.entities.removeAll();}},
  finish(){for(const s of list)s.entities.resumeEvents?.();stack();redrawBillboards();},
  setVisible(yes){for(const s of list)s.show=Boolean(yes);stack();redrawBillboards();}
 };
}
