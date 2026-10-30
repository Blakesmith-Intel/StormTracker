import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const base=new URL("../../",import.meta.url);
const build=readFileSync(new URL("scripts/build-current-site.sh",base),"utf8");
const css=readFileSync(new URL("frontend/src/severe-weather-sidebar-v1.css",base),"utf8");
assert(build.includes("situational-collapse-20261030-v1"),
 "New menu must load in existing mobile browser sessions");
assert(build.includes('id="situationalAwarenessDetails"'));
assert(css.includes("#situationalAwarenessDetails:not([open]) > :not(summary)"),
 "All child layer rows must be hidden in collapsed state");
assert(css.includes("#situationalAwarenessDetails[open] > summary"));
const test=String.raw`
import importlib.util,re
from pathlib import Path
src=Path('frontend/live3d-operational-v9.html').read_text()
spec=importlib.util.spec_from_file_location('menu','scripts/apply-severe-weather-sidebar-v1.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
qa=re.compile(r'    <div id="historicalCycloneMapStamp"[^\n]*\n    <section id="cycloneForecastQaPanel"[^\n]*\n.*?    </section>',re.S)
assert len(qa.findall(src))==1
live='''    <section id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts" hidden>
      <header><div><strong>Tropical cyclone forecasts</strong><small>CURRENT BoM PRODUCTS ONLY</small></div><button id="cycloneForecastQaClose" type="button">×</button></header>
    </section>'''
clean=qa.sub(live,src,count=1)
page=module.reorganise(clean)
assert page.count('id="severeWeatherDetails"')==1
assert page.count('id="situationalAwarenessDetails"')==1
opening='<details id="situationalAwarenessDetails" class="card layer-controls" aria-label="Situational Awareness Data">'
assert opening in page
assert '<summary class="section-title">◫ Situational Awareness Data</summary>' in page
assert page.count('</details>')>=3
a=page.index(opening)
b=page.index('    </details>\n  </aside>',a)
part=page[a:b]
severe=page[page.index('id="severeWeatherDetails"'):a]
assert not part.split('>')[0].endswith(' open')
assert page.index('id="severeWeatherDetails"')<a
for id in ('basemapSelect','showFloodRoadClosures','showPowerOutages',
 'showSignificantRainfall','significantRainfallPeriod','openRainfallTotalsReport',
 'openRainfallAepReport','qfdIncidentLegendDetails','showQfdTechnicalRescues'):
 assert part.count('id="'+id+'"')==1, id
for id in ('showRiverGauges','openFloodGaugeReport','showOfficialBomWarnings',
 'officialBomWarningProduct','cycloneForecastQaPanel'):
 assert severe.count('id="'+id+'"')==1,id
 assert part.count('id="'+id+'"')==0,id
for id in ('showFloodRoadClosures','showPowerOutages','showSignificantRainfall','showQfdTechnicalRescues'):
 assert 'id="'+id+'" type="checkbox"' in part, id
assert 'BoM Severe Weather and Thunderstorm Warnings' in severe
assert 'id="cycloneForecastQaPanel"' in severe
assert 'id="situationalAwarenessDetails"' not in severe
assert 'id="situationalAwarenessDetails"' not in clean
print('PASS unchanged original layer controls and current cyclone/warnings, two independent closed-by-default top-level native disclosures')
`;
const p=spawnSync("python3",["-c",test],{cwd:base.pathname,encoding:"utf8"});
if(p.status!==0){console.error(p.stdout,p.stderr);throw Error("Situational Awareness disclosure regression failed")}
console.log(p.stdout.trim());
