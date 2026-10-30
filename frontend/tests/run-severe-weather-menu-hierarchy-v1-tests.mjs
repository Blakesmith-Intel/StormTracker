import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const root=new URL("../../",import.meta.url);
const siteScript=readFileSync(new URL("scripts/apply-severe-weather-sidebar-v1.py",root),"utf8");
const build=readFileSync(new URL("scripts/build-current-site.sh",root),"utf8");
const css=readFileSync(new URL("frontend/src/severe-weather-sidebar-v1.css",root),"utf8");
assert(siteScript.includes("def reorganise(html:str)->str:"));
assert(build.includes("scripts/apply-severe-weather-sidebar-v1.py --site _site"));
assert(build.indexOf("scripts/apply-severe-weather-sidebar-v1.py")>
  build.indexOf("scripts/strip-production-cyclone-qa.py"),
  "Move cyclone panel only after historical QA is stripped");
assert(build.includes("v10.2.33-severe-weather")||
 build.includes("severe-weather-sidebar-20261030-v1"));
assert(css.includes("position:static!important"));
assert(css.includes("#severeWeatherDetails"));
assert(css.includes("#cycloneForecastQaPanel[hidden]"));
const verify=String.raw`
import importlib.util,re
from pathlib import Path
src=Path("frontend/live3d-operational-v9.html").read_text()
spec=importlib.util.spec_from_file_location("menu","scripts/apply-severe-weather-sidebar-v1.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
block=re.compile(r'    <div id="historicalCycloneMapStamp"[^\n]*\n    <section id="cycloneForecastQaPanel"[^\n]*\n.*?    </section>',re.S)
assert len(block.findall(src))==1, "Unexpected original cyclone QA structure"
live='''    <section id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts" hidden>
      <header><div><strong>Tropical cyclone forecasts</strong><small>CURRENT BoM PRODUCTS ONLY</small></div><button id="cycloneForecastQaClose" type="button">×</button></header>
    </section>'''
src=block.sub(live,src,count=1)
rearranged=module.reorganise(src)
assert rearranged.count('id="severeWeatherDetails"')==1
assert rearranged.count('class="card layer-controls"')==1
assert '◫ Situational Awareness Data' in rearranged
assert 'BoM Severe Weather and Thunderstorm Warnings' in rearranged
assert ' BoM severe warnings</label>' not in rearranged
assert rearranged.index('id="severeWeatherDetails"')<rearranged.index('class="card layer-controls"')
severe=rearranged[rearranged.index('id="severeWeatherDetails"'):rearranged.index('class="card layer-controls"')]
s=severe.index('id="showRiverGauges"')
w=severe.index('id="showOfficialBomWarnings"')
c=severe.index('id="openCycloneForecastQa"')
cp=severe.index('id="cycloneForecastQaPanel"')
assert 0<=s<w<c<cp
assert 'id="internalCycloneLiveToggle"' not in severe, "Live cyclone toggle is built by unchanged current-only runtime"
general=rearranged[rearranged.index('class="card layer-controls"'):rearranged.index("</aside>")]
for control in ('basemapSelect','showFloodRoadClosures','showPowerOutages','showSignificantRainfall','showQfdTechnicalRescues'):
 assert general.count('id="'+control+'"')==1,control
for control in ('showRiverGauges','refreshRiverGaugesButton','riverGaugeSeverityLegend',
 'showOfficialBomWarnings','officialBomWarningProduct','openCycloneForecastQa',
 'cycloneForecastQaPanel','showSignificantRainfall','showPowerOutages'):
 assert rearranged.count('id="'+control+'"')==1,control
assert 'CURRENT BoM PRODUCTS ONLY' in severe
assert 'cycloneUseJasper' not in rearranged
assert not rearranged.startswith('id="severeWeatherDetails"')
try: module.reorganise(rearranged)
except RuntimeError: pass
else: raise AssertionError("Double-restructuring must fail closed")
try: module.reorganise(src.replace('CURRENT BoM PRODUCTS ONLY','HISTORICAL FORECAST'))
except RuntimeError: pass
else: raise AssertionError("Historical/QA cyclone panel must not be copied to production")
print("PASS approved five-change sidebar order, no duplicated controls, inline real cyclone panel, baseline incident controls and fail-closed production-only application")
`;
const run=spawnSync("python3",["-c",verify],{cwd:new URL("../../",import.meta.url).pathname,encoding:"utf8"});
if(run.status!==0){
 console.error(run.stdout,run.stderr);
 throw new Error("Five-change sidebar structure regression failed");
}
console.log(run.stdout.trim());
