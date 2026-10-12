import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  reflectivityLegendBands, rgbForInferredDbz, intensityHeightMultiplier,
  displayedVolumeAltitude, volumeBlobDiameterPx, VOLUME_BASE_VERTICAL_EXAGGERATION
} from "../src/volumetric-visual-v2.js";
import {BOM_REFLECTIVITY_RGB,REFLECTIVITY_CLASSES} from "../src/palette.js";

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
assert.ok(volumeBlobDiameterPx(3,65)>volumeBlobDiameterPx(3,40));
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
assert.match(html,/id="verticalScale"[\s\S]*?value="1"/);
assert.match(html,/id="blobVolume" checked/);
assert.match(html,/id="reflectivityLegend"/);
assert.doesNotMatch(html,/rainRateLegend|estimated mm\/h/i);
const live=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(live,/rgbForInferredDbz/);
assert.match(live,/displayedVolumeAltitude/);
assert.match(live,/new Cesium.BillboardCollection/);
assert.match(live,/addVolumeDisplayPoint\(hybridTrackFootprintCollection/);
assert.doesNotMatch(live,/rainfallLegendBands|rainRateLegend|native-rain-rate/i);
console.log("BoM 15-band dBZ colour contract, cloud volume display and neutral 1.0x defaults verified.");
