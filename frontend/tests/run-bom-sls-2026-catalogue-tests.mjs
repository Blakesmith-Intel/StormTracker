import assert from "node:assert/strict";
import {parseMay2026ServiceLevelSpecification,validateMay2026Catalog}
  from "../../scripts/reconcile-bom-sls-2026.mjs";
const source=[
"Schedule 3: Information locations with flood class levels defined",
"540610 HINZE DAM HW Seqwater Automatic 98.1 100.7 102.3 Medium",
"540057 KALBAR WEIR TW Seqwater Automatic 76.2 77.7 79.2 Medium",
"539066 JONES WEIR HW DLGWV Automatic 111.5 115 121 Medium",
"540646 OXLEY CREEK Logan City Council Automatic 41.5 42 42.5 Medium",
"540097 NEW BEITH Brisbane City Council Automatic 4 5 6 Medium",
"535142 TARANA CROSSING Banana Shire Council Automatic 6 9 12 Medium",
"539086 AWOONGA DAM HW Gladstone Area Water Board Automatic 40.3 N/A N/A Medium",
"533207 SOUTH MACKAY (ELAMANG ST) Mackay Regional Council Automatic 1.1 1.2 Medium",
"531039 FLAGGY CREEK Cairns Regional Council Automatic 4.5 6 Medium",
"531027 FLAGGY CREEK DLGWV Automatic 4.5 6 Medium",
String.fromCharCode(12),
"Schedule 2: Forecast locations and levels of service",
"540149 GLENORE GROVE Bureau/Seqwater Automatic 8 11 13 TBC TBC TBC TBC TBC",
"040846 CLEARVIEW Bureau/Gold Coast City",
" Council Automatic 6 8 9 Quantitative 6 hours > 6.0 +/- 0.3m High",
String.fromCharCode(12),
"Schedule 4: River data locations",
"540000 SOME DATA-ONLY STATION Bureau Automatic River High"
].join(String.fromCharCode(10));
const result=parseMay2026ServiceLevelSpecification(source);
assert.equal(result.stations["bom:540610"].major,102.3);
assert.equal(result.stations["bom:539066"].major,121);
assert.equal(result.stations["bom:040846"].minor,6);
assert.equal(result.stations["bom:539086"].moderate,null);
assert.deepEqual(["minor","moderate","major"].map(k=>result.stations["bom:533207"][k]),
  [null,1.1,1.2]);
assert.deepEqual(["minor","moderate","major"].map(k=>result.stations["bom:531039"][k]),
  [4.5,null,6]);
assert.deepEqual(["minor","moderate","major"].map(k=>result.stations["bom:531027"][k]),
  [4.5,null,6]);
assert.equal(result.stations["bom:540149"].major,13);
assert.equal(result.stations["bom:540097"].nameHint.includes("NEW BEITH"),true);
assert.ok(result.dataLocations.includes("bom:540000"));
assert.equal(result.stations["bom:540000"],undefined);
assert.equal(result.duplicates.length,0);
validateMay2026Catalog(result,{strict:false});
const contradictory=source.replace(
  "535142 TARANA CROSSING Banana Shire Council Automatic 6 9 12 Medium",
  "540610 HINZE DAM HW Seqwater Automatic 1 2 3 Medium"+
  String.fromCharCode(10)+
  "535142 TARANA CROSSING Banana Shire Council Automatic 6 9 12 Medium");
const mixed=parseMay2026ServiceLevelSpecification(contradictory);
assert.equal(mixed.stations["bom:540610"],undefined);
assert.equal(mixed.duplicates.length,1);
console.log("PASS SLS 2026 classification by exact station ID, schedule isolation, head/tailwater, AHD-height thresholds, identity safeguards, duplicate rejection.");