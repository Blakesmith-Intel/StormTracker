import { createRadarImageryHandover } from "./radar-imagery-handover-v1.js";

// V9 multi-site 2-D reflectivity display only. The existing primary site
// still owns Doppler, source histories, storm tracks and inferred 3-D science.
export const MAX_DISPLAY_RADAR_SITES = 4;
const TILE_SIZE = 256;
export function chooseSupplementalRadarSites(primary, extras, sites, maxTotal=MAX_DISPLAY_RADAR_SITES) {
  if (!Object.hasOwn(sites,primary)) throw new RangeError("Unknown primary radar site");
  const out=[],seen=new Set([primary]);
  for(const id of extras ?? []) {
    if (!Object.hasOwn(sites,id) || seen.has(id)) continue;
    if(out.length >= maxTotal-1) break;
    seen.add(id);out.push(id);
  }
  return out;
}
export function maskPreviouslyDisplayedTiles(frame, priorWindows, tileSize=TILE_SIZE) {
  const window=frame?.sourceMetadata?.tileWindow;
  if (!window || !Number.isInteger(frame.width) || !Number.isInteger(frame.height) ||
      !frame.categories || frame.categories.length !== frame.width*frame.height)
    throw new Error("Additional radar image has no valid measured tile window");
  const columns=window.colEnd-window.colStart+1,rows=window.rowEnd-window.rowStart+1;
  if(frame.width!==columns*tileSize || frame.height!==rows*tileSize)
    throw new Error("Additional radar pixels disagree with BoM tile metadata");
  const categories=frame.categories.slice();
  let maskedTiles=0;
  for(let row=window.rowStart;row<=window.rowEnd;row++)
    for(let col=window.colStart;col<=window.colEnd;col++){
      if(!priorWindows.some(w=>w && row>=w.rowStart&&row<=w.rowEnd&&
          col>=w.colStart&&col<=w.colEnd))continue;
      maskedTiles++;
      const x0=(col-window.colStart)*tileSize,y0=(row-window.rowStart)*tileSize;
      for(let y=y0;y<y0+tileSize;y++)
        categories.fill(0,y*frame.width+x0,y*frame.width+x0+tileSize);
    }
  return {...frame,categories,sourceMetadata:{
    ...frame.sourceMetadata, supplementalDisplayOnly:true,
    overlappingTilesMasked:maskedTiles
  }};
}
export function fitSelectedRadarSites(primary,extras,sites) {
  const found=[primary,...chooseSupplementalRadarSites(primary,extras,sites)]
    .map(id=>sites[id]).filter(Boolean);
  const lats=found.map(x=>x.latitude),lons=found.map(x=>x.longitude);
  const north=Math.max(...lats),south=Math.min(...lats);
  const east=Math.max(...lons),west=Math.min(...lons);
  const centerLat=(south+north)/2;
  const widthKm=(east-west)*111.32*Math.cos(centerLat*Math.PI/180);
  const heightKm=(north-south)*111.32;
  return {
    longitude:(west+east)/2,latitude:centerLat,
    range:Math.min(5000000,Math.max(175000,
      Math.max(heightKm*1000/1.05,widthKm*1000/1.25)+210000))
  };
}

// An independently decoded BoM 2-D radar image uses the exact same
// prepare -> stage below -> wait for Cesium -> atomic handover as the primary.
// In particular, never remove last frame while fetching the next one.
// Supplemental handovers do NOT delay primary radar playback or tracking.
export function createSupplementalRadarDisplay({
  imageryLayers,scene,loadFrame,prepareProvider,createLayer,
  getWindow,onStatus=()=>{},maxCached=18,retireLayer=null
}) {
  let primary="",extras=[],generation=0,lastKey="",opacity=1;
  let targetUtc=null;
  const controllers=new Map(),cache=new Map(),displayedUtc=new Map();

  function controllerFor(site) {
    if (!controllers.has(site)) {
      controllers.set(site,createRadarImageryHandover({
        imageryLayers,scene,retireLayer
      }));
    }
    return controllers.get(site);
  }

  function reset() {
    generation++;
    lastKey="";
    targetUtc=null;
    displayedUtc.clear();
    for (const controller of controllers.values()) controller.reset();
    controllers.clear();
    scene.requestRender();
  }

  function configure(primaryId,selectedIds) {
    const next=[...(selectedIds??[])];
    const same=primary===primaryId && extras.join(",")===next.join(",");
    primary=primaryId;
    extras=next;
    // A new site/mask layout is the only reason to discard the old mosaic.
    // Advancing source time MUST keep the previous frame until replacement.
    if(!same) reset();
  }

  function setOpacity(alpha) {
    opacity=Math.max(0,Math.min(1,Number(alpha)||0));
    for(const controller of controllers.values()) controller.setOpacity(opacity);
    scene.requestRender();
  }

  async function cachedFrame(site,utc) {
    const key=site+"@"+utc;
    if(cache.has(key)){
      const value=cache.get(key);
      cache.delete(key);
      cache.set(key,value);
      return value;
    }
    const task=Promise.resolve().then(()=>loadFrame(utc,site));
    cache.set(key,task);
    while(cache.size>maxCached) cache.delete(cache.keys().next().value);
    try{return await task;}catch(error){cache.delete(key);throw error;}
  }

  function show(utc,{enabled=true,alpha=1}={}) {
    setOpacity(alpha);
    if(!enabled || !extras.length || !utc || !primary){
      reset();
      onStatus(!extras.length?"Primary radar only.":
        "Additional rain windows paused until an original rain scan is displayed.");
      return Promise.resolve([]);
    }
    const key=primary+"|"+extras.join(",")+"|"+utc;
    if(key===lastKey) return Promise.resolve(
      [...controllers.entries()].filter(([id,c])=>
        c.currentLayer?.show!==false && displayedUtc.get(id)===utc).map(([id])=>id)
    );
    // Match the PRIMARY displayed scan, not the timestamp of the last
    // successfully fetched supplemental tile. Immediately HIDE (but retain
    // for rollback) old-UTC layers while the requested observed scan loads.
    // This prevents different BoM times from appearing side-by-side on pan,
    // pause, scrubbing and rapid playback. Never fabricate missing scans.
    targetUtc=utc;
    let hidden=0;
    for(const [id,controller] of controllers) {
      const layer=controller.currentLayer;
      if(layer && displayedUtc.get(id)!==utc && layer.show!==false){
        layer.show=false;
        hidden++;
      }
    }
    if(hidden)scene.requestRender();
    const mine=++generation;
    lastKey=key;
    const prior=[getWindow(primary)];
    let success=0,fail=0,covered=0;
    const summary=()=>success+"/"+extras.length+" additional measured sites · "+
      utc+(covered?" · "+covered+" already covered":"")+
      (fail?" · "+fail+" unavailable":"");
    onStatus("Preparing "+extras.length+" additional original BoM radar site"+
      (extras.length===1?"":"s")+" for "+utc+"…");

    // Mask overlapping national WMTS tiles exactly as before. Only measured
    // source frames with the requested UTC are allowed to replace a site.
    const tasks=extras.map(async (site,index)=>{
      const earlier=[...prior,...extras.slice(0,index).map(id=>getWindow(id))];
      try{
        const frame=await cachedFrame(site,utc);
        if(mine!==generation || key!==lastKey) return null;
        if(frame.observedUtc!==utc || frame.sourceMetadata?.temporalInference)
          throw new Error("Source scan clock mismatch or synthetic interpolation");
        const masked=maskPreviouslyDisplayedTiles(frame,earlier);
        const siteWindow=getWindow(site);
        if(masked.sourceMetadata.overlappingTilesMasked===
            (siteWindow.rowEnd-siteWindow.rowStart+1)*
            (siteWindow.colEnd-siteWindow.colStart+1)){
          if(mine===generation) {
            controllerFor(site).reset();
            displayedUtc.delete(site);
            covered++;onStatus(summary());
          }
          return null;
        }
        const provider=await prepareProvider(masked);
        if(mine!==generation || key!==lastKey) return null;
        const layer=createLayer(provider);
        const ready=await controllerFor(site).replace(layer,{
          alpha:opacity,
          decodedSingleTile:true,
          timeoutMs:1800,
          isCurrent:()=>mine===generation && key===lastKey
        });
        if(mine!==generation || key!==lastKey) return null;
        if(!ready) throw new Error("New source scan was not ready for atomic handover");
        controllerFor(site).setOpacity(opacity);
        const active=controllerFor(site).currentLayer;
        if(active)active.show=true;
        displayedUtc.set(site,utc);
        scene.requestRender();
        success++;onStatus(summary());
        return site;
      }catch(error){
        if(mine!==generation || key!==lastKey) return null;
        // An unavailable new source is not replaced with a different UTC.
        // Do not indefinitely misrepresent an old scan as the current scan.
        controllerFor(site).reset();
        displayedUtc.delete(site);
        cache.delete(site+"@"+utc);
        fail++;
        console.warn("Additional BoM radar site unavailable",site,utc,error);
        onStatus(summary());
        return null;
      }
    });
    return Promise.all(tasks);
  }

  return {
    configure,show,reset,setOpacity,
    get visibleSites(){
      return [...controllers.entries()].filter(([id,c])=>
        c.currentLayer && c.currentLayer.show!==false &&
        displayedUtc.get(id)===targetUtc).map(([id])=>id);
    },
    get displayedTimes(){return Object.fromEntries(displayedUtc);},
    get targetTime(){return targetUtc;},
    get selectedSites(){return [...extras];},
    get generation(){return generation;}
  };
}
