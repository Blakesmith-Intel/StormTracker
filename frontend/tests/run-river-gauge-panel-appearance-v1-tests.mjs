import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {riverGaugePanelAppearance} from
  "../src/context-layers/river-gauges-operational-v1.js";
import {createRiverGaugeMarkerImage} from
  "../src/context-layers/river-gauge-layer-v1.js";

for(const [state,label,colour] of [
  ["rapid-rise","RAPID RISE BELOW MINOR","#1269e8"],
  ["minor","BOM MINOR FLOOD","#2db76f"],
  ["moderate","BOM MODERATE FLOOD","#ffd43b"],
  ["major","BOM MAJOR FLOOD","#e53935"]
]){
  for(const rise of [false,true]){
    const a=riverGaugePanelAppearance({displayState:state,rapidRise:rise});
    const finalRise=rise||state==="rapid-rise";
    assert.equal(a.state,state);
    assert.equal(a.rapidRise,finalRise);
    assert.ok(a.category.includes(label));
    assert.equal(a.category.includes("· RAPID RISE"),state!=="rapid-rise"&&rise);
    assert.equal(a.image,createRiverGaugeMarkerImage(state,finalRise),
      "Map marker and gauge information panel MUST have identical SVG");
    const svg=decodeURIComponent(a.image);
    assert.ok(svg.includes('fill="'+colour+'"'));
    assert.equal(svg.includes('cx="61"'),finalRise,
      "Only qualifying rapid-rise behaviour shows a blue arrow badge");
  }
}
const css=readFileSync(fileURLToPath(
  new URL("../src/single-interface-v1.css",import.meta.url)),"utf8");
for(const expected of [
  '#riverGaugeInfo .river-gauge-key',
  '#riverGaugeInfo .river-gauge-key img',
  '[data-gauge-state="minor"] .map-info-kicker',
  '[data-gauge-state="moderate"] .map-info-kicker',
  '[data-gauge-state="major"] .map-info-kicker',
  '[data-rapid-rise="true"] .river-gauge-rise-value'
])assert.ok(css.includes(expected),expected);
const operational=readFileSync(fileURLToPath(new URL(
  "../src/context-layers/river-gauges-operational-v1.js",import.meta.url)),"utf8");
assert.match(operational,/icon\.src=appearance\.image/);
assert.match(operational,/pin\.replaceChildren\(icon\)/);
assert.match(operational,/panel\.dataset\.rapidRise=String\(appearance\.rapidRise\)/);
assert.match(operational,/summary\.tidalScreened/);
assert.match(operational,/Tidal influence · rate-only alerts excluded/);
assert.match(operational,/Measured rapid rise · screening indicator/);
console.log("PASS river gauge info panels share actual map pin SVG, original BoM green/yellow/red severity and single blue rapid-rise badge.");
