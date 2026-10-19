import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {NATIONAL_MOSAIC_PRIMARY,reflectivityWindowForRegion,
 buildBomReflectivityTileUrl} from "../frontend/src/bom-wmts-loop-v2.js";
import {matchingFtpTimes} from "../frontend/src/ftp-reflectivity-operational-v1.js";

assert.equal(NATIONAL_MOSAIC_PRIMARY,true);
for(const region of ["66","107","SEQ"]){
 const tile=reflectivityWindowForRegion(region);
 assert(tile.colStart>=0&&tile.rowStart>=0);
 assert(tile.colEnd>=tile.colStart&&tile.rowEnd>=tile.rowStart);
 assert(buildBomReflectivityTileUrl(tile.colStart,tile.rowStart,
  "2026-10-19T09:00:00Z").includes("atm_surf_air_precip_reflectivity_dbz"));
}
const timestamp="2026-10-19T09:00:00Z";
const manifest={
 siteGeoreference:{"107":{controlPoints:{center_longitude:143.14145}}},
 siteFrameHistory:{"107":[{observedUtc:timestamp,
 filename:"IDR1073.T.202610190900.png"}]}
};
const late=Date.parse(timestamp)+70*60000;
assert.throws(()=>matchingFtpTimes(manifest,"107",late),
 /No common fresh source-confirmed/,
 "Historic source must never be classified as currently live radar");
assert.deepEqual(matchingFtpTimes(manifest,"107",late,{includeHistory:true}),[timestamp],
 "Previously verified source timestamp must remain playable as history");
const moduleText=readFileSync("frontend/src/ftp-reflectivity-operational-v1.js","utf8");
assert(!moduleText.includes("ftp-live-manifest"));
assert(!moduleText.includes("ftp-live-frame"));
const source=readFileSync("frontend/src/bom-wmts-loop-v2.js","utf8");
assert(source.includes("validatedNationalTimes(now,region,publishedTimes,verifyNationalTile)"));
assert(source.includes("return loadFtpReflectivityMosaicAtTime(observedUtc,region)"));
assert(!source.includes("ftpPreferred()"));
console.log("NATIONAL_BOM_SOURCE_POLICY_AND_VERIFIED_HISTORICAL_REPLAY_PASS");
