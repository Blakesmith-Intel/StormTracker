import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const root=new URL("../../",import.meta.url);
const build=readFileSync(new URL("scripts/build-current-site.sh",root),"utf8");
const css=readFileSync(new URL("frontend/src/four-section-menu-v1.css",root),"utf8");
const oldPath="scripts/apply-severe-weather-sidebar-v1.py --site _site";
const newPath="scripts/apply-four-section-menu-v1.py --site _site";
assert(build.includes(oldPath)&&build.includes(newPath),"Must build on existing sealed V10.2.34 menu");
assert(build.indexOf(oldPath)<build.indexOf(newPath));
assert(build.includes("four-operational-sections-20261030-v1"),"Must bust old browser caches");
assert(css.includes("#mapStyleDetails"),"Map Style needs original map toolbar styling");
assert(css.includes("grid-template-columns:38px minmax(0,1fr) auto 39px 42px"),
 "Mobile map toolbar must fit compact fifth control");
assert(css.includes(".operational-menu-section:not([open]) > :not(summary)"));
const check=String.raw`
import importlib.util,re
from pathlib import Path
src=Path('frontend/live3d-operational-v9.html').read_text()
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path)
 mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 return mod
v34=load('v34','scripts/apply-severe-weather-sidebar-v1.py')
v35=load('v35','scripts/apply-four-section-menu-v1.py')
qa=re.compile(r'    <div id="historicalCycloneMapStamp"[^\n]*\n    <section id="cycloneForecastQaPanel"[^\n]*\n.*?    </section>',re.S)
assert len(qa.findall(src))==1
live='''    <section id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts" hidden>
      <header><div><strong>Tropical cyclone forecasts</strong><small>CURRENT BoM PRODUCTS ONLY</small></div><button id="cycloneForecastQaClose" type="button">×</button></header>
    </section>'''
v34html=v34.reorganise(qa.sub(live,src,count=1))
html=v35.reorganise(v34html)
ids=['radarStormAnalysisDetails','severeWeatherDetails',
 'rainfallObservationsDetails','communityImpactsDetails']
assert all(html.count('id="'+id+'"')==1 for id in ids)
assert [html.index('id="'+id+'"') for id in ids]==sorted(
 html.index('id="'+id+'"') for id in ids)
assert '<details id="radarPlaybackDetails" class="card loop-controls" open>' in html
assert html.count('id="radarPlaybackDetails"')==1
assert html.count('id="mapStyleDetails"')==1
assert html.count('id="basemapSelect"')==1
assert html.index('id="nav"')<html.index('id="mapStyleDetails"')<html.index('id="resetButton"')
assert 'id="situationalAwarenessDetails"' not in html
parts={}
for i,key in enumerate(ids):
 start=html.index('id="'+key+'"')
 end=(html.index('id="'+ids[i+1]+'"') if i+1<len(ids)
      else html.index('</aside>'))
 parts[key]=html[start:end]
r=parts['radarStormAnalysisDetails']
s=parts['severeWeatherDetails']
rain=parts['rainfallObservationsDetails']
impacts=parts['communityImpactsDetails']
for control in ('loadHybridButton','radarOpacity','volumeOpacity','showTrackLabels',
 'openDetailsButton','trackDisplayFilter','showTrackThreatCone'):
 assert r.count('id="'+control+'"')==1,control
assert r.count('id="radarDisplayAppearanceDetails"')==1
assert r.index('id="status"')<r.index('id="radarDisplayAppearanceDetails"')
assert s.index('id="showOfficialBomWarnings"')<s.index('id="showRiverGauges"')<s.index('id="openCycloneForecastQa"')
assert 'id="floodGaugeLegendDetails"' in s
assert s.index('id="floodGaugeLegendDetails"')<s.index('id="riverGaugeSeverityLegend"')
for control in ('officialBomWarningProduct','locateOfficialBomWarnings',
 'refreshOfficialBomWarnings','openOfficialBomWarningGroups',
 'openFloodGaugeReport','refreshRiverGaugesButton','cycloneForecastQaPanel'):
 assert s.count('id="'+control+'"')==1,control
for control in ('showSignificantRainfall','significantRainfallPeriod',
 'refreshSignificantRainfallButton','significantRainfallStatus',
 'openRainfallTotalsReport','openRainfallAepReport'):
 assert rain.count('id="'+control+'"')==1,control
assert rain.index('id="significantRainfallStatus"')<rain.index('class="significant-rainfall-details"')
assert 'How unusual is it here?' in rain
assert '24hrs to 9am' in rain
for control in ('showFloodRoadClosures','showPowerOutages',
 'showQfdTechnicalRescues','qfdIncidentLegendDetails'):
 assert impacts.count('id="'+control+'"')==1,control
assert impacts.count('id="basemapSelect"')==0
assert impacts.count('id="significantRainfallPeriod"')==0
assert html.index('id="openPowerOutageExplorer"')<html.index('id="radarStormAnalysisDetails"')
assert html.index('id="openRoadLgaExplorer"')<html.index('id="radarStormAnalysisDetails"')
assert 'BoM Severe Weather and Thunderstorm Warnings' in s
assert 'CURRENT BoM PRODUCTS ONLY' in s
assert 'cycloneUseJasper' not in html
for id in ('radarStormAnalysisDetails','severeWeatherDetails',
 'rainfallObservationsDetails','communityImpactsDetails'):
 open_tag=re.search(r'<details[^>]*id="'+id+r'"[^>]*>',html)
 assert open_tag and not re.search(r'\sopen(?:\s|>)',open_tag.group()),id
try:v35.reorganise(html)
except RuntimeError:pass
else:raise AssertionError('Double application must be rejected')
print('PASS four collapsed operational sections, unchanged original control IDs, source statuses and reports, non-floating live cyclone, original basemap moved intact into nav, no archived QA')
`;
const p=spawnSync("python3",["-c",check],{cwd:root.pathname,encoding:"utf8"});
if(p.status!==0){console.error(p.stdout,p.stderr);throw Error("Approved four-section DOM regression failed")}
console.log(p.stdout.trim());
