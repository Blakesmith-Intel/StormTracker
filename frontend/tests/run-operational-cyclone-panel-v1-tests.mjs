import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {createOperationalCyclonePanel} from "../src/operational-cyclone-panel-v1.js";

function element(id) {
  return {
    id,hidden:false,children:[],attrs:{},listeners:{},
    setAttribute(key,value){this.attrs[key]=value;},
    addEventListener(event,fn){this.listeners[event]=fn;},
    removeEventListener(event,fn){if(this.listeners[event]===fn)delete this.listeners[event];},
    replaceChildren(...children){this.children=children;},
    append(...children){this.children.push(...children);},
    appendChild(child){this.children.push(child);},
    remove(){this.removed=true;},
    focus(){this.focused=true;}
  };
}
const sidebarButton=element("openCycloneForecastQa");
const archived=element("cyclone-qld-cases");
const uploader=element("cycloneGmlFile");
const stamp=element("historicalCycloneMapStamp");
const panel=element("cycloneForecastQaPanel");
panel.children=[element("header-with-archive-title"),archived,uploader];
const all = new Map([sidebarButton,panel,stamp].map(v=>[v.id,v]));
const documentRef={
  getElementById(id){return all.get(id)??null;},
  createElement(tag){const e=element(tag);e.tag=tag;return e;}
};
const view=createOperationalCyclonePanel({documentRef});
assert.equal(stamp.removed,true,"Old observed/archived stamp must be removed");
assert.equal(panel.attrs["aria-label"],"Current BoM tropical cyclone forecasts");
assert.equal(panel.children.length,1,"All archived controls and GML importer are stripped");
assert.equal(panel.children[0].tag,"header");
assert.equal(panel.children[0].children[0].children[0].textContent,
  "Tropical cyclone forecasts");
assert.equal(panel.hidden,true);
assert.equal(sidebarButton.attrs["aria-expanded"],"false");
sidebarButton.listeners.click();
assert.equal(panel.hidden,false);
assert.equal(sidebarButton.attrs["aria-expanded"],"true");
const close=panel.children[0].children[1];
close.listeners.click();
assert.equal(panel.hidden,true);
view.open();
assert.equal(panel.hidden,false);
view.destroy();
assert.equal(panel.hidden,true);
assert.equal(sidebarButton.listeners.click,undefined);

const runtime=readFileSync(fileURLToPath(new URL("../src/live3d-operational-v9.js",import.meta.url)),"utf8");
assert.match(runtime,/if \(onCycloneQaPreview\)/);
assert.match(runtime,/else if \(onOperationalApp\)/);
assert.match(runtime,/createOperationalCyclonePanel\(\{documentRef:document\}\)/);
assert.match(runtime,/createHistoricalCycloneForecastQA/);
assert.match(runtime,/createInternalCycloneLiveQA/);
assert.match(runtime,/\/index\\.html/);
assert.match(runtime,/isWindHookQaPreview/);
assert.ok(runtime.includes('window.location.pathname.includes("/preview/wind-hook-v10-3/")'));
assert.match(runtime,/if \(!windHookResearchEnabled\) return/);
assert.match(runtime,/if \(!isWindHookQaPreview\) return/);
assert.match(runtime,/severeStormAlertOverlay\.setEnabled\(false\)/);
console.log("PASS production cyclone UI excludes historical Jasper/Alfred reference tools while preserving isolated QA and research-only wind pins.");
