// Experimental FTP reflectivity verification only. NOT enabled in production.
// Product maps must be independently georeferenced before renderer integration.
import {BOM_REFLECTIVITY_RGB} from "./palette.js";
const COLORS=new Map(BOM_REFLECTIVITY_RGB.map(({rgb,value})=>[rgb.join(","),value]));
const FTP_PATTERN=/^IDR(\d{2,3})([1-4])\.T\.(\d{12})\.png$/;
export function inspectFtpReflectivityFrame({filename,imageData,now=Date.now(),maxAgeMs=45*60000}={}){
 const match=FTP_PATTERN.exec(String(filename??""));
 if(!match)throw Error("Unsupported genuine FTP reflectivity filename (not numeric 1-4)");
 const [,site,range,timestamp]=match;
 const y=+timestamp.slice(0,4),m=+timestamp.slice(4,6),d=+timestamp.slice(6,8),h=+timestamp.slice(8,10),min=+timestamp.slice(10,12);
 const time=Date.UTC(y,m-1,d,h,min),dt=new Date(time);
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d||dt.getUTCHours()!==h||dt.getUTCMinutes()!==min)
   throw Error("Invalid FTP observation UTC");
 if(time>now+5*60000||now-time>maxAgeMs)throw Error("FTP observation stale or future-dated");
 if(imageData?.width!==512||imageData?.height!==512||imageData?.data?.length!==512*512*4)
   throw Error("Unexpected FTP pixel geometry; georeference blocked");
 const categories=new Uint8Array(512*512);
 let opaque=0,matched=0,decorative=0;
 const pixels=imageData.data;
 for(let p=0,i=0;p<categories.length;p++,i+=4){
  if(pixels[i+3]===0)continue;
  opaque++;
  const rgb=pixels[i]+","+pixels[i+1]+","+pixels[i+2];
  const cat=COLORS.get(rgb);
  if(cat){categories[p]=cat;matched++;}
  else decorative++;
 }
 if(opaque>0 && matched/opaque<0.55)throw Error("FTP palette incompatible with source-authoritative BoM dBZ RGB");
 return {site,range,observedUtc:dt.toISOString(),categories,
  matchingPixels:matched,decorativePixels:decorative,opaquePixels:opaque,
  georefVerified:false,renderEligible:false,
  source:"Australian Bureau of Meteorology FTP numbered radar PNG"};
}
