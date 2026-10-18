import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync}
  from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=resolve(fileURLToPath(new URL("../..",import.meta.url)));
const tmp=mkdtempSync(join(tmpdir(),"stormtracker-production-cyclone-"));
const dst=join(tmp,"site");
const filenames=["index.html","live3d-operational-v9.html",
  "src/live3d-operational-v9.js"];
try {
  for(const file of filenames){
    mkdirSync(resolve(dst,file,".."),{recursive:true});
    copyFileSync(join(ROOT,"frontend",file),join(dst,file));
  }
  mkdirSync(join(dst,"data","cyclone-history"),{recursive:true});
  writeFileSync(join(dst,"data","cyclone-history","jasper-2023.json"),"{}");
  for(const file of ["historical-cyclone-forecast-map-v1.js",
    "historical-cyclone-overlay-v1.js","historical-cyclone-replay-v1.js",
    "bom-historical-forecast-gml-v1.js"]){
    writeFileSync(join(dst,"src",file),"// QA only");
  }
  writeFileSync(join(dst,"BUILD.txt"),"SEALED V10.2.0 original production source\n");
  const script=join(ROOT,"scripts","strip-production-cyclone-qa.py");
  const panel=join(ROOT,"frontend","src","operational-cyclone-panel-v1.js");
  const result=spawnSync("python3",[script,"--site",dst,"--panel-source",panel],
    {encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const html=readFileSync(join(dst,"live3d-operational-v9.html"),"utf8");
  const js=readFileSync(join(dst,"src","live3d-operational-v9.js"),"utf8");
  const index=readFileSync(join(dst,"index.html"),"utf8");
  assert.match(html,/id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts"/);
  assert.match(html,/Tropical cyclone forecasts/);
  for(const forbidden of ["cycloneUseJasper","cycloneUseAlfred","cycloneGmlFile",
      "cyclone-qld-cases","historicalCycloneMapStamp","Reference case: Fina",
      "Historical BoM cyclone forecast"]){
    assert.ok(!html.includes(forbidden),"Production HTML still exposes "+forbidden);
  }
  assert.match(js,/createOperationalCyclonePanel/);
  assert.match(js,/createInternalCycloneLiveQA/);
  assert.match(js,/!window\.location\.pathname\.includes\("\/preview\/"\)/);
  assert.ok(!js.includes("createHistoricalCycloneForecastQA"));
  assert.match(index,/active-cyclones-prod-v1-20261018/);
  assert.match(html,/active-cyclones-prod-v1-20261018/);
  assert.ok(!existsSync(join(dst,"data","cyclone-history")));
  for(const file of ["historical-cyclone-forecast-map-v1.js",
    "historical-cyclone-overlay-v1.js","historical-cyclone-replay-v1.js",
    "bom-historical-forecast-gml-v1.js"]){
    assert.ok(!existsSync(join(dst,"src",file)),
      "Archived module was still deployed: "+file);
  }
  assert.ok(existsSync(join(dst,"src","operational-cyclone-panel-v1.js")));
  assert.match(readFileSync(join(dst,"BUILD.txt"),"utf8"),
    /PRODUCTION ACTIVE-ONLY CYCLONES 2026-10-18/);
  const syntax=spawnSync("node",["--check",join(dst,"src","live3d-operational-v9.js")],
    {encoding:"utf8"});
  assert.equal(syntax.status,0,syntax.stderr);
  // Unknown upstream layouts must fail before touching any output.
  const before=readFileSync(join(dst,"live3d-operational-v9.html"),"utf8");
  const rerun=spawnSync("python3",[script,"--site",dst,"--panel-source",panel],
    {encoding:"utf8"});
  assert.notEqual(rerun.status,0);
  assert.equal(readFileSync(join(dst,"live3d-operational-v9.html"),"utf8"),before);
  console.log("PASS current-only operational cyclone UI; no historical imports/fixtures; QA-independent packaging and source-locked safety");
} finally {
  rmSync(tmp,{recursive:true,force:true});
}
