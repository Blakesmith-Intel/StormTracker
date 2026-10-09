import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { V10_ALERT_APPEARANCES, severeAlertAppearance } from "../src/severe-storm-alert-appearance-v10.js";
import { createSevereStormAlertOverlay } from "../src/severe-storm-alert-overlay-v1.js";

for(const [category, expected] of Object.entries({
  strong_radial_signature:{kind:"wind",hex:"#F6D94F",icon:"v10-gust.svg",title:"STRAIGHT-LINE WIND?"},
  hook_shape_only:{kind:"hook",hex:"#FF963F",icon:"v10-hook.svg",title:"HOOK ECHO?"},
  tornadic_candidate:{kind:"tornado",hex:"#D83045",icon:"v10-tornado.svg",title:"TORNADIC CIRCULATION?"}
})){
  const appearance=severeAlertAppearance({category});
  assert.equal(appearance.kind,expected.kind);
  assert.equal(appearance.color,expected.hex);
  assert.equal(appearance.icon,expected.icon);
  assert.equal(appearance.shortLabel,expected.title);
  assert.match(appearance.meaning,/not |no verified|not a confirmed|experimental/i);
  const svg=readFileSync(fileURLToPath(new URL("../assets/"+appearance.icon,import.meta.url)),"utf8");
  assert.match(svg,/<svg [^>]*viewBox="0 0 24 24"/);
  assert.match(svg,/<path /);
  assert.ok(!/script|onclick|foreignObject/i.test(svg),"Static SVGs contain no executable content");
}
assert.equal(Object.keys(V10_ALERT_APPEARANCES).length,3);
assert.equal(severeAlertAppearance({type:"wind"}).kind,"wind");
assert.equal(severeAlertAppearance({type:"hook"}).kind,"hook");
assert.equal(severeAlertAppearance({type:"hook",category:"tornadic_candidate"}).kind,"tornado");
assert.equal(severeAlertAppearance({category:"unrecognized"}).kind,"unknown");

const css=readFileSync(fileURLToPath(new URL("../src/operational-dashboard-v9-1.css",import.meta.url)),"utf8");
for(const c of ["wind","hook","tornado"]){
  assert.ok(css.includes(".storm-severe-alert-row.v10-"+c));
  assert.ok(css.includes(".storm-severe-alert-pin.v10-"+c));
  assert.ok(css.includes(".storm-severe-alert-detail.v10-"+c));
}
for(const color of ["#F6D94F","#FF963F","#D83045"])assert.ok(css.includes(color));

function fakeNode(tag){
  return {
    tag,style:{},children:[],handlers:{},hidden:false,dataset:{},textContent:"",
    setAttribute(key,value){this[key]=String(value);},
    append(...children){this.children.push(...children);},
    appendChild(child){this.children.push(child);},
    replaceChildren(...children){this.children=children;},
    addEventListener(event,handler){this.handlers[event]=handler;},
    remove(){this.removed=true;}
  };
}
const container=fakeNode("main");
container.clientWidth=400;container.clientHeight=400;
const scene={
  postRender:{addEventListener(){return ()=>{};}},
  globe:{ellipsoid:{}},camera:{positionWC:{}},requestRender(){}
};
const CesiumRef={
  Cartesian3:{fromDegrees(x,y){return {x,y};}},
  SceneTransforms:{worldToWindowCoordinates(_scene,p){return p;}},
  EllipsoidalOccluder:class{isPointVisible(){return true;}}
};
const focus=[];
const view=createSevereStormAlertOverlay({
  container,scene,CesiumRef,documentRef:{createElement:fakeNode},onFocus:a=>focus.push(a.category)
});
const sample=[
  {id:"wind",category:"strong_radial_signature",type:"wind",title:"Wind candidate",
   track_id:"ST1001",observed_utc:"2026-10-09T08:00:00Z",source_utc:"2026-10-09T08:00:00Z",
   longitude:120,latitude:180,radar_id:"66",velocity_kmh:64,sample_count:8,
   caveat:"Measured radial only, not surface gust."},
  {id:"hook",category:"hook_shape_only",type:"hook",title:"Hook candidate",
   track_id:"ST1002",observed_utc:"2026-10-09T08:00:00Z",
   longitude:160,latitude:180,arc_degrees:105,
   caveat:"Not measured rotation."},
  {id:"tornado",category:"tornadic_candidate",type:"hook",title:"Possible tornadic radar signature",
   track_id:"ST1003",observed_utc:"2026-10-09T08:00:00Z",
   longitude:200,latitude:180,arc_degrees:120,radial_shear_kmh:95,
   caveat:"Unconfirmed circulation; not a tornado warning."}
];
view.setFrame({alerts:sample,observedFrame:true,researchV10:true,
  experimentalHook:true,displayedUtc:sample[0].observed_utc,atNewestFrame:true});
assert.equal(view.alertCount,3);
const dock=container.children[0],pins=container.children[1];
for(let i=0;i<sample.length;i++){
  const appearance=severeAlertAppearance(sample[i]);
  const row=dock.children[1].children[i],pin=pins.children[i];
  assert.ok(row.className.includes("v10-"+appearance.kind));
  assert.ok(pin.className.includes("v10-"+appearance.kind));
  assert.ok(row.textContent.includes(appearance.shortLabel));
  assert.equal(row.children[0].src,"./assets/"+appearance.icon);
  assert.equal(pin.children[0].src,"./assets/"+appearance.icon);
  assert.equal(pin.children[0].alt,"");
  assert.equal(pin.children[0]["aria-hidden"],"true");
  assert.match(pin["aria-label"],/not a BoM warning/);
  pin.handlers.click();
  const detail=dock.children[3],heading=detail.children[0];
  assert.ok(detail.className.includes("v10-"+appearance.kind));
  assert.equal(heading.children[0].src,"./assets/"+appearance.icon);
  assert.ok(heading.textContent.startsWith(appearance.detailLabel));
  assert.equal(view.selectedAlertId,sample[i].id);
}
assert.deepEqual(focus,sample.map(x=>x.category));
view.setEnabled(false);
assert.equal(pins.hidden,true);
view.setEnabled(true);
assert.equal(pins.children.length,3);
view.destroy();
console.log("V10 severe alert icon, contrast token, semantic mapping, interactive pin and detail tests passed.");
