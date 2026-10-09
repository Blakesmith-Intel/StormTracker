import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  addVolumeDisplayPoint,setVolumeDisplayOpacity,volumeOpacityFactor
} from "../src/volume-display-opacity-v1.js";
const read=path=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
let checks=0;
function test(label,fn){fn();checks++;console.log("PASS "+label);}
class Colour {
  constructor(red,green,blue,alpha=1){Object.assign(this,{red,green,blue,alpha});}
  withAlpha(alpha){return new Colour(this.red,this.green,this.blue,alpha);}
}
class Points {
  items=[];
  add(options){const point={...options};this.items.push(point);return point;}
  get(i){return this.items[i];}
  get length(){return this.items.length;}
}
test("Opacity is clamped and does not corrupt malformed state",()=>{
  assert.equal(volumeOpacityFactor(0),0);
  assert.equal(volumeOpacityFactor(100),1);
  assert.equal(volumeOpacityFactor(65),0.65);
  assert.equal(volumeOpacityFactor(150),1);
  assert.equal(volumeOpacityFactor(-50),0);
  assert.equal(volumeOpacityFactor(NaN),1);
});
test("Confidence-adjusted inferred volume opacity reverses without cumulative loss",()=>{
  const collection=new Points();
  const colour=new Colour(0.6,0.1,0.2);
  const high=addVolumeDisplayPoint(collection,{color:colour,position:"a"},0.9,100);
  const low=addVolumeDisplayPoint(collection,{color:colour,position:"b"},0.25,100);
  assert.equal(high.color.alpha,0.9);
  assert.equal(low.color.alpha,0.25);
  assert.equal(setVolumeDisplayOpacity(collection,50),2);
  assert.equal(high.color.alpha,0.45);
  assert.equal(low.color.alpha,0.125);
  assert.equal(setVolumeDisplayOpacity(collection,0),2);
  assert.equal(high.color.alpha,0);
  assert.equal(low.color.alpha,0);
  assert.equal(setVolumeDisplayOpacity(collection,100),2);
  assert.equal(high.color.alpha,0.9);
  assert.equal(low.color.alpha,0.25);
  assert.deepEqual([high.color.red,high.color.green,high.color.blue],[0.6,0.1,0.2]);
  assert.deepEqual([low.color.red,low.color.green,low.color.blue],[0.6,0.1,0.2]);
});
test("Observed reflectivity footprint preserves original RGB even when transparent",()=>{
  const collection=new Points();
  const original=new Colour(1,0.45,0);
  const point=addVolumeDisplayPoint(collection,{color:original,position:"measured"},1,30);
  assert.equal(point.color.alpha,0.3);
  assert.equal(point.color.red,1);
  setVolumeDisplayOpacity(collection,0);
  setVolumeDisplayOpacity(collection,100);
  assert.deepEqual([point.color.red,point.color.green,point.color.blue,point.color.alpha],
    [1,0.45,0,1]);
  assert.equal(original.alpha,1,"Original BoM source colour is never mutated");
});
test("Empty and untracked collections remain safe; non-volume objects untouched",()=>{
  assert.equal(setVolumeDisplayOpacity(null,80),0);
  assert.equal(setVolumeDisplayOpacity(new Points(),50),0);
  const c=new Points(),alien=c.add({color:new Colour(0,0,0),position:"untracked"});
  assert.equal(setVolumeDisplayOpacity(c,10),0);
  assert.equal(alien.color.alpha,1);
});
test("Radar and inferred volume controls are separate; native Doppler is fixed 100%",()=>{
  const html=read("../live3d-operational-v9.html");
  const first=html.indexOf('id="radarOpacity"');
  const volume=html.indexOf('id="volumeOpacity"');
  assert.ok(first>=0&&first<volume,"Volume opacity follows radar transparency");
  assert.doesNotMatch(html,/id="dopplerOpacity"/,
    "Doppler-only no longer has a transparency slider");
  assert.match(html,/<output id="volumeOpacityValue"[^>]*>100%<\/output>/);
  assert.match(html,/<input id="volumeOpacity" type="range" min="0" max="100" step="5" value="100"/);
});
test("Slider updates only volume point collections without forcing radar reload",()=>{
  const script=read("../src/live3d-operational-v9.js");
  const start=script.indexOf('$("volumeOpacity").addEventListener("input"');
  const end=script.indexOf('$("dopplerOverlayRadar")',start);
  assert.ok(start>=0&&end>start);
  const listener=script.slice(start,end);
  assert.match(listener,/setVolumeDisplayOpacity\(inferredCollection,percent\)/);
  assert.match(listener,/setVolumeDisplayOpacity\(hybridTrackVolumeCollection,percent\)/);
  assert.doesNotMatch(listener,/renderInferredVolume|renderHybridTracks|loadHybridSequence|renderSurface|surfaceLayer\.alpha|dopplerOverlayTransition\.setOpacity/);
  assert.match(script,/addVolumeDisplayPoint\(inferredCollection/);
  assert.match(script,/addVolumeDisplayPoint\(hybridTrackVolumeCollection/);
  assert.match(script,/\},point\.alpha,volumePercent\)/);
  assert.match(script,/\},1,volumePercent\)/);
  assert.match(script,/\},supportStyle\.alpha,volumePercent\)/);
});
console.log(checks+" 3-D volume-opacity UI and scientific-intensity regression checks passed.");
