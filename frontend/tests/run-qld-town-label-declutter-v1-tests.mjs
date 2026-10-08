import assert from "node:assert/strict";
import {
  labelBudget, townLabelBox, boxesOverlap, greatCircleKm,
  rankQueenslandTowns, layoutTownLabels, townLabelTypography
} from "../src/context-layers/qld-town-label-declutter-v1.js";

assert.equal(labelBudget(390, 350, 2_000_000), 0, "No planetary-scale wall of labels");
assert.equal(labelBudget(390, 350, 50_000, "street"), 0,
  "Street must not draw supplemental Queensland town names");
assert.ok(labelBudget(390, 350, 50_000, "qld-imagery") <= 9);
assert.ok(labelBudget(390, 350, 50000, "qld-imagery", -90) <= 9,
  "Mobile imagery should remain bounded even with dense rural names even with a steep camera");
assert.equal(labelBudget(390, 350, 10000, "street", -90), 0,
  "No supplemental Street labels regardless of camera pitch");
assert.ok(labelBudget(390, 350, 750_000) <= 5);
assert.ok(labelBudget(390, 350, 300_000, "qld-imagery", -12) <= 4,
  "Shallow horizon views cannot create crowds even at moderate altitude");
assert.ok(labelBudget(390, 350, 50000, "qld-imagery", -30) <= 6);
assert.ok(labelBudget(390, 350, 50000, "qld-imagery", -70) >
  labelBudget(390, 350, 50000, "qld-imagery", -12));
assert.equal(labelBudget(160, 350, 10_000), 0, "Tiny map viewport does not get clutter");
assert.ok(labelBudget(1200, 800, 50_000, "qld-imagery") <= 42);
assert.equal(greatCircleKm({latitude:-25,longitude:139},{latitude:-25,longitude:139}),0);

assert.deepEqual(townLabelTypography(390,115),{
 fontSize:12,font:"12px sans-serif"
});
assert.deepEqual(townLabelTypography(390,18000),{
 fontSize:13,font:"bold 13px sans-serif"
});
assert.deepEqual(townLabelTypography(1200,115),{
 fontSize:15,font:"bold 15px sans-serif"
});
assert.deepEqual(townLabelTypography(1200,18000),{
 fontSize:16,font:"bold 16px sans-serif"
});
assert.equal(townLabelTypography(699,100).fontSize,12);
assert.equal(townLabelTypography(700,100).fontSize,15);
const adjacent=[
 {id:"birdsville",name:"Birdsville",population:115,priority:120,x:130,y:170},
 {id:"bedourie",name:"Bedourie",population:110,priority:110,x:235,y:170}
];
assert.equal(layoutTownLabels({candidates:adjacent,width:390,height:350,
 cameraHeight:30000,mode:"qld-imagery"}).length,2,
 "Mobile keeps original smaller label collision geometry");
assert.equal(layoutTownLabels({candidates:adjacent,width:1024,height:720,
 cameraHeight:30000,mode:"qld-imagery"}).length,1,
 "Desktop enlarged bold labels require larger spacing to avoid overlap");
const b = townLabelBox({name:"Birdsville",x:100,y:100});
assert.ok(boxesOverlap(b,townLabelBox({name:"Bedourie",x:101,y:100})));
assert.equal(boxesOverlap(b,townLabelBox({name:"Bedourie",x:270,y:250})),false);

const towns = rankQueenslandTowns([
  {id:"brisbane",name:"Brisbane",longitude:153.03,latitude:-27.47,population:2600000},
  {id:"birdsville",name:"Birdsville",longitude:139.35,latitude:-25.9,population:115},
  {id:"bedourie",name:"Bedourie",longitude:139.47,latitude:-24.35,population:110},
  {id:"metro",name:"Suburb",longitude:153.05,latitude:-27.49,population:10000}
]);
assert.equal(towns.length,4);
assert.ok(towns.find(t=>t.id==="birdsville").isolationKm>100);
assert.ok(towns.find(t=>t.id==="metro").isolationKm<10);

const candidates=[];
for(let i=0;i<758;i++){
  candidates.push({
    id:String(i),name:`Town ${i}`,
    population:i%3===0?1200:100,
    priority:100+i%20,
    x:195+(i%12-6)*2,
    y:170+Math.floor(i/12)%12*2
  });
}
assert.deepEqual(layoutTownLabels({
  candidates, width:390,height:350,cameraHeight:50000,mode:"street",
  previousVisible:["birdsville"]
}), [], "No Street town labels even when previously selected");
assert.equal(labelBudget(1200, 800, 50000, "street"),0,
  "No supplemental Street labels on desktop either");
const wall=layoutTownLabels({
  candidates,width:390,height:350,cameraHeight:50000,
  mode:"qld-imagery"
});
assert.ok(wall.length<=9);
const rects=wall.map(x=>townLabelBox(x));
for(let i=0;i<rects.length;i++){
  for(let j=i+1;j<rects.length;j++){
    assert.equal(boxesOverlap(rects[i],rects[j],9),false);
  }
}
const spread=Array.from({length:120},(_,i)=>({
  id:`s${i}`,name:`Rural Town ${i}`,
  x:40+(i%12)*28,y:40+Math.floor(i/12)*29,
  priority:10+i/2,population:250
}));
const sparse=layoutTownLabels({
  candidates:spread,width:390,height:350,cameraHeight:20000,mode:"qld-imagery"
});
assert.ok(sparse.length<=9);
assert.ok(sparse.length>1);
const remote=layoutTownLabels({
  candidates:[{id:"birdsville",name:"Birdsville",x:150,y:160,population:115,priority:80}],
  width:390,height:350,cameraHeight:60000,mode:"qld-imagery"
});
assert.deepEqual(remote.map(x=>x.id),["birdsville"]);
const pitched=layoutTownLabels({candidates:spread,width:390,height:350,cameraHeight:300000,mode:"qld-imagery",cameraPitchDegrees:-12});
assert.ok(pitched.length<=4,"Shallow horizon layout must be strictly limited");
const far=layoutTownLabels({candidates:spread,width:390,height:350,cameraHeight:2_100_000,mode:"qld-imagery"});
assert.equal(far.length,0);
const stay=layoutTownLabels({
  candidates:[
    {id:"a",name:"A",priority:20,x:100,y:100,population:50},
    {id:"b",name:"B",priority:25,x:100,y:100,population:50}
  ],
  width:390,height:350,cameraHeight:10000,mode:"qld-imagery",previousVisible:["a"]
});
assert.equal(stay[0].id,"a","Previously displayed label wins near ties during gentle pan");
const statewide = Array.from({ length: 20 }, (_, i) => ({
  id: `statewide-${i}`, name: `Outback ${i}`, population: 120,
  priority: 50 + i,
  x: 35 + (i % 5) * 72,
  y: 60 + Math.floor(i / 5) * 64,
  longitude: 139.1 + (i % 5) * 3.1,
  latitude: -28.4 + Math.floor(i / 5) * 5.1
}));
const lowAngleStatewide = layoutTownLabels({
  candidates: statewide, width: 390, height: 350,
  cameraHeight: 70000, cameraPitchDegrees: -55,
  mode: "qld-imagery"
});
assert.ok(lowAngleStatewide.length <= 5,
  "Statewide geographic footprint must cap labels even if camera height/pitch report a local view");

console.log("Town declutter checks passed: Street always returns zero supplemental names; QLD imagery remains collision-free with mobile/desktop budgets, rural priorities and horizon culling.");
