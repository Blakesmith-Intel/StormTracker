// Browser-only, source-faithful decision for a BoM history request failure.
// Retain genuine measured scans already published into this browser, but
// never infer/fabricate missing source observation times or tiles.
export function classifyReflectivityFailure(error){
 const message=String(error?.message??error??"unknown source error");
 const http=message.match(/(?:HTTP|status)\s*[:=]?\s*(400|401|403|404|408|429|500|502|503|504)\b/i);
 const status=http?Number(http[1]):null;
 const category=/capabilit|time dimension|published times|published reflectivity/i.test(message)
   ?"wmts-metadata-or-publication"
   : /tile|GetTile|preflight/i.test(message)?"wmts-tile"
   : /abort|timed?\s*out|timeout/i.test(message)?"source-timeout"
   : /network|fetch|dns|relay|gateway/i.test(message)?"source-network-or-relay"
   :"source-unclassified";
 return {category,status,message};
}
export function resolveSourceDiscovery({
  outcome,cachedFrames=[],automatic=false
}={}) {
  if(!outcome || (!Array.isArray(outcome.times) && !outcome.error))
    throw new TypeError("Explicit discovery result required");
  if(!outcome.error)
    return {times:outcome.times,keepCurrent:false,cachedOnly:false};
  const detail=classifyReflectivityFailure(outcome.error);
  // Diagnostics are available to callers without changing observation decisions.
  if(automatic)
    return {times:[],keepCurrent:true,cachedOnly:false};
  if(Array.isArray(cachedFrames) && cachedFrames.length)
    return {times:[],keepCurrent:false,cachedOnly:true};
  throw new Error("BoM published reflectivity unavailable, and there is no prior "+
    "genuine radar observation cached in this browser. "+
    "[source="+detail.category+(detail.status?", HTTP "+detail.status:"")+"] "+
    detail.message);
}
