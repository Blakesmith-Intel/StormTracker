// Opt-in browser GPU lifecycle probe; no production imports, no suppression.
// In DevTools console: await import('./src/dev-webgl-lifecycle-probe-20261019.js').then(m=>m.installWebglLifecycleProbe())
// Then exercise 10 frame changes, rapid zoom, and multi-radar switching.
// Snapshot: __stormGpuProbe.snapshot('playback'); Stop: __stormGpuProbe.stop()
export function installWebglLifecycleProbe(){
 if(globalThis.__stormGpuProbe)return globalThis.__stormGpuProbe;
 const restorers=[],counts={};const live=new WeakMap();let active=true;
 function count(name){counts[name]=(counts[name]||0)+1}
 for(const API of [globalThis.WebGLRenderingContext,globalThis.WebGL2RenderingContext].filter(Boolean)){
  const proto=API.prototype;
  for(const method of ["createTexture","deleteTexture","bindTexture","texImage2D","texSubImage2D","generateMipmap","createFramebuffer","deleteFramebuffer","createRenderbuffer","deleteRenderbuffer"]){
   const original=proto[method];if(typeof original!=="function")continue;
   const wrapper=function(...args){
    if(!active)return original.apply(this,args);
    count(method);
    if(method==="deleteTexture"&&args[0]){const s=live.get(this);if(s)s.delete(args[0])}
    const result=original.apply(this,args);
    if(method==="createTexture"&&result){let s=live.get(this);if(!s){s=new Set();live.set(this,s)}s.add(result)}
    return result;
   };
   try{proto[method]=wrapper;restorers.push(()=>{proto[method]=original})}catch{}
  }
 }
 const origins={...counts};
 const api={
  snapshot(label="snapshot"){const output={label,counts:{...counts},trackedTextureBalance:(counts.createTexture||0)-(counts.deleteTexture||0),note:"Creation/deletion balance is NOT proof of a leak; textures created before instrumentation and driver allocations are not visible."};console.table(output.counts);console.info("StormTracker GPU probe:",output);return output},
  resetCounters(){for(const k of Object.keys(counts))delete counts[k]},
  stop(){active=false;for(const fn of restorers.reverse())fn();delete globalThis.__stormGpuProbe;return {...counts}}
 };
 globalThis.__stormGpuProbe=api;
 console.info("GPU probe installed. Compare idle/playback/zoom/multi-radar snapshots; stop() after test.");
 return api;
}
