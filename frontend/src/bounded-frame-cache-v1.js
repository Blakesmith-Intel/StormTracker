// Bounded, source-agnostic LRU for expensive scene geometries. Keeping
// inactive primitives hidden avoids rebuilding the same 3-D frame each loop.
// Eviction always destroys GPU resources through the injected scene callback.
export function createBoundedFrameCache({limit=6,onEvict=()=>{}}={}) {
  if(!Number.isInteger(limit)||limit<1)throw new RangeError("Cache limit must be positive");
  const entries=new Map();
  function get(key){
    if(!entries.has(key))return null;
    const value=entries.get(key);
    entries.delete(key);entries.set(key,value);
    return value;
  }
  function put(key,value){
    if(entries.has(key)){
      const old=entries.get(key);entries.delete(key);
      if(old!==value)onEvict(old);
    }
    entries.set(key,value);
    while(entries.size>limit){
      const oldest=entries.keys().next().value;
      const removed=entries.get(oldest);
      entries.delete(oldest);onEvict(removed);
    }
  }
  function clear(){
    for(const item of entries.values())onEvict(item);
    entries.clear();
  }
  return {get,put,clear,get size(){return entries.size}};
}
