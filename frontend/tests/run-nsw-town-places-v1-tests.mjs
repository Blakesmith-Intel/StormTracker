import assert from "node:assert/strict";
import {
  NSW_SETTLEMENT_LAYERS, nswTownsQueryUrl, normaliseNswTowns,
  fetchNswTowns
} from "../src/context-layers/nsw-town-places-v1.js";
import {
  nswLocalityViewBounds, expandNswLocalityBounds, nswLocalityQueryUrl,
  normaliseNswLocalities
} from "../src/context-layers/nsw-nearby-localities-v1.js";
import {
  rankQueenslandTowns, layoutTownLabels,
  geographicPlaceNameKey
} from "../src/context-layers/qld-town-label-declutter-v1.js";
import {WORLD_IMAGERY_BASEMAP,createBasemapProvider,BASEMAP_IDS}
  from "../src/context-layers/basemap-manager-v1.js";

assert.deepEqual(NSW_SETTLEMENT_LAYERS.map(layer=>layer.kind),
  ["city","town","village"]);
assert.match(nswTownsQueryUrl({kind:"city"}),/outFields=objectid%2Cgeneralname/);
assert.match(nswTownsQueryUrl({kind:"town"}),/population/);
const mk=(id,name,lon,lat,pop=0)=>({
  type:"Feature",id,properties:{objectid:id,generalname:name,population:pop},
  geometry:{type:"Point",coordinates:[lon,lat]}
});
const city=normaliseNswTowns({features:[mk(10,"Sydney",151.21,-33.87)]},{kind:"city"});
assert.equal(city.length,1);
assert.equal(city[0].isMajor,true);
assert.equal(city[0].population,0,
  "Never invent numerical populations for city/village sources");
assert.deepEqual(normaliseNswTowns({features:[
  mk(11,"Moree",149.84,-29.46,10000),mk(12,"",150,-31),mk(13,"Outside NSW",140,-28)
]},{kind:"town"}).map(p=>p.name),["Moree"]);
let calls=[];
const fetchImpl=async url=>{
  calls.push(url);
  const kind=/MapServer\/0\/query/.test(url)?"city":
    /MapServer\/1\/query/.test(url)?"town":"village";
  const features=kind==="city"?[mk(1,"Sydney",151.21,-33.87)]:
    kind==="town"?[mk(2,"Moree",149.84,-29.46,10000)]:
    [mk(3,"Grafton",152.93,-29.69)];
  return {ok:true,async json(){return {type:"FeatureCollection",features};}};
};
const settlements=await fetchNswTowns({fetchImpl});
assert.equal(settlements.length,3);
assert.equal(calls.length,3,"City/town/village layers requested once in parallel");
assert.deepEqual(settlements.map(p=>p.name).sort(),["Grafton","Moree","Sydney"]);
const combined=rankQueenslandTowns([
  {id:"qld:goondiwindi",name:"Goondiwindi",longitude:150.31,latitude:-28.54,population:6000},
  ...settlements
]);
assert.ok(combined.find(x=>x.name==="Sydney").priority > combined.find(x=>x.name==="Grafton").priority,
  "Official NSW cities have useful broad-scale importance without made-up populations");
const accepted=layoutTownLabels({
  candidates:combined.map((p,i)=>({...p,x:140+i*170,y:180})),
  width:1100,height:600,cameraHeight:900000,mode:"qld-imagery"
});
assert.equal(accepted.length,combined.length,
  "Same existing collision layout can display nearby QLD and NSW towns together");
assert.equal(geographicPlaceNameKey("Tweed Heads"),"tweed heads");

const view=nswLocalityViewBounds({
  positionCartographic:{height:90000},
  computeViewRectangle(){return {west:150,east:152,south:-32,north:-30};}
},{Math:{toDegrees:x=>x}},{});
assert.ok(view&&view.east===152);
const expanded=expandNswLocalityBounds(view);
assert.ok(expanded.west < view.west && expanded.north > view.north);
const localityUrl=nswLocalityQueryUrl(expanded);
assert.match(localityUrl,/generalname/);
assert.match(localityUrl,/esriGeometryEnvelope/);
assert.deepEqual(normaliseNswLocalities({features:[mk(7,"Grafton",152.93,-29.69)]})
  .map(x=>x.name),["Grafton"]);

class UrlTemplate{constructor(options){this.options=options;}}
class Rectangle{static fromDegrees(...v){return v;}}
const Cesium={
  UrlTemplateImageryProvider:UrlTemplate,
  WebMercatorTilingScheme:class{},
  Credit:class{constructor(text){this.text=text;}},
  Rectangle
};
const imagery=createBasemapProvider(Cesium,BASEMAP_IDS.QLD_IMAGERY);
assert.equal(imagery.options.url,WORLD_IMAGERY_BASEMAP.tileTemplate);
assert.equal(imagery.options.rectangle,undefined,
  "National satellite base must not clip at either state border");
assert.match(imagery.options.credit.text,/Earthstar Geographics/);
console.log("PASS official NSW cities/towns/villages, national imagery, shared QLD label layout and viewport locality bounds.");
