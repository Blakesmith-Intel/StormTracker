// Use distinct Cesium CustomDataSource layers for genuine overlapping
// icon draw order; Cesium billboards have no supported zIndex.
const byViewer=new WeakMap();
export const FLOOD_ICON_PRIORITY=Object.freeze({unverified:0,"rapid-rise":1,minor:2,moderate:4,major:6});
export const floodIconPriority=state=>FLOOD_ICON_PRIORITY[String(state)]??0;
export function rainfallIconPriority(aep){
 if(aep?.classification==="below-20pct-aep")return 1;
 return ({20:2,10:3,5:4,2:5,1:6})[aep?.aepDesignThreshold]??0;
}
export function createSeverityMarkerLayers({viewer,CesiumRef,owner,priorities,visible=false}){
 if(!viewer?.dataSources||!CesiumRef?.CustomDataSource)throw Error("Missing Cesium viewer/data source");
 let registry=byViewer.get(viewer);
 if(!registry){registry=[];byViewer.set(viewer,registry);}
 const sources=new Map();
 for(const rank of [...new Set(priorities)].sort((a,b)=>a-b)){
  const source=new CesiumRef.CustomDataSource(owner+"-severity-"+rank);
  source.show=Boolean(visible);
  viewer.dataSources.add(source);
  sources.set(rank,source);registry.push({rank,owner,source});
 }
 function stack(){
  if(typeof viewer.dataSources.raiseToTop==="function")
   for(const entry of [...registry].sort((a,b)=>a.rank-b.rank||a.owner.localeCompare(b.owner)))
    viewer.dataSources.raiseToTop(entry.source);
 }
 const list=[...sources.values()];stack();
 return {dataSource:list[0],dataSources:list,
  sourceFor(rank){const s=sources.get(rank);if(!s)throw Error("Unknown rank "+rank);return s;},
  clear(){for(const s of list){s.entities.suspendEvents?.();s.entities.removeAll();}},
  finish(){for(const s of list)s.entities.resumeEvents?.();stack();},
  setVisible(yes){for(const s of list)s.show=Boolean(yes);stack();}
 };
}
