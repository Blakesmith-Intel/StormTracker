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

// Additional windows deliberately do NOT participate in the primary atomic
// weather handover. They are best-effort and never hold or slow the true
// primary radar playback clock. No stale scan remains on source-time changes.
export function createSupplementalRadarDisplay({
  imageryLayers,scene,loadFrame,prepareProvider,createLayer,
  getWindow,onStatus=()=>{},maxCached=18
}) {
  let primary="",extras=[],generation=0,lastKey="",layers=new Map(),cache=new Map();
  function removeLayers(){
    for(const layer of layers.values()){
      try{imageryLayers.remove(layer,true);}catch{/* discarded Cesium view */}
    }
    layers.clear();
    scene.requestRender();
  }
  function reset(){
    generation++;lastKey="";removeLayers();
  }
  function configure(primaryId,selectedIds){
    const same=primary===primaryId &&
      extras.join(",")===(selectedIds??[]).join(",");
    primary=primaryId;extras=[...(selectedIds??[])];
    if(!same)reset();
  }
  function setOpacity(alpha){
    const bounded=Math.max(0,Math.min(1,Number(alpha)||0));
    for(const layer of layers.values())layer.alpha=bounded;
    scene.requestRender();
  }
  async function cachedFrame(site,utc){
    const key=site+"@"+utc;
    if(cache.has(key)){
      const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;
    }
    const task=Promise.resolve().then(()=>loadFrame(utc,site));
    cache.set(key,task);
    while(cache.size>maxCached)cache.delete(cache.keys().next().value);
    try{return await task;}catch(error){cache.delete(key);throw error;}
  }
  function show(utc,{enabled=true,alpha=1}={}){
    if(!enabled || !extras.length || !utc || !primary){
      reset();
      onStatus(!extras.length ? "Primary radar only." :
        "Additional rain windows paused until an original rain scan is displayed.");
      return Promise.resolve([]);
    }
    const key=primary+"|"+extras.join(",")+"|"+utc;
    if(key===lastKey){
      setOpacity(alpha);return Promise.resolve([...layers.keys()]);
    }
    reset();lastKey=key;
    const mine=generation;
    const prior=[getWindow(primary)];
    let success=0,fail=0,covered=0;
    const summary=()=>success+"/"+extras.length+" additional measured sites · "+
      utc+(covered?" · "+covered+" already covered":"")+
      (fail?" · "+fail+" unavailable":"");
    onStatus("Loading "+extras.length+" additional radar site"+(extras.length===1?"":"s")+
      " at original BoM "+utc+"…");
    // List is ordered so windows are masked against the primary AND each
    // preceding selection: never double-paint duplicated national WMTS tiles.
    const tasks=extras.map(async (site,index)=>{
      const earlier=[...prior,...extras.slice(0,index).map(id=>getWindow(id))];
      try{
        const frame=await cachedFrame(site,utc);
        if(frame.observedUtc!==utc || frame.sourceMetadata?.temporalInference)
          throw new Error("Source scan clock mismatch or synthetic interpolation");
        const masked=maskPreviouslyDisplayedTiles(frame,earlier);
        if(masked.sourceMetadata.overlappingTilesMasked ===
            (getWindow(site).rowEnd-getWindow(site).rowStart+1)*
            (getWindow(site).colEnd-getWindow(site).colStart+1)){
          if(mine===generation){
            covered++;onStatus(summary());
          }
          return null;
        }
        const provider=await prepareProvider(masked);
        if(mine!==generation || key!==lastKey)return null;
        const layer=createLayer(provider);
        layer.alpha=Math.max(0,Math.min(1,Number(alpha)||0));
        imageryLayers.add(layer);
        layers.set(site,layer);
        success++;
        scene.requestRender();
        onStatus(summary());
        return site;
      }catch(error){
        if(mine!==generation)return null;
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
    get visibleSites(){return [...layers.keys()];},
    get selectedSites(){return [...extras];},
    get generation(){return generation;}
  };
}
