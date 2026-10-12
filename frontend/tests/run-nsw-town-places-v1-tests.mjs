import assert from "node:assert/strict";
import {fetchNswTowns} from "../src/context-layers/nsw-town-places-v1.js";
import {
  NSW_RADAR_PLACE_CATALOGUE_SCHEMA,NSW_RADAR_PLACE_CATALOGUE_URL,
  normaliseNswRadarPlaceCatalogue,fetchNswRadarPlaceCatalogue
} from "../src/context-layers/nsw-radar-place-catalogue-v1.js";
import {fetchNswNearbyLocalities,nswLocalityViewBounds,expandNswLocalityBounds}
  from "../src/context-layers/nsw-nearby-localities-v1.js";
import {layoutTownLabels,rankQueenslandTowns,sameGeographicSettlement}
  from "../src/context-layers/qld-town-label-declutter-v1.js";
const sample={
  schema:NSW_RADAR_PLACE_CATALOGUE_SCHEMA,
  source:"https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer",
  places:[
    {id:"nsw-town:1",name:"Brewarrina",longitude:146.8611357,latitude:-29.9624446,population:0,kind:"town"},
    {id:"nsw-town:2",name:"Moree",longitude:149.8416351,latitude:-29.4629725,population:0,kind:"town"},
    {id:"nsw-town:3",name:"Tweed Heads",longitude:153.5445904,latitude:-28.1740063,population:0,kind:"town"},
    {id:"nsw-city:4",name:"Lismore",longitude:153.279,latitude:-28.808,population:0,kind:"city"},
    {id:"nsw-locality:5",name:"Mungindi",longitude:149.00,latitude:-28.97,population:0,kind:"locality"},
    {id:"nsw-locality:6",name:"Ashford",longitude:151.1,latitude:-29.32,population:0,kind:"locality"},
    {id:"bad-town",name:"Invalid",longitude:160,latitude:-29,population:0,kind:"town"}
  ]
};
assert.ok(NSW_RADAR_PLACE_CATALOGUE_URL.includes("/data/nsw-radar-places-v1.json"));
assert.equal(normaliseNswRadarPlaceCatalogue(sample).length,6);
assert.throws(()=>normaliseNswRadarPlaceCatalogue({schema:"bad",places:[]}),/invalid/);
let requests=0,seenUrl="";
const fetchImpl=async url=>{
  requests++;seenUrl=url;
  return {ok:true,json:async()=>sample};
};
const towns=await fetchNswTowns({fetchImpl});
assert.equal(towns.length,4);
assert.deepEqual(towns.map(x=>x.name).sort(),
  ["Brewarrina","Lismore","Moree","Tweed Heads"]);
assert.equal(requests,1,"Load one same-origin snapshot instead of four non-CORS ArcGIS requests");
assert.equal(seenUrl,NSW_RADAR_PLACE_CATALOGUE_URL);
assert.equal(towns.find(x=>x.name==="Lismore").isMajor,true);
const north=await fetchNswNearbyLocalities({
  bounds:{west:148,south:-30,east:152,north:-28},
  fetchImpl
});
assert.deepEqual(north.map(x=>x.name).sort(),["Ashford","Mungindi"]);
assert.equal(requests,1,"Localities share cached snapshot with towns");
assert.ok(north.every(x=>x.fromNswLocality&&x.priority===38));
const view=nswLocalityViewBounds({
  positionCartographic:{height:540000},
  computeViewRectangle(){return {west:147,east:153,south:-31,north:-27.5};}
},{Math:{toDegrees:x=>x}},{});
assert.ok(view&&view.west===147&&view.east===153,
  "NSW rural names permitted at radar-regional zoom, not just street-level");
assert.ok(expandNswLocalityBounds(view).west<view.west);
assert.equal(nswLocalityViewBounds({
  positionCartographic:{height:1000000},
  computeViewRectangle(){throw Error("not invoked at extreme zoom");}
},{Math:{toDegrees:x=>x}},{}),null);
const ranked=rankQueenslandTowns([...towns,{
  id:"qld-town:1",name:"Goondiwindi",longitude:150.31,latitude:-28.54,population:7000
}]);
const accepted=layoutTownLabels({candidates:ranked.map((p,i)=>({...p,x:80+i*170,y:180})),
  width:1200,height:800,cameraHeight:750000,mode:"qld-imagery"});
assert.equal(accepted.length,ranked.length,
  "QLD and NSW place names share the one geographical screen-space label layout");
assert.ok(!sameGeographicSettlement(towns[0],towns[1]));
const invalidFetch=async()=>({ok:false,status:503});
await assert.rejects(()=>fetchNswRadarPlaceCatalogue({fetchImpl:invalidFetch}),/503/);
console.log("PASS same-origin NSW radar-name snapshot, major settlements, rural 540-km altitude, cache, and shared QLD/NSW layout.");
