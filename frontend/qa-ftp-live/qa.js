import {createSupplementalRadarVolumes} from "../src/supplemental-radar-volume-v1.js";
import {createIncrementalVolumeRenderer} from "../src/incremental-volume-renderer-v1.js";
import {inferColumn,representativeDbzForCategory,webMercatorToDegrees} from "../src/inferred-volume-v1.js";
import {selectSupplementalVolumeSampleIndices} from "../src/supplemental-volume-sampling-v1.js";
import {inverseGnomonic} from "../src/geo.js";
const Cesium=window.Cesium, status=document.getElementById("status");
const output={phases:[],errors:[],done:false};window.__ftpBrowserQA=output;
try{
 if(!Cesium)throw Error("Real Cesium browser runtime failed to load");
 const data=await (await fetch("./fixtures.json",{cache:"no-store"})).json();
 const model=await (await fetch("../3d-models/inferred_vertical_profile_model_v2.json")).json();
 const times=[...new Set(data.map(x=>x.observedUtc))].sort();
 const sites=["66","50","08","28"];if(times.length!==3)throw Error("Expected 3 genuine scans");
 const groups=new Map();
 for(const site of sites){const recs=data.filter(x=>x.site===site).sort((a,b)=>a.observedUtc.localeCompare(b.observedUtc));if(recs.length!==3)throw Error("Missing site frames "+site);
  groups.set(site,recs.map(x=>({...x,width:512,height:512,categories:Uint8Array.from(atob(x.categories),c=>c.charCodeAt(0))})));
 }
 const sceneViewer=new Cesium.Viewer("map",{animation:false,timeline:false,baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,fullscreenButton:false,navigationHelpButton:false,infoBox:false,selectionIndicator:false,baseLayer:false,terrainProvider:new Cesium.EllipsoidTerrainProvider()});
 const scene=sceneViewer.scene;scene.globe.baseColor=Cesium.Color.fromCssColorString("#1a3542");
 sceneViewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(152.65,-27.8,400000)});
 const R=6371008.8,rad=Math.PI/180,bounds=new WeakMap();
 function forward(lon,lat,lon0,lat0){const [l,p,l0,p0]=[lon,lat,lon0,lat0].map(x=>x*rad),d=l-l0;const c=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(d);return {x:R*Math.cos(p)*Math.sin(d)/c,y:R*(Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(d))/c}}
 function getBounds(frame){let b=bounds.get(frame);if(b)return b;const c=frame.controlPoints,pts=[0,1,2,3].map(i=>forward(c["lon"+i],c["lat"+i],c.center_longitude,c.center_latitude));
 b={w:(pts[0].x+pts[1].x)/2,e:(pts[2].x+pts[3].x)/2,s:(pts[0].y+pts[3].y)/2,n:(pts[1].y+pts[2].y)/2};bounds.set(frame,b);return b}
 function geo(frame,col,row){const b=getBounds(frame),c=frame.controlPoints;return inverseGnomonic(b.w+(col+0.5)/512*(b.e-b.w),b.n-(row+0.5)/512*(b.n-b.s),c.center_longitude,c.center_latitude)}
 function pixelCentreMercator(frame,col,row){const g=geo(frame,col,row);return {x:6378137*g.longitude*rad,y:6378137*Math.log(Math.tan(Math.PI/4+g.latitude*rad/2))}}
 const settings={minimumDbzh:40,occupancyThreshold:0.35,pointSize:4,verticalScale:1,volumePercent:85,blob:false};
 const colourForDbzh=d=>Cesium.Color.fromCssColorString(d>=60?"#aa25ee":d>=55?"#ec442b":d>=50?"#ffd112":d>=40?"#0acc95":"#2089ed");
 const supplemental=createSupplementalRadarVolumes({Cesium,scene,getModel:()=>model,getSettings:()=>settings,inferColumn,representativeDbzForCategory,pixelCentreMercator,webMercatorToDegrees,styleForInferredPoint:()=>({pixelSize:4,alpha:0.9}),displayedVolumeAltitude:m=>m,colourForDbzh,addVolumeGlyph:(collection,opts,alpha)=>collection.add({...opts,color:opts.color.withAlpha(alpha)}),updateVolumeGlyph:(glyph,opts,alpha)=>Object.assign(glyph,opts,{color:opts.color.withAlpha(alpha)}),setVolumeDisplayOpacity:()=>{},incremental:true});
 const primary=createIncrementalVolumeRenderer({scene});
 let imageLayers=[];
 async function draw2D(site,frame){const b=getBounds(frame),c=frame.controlPoints;
 const sw=inverseGnomonic(b.w,b.s,c.center_longitude,c.center_latitude),ne=inverseGnomonic(b.e,b.n,c.center_longitude,c.center_latitude);
 const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;const ctx=canvas.getContext("2d"),image=ctx.createImageData(512,512);
 const bands=[[245,245,255],[180,180,255],[120,120,255],[20,20,255],[0,216,195],[0,150,144],[0,102,102],[255,255,0],[255,200,0],[255,150,0],[255,100,0],[255,0,0],[200,0,0],[120,0,0],[40,0,0]];
 // Resample geographic display from authentic Gnomonic source coordinates using nearest source category.
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const lat=ne.latitude-(y+0.5)/512*(ne.latitude-sw.latitude),lon=sw.longitude+(x+0.5)/512*(ne.longitude-sw.longitude);
  const p=forward(lon,lat,c.center_longitude,c.center_latitude);
  const sx=Math.floor((p.x-b.w)/(b.e-b.w)*512),sy=Math.floor((b.n-p.y)/(b.n-b.s)*512);
  if(sx<0||sx>=512||sy<0||sy>=512)continue;
  const band=frame.categories[sy*512+sx],rgb=bands[band-1];if(!rgb)continue;
  image.data.set([...rgb,185],(y*512+x)*4)
 }
 ctx.putImageData(image,0,0);
 const provider=await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL("image/png"),{rectangle:Cesium.Rectangle.fromDegrees(sw.longitude,sw.latitude,ne.longitude,ne.latitude)});
 const layer=sceneViewer.imageryLayers.addImageryProvider(provider);layer.alpha=site==="66"?0.75:0.42;return layer;
 }
 function drawPrimary(frame){const coll=primary.begin("ftp-primary-66",()=>new Cesium.PointPrimitiveCollection(),false);
 const picks=selectSupplementalVolumeSampleIndices(frame.categories,representativeDbzForCategory,40,350);
 let count=0;
 for(const i of picks.indices){const category=frame.categories[i],dbz=representativeDbzForCategory(category);if(dbz<40||dbz==null)continue;
 const points=inferColumn(model,dbz,{occupancyThreshold:settings.occupancyThreshold,minimumOutputDbz:40}).filter(p=>p.dbzh>=40);
 const g=geo(frame,i%512,Math.floor(i/512));
 const specs=points.slice(0,6).map(p=>({position:Cesium.Cartesian3.fromDegrees(g.longitude,g.latitude,p.altitude_m_amsl),pixelSize:4,color:colourForDbzh(p.dbzh),disableDepthTestDistance:0}));
 primary.upsert(i,category,specs,s=>coll.add(s),(point,s)=>Object.assign(point,s));count+=specs.length;
 }
 primary.end();return {glyphs:coll.length,calculatedGlyphs:count};
 }
 for(let index=0;index<3;index++){
  for(const layer of imageLayers)sceneViewer.imageryLayers.remove(layer,true);imageLayers=[];
  for(const site of sites)imageLayers.push(await draw2D(site,groups.get(site)[index]));
  const prim=drawPrimary(groups.get("66")[index]),secondary={};
  for(const site of sites.slice(1)){const f=groups.get(site)[index];secondary[site]=supplemental.render(site,f,f.observedUtc)}
  if(prim.glyphs<1||Object.values(secondary).some(x=>x<1))throw Error("Missing genuine source-driven 3D volume");
  if(supplemental.visibleSites.length!==3)throw Error("Expected three supplemental radar volumes");
  scene.requestRender();await new Promise(r=>setTimeout(r,1500));
  const shot={frame:index,utc:times[index],primaryGlyphs:prim.glyphs,secondary,imageryLayers:imageLayers.length,visibleSites:supplemental.visibleSites,actualCesiumCollections:scene.primitives.length};
  output.phases.push(shot);status.textContent=JSON.stringify(shot);console.log("FTP_BROWSER_FRAME",JSON.stringify(shot));
 }
 output.done=true;status.textContent="PASS: 3 FTP frames, 4 2-D overlays, primary and 3 supplemental 3D volumes";console.log("FTP_BROWSER_PASS",JSON.stringify(output));
}catch(error){output.errors.push(String(error?.stack||error));output.done=true;status.textContent="FAIL "+error.message;console.error("FTP_BROWSER_FAIL",error)}
