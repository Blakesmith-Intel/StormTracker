import {codeFromOriginalBomCapMetadata} from "./bom-qld-warning-product-catalogue-v1.js";
// Exact CAP-AU warning polygons only: no district-shaped substitutes.
export const BOM_WARNING_TYPES=Object.freeze(["severe-thunderstorm","severe-weather"]);
function decodeEntities(x){
 return String(x).replace(/&(?:amp|lt|gt|quot|apos|#(?:\d+|x[0-9a-f]+));/gi,entity=>{
  const named={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
  const key=entity.slice(1,-1);
  if(named[key])return named[key];
  const cp=key.startsWith("#x")?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
  return Number.isInteger(cp)&&cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):"";
 });
}
const fields=(xml,key)=>[...String(xml).matchAll(
 new RegExp("<(?:[\\w-]+:)?"+key+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?"+key+">","gi")
)].map(m=>decodeEntities(m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,"$1").trim()));
const one=(xml,key)=>fields(xml,key)[0]??"";
const strictTime=x=>/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)
 &&Number.isFinite(Date.parse(x))?Date.parse(x):null;
export function capPolygonCoordinates(raw){
 const coords=String(raw??"").trim().split(/\s+/);
 if(coords.length<3||coords.length>16000)throw Error("Missing or excessive CAP polygon positions");
 const out=coords.map(token=>{
  const s=token.split(",");if(s.length!==2||!s.every(v=>/^-?\d+(?:\.\d+)?$/.test(v)))
   throw Error("Invalid CAP lat/lon");
  const [lat,lon]=s.map(Number);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)
   throw Error("CAP geographic coordinates invalid");
  return [lon,lat];
 });
 if(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1])out.push([...out[0]]);
 if(new Set(out.slice(0,-1).map(p=>p.join(","))).size<3)
  throw Error("Degenerate official polygon");
 return out;
}
export function bomCapRssLinks(xml,{nowMs=Date.now(),maximum=22}={}){
 if(!/<rss\b/i.test(xml)||!/<channel\b/i.test(xml))
  throw Error("WMO BoM RSS is not a valid alert feed");
 const items=fields(xml,"item"),urls=[];
 for(const item of items){
  const pub=Date.parse(one(item,"pubDate"));
  const headline=one(item,"title")+" "+one(item,"description");
  if(!/severe\s+(?:thunderstorm|weather)/i.test(headline))continue;
  if(Number.isFinite(pub)&&(pub>nowMs+15*60000||nowMs-pub>30*3600000))continue;
  const link=one(item,"link")||one(item,"guid");
  try{
   const url=new URL(link);
   if(url.protocol!=="https:"||
      !/(^|\.)severeweather\.wmo\.int$|(^|\.)bom\.gov\.au$/.test(url.hostname))continue;
   if(!urls.includes(url.href))urls.push(url.href);
  }catch{}
  if(urls.length>=maximum)break;
 }
 return urls;
}
function bomUrl(value){
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&/(^|\.)bom\.gov\.au$/.test(u.hostname)&&
   (u.pathname.includes("warnings")||/\/fwo\/ID[QN]/i.test(u.pathname))?u.href:"";
 }catch{return "";}
}
const warningKind=event=>/severe\s+thunderstorm\s+warning/i.test(event)?"severe-thunderstorm":
 /severe\s+weather\s+warning/i.test(event)?"severe-weather":null;
function verifiedEventKind(event,headline,product){
 const named=warningKind(event);
 if(named)return named;
 // WMO's *actual official BoM CAP* uses <event>Thunderstorm</event>.
 // Only a separately verified specific severe-warning PRODUCT ID plus
 // explicit severe warning headline permits this classification.
 if(product?.kind==="severe-thunderstorm"&&/^Thunderstorm$/i.test(event)&&
   /severe\s+thunderstorm\s+warning/i.test(headline))
   return "severe-thunderstorm";
 if(product?.kind==="severe-weather"&&/^Severe Weather$/i.test(event)&&
   /severe\s+weather\s+warning/i.test(headline))
   return "severe-weather";
 return null;
}
function sourceBoMWebIsAuthentic(value){
 // Genuine WMO-BoM CAP advertises HTTP http://www.bom.gov.au/australia/warnings;
 // re-link to the authoritative per-product HTTPS page, never to non-BoM URLs.
 if(!value)return true;
 try{
  const u=new URL(value);
  return ["http:","https:"].includes(u.protocol)&&/(^|\\.)bom\\.gov\\.au$/.test(u.hostname);
 }catch{return false;}
}
const productBulletinUrl=code=>{
 const kind=/^IDQ2103[35]$/.test(code)?"severe-thunderstorm-warning":"severe-weather-warning";
 return "https://www.bom.gov.au/warning/"+kind+"/"+code;
};
const qldCoordinates=ring=>ring.some(([lon,lat])=>lon>=137&&lon<=154.5&&lat>=-29.5&&lat<=-9);
const nswCoordinates=ring=>ring.some(([lon,lat])=>lon>=141&&lon<=154.5&&lat>=-38&&lat<=-28);
// CAP cancellation notices are authoritative even when no polygon is provided.
// Separating the notice from shape validation prevents a completed, cancelled
// warning from being misrepresented as an unavailable geometry lookup.
export function parseBomCapProductNotice(xml,{nowMs=Date.now()}={}){
 if(typeof xml!=="string"||xml.length>1500000||
    !/<(?:[\w-]+:)?alert[\s>]/i.test(xml))
  throw Error("Not an original CAP alert");
 const sender=one(xml,"sender"),senderName=one(xml,"senderName"),source=one(xml,"source");
 if(!(/bom\.gov\.au/i.test(sender)||/bureau of meteorology/i.test(senderName+" "+source)) ||
    !/^actual$/i.test(one(xml,"status")))return null;
 const identifier=one(xml,"identifier"),sent=one(xml,"sent");
 const sentMs=strictTime(sent);
 if(!identifier||sentMs===null||sentMs>nowMs+5*60000||
    nowMs-sentMs>36*3600000)return null;
 const infos=fields(xml,"info");
 const matching=infos.find(info=>/thunderstorm|severe weather/i.test(one(info,"event")+" "+one(info,"headline")))??"";
 const parameters=fields(matching,"parameter").map(p=>({
   name:one(p,"valueName"),value:one(p,"value")
 })).filter(p=>/^(?:product.?code|bom.?product.?id|warning.?product|product)$/i.test(p.name));
 const product=codeFromOriginalBomCapMetadata({
   identifier,web:one(matching,"web"),references:one(xml,"references"),parameters
 });
 if(!product||!matching||verifiedEventKind(one(matching,"event"),one(matching,"headline"),product)!==product.kind)return null;
 const cancelled=/^cancel$/i.test(one(xml,"msgType"))||
   /^cancellation of\b/i.test(one(matching,"headline"));
 const exp=strictTime(one(matching,"expires"));
 return {productCode:product.code,issuedUtc:new Date(sentMs).toISOString(),
  expiresUtc:exp===null?null:new Date(exp).toISOString(),
  headline:one(matching,"headline").slice(0,350),
  description:one(matching,"description").slice(0,4500),
  instruction:one(matching,"instruction").slice(0,2500),
  areaDescription:fields(matching,"area").map(area=>one(area,"areaDesc")).filter(Boolean).join(" · ").slice(0,900),
  bulletinUrl:productBulletinUrl(product.code),
  status:cancelled?"cancelled":exp!==null&&exp<=nowMs?"expired":"issued",
  geometryExpected:!cancelled&&exp!==null&&exp>nowMs,
  originalIdentifier:identifier};
}

export function parseOfficialBomCap(xml,{nowMs=Date.now()}={}){
 if(typeof xml!=="string"||xml.length>1500000||!/<(?:[\w-]+:)?alert[\s>]/i.test(xml))
  throw Error("Not a CAP alert document");
 const sender=one(xml,"sender"),senderName=one(xml,"senderName"),source=one(xml,"source");
 if(!(/bom\.gov\.au/i.test(sender)||/bureau of meteorology/i.test(senderName+" "+source)))
  return [];
 if(!/^actual$/i.test(one(xml,"status"))||
   /^(cancel|error|test|ack)$/i.test(one(xml,"msgType")))return [];
 const id=one(xml,"identifier");
 const references=one(xml,"references");
 const issued=one(xml,"sent"),issuedMs=strictTime(issued);
 if(!id||id.length>160||issuedMs===null||issuedMs>nowMs+300000||nowMs-issuedMs>18*3600000)
  return [];
 const output=[];
 for(const info of fields(xml,"info")){
  const event=one(info,"event");
  const parameters=fields(info,"parameter").map(p=>({
    name:one(p,"valueName"),value:one(p,"value")
  })).filter(p=>/^(?:product.?code|bom.?product.?id|warning.?product|product)$/i.test(p.name));
  const product=codeFromOriginalBomCapMetadata({
    identifier:id,references,web:one(info,"web"),parameters
  });
  const kind=verifiedEventKind(event,one(info,"headline"),product);
  // Never call IDQ21035 "regional" or IDQ21033 "detailed" by
  // headline, shape size, or an unauthenticated generic CAP event.
  if(!product||product.kind!==kind)continue;
  const expires=one(info,"expires"),endMs=strictTime(expires);
  if(endMs===null||endMs<=nowMs||endMs-issuedMs>24*3600000)continue;
  // WMO CAP <web> is an HTTP national index, not a direct warning bulletin.
  // Use the BoM's published product-specific HTTPS location for verified IDQ.
  if(!sourceBoMWebIsAuthentic(one(info,"web")))continue;
  const bulletin=productBulletinUrl(product.code);
  for(const [areaIndex,area] of fields(info,"area").entries()){
   const polygons=[];
   for(const raw of fields(area,"polygon")){
    try{
     const ring=capPolygonCoordinates(raw);
     if(qldCoordinates(ring)||nswCoordinates(ring))polygons.push([ring]);
    }catch{}
   }
   if(!polygons.length)continue;
   const state=polygons.some(p=>qldCoordinates(p[0]))?"QLD":"NSW";
   output.push({
    id:id+":"+areaIndex,issuer:"Bureau of Meteorology",type:kind,
    event,productCode:product.code,polygonProductCodes:product.polygonAxfs,
    productType:product.productType,
    state,issuedUtc:new Date(issuedMs).toISOString(),expiresUtc:new Date(endMs).toISOString(),
    headline:one(info,"headline").slice(0,280),description:one(info,"description").slice(0,5000),
    instruction:one(info,"instruction").slice(0,2200),
    severity:one(info,"severity"),certainty:one(info,"certainty"),
    areaDescription:one(area,"areaDesc").slice(0,500),
    bulletinUrl:bulletin,geometry:{
      type:polygons.length===1?"Polygon":"MultiPolygon",
      coordinates:polygons.length===1?polygons[0]:polygons
    },official:true
   });
  }
 }
 return output;
}
