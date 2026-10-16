// Source-renderer promise LRU. Retained BoM frame objects can otherwise keep
// every decoded PNG/data-URL/Cesium imagery provider alive through a WeakMap.
// This is a *render* cache, not an observation or scientific-data cache.
export function createBoundedRenderProviderCache({limit=5}={}) {
  if(!Number.isSafeInteger(limit)||limit<1)throw new RangeError("Provider cache limit must be positive");
  const entries=new Map();
  return {
    get(key){
      if(!entries.has(key))return undefined;
      const value=entries.get(key);
      entries.delete(key);
      entries.set(key,value);
      return value;
    },
    set(key,value){
      if(entries.has(key))entries.delete(key);
      entries.set(key,value);
      while(entries.size>limit)entries.delete(entries.keys().next().value);
      return this;
    },
    delete(key){return entries.delete(key);},
    clear(){entries.clear();},
    get size(){return entries.size;},
    keys(){return entries.keys();}
  };
}
