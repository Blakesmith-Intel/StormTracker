import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  reflectivityLegendBands, rgbForInferredDbz, intensityHeightMultiplier,
  displayedVolumeAltitude, volumeBlobDiameterPx, VOLUME_BASE_VERTICAL_EXAGGERATION
} from "../src/volumetric-visual-v2.js";
import {BOM_REFLECTIVITY_RGB,REFLECTIVITY_CLASSES} from "../src/palette.js";
import { inferColumn } from "../src/inferred-volume-v1.js";

const bands=reflectivityLegendBands();
assert.equal(bands.length,15,"all 15 BoM reflectivity bands must be shown");
for(let i=0;i<15;i++){
  const source=BOM_REFLECTIVITY_RGB[i];
  const hex="#"+source.rgb.map(n=>n.toString(16).padStart(2,"0")).join("");
  assert.equal(bands[i].color,hex,"legend must use original BoM colours");
  assert.equal(bands[i].category,i+1);
  assert.ok(bands[i].dbzLabel.endsWith("dBZ"));
  assert.deepEqual(rgbForInferredDbz(REFLECTIVITY_CLASSES[i+1][0]),source.rgb);
}
assert.equal(bands[6].dbzLabel,"40–43 dBZ");
assert.equal(bands[14].dbzLabel,"64+ dBZ");
assert.deepEqual(rgbForInferredDbz(40),[0,102,102]);
assert.deepEqual(rgbForInferredDbz(43),[255,255,0]);
assert.deepEqual(rgbForInferredDbz(55),[255,0,0]);
assert.deepEqual(rgbForInferredDbz(64),[40,0,0]);
assert.deepEqual(rgbForInferredDbz(65),[40,0,0]);
assert.equal(rgbForInferredDbz(Number.NaN),null);
assert.equal(VOLUME_BASE_VERTICAL_EXAGGERATION,1);
assert.equal(intensityHeightMultiplier(40),1);
assert.equal(intensityHeightMultiplier(65),1.4);
assert.ok(intensityHeightMultiplier(60)>intensityHeightMultiplier(50));
assert.ok(intensityHeightMultiplier(50)>intensityHeightMultiplier(40));
assert.equal(displayedVolumeAltitude(5000,40,1),5000);
assert.equal(displayedVolumeAltitude(5000,65,1),7000);
// The actual calibrated inference yields short weaker pixel columns while
// strong pixels support much taller display, all WITHOUT default 1.5x scale.
const model=JSON.parse(readFileSync(new URL("../3d-models/inferred_vertical_profile_model_v2.json",import.meta.url),"utf8"));
function maxDisplayedTop(dbz){
  const samples=inferColumn(model,dbz,{occupancyThreshold:0.35,minimumOutputDbz:20})
    .filter(p=>p.dbzh>=40);
  assert.ok(samples.length>0);
  return Math.max(...samples.map(p=>displayedVolumeAltitude(p.altitude_m_amsl,dbz,1)));
}
const weakTop=maxDisplayedTop(41.5),strongTop=maxDisplayedTop(59.5);
assert.ok(strongTop>weakTop*3,"Per-pixel dBZ must support visibly shorter weak columns");
assert.ok(volumeBlobDiameterPx(3,65)>volumeBlobDiameterPx(3,40));
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
assert.match(html,/id="verticalScale"[\s\S]*?value="1"/);
assert.doesNotMatch(html,/id="blobVolume"/);
assert.match(readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8"),/function useBlobVolume\(\)\{ return true; \}/);
assert.match(html,/id="reflectivityLegend"/);
assert.doesNotMatch(html,/rainRateLegend|estimated mm\/h/i);
const live=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(live,/rgbForInferredDbz/);
assert.match(live,/displayedVolumeAltitude/);
assert.match(live,/new Cesium.BillboardCollection/);
assert.match(live,/addVolumeDisplayPoint\(hybridTrackFootprintCollection/);
assert.match(live,/point.source_low_level_dbzh \?\? point.dbzh/,"Track volume must use per-pixel dBZ");
assert.doesNotMatch(live,/displayedVolumeAltitude\(point.altitude_m_amsl,\s*Number\(observation.maximum_dbzh_lower_bound\)/);
const measured=readFileSync(new URL("../src/measured-track-volume-v1.js",import.meta.url),"utf8");
assert.match(measured,/source_low_level_dbzh: inputDbz/,"Measured intensity metadata must accompany each column");
assert.doesNotMatch(live,/rainfallLegendBands|rainRateLegend|native-rain-rate/i);
console.log("BoM 15-band dBZ colour contract, cloud volume display and neutral 1.0x defaults verified.");
