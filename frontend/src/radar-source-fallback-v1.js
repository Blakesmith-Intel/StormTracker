// Browser-only, source-faithful decision for a BoM history request failure.
// Retain genuine measured scans already published into this browser, but
// never infer/fabricate missing source observation times or tiles.
export function resolveSourceDiscovery({
  outcome,cachedFrames=[],automatic=false
}={}) {
  if(!outcome || (!Array.isArray(outcome.times) && !outcome.error))
    throw new TypeError("Explicit discovery result required");
  if(!outcome.error)
    return {times:outcome.times,keepCurrent:false,cachedOnly:false};
  if(automatic)
    return {times:[],keepCurrent:true,cachedOnly:false};
  if(Array.isArray(cachedFrames) && cachedFrames.length)
    return {times:[],keepCurrent:false,cachedOnly:true};
  throw new Error("BoM published reflectivity unavailable, and there is no prior "+
    "genuine radar observation cached in this browser. "+
    String(outcome.error?.message??outcome.error));
}
