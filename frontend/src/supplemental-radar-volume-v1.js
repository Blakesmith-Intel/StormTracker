import {createIncrementalVolumeRenderer} from "./incremental-volume-renderer-v1.js?v=delta-reuse-20261016-v2";
import {selectSupplementalVolumeSampleIndices} from "./supplemental-volume-sampling-v1.js?v=secondary-coverage-fix-1";

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
  colourForDbzh,addVolumeGlyph,updateVolumeGlyph,setVolumeDisplayOpacity,
  incremental=false
}) {
  const siteStates=new Map();
  let visible=true;

  function hide(site){
    const state=siteStates.get(site);
    if(!state)return;
    state.visible=false;
    state.delta?.finishAnimation();
    for(const collection of state.collections.values())collection.show=false;
    state.frame=null;state.utc=null;
    scene.requestRender();
  }
  function hideAll(){for(const site of siteStates.keys())hide(site);}
  function pruneSites(selectedIds=[]){
    // Deselecting radar sites previously hid their volumes but left all GPU
    // billboards and maps reachable indefinitely across selection changes.
    const keep=new Set(selectedIds);
    for(const [site,state] of siteStates){
      if(keep.has(site))continue;
      if(state.delta)state.delta.reset();
      else for(const collection of state.collections.values())
        scene.primitives.remove(collection);
      state.collections.clear();
      state.frame=null;
      siteStates.delete(site);
    }
    scene.requestRender();
  }
  function render(site,frame,utc){
    if(!frame?.categories || frame.observedUtc!==utc)return 0;
    const model=getModel();
    if(!model){hide(site);return 0;}
    const settings=getSettings();
    let state=siteStates.get(site);
    if(!state){
      state={collections:new Map(),visible:false,frame:null,utc:null,
        delta:incremental?createIncrementalVolumeRenderer({scene}):null,
        sampleEvery:null};
      siteStates.set(site,state);
    }
    const mode=settings.blob?"blob":"point";
    // Classic path remains unchanged. Preview keeps stable per-site sample
    // identities in one live Cesium collection rather than removeAll per scan.
    let collection=null;
    if(!incremental){
      for(const [type,prior] of state.collections){
        if(type!==mode)prior.show=false;
      }
      collection=state.collections.get(mode);
      if(!collection){
        collection=scene.primitives.add(settings.blob
          ?new Cesium.BillboardCollection()
          :new Cesium.PointPrimitiveCollection());
        state.collections.set(mode,collection);
      }
      collection.show=false;
      collection.removeAll();
    }

    // The classic V9.19.0 branch still uses the eligible-pixel stride.
    // The production incremental renderer samples exactly up to 250 actual
    // high-dBZ BoM pixels with a source-indexed stable hash, so a sparse echo
    // cannot land entirely between fixed modulo-lattice points.
    const threshold=Math.max(40,Number(settings.minimumDbzh)||40);
    const categories=frame.categories;
    const sampled=incremental
      ?selectSupplementalVolumeSampleIndices(categories,
        representativeDbzForCategory,threshold,SUPPLEMENTAL_VOLUME_MAX_COLUMNS)
      :null;
    let eligible=sampled?.eligible??0;
    if(!incremental){
      for(let i=0;i<categories.length;i++){
        const dbz=representativeDbzForCategory(categories[i]);
        if(dbz!==null && dbz!==undefined && dbz>=threshold)eligible++;
      }
    }
    const sampleEvery=Math.max(1,Math.ceil(eligible/SUPPLEMENTAL_VOLUME_MAX_COLUMNS));
    if(incremental){
      const geo=frame.georef||{};
      const identity=[site,frame.width,frame.height,geo.projection,
        geo.minX,geo.maxX,geo.minY,geo.maxY,mode,
        settings.occupancyThreshold,settings.minimumDbzh,
        settings.pointSize,settings.verticalScale].join(":");
      collection=state.delta.begin(identity,
        ()=>settings.blob?new Cesium.BillboardCollection():
          new Cesium.PointPrimitiveCollection(),
        false); // Never alpha-fade an entire secondary cloud between scans.
      state.collections.clear();
      state.collections.set(mode,collection);
    }
    let seen=0,columns=0,glyphs=0;
    const width=frame.width;
    const count=incremental?sampled.indices.length:categories.length;
    outer:for(let offset=0;offset<count;offset++){
      const i=incremental?sampled.indices[offset]:offset;
      const inputDbzh=representativeDbzForCategory(categories[i]);
      if(inputDbzh==null || inputDbzh<threshold)continue;
      if(!incremental && seen++%sampleEvery!==0)continue;
      const levelPoints=inferColumn(model,inputDbzh,{
        occupancyThreshold:settings.occupancyThreshold,
        minimumOutputDbz:30
      }).filter(p=>Number(p.dbzh)>=threshold);
      if(!levelPoints.length)continue;
      const sameGlyphs=incremental&&state.delta.unchanged(i,categories[i]);
      const nextSpecs=[];
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
        if(!incremental||!sameGlyphs){
          const options={
            position:Cesium.Cartesian3.fromDegrees(
              geo.longitude,geo.latitude,
              displayedVolumeAltitude(
                inferred.altitude_m_amsl,inputDbzh,settings.verticalScale
              )
            ),
            color:colourForDbzh(inferred.dbzh),
            pixelSize:style.pixelSize,
            disableDepthTestDistance:0
          };
          const support=Math.min(1.3,style.pixelSize/3);
          if(incremental)nextSpecs.push({
            options,alpha:style.alpha,dbz:inferred.dbzh,support
          });
          else addVolumeGlyph(collection,options,style.alpha,settings.volumePercent,
            inferred.dbzh,support);
        }
        glyphs++;
      }
      if(incremental){
        if(sameGlyphs)state.delta.touch(i,categories[i]);
        else state.delta.upsert(i,categories[i],nextSpecs,
          spec=>addVolumeGlyph(collection,spec.options,spec.alpha,
            settings.volumePercent,spec.dbz,spec.support),
          (glyph,spec)=>updateVolumeGlyph(glyph,spec.options,spec.alpha,
            settings.volumePercent,spec.dbz,spec.support));
      }
      columns++;
      if(columns>=SUPPLEMENTAL_VOLUME_MAX_COLUMNS)break;
    }
    if(incremental)state.delta.end();
    state.frame=frame;state.utc=utc;state.visible=true;
    collection.show=visible;
    // All new/reused glyphs already have the requested opacity; rewriting
    // EVERY unchanged Cesium colour each frame causes needless GPU uploads.
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
    for(const state of siteStates.values()){
      state.delta?.finishAnimation();
      for(const collection of state.collections.values())
        setVolumeDisplayOpacity(collection,percent);
    }
    scene.requestRender();
  }
  return {
    render,hide,hideAll,pruneSites,refresh,setOpacity,
    get siteGlyphs(){return Object.fromEntries([...siteStates].map(([site,s])=>[
      site,s.visible?[...s.collections.values()].reduce(
        (total,c)=>total+(c.show?(c.length??0):0),0):0
    ]));},
    get visibleSites(){return [...siteStates].filter(([,s])=>s.visible).map(([id])=>id);},
    get glyphs(){return [...siteStates.values()].reduce((n,s)=>
      n+(s.visible?[...s.collections.values()].reduce(
        (sum,c)=>sum+(c.show?(c.length??0):0),0):0),0);}
  };
}
