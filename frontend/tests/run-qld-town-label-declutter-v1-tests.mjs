import assert from "node:assert/strict";
import {
  labelBudget, townLabelBox, boxesOverlap, greatCircleKm,
  rankQueenslandTowns, layoutTownLabels
} from "../src/context-layers/qld-town-label-declutter-v1.js";

assert.equal(labelBudget(390, 350, 2_000_000), 0, "No planetary-scale wall of labels");
assert.equal(labelBudget(390, 350, 50_000, "street"), 8);
assert.ok(labelBudget(390, 350, 50_000, "qld-imagery") <= 9);
assert.ok(labelBudget(390, 350, 750_000) <= 5);
assert.equal(labelBudget(160, 350, 10_000), 0, "Tiny map viewport does not get clutter");
assert.ok(labelBudget(1200, 800, 50_000) <= 28);
assert.equal(greatCircleKm({latitude:-25,longitude:139},{latitude:-25,longitude:139}),0);

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
const wall=layoutTownLabels({
  candidates,width:390,height:350,cameraHeight:50000,
  mode:"street"
});
assert.ok(wall.length<=8);
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
  candidates:spread,width:390,height:350,cameraHeight:20000,mode:"street"
});
assert.ok(sparse.length<=8);
assert.ok(sparse.length>1);
const remote=layoutTownLabels({
  candidates:[{id:"birdsville",name:"Birdsville",x:150,y:160,population:115,priority:80}],
  width:390,height:350,cameraHeight:60000
});
assert.deepEqual(remote.map(x=>x.id),["birdsville"]);
const far=layoutTownLabels({candidates:spread,width:390,height:350,cameraHeight:2_100_000});
assert.equal(far.length,0);
const stay=layoutTownLabels({
  candidates:[
    {id:"a",name:"A",priority:20,x:100,y:100,population:50},
    {id:"b",name:"B",priority:25,x:100,y:100,population:50}
  ],
  width:390,height:350,cameraHeight:10000,previousVisible:["a"]
});
assert.equal(stay[0].id,"a","Previously displayed label wins near ties during gentle pan");
console.log("Town declutter checks passed: 758 dense names, collision-free mobile/desktop budgets, horizon-scale suppression, remote settlement priority and visibility hysteresis.");
