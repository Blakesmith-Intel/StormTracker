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
const qldCoordinates=ring=>ring.some(([lon,lat])=>lon>=137&&lon<=154.5&&lat>=-29.5&&lat<=-9);
const nswCoordinates=ring=>ring.some(([lon,lat])=>lon>=141&&lon<=154.5&&lat>=-38&&lat<=-28);
export function parseOfficialBomCap(xml,{nowMs=Date.now()}={}){
 if(typeof xml!=="string"||xml.length>1500000||!/<(?:[\w-]+:)?alert[\s>]/i.test(xml))
  throw Error("Not a CAP alert document");
 const sender=one(xml,"sender"),senderName=one(xml,"senderName"),source=one(xml,"source");
 if(!(/bom\.gov\.au/i.test(sender)||/bureau of meteorology/i.test(senderName+" "+source)))
  return [];
 if(!/^actual$/i.test(one(xml,"status"))||
   /^(cancel|error|test|ack)$/i.test(one(xml,"msgType")))return [];
 const id=one(xml,"identifier");
 const issued=one(xml,"sent"),issuedMs=strictTime(issued);
 if(!id||id.length>160||issuedMs===null||issuedMs>nowMs+300000||nowMs-issuedMs>18*3600000)
  return [];
 const output=[];
 for(const info of fields(xml,"info")){
  const event=one(info,"event"),kind=warningKind(event);
  if(!kind)continue;
  const expires=one(info,"expires"),endMs=strictTime(expires);
  if(endMs===null||endMs<=nowMs||endMs-issuedMs>24*3600000)continue;
  const bulletin=bomUrl(one(info,"web")||one(xml,"web"));
  if(!bulletin)continue;
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
    event,productType:kind==="severe-weather"?"severe-weather":
      /detailed|metropolitan|cell based/i.test(one(info,"headline")+" "+one(info,"description"))
       ?"detailed":"regional-or-unspecified",
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
