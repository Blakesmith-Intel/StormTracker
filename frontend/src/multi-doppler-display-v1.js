// Secondary native Doppler scans for the existing multi-site radar chooser.
// Each source is genuine BoM radial velocity, independently timestamped;
// primary scan clock drives navigation but secondary data is never invented.
import {nearestDopplerFrameForTime} from "./bom-doppler-intake-v3.js";

export const MAX_SECONDARY_WIND_OFFSET_MINUTES=8;
export const SECONDARY_WIND_BLEND_MS=120;
export const SECONDARY_WIND_FRAME_SYNC_WAIT_MS=350;
export const SECONDARY_WIND_RETRY_COOLDOWN_MS=60000;
// Stage genuine secondary scans concurrently with primary decoding. At each
// primary frame boundary, wait at most 350 ms for extra-site preparation;
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
  // Rain radar's existing pattern: prepare source-true selected images while
  // primary decodes, then commit the ready layers together at its frame edge.
  let primary="",selected=[],enabled=false,targetUtc=null,generation=0;
  let preparingKey="",preparingPromise=null,committedUtc=null;
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
  function removeStage(s){
    if(!s.staged)return;
    const staged=s.staged;
    s.staged=null;
    if(staged.layer){
      try{
        if(!retireLayer?.(staged.layer))
          imageryLayers.remove(staged.layer,true);
      }catch{}
    }
  }
  function release(s){
    removeStage(s);
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
      s={id,observedUtc:null,error:null,staged:null,
        history:null,historyAt:0,historyTask:null,historyRetryAt:0,
        entries:new Map(),failedFrameUntil:new Map(),
        transition:createTransition({imageryLayers,scene,retireLayer,
          requestRender:()=>scene.requestRender()})};
      states.set(id,s);
    }
    return s;
  }
  function invalidateStages(){
    generation++;committedUtc=null;preparingKey="";preparingPromise=null;
    for(const s of states.values())removeStage(s);
  }
  function configure(primaryId,extras=[]){
    const next=supportedSecondaryWindSites(primaryId,extras,sites);
    if(primary===primaryId && selected.join(",")===next.join(","))return;
    const prevPrimary=primary;
    invalidateStages();
    primary=primaryId;selected=next;
    for(const [id,s] of states){
      if(!next.includes(id)||prevPrimary!==primaryId){
        release(s);states.delete(id);
      }
    }
    for(const id of next)stateFor(id);
    if(enabled&&targetUtc)showAt(targetUtc);
    else report();
  }
  function setEnabled(next){
    const active=Boolean(next);
    if(active===enabled)return;
    invalidateStages();
    enabled=active;
    if(!enabled){
      for(const s of states.values()){
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
  // Same prepare-then-commit discipline as supplemental rain radar.
  // Every extra site selects its own genuine nearest BoM velocity observation
  // (at most 8 minutes either side); no same-UTC scan is manufactured.
  function current(mine,utc){
    return enabled && generation===mine && targetUtc===utc;
  }
  async function waitForStage(layer,valid){
    if(!scene?.postRender?.addEventListener)return true;
    return new Promise(resolve=>{
      let done=false,frames=0,remove=()=>{};
      let timer;
      const finish=ok=>{
        if(done)return;
        done=true;remove();clearTimeout(timer);resolve(ok);
      };
      remove=scene.postRender.addEventListener(()=>{
        if(!valid()){finish(false);return;}
        if(++frames>=3){finish(true);return;}
        scene.requestRender();
      });
      // Staging remains asynchronous and never gates the master playback.
      timer=setTimeout(()=>finish(false),2500);
      scene.requestRender();
    });
  }
  async function prepareSite(s,utc,mine){
    const valid=()=>current(mine,utc)&&selected.includes(s.id) &&
      states.get(s.id)===s;
    let layer=null;
    try{
      const {frames,palette}=await ensureHistory(s);
      if(!valid())return;
      const match=matchingSecondaryWindFrame(frames,utc);
      if(!match){
        s.error="No measured Doppler scan within 8 minutes";
        return;
      }
      // Existing source-accurate scan can remain visible at this clock time.
      if(s.observedUtc===match.frame.observedUtc &&
         s.transition.currentLayer?.show!==false){
        s.staged={utc,observedUtc:match.frame.observedUtc,reuse:true};
        s.error=null;
        if(committedUtc===utc){commitSite(s,utc);report();}
        return;
      }
      const result=await frameFor(s,match.frame,palette);
      if(!valid())return;
      layer=createLayer(result.provider);
      layer.alpha=.001;
      const previous=s.transition.currentLayer;
      if(typeof imageryLayers.indexOf==="function"&&previous &&
         imageryLayers.indexOf(previous)>=0){
        imageryLayers.add(layer,imageryLayers.indexOf(previous));
      }else imageryLayers.add(layer);
      const staged=await waitForStage(layer,valid);
      if(!valid()||!staged)return;
      s.staged={utc,observedUtc:match.frame.observedUtc,layer};
      layer=null;
      s.error=null;
      // Finish late authentic scans only if the master is still on this UTC.
      if(committedUtc===utc){commitSite(s,utc);scene.requestRender();report();}
    }catch(error){
      if(valid()){
        s.error=String(error?.message??error);
        if(committedUtc===utc)report();
      }
    }finally{
      if(layer){
        try{if(!retireLayer?.(layer))imageryLayers.remove(layer,true);}catch{}
      }
    }
  }
  function prepare(utc){
    if(!enabled || !Number.isFinite(Date.parse(utc)))return Promise.resolve([]);
    const key=primary+"|"+selected.join(",")+"|"+utc;
    if(preparingKey===key && preparingPromise)return preparingPromise;
    invalidateStages();
    targetUtc=utc;
    const mine=generation;
    preparingKey=key;
    preparingPromise=Promise.all(selected.map(async id=>{
      const site=stateFor(id);
      await prepareSite(site,utc,mine);
      return site.staged?.utc===utc?id:null;
    })).then(ids=>current(mine,utc)?ids.filter(Boolean):[]);
    return preparingPromise;
  }
  // Keep a previously measured image only while its original BoM timestamp
  // remains within the accepted eight-minute selection window.
  function holdIsValid(s,utc){
    return Boolean(s.observedUtc && s.transition.currentLayer &&
      s.transition.currentLayer.show!==false &&
      Number.isFinite(Date.parse(utc)) &&
      Math.abs(Date.parse(s.observedUtc)-Date.parse(utc))<=
        MAX_SECONDARY_WIND_OFFSET_MINUTES*60000);
  }
  function commitSite(s,utc){
    const entry=s.staged?.utc===utc?s.staged:null;
    if(entry?.reuse){
      s.staged=null;s.error=null;return true;
    }
    if(entry?.layer){
      s.staged=null; // Hand ownership of the ready image to the transition.
      try{
        s.transition.replace({
          layer:entry.layer,key:s.id+"@"+entry.observedUtc,
          alpha:1,durationMs:SECONDARY_WIND_BLEND_MS,
          onAdded:()=>{
            const wind=getPrimaryLayer();
            if(wind&&imageryLayers.indexOf(wind)>=0)imageryLayers.raiseToTop(wind);
            const surface=getSurfaceLayer();
            if(surface&&imageryLayers.indexOf(surface)>=0)
              imageryLayers.raiseToTop(surface);
          }
        });
        s.observedUtc=entry.observedUtc;s.error=null;
        return true;
      }catch(error){
        s.error=String(error?.message??error);
        try{if(!retireLayer?.(entry.layer))
          imageryLayers.remove(entry.layer,true);}catch{}
      }
    }
    if(holdIsValid(s,utc)){
      // Keep the last in-window genuine image, never modify its source UTC.
      return true;
    }
    s.transition.clear();s.observedUtc=null;
    if(!s.error)s.error="Measured wind not ready for selected frame";
    return false;
  }
  // Commit the primary source clock immediately. A secondary stage may
  // complete afterwards at THIS SAME clock time; do not discard it merely
  // because it missed a 350ms primary deadline. New clock steps invalidate it.
  function commit(utc){
    if(!enabled||targetUtc!==utc)return [];
    committedUtc=utc;
    const ready=[];
    for(const id of selected){
      if(commitSite(stateFor(id),utc))ready.push(id);
    }
    scene.requestRender();report();
    return ready;
  }
  function showAt(utc){
    // Clicking a radar while paused uses the identical prepare/commit path.
    void prepare(utc).then(()=>{
      if(enabled&&targetUtc===utc)commit(utc);
    }).catch(error=>{
      console.warn("Supplemental measured wind unavailable",error);
    });
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
  return {configure,setEnabled,prepare,commit,showAt,prewarm,refresh,destroy,snapshot:reported,
    get visibleSites(){return [...states].filter(([,s])=>s.observedUtc).map(([id])=>id);}};
}
