import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {QLD_DOPPLER_PRODUCTS} from "../src/qld-radar-sites-v1.js";
import {NSW_BORDER_DOPPLER_PRODUCTS,BORDER_RADAR_DOPPLER_PRODUCTS,
  NSW_BORDER_RADAR_SITES,primaryRadarDopplerSites} from "../src/border-radar-sites-v1.js";
import {DOPPLER_PRODUCTS,buildDopplerHistoryUrl,buildDopplerFrameUrl,
  buildDopplerRelayUrl} from "../src/bom-doppler-intake-v3.js";
import {BOM_DOPPLER_MAPS,dopplerMapCoordinateToLonLat} from "../src/bom-doppler-georef-v1.js";
import {parseBomRadarLoopFrames} from "../../relay/doppler-history-v1.js";

assert.deepEqual(NSW_BORDER_DOPPLER_PRODUCTS,{"93":"IDR93I"});
assert.deepEqual(BORDER_RADAR_DOPPLER_PRODUCTS["93"],"IDR93I");
assert.equal(Object.keys(BORDER_RADAR_DOPPLER_PRODUCTS).length,
  Object.keys(QLD_DOPPLER_PRODUCTS).length+1);
for(const id of ["53","28"]){
  assert.equal(BORDER_RADAR_DOPPLER_PRODUCTS[id],undefined);
  assert.equal(NSW_BORDER_RADAR_SITES[id].dopplerProduct,null);
  assert.deepEqual(primaryRadarDopplerSites(id),[]);
}
assert.deepEqual(primaryRadarDopplerSites("93"),["93"],
  "Brewarrina is a genuine Doppler-capable primary radar");
assert.equal(NSW_BORDER_RADAR_SITES["93"].dopplerIntegrated,true);
assert.equal(NSW_BORDER_RADAR_SITES["93"].displayGeorefBasis,
  "bom-site-centred-gnomonic-128km");
assert.equal(NSW_BORDER_RADAR_SITES["93"].analysisGeorefVerified,false,
  "Nominal wind overlay must NOT authorise unvalidated circulation measurements");
assert.equal(DOPPLER_PRODUCTS["93"],"IDR93I");
assert.equal(new URL(buildDopplerRelayUrl("93")).searchParams.get("product"),"IDR93I");
assert.equal(new URL(buildDopplerRelayUrl("93")).host,
  "stormtracker-bom-relay-nsw-preview.stormtracker-bom-relay.workers.dev");
assert.equal(new URL(buildDopplerRelayUrl("66")).host,
  "stormtracker-bom-relay.stormtracker-bom-relay.workers.dev",
  "Original Queensland Doppler must not change endpoint");
assert.equal(new URL(buildDopplerHistoryUrl("93")).searchParams.get("product"),"IDR93I");
const filename="IDR93I.T.202610121050.png";
const history=parseBomRadarLoopFrames(
  `<html><script>var imgs=["/radar/${filename}","/radar/IDR53I.T.202610121045.png"];</script></html>`,
  "IDR93I");
assert.equal(history.length,1);
assert.equal(history[0].filename,filename);
assert.equal(history[0].observedUtc,"2026-10-12T10:50:00.000Z");
assert.equal(new URL(buildDopplerFrameUrl("93",filename)).searchParams.get("file"),filename);
for(const invalid of ["IDR53I","IDR28I","IDR94I","IDR93A"]){
  assert.throws(()=>parseBomRadarLoopFrames("",invalid),/Unsupported Doppler product/);
}
assert.equal(BOM_DOPPLER_MAPS["93"].product,"IDR93I");
assert.equal(BOM_DOPPLER_MAPS["93"].nominalPanel,true);
assert.equal(BOM_DOPPLER_MAPS["93"].radialRangeKm,128);
assert.equal(BOM_DOPPLER_MAPS["93"].latitude,-29.96);
assert.equal(BOM_DOPPLER_MAPS["93"].longitude,146.81);
const midpoint=dopplerMapCoordinateToLonLat("93",256,256);
assert.ok(Math.abs(midpoint.latitude+29.96)<0.02);
assert.ok(Math.abs(midpoint.longitude-146.81)<0.02);
const relay=readFileSync(new URL("../../relay/worker.js",import.meta.url),"utf8");
assert.match(relay,/new Set\(Object.values\(BORDER_RADAR_DOPPLER_PRODUCTS\)\)/);
assert.match(relay,/ALLOWED_DOPPLER_PRODUCTS.has\(product\)/);
assert.match(relay,/Invalid Doppler history filename/);
assert.doesNotMatch(relay,/ALLOWED_DOPPLER_PRODUCTS = new Set\(\[\.\.\./);
console.log("Explicit IDR93I-only NSW Doppler contract and nominal geolocation tests passed.");
