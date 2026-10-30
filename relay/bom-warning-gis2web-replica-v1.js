// Queensland emergency-management replica of Bureau GIS2Web WFS warnings.
// ArcGIS service description: BoM Land Warnings RO; WFS downloaded by FME.
// Service is declared for QFES/QDMA use; publisher is NOT the Bureau itself.
// Use ONLY geospatial features matched to an independently verified active
// WMO-BoM CAP product and ORIGINAL issue/expiry time. No other overlays altered.
import {QLD_WARNING_PRODUCTS}
 from "../frontend/src/context-layers/bom-qld-warning-product-catalogue-v1.js";
export const QLD_BOM_GIS_WARNING_REPLICA=
 "https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/BOM_Land_Warnings_RO/FeatureServer";
const ACCEPTED_PRODUCTS=new Map([
 ["IDQ21033",{axf:"IDQ65654",layer:3}],
 ["IDQ21035",{axf:"IDQ65650",layer:3}],
 ["IDQ21037",{axf:"IDQ65272",layer:2}],
 ["IDQ21038",{axf:"IDQ65277",layer:2}]
]);
const allowed=(s)=>ACCEPTED_PRODUCTS.get(s);
const timeMs=x=>{
 if(Number.isFinite(x))return x;
 if(typeof x==="string"&&Number.isFinite(Date.parse(x)))return Date.parse(x);
 return NaN;
};
function checkRing(ring){
 if(!Array.isArray(ring)||ring.length<4||ring.length>30000)throw Error("Invalid BoM GIS ring length");
 let out=ring.map(p=>{
  if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])
  ||p[0]<136||p[0]>154.7||p[1]<-29.7||p[1]>-9)
   throw Error("Invalid Queensland warning coordinate");
  return [p[0],p[1]];
 });
 if(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1])
   out.push([...out[0]]);
 if(new Set(out.slice(0,-1).map(p=>p.join(","))).size<3)
  throw Error("Degenerate BoM warning area");
 return out;
}
function checkGeometry(g){
 let polys=g?.type==="Polygon"?[g.coordinates]:g?.type==="MultiPolygon"?g.coordinates:[];
 if(!polys.length||polys.length>150)throw Error("BoM polygon missing/unsupported");
 return {type:polys.length===1?"Polygon":"MultiPolygon",
  coordinates:polys.length===1?polys[0].map(checkRing):
   polys.map(p=>p.map(checkRing))};
}
export function sourceExactQldBomWfsFeatures(collection,notice,{nowMs=Date.now()}={}){
 const code=notice?.productCode,source=allowed(code);
 if(!source||!QLD_WARNING_PRODUCTS[code]||
    notice.status!=="issued"||!Number.isFinite(timeMs(notice.issuedUtc))||
    !Number.isFinite(timeMs(notice.expiresUtc))||
    timeMs(notice.expiresUtc)<=nowMs)return [];
 if(collection?.type!=="FeatureCollection"||!Array.isArray(collection.features)||
    collection.error||collection.features.length>500||
    collection.exceededTransferLimit===true)
  throw Error("Incomplete official BoM WFS-derived geometry data");
 const seen=new Set(),warnings=[];
 for(const [i,feature] of collection.features.entries()){
  const p=feature?.properties??{};
  if(p.product!==source.axf)continue;
  const from=timeMs(p.validfrom_utc),to=timeMs(p.validto_utc);
  if(!Number.isFinite(from)||!Number.isFinite(to)||
      from>nowMs+300000||to<=nowMs)continue;
  // Join only the same original BoM product and issue, never a nearby
  // forecast-district approximation or an older hazard footprint.
  // WMO CAP is the bulletin lifetime; GIS2Web geometry has an independent
  // validity end, which can legitimately be hours earlier.
  // Observed 30 Oct 2026: CAP expires 10:45:08Z, original GIS polygon
  // expires 08:45:08Z, but both issue times match within four seconds.
  if(Math.abs(from-timeMs(notice.issuedUtc))>120000)continue;
  const visibleUntil=Math.min(to,timeMs(notice.expiresUtc));
  if(visibleUntil<=nowMs)continue;
  let geometry;
  try{geometry=checkGeometry(feature.geometry);}catch{continue;}
  const id=String(p.gml_id??p.OBJECTID??feature.id??i).slice(0,85);
  if(seen.has(id))continue;seen.add(id);
  warnings.push({
   id:code+":"+new Date(from).toISOString()+":"+id,
   issuer:"Bureau of Meteorology",official:true,
   type:QLD_WARNING_PRODUCTS[code].kind,productCode:code,
   polygonProductCodes:[source.axf],
   productType:QLD_WARNING_PRODUCTS[code].productType,
   state:"QLD",event:notice.headline,
   headline:notice.headline,description:notice.description,
   instruction:notice.instruction,areaDescription:notice.areaDescription,
   issuedUtc:new Date(from).toISOString(),expiresUtc:new Date(visibleUntil).toISOString(),
   // Preserve BOTH source expiry times; never extend the plotted geometry
   // beyond its own published validity even while the bulletin remains live.
   geometryExpiresUtc:new Date(to).toISOString(),
   bulletinExpiresUtc:new Date(timeMs(notice.expiresUtc)).toISOString(),
   bulletinUrl:notice.bulletinUrl,severity:"",certainty:"",
   phenomena:String(p.phenomena??"").slice(0,350),
   warningGeometrySource:"Queensland emergency-management Bureau GIS2Web WFS-derived feature service",
   sourceProduct:source.axf,
   // Prevent misrepresentation: this geometry is a government-published
   // source-exact mirror, NOT coordinates present in WMO CAP.
   geometry
  });
 }
 return warnings;
}
export async function fetchQldBomWfsGeometry(notice,{fetchImpl=fetch,nowMs=Date.now()}={}){
 const source=allowed(notice?.productCode);
 if(!source)return [];
 const url=new URL(QLD_BOM_GIS_WARNING_REPLICA+"/"+source.layer+"/query");
 url.searchParams.set("f","geojson");
 url.searchParams.set("where","product='"+source.axf+"'");
 url.searchParams.set("outFields","*");
 url.searchParams.set("outSR","4326");
 url.searchParams.set("returnGeometry","true");
 url.searchParams.set("resultRecordCount","500");
 const response=await fetchImpl(url.toString(),{
  headers:{Accept:"application/json"},
  signal:AbortSignal.timeout(14500)
 });
 if(!response.ok)throw Error("Queensland BoM WFS derivative HTTP "+response.status);
 const text=await response.text();
 if(text.length>1800000)throw Error("BoM GIS polygon response oversized");
 let collection;
 try{collection=JSON.parse(text);}catch{throw Error("Invalid government BoM GIS JSON");}
 if(collection?.error)throw Error("Government BoM GIS unavailable: "+String(collection.error.code??"API error"));
 return sourceExactQldBomWfsFeatures(collection,notice,{nowMs});
}
