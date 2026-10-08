import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createSevereStormAlertOverlay } from "../src/severe-storm-alert-overlay-v1.js";

function element(tag) {
  return {
    tag, style: {}, attributes: {}, children: [], handlers: {},
    hidden: false, textContent: "", dataset: {},
    setAttribute(k,v) { this.attributes[k]=v; },
    addEventListener(kind,handler) { this.handlers[kind]=handler; },
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children=nodes; },
    remove() { this.removed=true; }
  };
}
const documentRef={createElement:element};
const container=element("map");
container.clientWidth=400;
container.clientHeight=400;
let postRender=null, listenerRemoved=false, renders=0;
const scene={
  postRender:{addEventListener(fn){postRender=fn;return ()=>{listenerRemoved=true;postRender=null;};}},
  globe:{ellipsoid:{}},camera:{positionWC:{}},
  requestRender(){renders++;}
};
const CesiumRef={
  Cartesian3:{fromDegrees(longitude,latitude,height){return {x:longitude,y:latitude,height};}},
  SceneTransforms:{worldToWindowCoordinates(_scene,position){return {x:position.x,y:position.y};}},
  EllipsoidalOccluder:class{isPointVisible(){return true;}}
};
const focused=[];
const overlay=createSevereStormAlertOverlay({
  scene,CesiumRef,container,documentRef,onFocus:alert=>focused.push(alert.track_id)
});
assert.equal(typeof postRender,"function");
assert.equal(container.children.length,2);
const dock=container.children[0],pins=container.children[1];
assert.equal(dock.attributes["aria-label"],"Radar evidence alerts");
assert.match(dock.children[2].textContent,/Load an observed storm loop/);

const example={
  id:"wind:66:ST0042", type:"wind", track_id:"ST0042",
  title:"High Doppler radial velocity",
  observed_utc:"2026-10-08T04:00:00Z",
  source_utc:"2026-10-08T04:00:00Z",
  longitude:120, latitude:160,
  radar_id:"66",velocity_kmh:-90,sample_count:4,
  caveat:"Radar radial velocity, NOT a measured surface gust or an official BoM warning."
};
overlay.setFrame({
  alerts:[example],observedFrame:true,windSupported:true,
  displayedUtc:example.observed_utc,atNewestFrame:false
});
assert.equal(overlay.alertCount,1);
assert.equal(pins.children.length,1);
assert.equal(pins.children[0].hidden,false);
assert.equal(pins.children[0].style.left,"120px");
assert.equal(pins.children[0].style.top,"160px");
assert.match(dock.children[2].textContent,/HISTORICAL/);
assert.match(dock.children[1].children[0].textContent,/90 km\/h radial/);
pins.children[0].handlers.click();
assert.deepEqual(focused,["ST0042"]);
assert.equal(overlay.selectedAlertId,example.id);
assert.equal(dock.children[3].hidden,false);
const sourceLink=dock.children[3].children.find(item=>item.tag==="a");
assert.equal(sourceLink.href,"https://www.bom.gov.au/australia/radar/");
assert.equal(sourceLink.rel,"noopener noreferrer");

overlay.setEnabled(false);
assert.equal(dock.hidden,true);
assert.equal(pins.hidden,true);
overlay.setEnabled(true);
assert.equal(dock.hidden,false);
assert.equal(pins.children.length,1, "current paused frame restored immediately");
postRender();
assert.equal(pins.children[0].hidden,false);

overlay.setFrame({alerts:[example],observedFrame:true,
  windSupported:false,displayedUtc:"2020-01-01T00:00:00Z",
  atNewestFrame:true, experimentalHook:true});
assert.match(dock.children[2].textContent,/STALE/);
assert.match(dock.children[2].textContent,/unsupported by current/);
assert.match(dock.children[2].children[1].textContent,/experimental/i);
overlay.setFrame();
assert.equal(overlay.alertCount,0);
assert.equal(pins.children.length,0);
assert.equal(dock.children[3].hidden,true);
overlay.destroy();
assert.equal(listenerRemoved,true);
assert.equal(dock.removed,true);
assert.equal(pins.removed,true);
assert.ok(renders>=5);

const src=name=>readFileSync(fileURLToPath(new URL(name,import.meta.url)),"utf8");
const controller=src("../src/live3d-operational-v9.js");
const html=src("../live3d-operational-v9.html");
assert.match(controller,/syncSevereStormAlerts\(hybridFrameIndex\)/);
assert.match(controller,/severeStormAlertOverlay\.setEnabled\(event\.target\.checked\)/);
assert.match(controller,/stormTrackLabelOverlay\.setVisible\(Boolean\(\$\("showTrackLabels"\)\?\.checked\)\)/);
assert.match(html,/id="showSevereRadarAlerts" type="checkbox" disabled/);
assert.match(html,/storm-severe-layer-row" hidden style="display:none"/);
assert.match(controller,/severeStormAlertOverlay\.setEnabled\(false\)/);
assert.match(html,/id="showExperimentalHookAlerts" type="checkbox"/);
console.log("Severe storm map alert dock interaction tests passed.");