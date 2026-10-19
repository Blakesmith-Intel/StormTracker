import assert from "node:assert/strict";
import {createPowerOutageLayer,officialPowerOutagePolygonParts}
 from "../src/context-layers/power-outages-v1.js";
import {parseEssentialEnergyKml} from "../src/context-layers/essential-energy-kml-v1.js";

const now=Date.now();
const start=new Date(now-8*60000);
const updated=new Date(now-3*60000);
const future=new Date(now+120*60000);
const localDate=d=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-AU",{
  timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false
 }).formatToParts(d).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
};
const poly=(coords,id,provider)=>({
 type:"Feature",id,
 properties:{EVENT_ID:id,TYPE:"UNPLANNED",STATUS:"In Progress",
 SUBURBS:provider==="Energex"?"WYNNUM WEST":"QLD",
 CUSTOMERS_AFFECTED:1107,START:now-8*60000,FINISH:null,
 provider},
 geometry:{type:"Polygon",coordinates:[coords]}
});
const wynnum=[[153.13,-27.46],[153.16,-27.46],[153.16,-27.44],[153.13,-27.44],[153.13,-27.46]];
const ergonRing=[[146.8,-19.3],[146.82,-19.3],[146.82,-19.28],[146.8,-19.28],[146.8,-19.3]];
const essentialRing=[[150.30,-28.56],[150.32,-28.56],[150.32,-28.54],[150.30,-28.54],[150.30,-28.56]];
const essentialKml=`<kml><Document><Placemark id="INCD-ESS-QLD"><styleUrl>#sw_1249554_normal_unplanned</styleUrl>
<description><![CDATA[<h2>INCD-ESS-QLD</h2><div><span>Time Off:</span>${localDate(start)}</div>
<div><span>Est. Time On:</span>${localDate(future)}</div><div><span>No. of Customers affected:</span>30</div>
<div><span>Reason:</span>Fault</div><div><span>Last Updated:</span>${localDate(updated)}</div>]]></description>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${essentialRing.map(c=>c.join(",")+",0").join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark></Document></kml>`;
const parsed=parseEssentialEnergyKml(essentialKml);
assert.equal(parsed.features.length,1);
assert.equal(officialPowerOutagePolygonParts(parsed.features[0]).length,1);
const energex=poly(wynnum,"energex:INCD-988236-g","Energex");
const ergon=poly(ergonRing,"ergon:INCD-5000","Ergon");
const boundary={type:"FeatureCollection",features:[{type:"Feature",properties:{OBJECTID:1},
 geometry:{type:"Polygon",coordinates:[[[140,-29],[151,-29],[153.6,-28.1],[153.6,-10],[140,-10],[140,-29]]]}}]};
const json=v=>({ok:true,status:200,async json(){return v},async text(){return String(v)}});
const fetchImpl=async url=>{
 url=String(url);
 if(url.includes("essential-energy-outages"))return json(essentialKml);
 if(url.includes("Locality/FeatureServer/5/query"))return json(boundary);
 if(url.includes("VwErgonOutages"))return json({type:"FeatureCollection",features:[ergon]});
 if(url.includes("VwEnergexOutages"))return json({type:"FeatureCollection",features:[energex]});
 return json({type:"FeatureCollection",features:[]});
};
class Collection {
 values=[];
 add(input){const e={...input};this.values.push(e);return e}
 removeAll(){this.values=[]}
}
class GeoJsonDataSource {
 constructor(name){this.name=name;this.show=true;this.entities=new Collection()}
 async load(payload){
  this.entities.removeAll();
  for(const feature of payload.features){
   this.entities.add({id:"cesium-internal-"+feature.id,polygon:{show:true,fill:true}});
  }
 }
}
class PolygonHierarchy{constructor(positions,holes=[]){this.positions=positions;this.holes=holes}}
const shade={withAlpha(alpha){return {rgba:"red",alpha}}};
const CesiumRef={GeoJsonDataSource,PolygonHierarchy,
 Color:{fromCssColorString:()=>shade},Cartesian3:{fromDegreesArray:a=>a},
 HeightReference:{CLAMP_TO_GROUND:1}};
const viewer={dataSources:{add(){}},scene:{requestRender(){}}};
const layer=createPowerOutageLayer({viewer,CesiumRef,fetchImpl,visible:true,
 onStatus:()=>{},onUpdate:()=>{}});
const features=await layer.refresh();
assert.equal(features.length,3,
 "Energex, Ergon and Essential Energy must all retain polygon geometry");
const fills=layer.dataSource.entities.values.filter(e=>e.id?.startsWith("stormtracker-outage-fill-"));
assert.equal(fills.length,3,"Every provider's polygon needs an actual filled entity");
const prov=new Set(fills.map(e=>e.stormTrackerPowerOutageProvider));
assert.deepEqual([...prov].sort(),["Energex","Ergon","Essential Energy"]);
for(const f of fills){
 assert.equal(f.polygon.show,true);
 assert.equal(f.polygon.fill,true);
 assert.equal(f.polygon.material.alpha,0.38);
 assert(f.polygon.hierarchy.positions.length>=8);
}
const essential=fills.find(x=>x.stormTrackerPowerOutageProvider==="Essential Energy");
assert(essential.polygon.hierarchy.positions[0]===150.3);
const legacy=layer.dataSource.entities.values.filter(e=>e.id?.startsWith("cesium-internal-"));
assert(legacy.every(x=>x.polygon.show===false),
 "Incorrectly matched Cesium polygons must never obscure the source-authentic fills");
layer.setVisible(false);
assert.equal(layer.dataSource.show,false);
layer.setVisible(true);
assert.equal(layer.dataSource.show,true);
console.log("ALL_THREE_POWER_PROVIDERS_SHADED_POLYGONS_PASS",
 {fills:fills.length,providers:[...prov].sort(),holesSupported:true});
