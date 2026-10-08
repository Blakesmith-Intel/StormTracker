import assert from "node:assert/strict";
import { loadCompleteRadarTiles } from "../src/radar-tile-retry-v1.js";

const tasks=[
  {url:"tile-a",col:1,row:1,x:0,y:0},
  {url:"tile-b",col:2,row:1,x:256,y:0},
  {url:"tile-c",col:3,row:1,x:512,y:0}
];
const image={width:256,height:256,data:new Uint8ClampedArray(4)};
const attempts=new Map();
const loaded=await loadCompleteRadarTiles(tasks,async url=>{
  attempts.set(url,(attempts.get(url)??0)+1);
  if(url==="tile-b"&&attempts.get(url)===1)throw Error("503");
  return image;
},{wait:async()=>{}});
assert.deepEqual(loaded.map(x=>x.url),tasks.map(x=>x.url));
assert.equal(attempts.get("tile-a"),1);
assert.equal(attempts.get("tile-b"),2);
assert.equal(attempts.get("tile-c"),1);
assert.deepEqual(loaded.map(x=>x.x),[0,256,512]);
let failed=false;
try{
 await loadCompleteRadarTiles(tasks,async task=>{
   if(task==="tile-c")throw Error("WMTS HTTP 404");
   return image;
 },{wait:async()=>{}});
}catch(error){
 failed=true;
 assert.match(error.message,/Incomplete BoM reflectivity mosaic/);
 assert.match(error.message,/tile 3\/1/);
 assert.match(error.message,/404/);
}
assert.equal(failed,true,"missing real radar pixel tile must reject entire scan");
await assert.rejects(loadCompleteRadarTiles([],async()=>image),TypeError);
await assert.rejects(loadCompleteRadarTiles(tasks,async()=>({width:0,height:0}),
 {wait:async()=>{}}),/empty radar tile/);
console.log("PASS selective WMTS tile retry; existing real tiles retained; no missing-pixel fabrication.");
