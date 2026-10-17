// Camera-safe focus for original BoM cyclone source geometry.
// StormTracker has a stateful camera guardian. NEVER call viewer.camera.flyTo
// or camera.setView directly from the cyclone tools: their external motion
// would be reverted by the 250ms guardian correction timer. Pass the entire
// viewport target to StormTracker's mapCamera.setView instead.
const EARTH_M=6371008.8;
const RAD=Math.PI/180;
const safePoint=p=>Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  p[0]>=-180&&p[0]<=180&&p[1]>=-90&&p[1]<=90;

/**
 * Calculate an overhead camera state for a source-supplied geographical
 * envelope. No change to original cyclone vertices or weather frames.
 * Throws for dateline-straddling geometry we cannot fit without a longitude
 * wrapping policy; this must not accidentally navigate to the wrong ocean.
 */
export function cycloneCameraFitState(coordinates,{
  marginDegrees=1.25,viewportWidth=1024,viewportHeight=768,
  fovyRadians=Math.PI/3,minRange=800,maxRange=5_000_000
}={}){
 if(!Array.isArray(coordinates)||!coordinates.length||
    coordinates.some(p=>!safePoint(p))||coordinates.length>150_000)
   throw new Error("Missing/invalid original cyclone positions");
 let west=180,east=-180,south=90,north=-90;
 for(const [lon,lat] of coordinates){
   if(lon<west)west=lon;if(lon>east)east=lon;
   if(lat<south)south=lat;if(lat>north)north=lat;
 }
 if(east-west>180)throw new Error("Cyclone spans longitude seam; no safe automatic focus");
 const centreLon=(west+east)/2,centreLat=(south+north)/2;
 const pad=Number.isFinite(marginDegrees)?Math.max(0,Math.min(6,marginDegrees)):1.25;
 const latSpan=Math.min(178,north-south+pad*2);
 const lonSpan=Math.min(359,east-west+pad*2);
 // Only the VIEW is fitted using spherical angular spans. The source lines
 // and polygon vertices remain strictly untouched, including GDA94 order.
 const kmPerLonRad=Math.max(.08,Math.cos(centreLat*RAD));
 const widthM=EARTH_M*lonSpan*RAD*kmPerLonRad;
 const heightM=EARTH_M*latSpan*RAD;
 const aspect=Math.max(.23,Math.min(6,
    (Number(viewportWidth)||1024)/Math.max(1,Number(viewportHeight)||768)));
 const fovy=Number.isFinite(fovyRadians)&&fovyRadians>0.15&&fovyRadians<2.6
   ?fovyRadians:Math.PI/3;
 const tanHalf=Math.tan(fovy/2);
 const distance=Math.max(widthM/(2*tanHalf*aspect),
   heightM/(2*tanHalf),50000)*1.24;
 const range=Math.max(minRange,Math.min(maxRange,distance));
 return Object.freeze({
  longitude:centreLon,latitude:centreLat,targetHeight:0,range,
  heading:0,pitch:-Math.PI/2+0.12
 });
}
/** The ONLY path used by Jasper, Alfred and historical GML Focus buttons. */
export function focusCycloneThroughController({coordinates,controller,viewer,marginDegrees}){
 if(!controller||typeof controller.setView!=="function")
   throw new Error("StormTracker camera controller unavailable");
 const view=cycloneCameraFitState(coordinates,{
   marginDegrees,
   viewportWidth:viewer?.scene?.canvas?.clientWidth??1024,
   viewportHeight:viewer?.scene?.canvas?.clientHeight??768,
   fovyRadians:viewer?.camera?.frustum?.fovy
 });
 controller.setView(view); // updates controller state + stable snapshot atomically
 viewer?.scene?.requestRender?.();
 return view;
}
