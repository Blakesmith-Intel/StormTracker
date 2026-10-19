import assert from "node:assert/strict";
import {normaliseCompassHeading,northArrowRotationDegrees,mountNorthCompass} from "../frontend/src/north-compass-v1.js";
assert.equal(normaliseCompassHeading(0),0);
assert.equal(normaliseCompassHeading(360),0);
assert.equal(normaliseCompassHeading(-15),345);
assert(Math.abs(northArrowRotationDegrees(Math.PI/2)+90)<1e-8);
assert(Math.abs(northArrowRotationDegrees(Math.PI)+180)<1e-8);
class E {
 constructor(tagName="div"){this.tagName=tagName;this.children=[];this.listeners=new Map();this.style={};this.title="";}
 append(...c){this.children.push(...c);}
 appendChild(c){this.children.push(c);}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,f){this.listeners.set(k,f);}
 removeEventListener(k){this.listeners.delete(k);}
 remove(){this.removed=true;}
 get outerHTML(){return "<"+this.tagName+">";}
}
const mapPanel=new E(),head=new E();
const documentRef={head,hidden:false,getElementById:()=>null,createElement:tag=>new E(tag)};
let handler=null;
const windowRef={setInterval(f){handler=f;return 1},clearInterval(){},addEventListener(){},removeEventListener(){}};
const state={longitude:153.41,latitude:-27.72,range:175000,pitch:-.48,heading:Math.PI/2};
const initial={...state};
const cameraController={getState:()=>({...state}),setView(patch){Object.assign(state,patch)}};
const compass=mountNorthCompass({cameraController,mapPanel,documentRef,windowRef});
assert.equal(mapPanel.children[0],compass.element);
assert.equal(compass.element.id,"stormTrackerNorthCompass");
const arrow=compass.element.children[0];
assert(arrow.style.transform.includes("-90"));
assert.equal(typeof handler,"function");
let prevented=false,stopped=false;
compass.element.listeners.get("click")({
 preventDefault(){prevented=true},stopPropagation(){stopped=true}
});
assert(prevented&&stopped);
assert.equal(state.heading,0);
for(const k of ["longitude","latitude","range","pitch"])assert.equal(state[k],initial[k]);
state.heading=Math.PI;handler();
assert(arrow.style.transform.includes("-180"));
compass.dispose();
assert(compass.element.removed);
console.log("NORTH_COMPASS_TRUE_NORTH_PRIMARY_RESET_TEST_PASS");