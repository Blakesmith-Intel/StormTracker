import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRiverGaugeMarkerImage} from "../src/context-layers/river-gauge-layer-v1.js";
const read=file=>readFileSync(new URL(file,import.meta.url),"utf8");
const html=read("../live3d-operational-v9.html");
const css=read("../src/single-interface-v1.css");
const controller=read("../src/context-layers/river-gauges-operational-v1.js");
const builder=read("../../scripts/build-current-site.sh");
const section=html.slice(html.indexOf('<div id="riverGaugeSeverityLegend"'),
 html.indexOf("<!-- SIG_RAIN_ROW_START -->"));
assert(section.includes('class="flood-legend-grid"'));
assert.equal((section.match(/data-flood-legend-state=/g)??[]).length,6);
for(const state of ["rapid-rise","crossing","minor","moderate","major"]){
 assert(section.includes('data-flood-legend-state="'+state+'"'),
  "Missing legend entry for actual gauge map marker: "+state);
 assert(decodeURIComponent(createRiverGaugeMarkerImage(state,false))
   .includes("http://www.w3.org/2000/svg"));
}
const bridgeSvg=decodeURIComponent(createRiverGaugeMarkerImage("crossing",false));
assert(bridgeSvg.includes('fill="#f5a21b"'));
assert(bridgeSvg.includes("Bridge deck and supports"));
assert(bridgeSvg.includes('stroke="#1269e8"'));
assert(!bridgeSvg.includes('cx="61"'));
const risingBridge=decodeURIComponent(createRiverGaugeMarkerImage("crossing",true));
assert(risingBridge.includes('cx="61"'));
assert(section.includes('data-flood-legend-rapid-rise="true"'));
assert.match(section,/road status unconfirmed/i);
assert.match(section,/Blue ↑ badge/);
assert.match(section,/Minor flooding/);
assert.match(section,/Moderate flooding/);
assert.match(section,/Major flooding/);
assert.match(controller,/icon\.src=createRiverGaugeMarkerImage\(state,rapid\)/,
 "Legend should never use inaccurate lookalike symbols");
assert.match(css,/\.flood-legend-grid[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(builder,/new_legend=operator_html\[legend_start:legend_end\]\.strip\(\)/,
 "Production build must ship the maintenance icon legend, not the old dots");
assert.match(builder,/flood-legend-grid' in html/);
assert(!section.includes('🌉'),"Don't use font-dependent bridge emojis");
console.log("PASS clearer production flood gauge legend: actual amber bridge/water SVG, blue rise badge, all original severity markers, compact responsive 2-column layout and published HTML contract.");
