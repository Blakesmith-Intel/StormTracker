// QFD's public ESCAD feature VIEW publishes GroupedType but currently has
// no drawingInfo renderer in the public layer metadata. Where it becomes
// publicly available, use the publisher's own picture-marker images.
// Until then, provisional custom symbols must NEVER be called "QFD icons".
import {QFD_PUBLIC_GROUPS,QFD_PUBLIC_GROUP_NAMES,QFD_ESCAD_ENDPOINT}
  from "./qfd-technical-rescues-v1.js?v=9.15.1";

const SOURCE_LAYER = QFD_ESCAD_ENDPOINT.replace(/\/query$/, "");
const OFFICIAL_HOSTS = new Set(["services1.arcgis.com","static.arcgis.com","www.arcgis.com","publicsafetyqld.maps.arcgis.com"]);

export function safeQfdSymbolImage(symbol,layerUrl=SOURCE_LAYER) {
  if(!symbol || symbol.type!=="esriPMS")return "";
  if(typeof symbol.imageData==="string" && /^[A-Za-z0-9+/\r\n=]+$/.test(symbol.imageData) &&
    symbol.imageData.length<240000)
    return "data:image/png;base64,"+symbol.imageData.replace(/\s/g,"");
  try{
    const url=new URL(String(symbol.url??""),layerUrl+"/");
    if(url.protocol!=="https:" || !OFFICIAL_HOSTS.has(url.hostname.toLowerCase()) ||
      url.username || url.password)return "";
    return url.href;
  }catch{return "";}
}
export function qfdOfficialSymbolCatalog(layerMetadata,layerUrl=SOURCE_LAYER) {
  const renderer=layerMetadata?.drawingInfo?.renderer;
  if(!renderer || renderer.type!=="uniqueValue" ||
      String(renderer.field1??"").toLowerCase()!=="groupedtype")return {};
  const matched={};
  for(const item of renderer.uniqueValueInfos??[]) {
    const key=String(item.value??"").trim().toUpperCase();
    if(!Object.hasOwn(QFD_PUBLIC_GROUPS,key))continue;
    const source=safeQfdSymbolImage(item.symbol,layerUrl);
    if(source)matched[key]=source;
  }
  return matched;
}
const glyphs=Object.freeze({
  "RESCUE TECHNICAL":"✚",
  "RESCUE ROAD CRASH":"↔",
  "ASSIST PUBLIC":"●"
});
function encodeSvg(svg) {
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
// A visibly distinct, temporary map marker — NOT official QFD symbology.
// The entire fallback is replaceable by the verified public renderer.
export function provisionalQfdSymbol(groupedType) {
  const group=QFD_PUBLIC_GROUPS[groupedType];
  if(!group) return "";
  const glyph=glyphs[groupedType];
  return encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="19" r="16" fill="${group.color}" stroke="#101a20" stroke-width="3"/><text x="20" y="26" font-size="23" font-weight="bold" text-anchor="middle" fill="#131923" font-family="Arial,sans-serif">${glyph}</text><path d="M16 34h8l-4 5z" fill="${group.color}" stroke="#101a20" stroke-width="1.5"/></svg>`
  );
}
export function qfdSymbolFor(groupedType,officialCatalog={}) {
  return officialCatalog[groupedType] || provisionalQfdSymbol(groupedType);
}
export async function fetchQfdPublicSymbolCatalog({fetchImpl=globalThis.fetch,timeoutMs=7000}={}) {
  if(typeof fetchImpl!=="function")return {};
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetchImpl(SOURCE_LAYER+"?f=json",{
      cache:"force-cache",signal:controller?.signal
    });
    if(!response.ok)return {};
    const json=await response.json();
    return qfdOfficialSymbolCatalog(json);
  }catch{return {};}
  finally{if(timer!==null)clearTimeout(timer);}
}
export const QFD_GROUP_ICON_COUNT = QFD_PUBLIC_GROUP_NAMES.length;
