// Display-only empirical 3-D over genuine, source-time-matched supplemental
// BoM reflectivity. Never supplies tracks, threats, Doppler or observed heights.
// Masked overlapping WMTS tiles contain category zero and cannot duplicate
// a column already represented by the primary/earlier selected radar.
// Bounded at 250 sampled columns and 1500 glyphs/site: three additional
// windows can never multiply unbounded browser GPU geometry.
export const SUPPLEMENTAL_VOLUME_MAX_COLUMNS=250;
export const SUPPLEMENTAL_VOLUME_MAX_GLYPHS=1500;

export function createSupplementalRadarVolumes({
  Cesium,scene,getModel,getSettings,inferColumn,
  representativeDbzForCategory,pixelCentreMercator,
  webMercatorToDegrees,styleForInferredPoint,displayedVolumeAltitude,
  colourForDbzh,addVolumeGlyph,setVolumeDisplayOpacity
}) {
  const siteStates=new Map();
  let visible=true;

  function hide(site){
    const state=siteStates.get(site);
    if(!state)return;
    state.visible=false;
    for(const collection of state.collections.values())collection.show=false;
    state.frame=null;state.utc=null;
    scene.requestRender();
  }
  function hideAll(){for(const site of siteStates.keys())hide(site);}
  function render(site,frame,utc){
    if(!frame?.categories || frame.observedUtc!==utc)return 0;
    const model=getModel();
    if(!model){hide(site);return 0;}
    const settings=getSettings();
    let state=siteStates.get(site);
    if(!state){
      state={collections:new Map(),visible:false,frame:null,utc:null};
      siteStates.set(site,state);
    }
    const mode=settings.blob?"blob":"point";
    // Keep collections alive across frame changes and toggles instead of
    // destroying/recreating GPU textures (the original WebGL crash path).
    for(const [type,collection] of state.collections){
      if(type!==mode)collection.show=false;
    }
    let collection=state.collections.get(mode);
    if(!collection){
      collection=scene.primitives.add(settings.blob
        ?new Cesium.BillboardCollection()
        :new Cesium.PointPrimitiveCollection());
      state.collections.set(mode,collection);
    }
    collection.show=false;
    collection.removeAll();

    // Count ONLY actual observed high-dBZ pixels (including the 40 dBZ
    // threshold). Then take deterministic samples throughout each measured
    // source footprint, not an invented interpolation between sites.
    const threshold=Math.max(40,Number(settings.minimumDbzh)||40);
    let eligible=0;
    const categories=frame.categories;
    for(let i=0;i<categories.length;i++){
      const dbz=representativeDbzForCategory(categories[i]);
      if(dbz!==null && dbz!==undefined && dbz>=threshold)eligible++;
    }
    const sampleEvery=Math.max(1,Math.ceil(eligible/SUPPLEMENTAL_VOLUME_MAX_COLUMNS));
    let seen=0,columns=0,glyphs=0;
    const width=frame.width;
    outer:for(let i=0;i<categories.length;i++){
      const inputDbzh=representativeDbzForCategory(categories[i]);
      if(inputDbzh==null || inputDbzh<threshold)continue;
      if(seen++%sampleEvery!==0)continue;
      const levelPoints=inferColumn(model,inputDbzh,{
        occupancyThreshold:settings.occupancyThreshold,
        minimumOutputDbz:30
      }).filter(p=>Number(p.dbzh)>=threshold);
      if(!levelPoints.length)continue;
      const y=Math.floor(i/width),x=i-y*width;
      const point=pixelCentreMercator(frame,x,y);
      const geo=webMercatorToDegrees(point.x,point.y);
      const verticalStep=Math.max(1,Math.ceil(levelPoints.length/6));
      for(let k=0;k<levelPoints.length;k+=verticalStep){
        if(glyphs>=SUPPLEMENTAL_VOLUME_MAX_GLYPHS)break outer;
        const inferred=levelPoints[k];
        const style=styleForInferredPoint(inferred,{
          displayThresholdDbz:30,basePointSize:settings.pointSize
        });
        addVolumeGlyph(collection,{
          position:Cesium.Cartesian3.fromDegrees(
            geo.longitude,geo.latitude,
            displayedVolumeAltitude(
              inferred.altitude_m_amsl,inputDbzh,settings.verticalScale
            )
          ),
          color:colourForDbzh(inferred.dbzh),
          pixelSize:style.pixelSize,
          disableDepthTestDistance:0
        },style.alpha,settings.volumePercent,inferred.dbzh,
          Math.min(1.3,style.pixelSize/3));
        glyphs++;
      }
      columns++;
      if(columns>=SUPPLEMENTAL_VOLUME_MAX_COLUMNS)break;
    }
    state.frame=frame;state.utc=utc;state.visible=true;
    collection.show=visible;
    setVolumeDisplayOpacity(collection,settings.volumePercent);
    scene.requestRender();
    return glyphs;
  }
  function refresh(){
    const targets=[...siteStates.entries()]
      .filter(([,s])=>s.visible && s.frame)
      .map(([site,s])=>[site,s.frame,s.utc]);
    for(const [site,frame,utc] of targets)render(site,frame,utc);
  }
  function setOpacity(percent){
    for(const state of siteStates.values())
      for(const collection of state.collections.values())
        setVolumeDisplayOpacity(collection,percent);
    scene.requestRender();
  }
  return {
    render,hide,hideAll,refresh,setOpacity,
    get visibleSites(){return [...siteStates].filter(([,s])=>s.visible).map(([id])=>id);},
    get glyphs(){return [...siteStates.values()].reduce((n,s)=>
      n+(s.visible?[...s.collections.values()].reduce(
        (sum,c)=>sum+(c.show?(c.length??0):0),0):0),0);}
  };
}
