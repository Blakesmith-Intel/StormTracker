// Direct BoM native rain-rate tile display. Browser-only, no extrapolation
// from reflectivity dBZ and no change to tracking or inferred science.
import { buildBomReflectivityTileUrl } from "./bom-wmts-loop-v2.js";
import { fetchReadableImage } from "./radar-source.js";
import { loadCompleteRadarTiles } from "./radar-tile-retry-v1.js";
import { reprojectWebMercatorRgbaToGeographic } from "./webmercator-raster-reproject-v1.js";
import { webMercatorToDegrees } from "./inferred-volume-v1.js";
import { NATIVE_RAIN_RATE_LAYER } from "./volumetric-visual-v2.js";

const UPSTREAM_BOM_WMTS="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
let unavailableUntil=0;
const cache=new WeakMap();

export function nativeRainRateUrl(col,row,observedUtc){
  const url=new URL(buildBomReflectivityTileUrl(col,row,observedUtc));
  const source=new URL(UPSTREAM_BOM_WMTS);
  url.protocol=source.protocol;
  url.host=source.host;
  url.pathname=source.pathname;
  url.searchParams.set("LAYER",NATIVE_RAIN_RATE_LAYER);
  return url.toString();
}

export function isActualSourceRadarFrame(frame){
  const method=frame?.sourceMetadata?.temporalInference?.method;
  return !method || method==="none";
}

function canvas2d(w,h){
  const canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Native BoM rain-rate tile canvas unavailable");
  return {canvas,ctx};
}

export async function prepareNativeRainRateProvider(frame,Cesium,timeoutMs=6500){
  if(!isActualSourceRadarFrame(frame))throw new Error("Reflectivity-interpolated display frame");
  if(Date.now()<unavailableUntil)throw new Error("Native rain-rate temporarily unavailable");
  const existing=cache.get(frame);
  if(existing)return existing;
  const job=(async()=>{
    const win=frame.sourceMetadata?.tileWindow;
    if(!win || !Number.isInteger(win.colStart)||!Number.isInteger(win.rowStart))
      throw new Error("Radar tile-window metadata is unavailable");
    const expectedW=(win.colEnd-win.colStart+1)*256;
    const expectedH=(win.rowEnd-win.rowStart+1)*256;
    if(expectedW!==frame.width||expectedH!==frame.height)
      throw new Error("Native rain-rate geometry differs from reflectivity");
    const {canvas,ctx}=canvas2d(frame.width,frame.height);
    const tasks=[];
    for(let row=win.rowStart;row<=win.rowEnd;row++)
      for(let col=win.colStart;col<=win.colEnd;col++){
        tasks.push({
          url:nativeRainRateUrl(col,row,frame.observedUtc),
          x:(col-win.colStart)*256,y:(row-win.rowStart)*256
        });
      }
    // Reject missing native frames. Do not invent rain-rate pixels or
    // silently relabel the original reflectivity product as mm/h.
    const tiles=await loadCompleteRadarTiles(tasks,fetchReadableImage,{retries:0});
    for(const tile of tiles)ctx.putImageData(tile.image,tile.x,tile.y);
    const rgba=ctx.getImageData(0,0,frame.width,frame.height).data;
    const projected=reprojectWebMercatorRgbaToGeographic(frame,rgba);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(projected),frame.width,frame.height),0,0);
    const sw=webMercatorToDegrees(frame.georef.minX,frame.georef.minY);
    const ne=webMercatorToDegrees(frame.georef.maxX,frame.georef.maxY);
    const rectangle=Cesium.Rectangle.fromDegrees(sw.longitude,sw.latitude,ne.longitude,ne.latitude);
    return Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL("image/png"),{rectangle});
  })();
  const guarded=Promise.race([
    job,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Native rain-rate timeout")),timeoutMs))
  ]).catch(e=>{
    cache.delete(frame);
    unavailableUntil=Date.now()+60000;
    throw e;
  });
  cache.set(frame,guarded);
  return guarded;
}
