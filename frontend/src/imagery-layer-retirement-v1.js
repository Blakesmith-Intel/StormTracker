// Isolated Cesium 1.145 GPU lifetime experiment: remove old weather layers
// from draw order immediately, but defer destruction of their GPU resources
// until at least two later Cesium render boundaries and a short grace period.
// Never synthesize weather imagery or retain permanently obsolete layers.
export function createDeferredImageryRetirement({
  imageryLayers,scene,now=()=>Date.now(),
  graceMs=500,schedule=setTimeout,cancel=clearTimeout
}={}) {
  if(!imageryLayers?.remove || !scene?.postRender?.addEventListener)
    throw TypeError("Imagery retirement requires Cesium layers and postRender");
  const retired=new Map();
  let renderCount=0,timer=null,disposed=false;
  const counts={retired:0,destroyed:0,peakPending:0};
  function safelyDestroy(layer){
    const item=retired.get(layer);
    if(!item)return;
    retired.delete(layer);
    try{
      if(!layer.isDestroyed?.())layer.destroy?.();
    }catch(error){
      console.warn("Deferred imagery resource cleanup failed:",error?.message??error);
    }
    counts.destroyed++;
  }
  function sweep(){
    if(disposed)return;
    for(const [layer,item] of retired){
      if(renderCount-item.renderCount>=2 && now()-item.at>=graceMs)
        safelyDestroy(layer);
    }
    if(retired.size && timer===null){
      timer=schedule(()=>{
        timer=null;
        scene.requestRender?.();
        sweep();
      },graceMs);
    }
  }
  const detach=scene.postRender.addEventListener(()=>{
    renderCount++;
    sweep();
    if(retired.size)scene.requestRender?.();
  });
  function retire(layer){
    if(!layer||retired.has(layer)||disposed)return false;
    try{
      if(!imageryLayers.remove(layer,false))return false;
    }catch{return false;}
    counts.retired++;
    retired.set(layer,{at:now(),renderCount});
    counts.peakPending=Math.max(counts.peakPending,retired.size);
    scene.requestRender?.();
    sweep();
    return true;
  }
  function destroy(){
    if(disposed)return;
    disposed=true;
    detach?.();
    if(timer!==null){cancel(timer);timer=null;}
    for(const layer of retired.keys())safelyDestroy(layer);
  }
  return {retire,destroy,snapshot:()=>({...counts,pending:retired.size,renderCount})};
}
