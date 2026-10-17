// Secondary native Doppler scans for the existing multi-site radar chooser.
// Each source is genuine BoM radial velocity, independently timestamped;
// primary scan clock drives navigation but secondary data is never invented.
import {nearestDopplerFrameForTime} from "./bom-doppler-intake-v3.js";

export const MAX_SECONDARY_WIND_OFFSET_MINUTES=8;
export const SECONDARY_WIND_BLEND_MS=120;
export const SECONDARY_WIND_FRAME_SYNC_WAIT_MS=160;
export const SECONDARY_WIND_RETRY_COOLDOWN_MS=60000;
// Stage genuine secondary scans concurrently with primary decoding. At each
// primary frame boundary, wait at most 160 ms for extra-site preparation;
// never let an unavailable/sluggish radar freeze the operator playback.
// Return false on timeout/error, with the source promise safely handled.
export async function waitForSecondaryWindPreparation(preparation,
  maxWaitMs=SECONDARY_WIND_FRAME_SYNC_WAIT_MS){
  let timer;
  try{
    return await Promise.race([
      Promise.resolve(preparation).then(()=>true,()=>false),
      new Promise(resolve=>{
        timer=setTimeout(()=>resolve(false),Math.max(0,maxWaitMs));
      })
    ]);
  }finally{if(timer!=null)clearTimeout(timer);}
}
export function supportedSecondaryWindSites(primary,extras,sites){
  return [...new Set(extras??[])].filter(id=>id!==primary &&
    Boolean(sites?.[id]?.dopplerProduct) && sites[id].dopplerIntegrated!==false);
}
export function matchingSecondaryWindFrame(frames,targetUtc,maxOffset=MAX_SECONDARY_WIND_OFFSET_MINUTES){
  if(!Number.isFinite(Date.parse(targetUtc)))return null;
  const result=nearestDopplerFrameForTime(frames,targetUtc,maxOffset);
  if(!result.matched || !result.candidate?.filename ||
     !Number.isFinite(Date.parse(result.candidate.observedUtc)))return null;
  return {frame:result.candidate,deltaMinutes:result.deltaMinutes};
}
export function createSupplementalDopplerDisplay({
  sites,imageryLayers,scene,loadSiteHistory,loadSiteFrame,createLayer,
  createTransition,getPrimaryLayer=()=>null,getSurfaceLayer=()=>null,
  retireLayer=null,onStatus=()=>{},now=()=>Date.now(),
  historyFreshMs=300000,requestTimeoutMs=7000
}){
  const states=new Map();
  let primary="",selected=[],enabled=false,targetUtc=null,generation=0;
  const reported=()=>({
    enabled,targetUtc,selected:[...selected],
    sources:selected.map(id=>{
      const s=states.get(id);
      const measured=Date.parse(s?.observedUtc??"");
      const selectedTime=Date.parse(targetUtc??"");
      const offsetMinutes=Number.isFinite(measured)&&Number.isFinite(selectedTime)
        ? Math.round((measured-selectedTime)/6000)/10:null;
      return {id,observedUtc:s?.observedUtc??null,
        offsetMinutes,error:s?.error??null,
        matched:Boolean(s?.observedUtc &&
          matchingSecondaryWindFrame([{filename:"displayed",observedUtc:s.observedUtc}],targetUtc))};
    })
  });
  function report(){onStatus(reported());}
  function release(s){
    s.token++;
    s.desiredUtc=null;
    s.observedUtc=null;
    s.transition.clear();
    s.entries.clear();
    s.failedFrameUntil.clear();
    s.historyRetryAt=0;
    s.error=null;
  }
  function stateFor(id){
    let s=states.get(id);
    if(!s){
      s={id,token:0,desiredUtc:null,observedUtc:null,error:null,
        history:null,historyAt:0,historyTask:null,historyRetryAt:0,
        pumping:false,entries:new Map(),failedFrameUntil:new Map(),
        transition:createTransition({imageryLayers,scene,retireLayer,
          requestRender:()=>scene.requestRender()})};
      states.set(id,s);
    }
    return s;
  }
  function configure(primaryId,extras=[]){
    const next=supportedSecondaryWindSites(primaryId,extras,sites);
    if(primary===primaryId && selected.join(",")===next.join(","))return;
    const prevPrimary=primary;
    primary=primaryId;
    selected=next;
    generation++;
    for(const [id,s] of states)
      if(!next.includes(id)||prevPrimary!==primaryId){release(s);states.delete(id);}
    for(const id of next)stateFor(id);
    if(enabled && targetUtc)showAt(targetUtc);
    else report();
  }
  function setEnabled(next){
    const active=Boolean(next);
    if(active===enabled)return;
    enabled=active;
    generation++;
    if(!enabled){
      for(const s of states.values()){
        s.token++;
        s.desiredUtc=null;
        s.observedUtc=null;
        s.transition.clear();
      }
      targetUtc=null;
    }
    report();
  }
  async function bounded(task){
    let timer;
    try{return await Promise.race([task,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error("Doppler source preparation exceeded deadline")),requestTimeoutMs);
    })]);}
    finally{clearTimeout(timer);}
  }
  async function ensureHistory(s,force=false){
    if(!force && s.history && now()-s.historyAt<historyFreshMs)return s.history;
    if(s.historyTask)return s.historyTask;
    if(!force && now()<s.historyRetryAt)
      throw Error("BoM Doppler history temporarily unavailable; waiting before retry");
    const task=bounded(Promise.resolve().then(()=>loadSiteHistory(s.id))).then(result=>{
      if(!Array.isArray(result?.frames) || !result?.palette)
        throw Error("No source-calibrated BoM velocity history");
      s.history=result;s.historyAt=now();s.error=null;s.historyRetryAt=0;
      return result;
    }).catch(error=>{
      // Without backoff, each animation frame refetches the same rejected
      // optional radar (often HTTP 403/502) and saturates the map/relay.
      s.historyRetryAt=now()+SECONDARY_WIND_RETRY_COOLDOWN_MS;
      throw error;
    });
    s.historyTask=task;
    try{return await task;}finally{if(s.historyTask===task)s.historyTask=null;}
  }
  async function frameFor(s,frame,palette){
    const key=frame.filename;
    if(s.entries.has(key))return s.entries.get(key);
    if(now()<(s.failedFrameUntil.get(key)??0))
      throw Error("BoM Doppler image temporarily unavailable; waiting before retry");
    const task=bounded(Promise.resolve().then(()=>
      loadSiteFrame(s.id,frame,palette))).then(result=>{
      // A mislabeled source frame cannot be presented under a different UTC.
      if(!result?.provider || result.observedUtc!==frame.observedUtc)
        throw Error("BoM Doppler source UTC mismatch or imagery missing");
      s.failedFrameUntil.delete(key);
      return result;
    }).catch(error=>{
      s.failedFrameUntil.set(key,now()+SECONDARY_WIND_RETRY_COOLDOWN_MS);
      while(s.failedFrameUntil.size>12)
        s.failedFrameUntil.delete(s.failedFrameUntil.keys().next().value);
      throw error;
    });
    s.entries.set(key,task);
    while(s.entries.size>3)s.entries.delete(s.entries.keys().next().value);
    task.catch(()=>{if(s.entries.get(key)===task)s.entries.delete(key);});
    return task;
  }
  function isCurrent(s,token,utc){
    return enabled && selected.includes(s.id) && states.get(s.id)===s &&
      s.token===token && s.desiredUtc===utc && targetUtc===utc;
  }
  async function pump(s){
    if(s.pumping)return;
    s.pumping=true;
    try {
      // Only one network/decode pipeline per site; fast scrubbing coalesces
      // to the most recent requested timestamp, never multiplying requests.
      while(enabled && selected.includes(s.id) && s.desiredUtc){
        const utc=s.desiredUtc,token=s.token;
        try{
          const {frames,palette}=await ensureHistory(s);
          if(!isCurrent(s,token,utc))continue;
          const match=matchingSecondaryWindFrame(frames,utc);
          if(!match){
            s.transition.clear();s.observedUtc=null;
            s.error="No measured Doppler scan within 8 minutes";report();
            break;
          }
          if(s.observedUtc===match.frame.observedUtc &&
             s.transition.currentLayer?.show!==false){s.error=null;report();break;}
          const result=await frameFor(s,match.frame,palette);
          if(!isCurrent(s,token,utc))continue;
          const layer=createLayer(result.provider);
          const key=s.id+"@"+match.frame.observedUtc;
          const handover=await s.transition.replacePrepared({
            layer,key,alpha:1,durationMs:SECONDARY_WIND_BLEND_MS,timeoutMs:1000,
            onAdded:()=>{
              const wind=getPrimaryLayer();
              if(wind && imageryLayers.indexOf(wind)>=0)imageryLayers.raiseToTop(wind);
              const surface=getSurfaceLayer();
              if(surface && imageryLayers.indexOf(surface)>=0)imageryLayers.raiseToTop(surface);
            }
          });
          if(!isCurrent(s,token,utc)){
            // A newer requested frame or a disabled layer wins; never allow
            // an older asynchronous wind request to resurrect stale imagery.
            s.transition.clear();s.observedUtc=null;
            continue;
          }
          if(handover?.ready===false || handover?.cancelled)
            throw Error("Secondary Doppler tile did not stage");
          s.observedUtc=match.frame.observedUtc;s.error=null;
          scene.requestRender();report();break;
        }catch(error){
          if(!isCurrent(s,token,utc))continue;
          s.transition.clear();s.observedUtc=null;
          s.error=String(error?.message??error);
          report();
          break;
        }
      }
    }finally{
      s.pumping=false;
      // A time change during final cleanup will have a newer token.
      // The caller runs pump again on showAt; the loop above handles changes
      // during awaits without spawning parallel per-site requests.
    }
  }
  function showAt(utc){
    targetUtc=Number.isFinite(Date.parse(utc))?utc:null;
    if(!enabled || !targetUtc){report();return;}
    for(const id of selected){
      const s=stateFor(id);
      if(s.desiredUtc!==targetUtc){
        s.token++;s.desiredUtc=targetUtc;
        // Never show last frame outside permitted measured source-time delta.
        if(s.observedUtc && !matchingSecondaryWindFrame(
          [{filename:"displayed",observedUtc:s.observedUtc}],targetUtc)){
          s.transition.clear();s.observedUtc=null;
        }
      }
      void pump(s);
    }
    report();
  }
  // Decode and geographically project ONE upcoming observed scan per site
  // off the critical displayed-frame path. Only genuine, per-site BoM frames
  // are cached; no interpolation or extra source timestamps are created.
  async function prewarm(utc){
    if(!enabled || !Number.isFinite(Date.parse(utc)))return;
    await Promise.allSettled(selected.map(async id=>{
      const s=stateFor(id);
      const {frames,palette}=await ensureHistory(s);
      const match=matchingSecondaryWindFrame(frames,utc);
      if(match)await frameFor(s,match.frame,palette);
    }));
  }
  async function refresh(){
    if(!enabled || !selected.length)return;
    await Promise.allSettled(selected.map(async id=>{
      const s=states.get(id);
      try{await ensureHistory(s,true);}catch(error){
        s.error=String(error?.message??error);
      }
    }));
    if(enabled && targetUtc)showAt(targetUtc);
  }
  function destroy(){
    enabled=false;generation++;
    for(const s of states.values())release(s);
    states.clear();selected=[];targetUtc=null;report();
  }
  return {configure,setEnabled,showAt,prewarm,refresh,destroy,snapshot:reported,
    get visibleSites(){return [...states].filter(([,s])=>s.observedUtc).map(([id])=>id);}};
}
