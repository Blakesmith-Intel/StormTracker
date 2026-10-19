// FTP-first reflectivity adapter for StormTracker V10.
// Source filenames and Gnomonic map control points come from BoM anonymous FTP
// via a timestamped public GitHub archive containing the ORIGINAL FTP PNG bytes.
// It does not depend on BoM HTTPS (which intermittently returns HTTP 403).
// No guessed UTC or colour interpolation.
import {BOM_REFLECTIVITY_RGB, REFLECTIVITY_CLASSES} from "./palette.js";
import {fetchReadableImage} from "./radar-source.js";

const MANIFEST="https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/manifest.json";
const FRAME_BASE="https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/frames/";
const LIVE_MANIFEST="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/ftp-live-manifest";
const LIVE_FRAME_BASE="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/ftp-live-frame?file=";
const COLOURS=new Map(BOM_REFLECTIVITY_RGB.map(x=>[x.rgb.join(","),x.value]));
const EARTH=6371008.8, MERC=6378137, RAD=Math.PI/180;
let cached=null,cachedAt=0;
const siteIds=region=>region==="SEQ"?["08","50","66"]:[String(region)];
const validTime=(s,now=Date.now())=>{const t=Date.parse(s);return Number.isFinite(t)&&t<=now+5*60000&&t>=now-45*60000};
export async function publishedFtpManifest({now=Date.now(),fetcher=fetch}={}){
 if(cached&&now-cachedAt<45000)return cached;
 // GitHub's original, byte-identical FTP archive is the verified fast path.
 // The direct Cloudflare TCP FTP transport opens but fails to receive BoM's
 // 220 banner, so it MUST NOT block loading every radar frame for 22 seconds.
 let staticError=null;
 try{
  // GitHub raw CDN may serve an outdated branch HEAD even with cache:no-store.
  // The five-minute bucket changes the actual CDN cache key without changing
  // the immutable source-frame URLs or inventing an observation timestamp.
  const url=MANIFEST+"?refresh="+Math.floor(now/300000);
  const response=await fetcher(url,{cache:"no-store",
   signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw Error("FTP archive HTTP "+response.status);
  const m=await response.json();
  if(m.schema!=="StormTrackerBoMFtpReflectivityManifestV1"||
   m.sourceKind!=="ftp-original-png-byte-identical-static-archive"||
   !m.siteFrameHistory||!m.siteGeoreference)
    throw Error("Unrecognised BoM FTP static archive");
  if(!Number.isFinite(Date.parse(m.generatedUtc))||
    now-Date.parse(m.generatedUtc)>60*60000)
    throw Error("BoM FTP discovery manifest stale");
  cached=m;cachedAt=now;return m;
 }catch(error){staticError=error;}
 // Last-resort optional direct FTP. Bounded tightly because BoM's FTP
 // control greeting currently stalls over Cloudflare's outbound TCP path.
 let liveError=null;
 try{
  const response=await fetcher(LIVE_MANIFEST,{cache:"no-store",
   signal:AbortSignal.timeout(4500)});
  if(!response.ok)throw Error("BoM direct FTP source HTTP "+response.status);
  const m=await response.json();
  if(m.schema!=="StormTrackerBoMFtpReflectivityManifestV1"||
    m.sourceKind!=="ftp-live-direct-relay"||
    !m.siteFrameHistory||!m.siteGeoreference||
    !Number.isFinite(Date.parse(m.generatedUtc))||
    now-Date.parse(m.generatedUtc)>10*60000)
    throw Error("Unverified live FTP radar source");
  cached=m;cachedAt=now;return m;
 }catch(error){liveError=error;}
 throw Error("Verified static FTP unavailable ("+
   String(staticError?.message??staticError)+
   "); direct FTP unavailable ("+String(liveError?.message??liveError)+")");
}
export function matchingFtpTimes(manifest,region="SEQ",now=Date.now()){
 const ids=siteIds(region);
 if(ids.some(id=>!manifest.siteGeoreference?.[id]?.controlPoints ||
                       !Array.isArray(manifest.siteFrameHistory?.[id])))
   throw Error("No authoritative BoM FTP source georeference/history for selected sites");
 const sets=ids.map(id=>new Set(manifest.siteFrameHistory[id]
   .filter(f=>validTime(f.observedUtc,now)&&
     new RegExp("^IDR"+id+"3\\.T\\.[0-9]{12}\\.png$").test(f.filename))
   .map(f=>f.observedUtc)));
 const matches=[...sets[0]].filter(t=>sets.every(set=>set.has(t))).sort();
 if(!matches.length)throw Error("No common fresh source-confirmed FTP radar frame");
 return matches;
}
export async function discoverFtpReflectivityHistory(now=Date.now(),region="SEQ",horizonMinutes=180){
 const m=await publishedFtpManifest({now});
 const t=matchingFtpTimes(m,region,now),latest=Date.parse(t.at(-1));
 return t.filter(s=>Date.parse(s)>=latest-Math.min(180,horizonMinutes)*60000);
}
function forward(lon,lat,lon0,lat0){
 const [l,p,l0,p0]=[lon,lat,lon0,lat0].map(n=>n*RAD),dl=l-l0;
 const cosc=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(dl);
 return {x:EARTH*Math.cos(p)*Math.sin(dl)/cosc,
         y:EARTH*(Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(dl))/cosc};
}
function inverse(x,y,lon,lat){
 const p0=lat*RAD,l0=lon*RAD,rho=Math.hypot(x,y);
 if(!rho)return {lon,lat};
 const c=Math.atan(rho/EARTH),si=Math.sin(c),co=Math.cos(c);
 return {lon:(l0+Math.atan2(x*si,rho*Math.cos(p0)*co-y*Math.sin(p0)*si))/RAD,
         lat:Math.asin(co*Math.sin(p0)+y*si*Math.cos(p0)/rho)/RAD};
}
function sourceGeometry(control){
 const coords=control.controlPoints,projected=[0,1,2,3].map(i=>
   forward(coords["lon"+i],coords["lat"+i],coords.center_longitude,coords.center_latitude));
 const bounds={w:(projected[0].x+projected[1].x)/2,e:(projected[2].x+projected[3].x)/2,
               s:(projected[0].y+projected[3].y)/2,n:(projected[1].y+projected[2].y)/2};
 if(!Object.values(bounds).every(Number.isFinite)||bounds.e<=bounds.w||bounds.n<=bounds.s)
   throw Error("Bad BoM FTP map coordinates");
 const corners=[inverse(bounds.w,bounds.s,coords.center_longitude,coords.center_latitude),
   inverse(bounds.e,bounds.n,coords.center_longitude,coords.center_latitude)];
 return {coords,bounds,west:Math.min(...corners.map(p=>p.lon)),east:Math.max(...corners.map(p=>p.lon)),
         south:Math.min(...corners.map(p=>p.lat)),north:Math.max(...corners.map(p=>p.lat))};
}
const xm=lon=>MERC*lon*RAD,ym=lat=>MERC*Math.log(Math.tan(Math.PI/4+lat*RAD/2));
function ll(x,y){return {lon:x/MERC/RAD,lat:(2*Math.atan(Math.exp(y/MERC))-Math.PI/2)/RAD}}
function rgbaCategories(image){
 if(image.width!==512||image.height!==512)throw Error("Incorrect FTP native 512px image");
 const cat=new Uint8Array(512*512),data=image.data;
 let opaque=0,valid=0;
 for(let y=0;y<438;y++)for(let x=0;x<512;x++){
   const i=(y*512+x)*4;if(!data[i+3])continue;opaque++;
   const category=COLOURS.get(data[i]+","+data[i+1]+","+data[i+2]);
   if(category){cat[y*512+x]=category;valid++}
 }
 // These are SHA-verified original BoM FTP pixels, not an HTML/HTTP image.
 // Low matching fractions are valid for near-dry panels, because labels,
 // range rings and coast/land graphics can dominate opaque image pixels.
 // Classify only exact BoM reflectivity swatches; background and annotation
 // colours must remain non-radar.
 if(!Number.isFinite(valid)||valid>opaque)throw Error("Invalid BoM palette decoder");
 return cat;
}
export async function loadFtpReflectivityMosaicAtTime(observedUtc,region="SEQ"){
 const manifest=await publishedFtpManifest();
 if(!matchingFtpTimes(manifest,region).includes(observedUtc))
   throw Error("FTP observation is not current and published for all selected sites");
 const ids=siteIds(region);
 const inputs=await Promise.all(ids.map(async id=>{
   const record=manifest.siteFrameHistory[id].find(f=>f.observedUtc===observedUtc);
   if(!record||!new RegExp("^IDR"+id+"3\\.T\\.[0-9]{12}\\.png$").test(record.filename))
     throw Error("Unverified FTP source filename");
   const geo=sourceGeometry(manifest.siteGeoreference[id]);
   if(manifest.sourceKind==="ftp-live-direct-relay"){
     if(record.imageUrl!==LIVE_FRAME_BASE+encodeURIComponent(record.filename))
       throw Error("Unexpected direct FTP frame URL");
   }else if(record.imageUrl!==FRAME_BASE+record.filename||
     !/^([a-f0-9]{64})$/.test(record.sha256||""))
     throw Error("Unverified source FTP image delivery path/hash");
   const image=await fetchReadableImage(record.imageUrl);
   return {id,record,geo,categories:rgbaCategories(image)};
 }));
 const minX=Math.min(...inputs.map(i=>xm(i.geo.west))),maxX=Math.max(...inputs.map(i=>xm(i.geo.east)));
 const minY=Math.min(...inputs.map(i=>ym(i.geo.south))),maxY=Math.max(...inputs.map(i=>ym(i.geo.north)));
 const width=region==="SEQ"?1024:512,height=region==="SEQ"?1024:512;
 const categories=new Uint8Array(width*height);
 for(let y=0;y<height;y++){
   const my=maxY-(y+0.5)/height*(maxY-minY);
   for(let x=0;x<width;x++){
     const mx=minX+(x+0.5)/width*(maxX-minX),pt=ll(mx,my);
     let highest=0;
     for(const input of inputs){
       if(pt.lon<input.geo.west||pt.lon>input.geo.east||pt.lat<input.geo.south||pt.lat>input.geo.north)continue;
       const c=input.geo.coords,b=input.geo.bounds;
       const p=forward(pt.lon,pt.lat,c.center_longitude,c.center_latitude);
       const sx=Math.floor((p.x-b.w)/(b.e-b.w)*512),sy=Math.floor((b.n-p.y)/(b.n-b.s)*512);
       if(sx<0||sx>=512||sy<0||sy>=438)continue;
       highest=Math.max(highest,input.categories[sy*512+sx]);
     }
     categories[y*width+x]=highest;
   }
 }
 const histogram=Array(16).fill(0);for(const value of categories)histogram[value]++;
 const maxCategory=histogram.findLastIndex((count,i)=>i>0&&count>0);
 return {radarId:"BOM-FTP-MOSAIC",sourceId:"BOM-FTP-MOSAIC",observedUtc,width,height,categories,
   georef:{projection:"EPSG:3857",minX,maxX,minY,maxY},
   sourceMetadata:{provider:"Australian Bureau of Meteorology",
     transport:manifest.sourceKind==="ftp-live-direct-relay"?
       "Live original BoM anonymous FTP PNG via Cloudflare TCP":
       "Original BoM FTP PNG archived unchanged to HTTPS feed",
     product:"Observed site-specific 128 km Gnomonic PNG",siteIds:ids,
     nativeSourcePixels:512,sourceUrls:inputs.map(i=>i.record.imageUrl),
     colouredPixelCount:categories.length-histogram[0],strongPixelCount:histogram.slice(7).reduce((a,b)=>a+b,0),
     categoryHistogram:histogram,maxCategory,maxDbzLowerBound:REFLECTIVITY_CLASSES[maxCategory]?.[0]??null,
     maxDbzUpperBound:REFLECTIVITY_CLASSES[maxCategory]?.[1]??null,
     combineMethod:"highest-source-dBZ-category-at-each-displayed-geographic-pixel",
     volumeStatus:"inferred-from-native-observed-reflectivity"}};
}
