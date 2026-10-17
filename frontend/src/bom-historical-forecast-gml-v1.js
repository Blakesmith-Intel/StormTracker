// Strict browser decoder of a locally selected ORIGINAL BoM tcData GML file.
// Uses source vertices. Never synthesises a forecast fix or uncertainty cone,
// fetches FTP data, polls for warnings, or stores original warning materials.
// No network operation of any kind; never label an uploaded source as live.
export const HISTORICAL_TC_GML_PRODUCTS=Object.freeze([
 "IDD65401","IDD65402","IDD65408","IDD65409",
 "IDQ65248","IDQ65249","IDQ65250","IDQ65251","IDQ65252",
 "IDW60266","IDW60267","IDW60268","IDW60283"
]);
const PRODUCT_SET=new Set(HISTORICAL_TC_GML_PRODUCTS);
const TC_NS="http://www.bom.gov.au/dtd/tc";
const GML_NS="http://www.opengis.net/gml";
const CRS=new Set(["urn:ogc:def:crs:EPSG:6.6:4283",
 "urn:ogc:def:crs:EPSG::4283","EPSG:4283",
 "urn:ogc:def:crs:EPSG::4326","EPSG:4326"]);
const MAX_XML=3_000_000,MAX_VERTICES=20_000,MAX_FEATURES=300;
const name=e=>String(e?.localName??"").toLowerCase();
const children=(e,key)=>Array.from(e?.children??[]).filter(c=>name(c)===key.toLowerCase());
const child=(e,key)=>children(e,key)[0]??null;
const descendants=(e,key)=> {
 const results=[];
 const visit=node=>{for(const c of node?.children??[]){
   if(name(c)===key.toLowerCase())results.push(c);
   visit(c);
 }};
 visit(e);return results;
};
const requiredText=(e,key)=>{
 const c=child(e,key);const text=c?.textContent?.trim();
 if(!text)throw new Error("Missing original BoM field "+key);
 return text;
};
const optionalText=(e,key)=>child(e,key)?.textContent?.trim()??null;
const validUtc=(text)=>{
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(text??"") ||
   !Number.isFinite(Date.parse(text)))throw new Error("Invalid source issue/valid UTC");
 return new Date(text).toISOString();
};
const originalCoords=(text)=>{
 const tokens=String(text??"").trim().split(/\s+/).filter(Boolean);
 if(!tokens.length||tokens.length>MAX_VERTICES)throw new Error("Empty or oversized BoM coordinates");
 return tokens.map(v=>{
   const parts=v.split(",");if(parts.length!==2)throw new Error("Unsupported original coordinate tuple");
   const lon=Number(parts[0]),lat=Number(parts[1]);
   if(!parts.every(p=>p.trim()!==""&&Number.isFinite(Number(p)))||
     !Number.isFinite(lon)||!Number.isFinite(lat)||
     lon< -180||lon>180||lat< -90||lat>90)
     throw new Error("Invalid geographic longitude/latitude; no axis swap");
   return [lon,lat];
 });
};
const sourceCRS=element=>{
 const members=[];
 const visit=e=>{
   if(e?.getAttribute?.("srsName"))members.push(e.getAttribute("srsName"));
   for(const c of e?.children??[])visit(c);
 };
 visit(element);
 if(!members.length||members.some(m=>!CRS.has(m))||
    new Set(members).size!==1)throw new Error("Missing/mixed/unsupported BoM geographic CRS");
 return members[0];
};
const typedCoords=(feature,type)=>{
 const candidates=descendants(feature,type);
 if(candidates.length!==1)throw new Error("No unique source "+type);
 const coords=descendants(candidates[0],"coordinates");
 if(coords.length!==1||coords[0].namespaceURI!==GML_NS)
   throw new Error("Missing gml:coordinates in "+type);
 return originalCoords(coords[0].textContent);
};
const sourcePolygons=element=>{
 const polygons=descendants(element,"polygon");
 if(!polygons.length||polygons.length>50)throw new Error("Missing/oversized source polygon");
 return polygons.map(p=>{
   const outer=children(p,"outerBoundaryIs");
   if(outer.length!==1)throw new Error("Source polygon has no unique outer boundary");
   const borders=[outer[0],...children(p,"innerBoundaryIs")];
   return borders.map(b=>{
     const ring=typedCoords(b,"linearring");
     if(ring.length<4 || ring[0][0]!==ring.at(-1)[0] ||
       ring[0][1]!==ring.at(-1)[1])throw new Error("Original polygon ring is not closed");
     return ring;
   });
 });
};
export function decodeHistoricalBomCycloneGml(xmlText,{
 filename,parseXml=text=>new DOMParser().parseFromString(text,"application/xml")
}={}){
 if(typeof xmlText!=="string"||xmlText.length>MAX_XML||xmlText.length<100 ||
   /<!DOCTYPE|<!ENTITY/i.test(xmlText))throw new Error("Invalid or unsafe cyclone GML input");
 const match=/^(ID[QDWN]\d{5})\.gml$/i.exec(String(filename??""));
 const productId=match?.[1]?.toUpperCase();
 if(!PRODUCT_SET.has(productId))throw new Error("Select a documented original BoM cyclone *.gml file");
 const doc=parseXml(xmlText);
 if(!doc?.documentElement||name(doc.documentElement)!=="tcdata" ||
   doc.documentElement.namespaceURI!==TC_NS ||
   descendants(doc.documentElement,"parsererror").length)
   throw new Error("Not BoM tcData GML with the official XML namespace");
 const root=doc.documentElement;
 const issueUtc=validUtc(requiredText(root,"issueTime"));
 const baseUtc=validUtc(requiredText(root,"fcastTime"));
 if(Date.parse(issueUtc)<Date.parse(baseUtc))throw new Error("Issue before original forecast base");
 const systemId=requiredText(root,"distId");
 const cycloneName=requiredText(root,"distName").slice(0,80);
 if(systemId.length>80||!/[A-Za-z]/.test(systemId))throw new Error("Invalid original storm ID");
 const expiryHours=Number(requiredText(root,"expiryHrs"));
 if(!Number.isInteger(expiryHours)||expiryHours<1||expiryHours>48)
   throw new Error("Invalid original issue expiry");
 const types={tcfix:"",tctrack:"",tcforecastarea:"",
   tcwarningarea:"",tcwatcharea:"",tcwindarea:""};
 const features=[];
 for(const element of root.children){
   const type=name(element);
   if(!(type in types))continue;
   const crs=sourceCRS(element);
   let role,geometry,detail={},areaKey=null;
   if(type==="tcfix"){
     const kind=requiredText(element,"fixType").toLowerCase();
     role=kind==="forecast"?"forecast_fix":
       ["current","observed","analysis"].includes(kind)?"observed_fix":null;
     if(!role)throw new Error("Unrecognised BoM fixType");
     const validTime=validUtc(requiredText(element,"fixTime"));
     if(role==="forecast_fix" && (
       Date.parse(validTime)<=Date.parse(baseUtc) ||
       Date.parse(validTime)>Date.parse(baseUtc)+121*3600000))
       throw new Error("Forecast fix outside source horizon");
     const coords=typedCoords(element,"point");
     if(coords.length!==1)throw new Error("Original fix is not one point");
     const rawCat=optionalText(element,"category");
     const category=rawCat===null?null:Number(rawCat);
     if(category!==null&&(!Number.isInteger(category)||category<0||category>5))
       throw new Error("Invalid original BoM category");
     const rawOffset=optionalText(element,"timeOffset");
     const lead=rawOffset===null?null:Number(rawOffset);
     if(lead!==null&&(!Number.isFinite(lead)||lead< -96||lead>121))
       throw new Error("Invalid original lead time");
     geometry={type:"Point",coordinates:coords[0]};
     detail={validUtc:validTime,category,leadHours:lead,fixType:kind};
   }else if(type==="tctrack"){
     const kind=requiredText(element,"trackType").toLowerCase();
     role=kind==="forecast"?"forecast_track":
       ["current","observed","analysis"].includes(kind)?"observed_track":null;
     if(!role)throw new Error("Unrecognised original trackType");
     const coords=typedCoords(element,"linestring");
     if(coords.length<2)throw new Error("Original track too short");
     geometry={type:"LineString",coordinates:coords};
     detail={startUtc:validUtc(requiredText(element,"startTime")),
       endUtc:validUtc(requiredText(element,"endTime"))};
   }else{
     role=type==="tcforecastarea"?"uncertainty_area":
       type==="tcwarningarea"?"warning_area":
       type==="tcwatcharea"?"watch_area":"wind_area";
     const polygons=sourcePolygons(element);
     geometry=polygons.length===1?{type:"Polygon",coordinates:polygons[0]}:
       {type:"MultiPolygon",coordinates:polygons};
     detail={areaType:optionalText(element,"areaType"),
       extent:optionalText(element,"extent"),windType:optionalText(element,"windType")};
     if(role==="uncertainty_area"){
       if(detail.areaType!=="Likely Tracks Area" ||
          !["Up to 72 hours","Up to 120 hours"].includes(detail.extent))
         throw new Error("Forecast area is not a verified BoM likely-tracks polygon");
       areaKey=detail.extent==="Up to 72 hours"?"72":"120";
     }
   }
   features.push({id:systemId+":"+type+":"+(features.length+1),role,
      productType:type,originalCRS:crs,geometry,...detail,areaKey});
   if(features.length>MAX_FEATURES)throw new Error("Oversized original cyclone feature collection");
 }
 if(!features.some(f=>f.role==="forecast_fix"||f.role==="forecast_track"))
   throw new Error("No original issued forecast fixes or tracks");
 return {productId,systemId,cycloneName,issueUtc,baseUtc,expiryHours,
   source:"LOCAL ORIGINAL BoM GML · HISTORICAL QA · NOT LIVE",
   features};
}
export function cycloneForecastSummary(bundle){
 const features=bundle?.features??[];
 return Object.freeze({
  forecastFixes:features.filter(f=>f.role==="forecast_fix").length,
  forecastTracks:features.filter(f=>f.role==="forecast_track").length,
  observedFixes:features.filter(f=>f.role==="observed_fix").length,
  uncertainty72:features.filter(f=>f.role==="uncertainty_area"&&f.areaKey==="72").length,
  uncertainty120:features.filter(f=>f.role==="uncertainty_area"&&f.areaKey==="120").length
 });
}
