// Render ALL original BoM flood/rainfall marker pairs, without suppression,
// label relocation, marker displacement or coordinate substitution.
// Cesium BillboardCollection has no billboard zIndex, so each severity rank
// receives its own scene primitive collection. Draw lower ranks first and
// higher rarity over them; geographically fixed symbols stay selectable.
const byViewer=new WeakMap();
export const FLOOD_ICON_PRIORITY=Object.freeze({unverified:0,"rapid-rise":1,elevated:1,minor:2,moderate:4,major:6});
export const floodIconPriority=state=>FLOOD_ICON_PRIORITY[String(state)]??0;
export function rainfallIconPriority(aep){
 if(aep?.classification==="below-20pct-aep")return 1;
 return ({20:2,10:3,5:4,2:5,1:6})[aep?.aepDesignThreshold]??0;
}
const resolve=(property,time)=>typeof property?.getValue==="function"?
 property.getValue(time):property;
const BILLBOARD_OPTIONS=["width","height","horizontalOrigin","verticalOrigin",
 "heightReference","disableDepthTestDistance","scale",
 "distanceDisplayCondition","scaleByDistance","translucencyByDistance"];
export function createSeverityMarkerLayers({viewer,CesiumRef,owner,priorities,visible=false}){
 if(!viewer?.dataSources||!CesiumRef?.CustomDataSource)throw Error("Missing Cesium viewer/data source");
 let registry=byViewer.get(viewer);
 if(!registry){registry={layers:[],billboards:new Map()};byViewer.set(viewer,registry);}
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
  const layers=[...registry.layers].sort((a,b)=>
   a.rank-b.rank||a.owner.localeCompare(b.owner));
  const ranks=[...new Set(layers.map(entry=>entry.rank))];
  // One scene collection per rank makes order explicit across owners.
  for(const rank of ranks){
   if(!registry.billboards.has(rank)){
    const display=scene.primitives.add(new CesiumRef.BillboardCollection({scene}));
    registry.billboards.set(rank,display);
   }
   registry.billboards.get(rank).removeAll();
  }
  const time=viewer.clock?.currentTime??CesiumRef.JulianDate?.now();
  for(const entry of layers){
   for(const entity of entry.source.entities.values){
    const graphics=entity.billboard;
    if(!graphics)continue;
    const position=resolve(entity.position,time);
    const image=resolve(graphics.image,time);
    // Keep the source entity for existing picking and station identity.
    graphics.show=false;
    if(!entry.source.show||!position||!image)continue;
    const options={id:entity,position,image};
    for(const key of BILLBOARD_OPTIONS){
     const value=resolve(graphics[key],time);
     if(value!==undefined&&value!==null)options[key]=value;
    }
    // Never replace original BoM longitude/latitude with a screen offset.
    // The icon and its AEP text are one immutable SVG image.
    registry.billboards.get(entry.rank).add(options);
   }
  }
  if(typeof scene.primitives.raiseToTop==="function")
   for(const rank of ranks)scene.primitives.raiseToTop(registry.billboards.get(rank));
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
