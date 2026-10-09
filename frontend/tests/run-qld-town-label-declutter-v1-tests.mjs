import assert from "node:assert/strict";
import {labelBudget,townLabelBox,boxesOverlap,greatCircleKm,
  rankQueenslandTowns,layoutTownLabels,townLabelTypography,
  geographicPlaceNameKey,sameGeographicSettlement}
  from "../src/context-layers/qld-town-label-declutter-v1.js";

assert.equal(labelBudget(390,350,4_000_000,"street"),0);
assert.equal(labelBudget(160,350,50000,"qld-imagery"),0);
assert.ok(labelBudget(390,350,50000,"street")>0,
  "Street gets our own missing rural place names");
assert.equal(labelBudget(390,350,50000,"street"),
  labelBudget(390,350,50000,"qld-imagery"));
assert.ok(labelBudget(1200,800,50000,"qld-imagery")>42,
  "Desktop must no longer stop at arbitrary 42-label limit");
assert.ok(labelBudget(1200,800,1_900_000,"qld-imagery")>8,
  "Statewide desktop must no longer be hard-capped at eight town names");
assert.ok(labelBudget(390,350,50000,"qld-imagery")<=16,
  "Smaller mobile view remains bounded by usable area");
assert.equal(greatCircleKm({latitude:-25,longitude:139},
  {latitude:-25,longitude:139}),0);
assert.deepEqual(townLabelTypography(390,115),{fontSize:12,font:"12px sans-serif"});
assert.deepEqual(townLabelTypography(1200,115),{fontSize:15,font:"bold 15px sans-serif"});

const source=rankQueenslandTowns([
  {id:"brisbane",name:"Brisbane",longitude:153.03,latitude:-27.47,population:2_600_000},
  {id:"birdsville",name:"Birdsville",longitude:139.35,latitude:-25.9,population:115},
  {id:"bedourie",name:"Bedourie",longitude:139.47,latitude:-24.35,population:110}
]);
assert.equal(source.length,3);
assert.ok(source.find(p=>p.id==="birdsville").isolationKm>100);

// A broad Queensland map has names distributed across the viewport, not
// concentrated exclusively around coastal high-population clusters.
const statewide=[];
for(let y=0;y<6;y++)for(let x=0;x<10;x++)statewide.push({
  id:`remote-${x}-${y}`,name:`Locality ${x}-${y}`,
  x:60+x*110,y:60+y*112,longitude:138+x*1.6,
  latitude:-28+y*3.4,population:150,priority:100+(x===9?150:0)+y
});
const desktop=layoutTownLabels({
  candidates:statewide,width:1200,height:800,cameraHeight:1_700_000,
  cameraPitchDegrees:-45,mode:"qld-imagery"
});
assert.ok(desktop.length>=15,"Broad desktop view must retain 15+ distinct names");
assert.ok(desktop.some(p=>p.longitude<142),"Western Queensland remains named");
assert.ok(desktop.some(p=>p.longitude>149),"Eastern Queensland remains named");
const street=layoutTownLabels({
  candidates:statewide,width:1200,height:800,cameraHeight:1_700_000,
  cameraPitchDegrees:-45,mode:"street"
});
assert.ok(street.length>=15,"Street view gains missing rural labels");
for(let i=0;i<desktop.length;i++)for(let j=i+1;j<desktop.length;j++)
  assert.equal(boxesOverlap(townLabelBox({
    ...desktop[i],fontSize:townLabelTypography(1200,150).fontSize
  }),townLabelBox({
    ...desktop[j],fontSize:townLabelTypography(1200,150).fontSize
  }),9),false,"Label collision detection must remain active");

const phone=layoutTownLabels({
  candidates:statewide,width:390,height:350,cameraHeight:800000,
  mode:"qld-imagery"
});
assert.ok(phone.length<=16);
const invisible=layoutTownLabels({
  candidates:statewide,width:1200,height:800,cameraHeight:3_900_000,
  mode:"qld-imagery"
});
assert.deepEqual(invisible,[]);
const sticky=layoutTownLabels({
  candidates:[
    {id:"a",name:"A",priority:20,x:100,y:100,population:50},
    {id:"b",name:"B",priority:25,x:100,y:100,population:50}
  ],width:390,height:350,cameraHeight:10000,mode:"street",
  previousVisible:["a"]
});
assert.equal(sticky[0].id,"a");
// Pentland can arrive from both QLD population centres and gazetteer
// under different official IDs and slightly different coordinates.
const pentlandA={id:"town:pentland",name:"Pentland",latitude:-20.525,longitude:145.400};
const pentlandB={id:"gazetteer:pentland",name:"PENTLAND (Charters Towers Shire)",latitude:-20.545,longitude:145.425};
assert.equal(geographicPlaceNameKey(pentlandB.name),"pentland");
assert.ok(sameGeographicSettlement(pentlandA,pentlandB));
assert.ok(!sameGeographicSettlement(pentlandA,{...pentlandB,longitude:151}),
  "A genuinely distant same-name locality is NOT discarded");
const duplicates=layoutTownLabels({
  candidates:[
    {...pentlandA,x:220,y:225,priority:150,population:200},
    {...pentlandB,x:400,y:225,priority:120,population:200},
    {id:"other",name:"Hughenden",x:600,y:225,priority:110,population:800}
  ],width:1000,height:600,cameraHeight:900000,mode:"qld-imagery"
});
assert.equal(duplicates.filter(p=>geographicPlaceNameKey(p.name)==="pentland").length,1,
  "Two geographic feeds must never produce duplicate Pentland names even when their screen anchors are apart");
assert.equal(duplicates.length,2);
console.log("PASS adaptive rural Queensland label density, statewide desktop distribution, Street+imagery, collisions and mobile bounds.");
