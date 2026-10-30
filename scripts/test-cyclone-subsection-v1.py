#!/usr/bin/env python3
"""Regression: current-only cyclone UI, independent original source maps & warnings."""
import importlib.util
import re
import subprocess
import tempfile
from pathlib import Path

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

v34=load('v34','scripts/apply-severe-weather-sidebar-v1.py')
v35=load('v35','scripts/apply-four-section-menu-v1.py')
v36=load('v36','scripts/apply-cyclone-subsection-v1.py')
multi=load('multi','scripts/apply-cyclone-multi-systems-v1.py')
html=Path('frontend/live3d-operational-v9.html').read_text()
qa=re.compile(r'    <div id="historicalCycloneMapStamp"[^\n]*\n'
              r'    <section id="cycloneForecastQaPanel"[^\n]*\n.*?    </section>',re.S)
assert len(qa.findall(html))==1
live='''    <section id="cycloneForecastQaPanel" aria-label="Current BoM tropical cyclone forecasts" hidden>
      <header><div><strong>Tropical cyclone forecasts</strong><small>CURRENT BoM PRODUCTS ONLY</small></div><button id="cycloneForecastQaClose" type="button">×</button></header>
    </section>'''
html=v35.reorganise(v34.reorganise(qa.sub(live,html,count=1)))
source=Path('frontend/src/internal-cyclone-live-qa-v1.js').read_text()
panel=Path('frontend/src/operational-cyclone-panel-v1.js').read_text()
build=Path('scripts/build-current-site.sh').read_text()
assert build.index('apply-four-section-menu-v1.py')<build.index('apply-cyclone-subsection-v1.py')
assert build.index('apply-cyclone-subsection-v1.py')<build.index('apply-cyclone-multi-systems-v1.py')
with tempfile.TemporaryDirectory() as tmp:
    site=Path(tmp)
    (site/'src').mkdir()
    (site/'live3d-operational-v9.html').write_text(html)
    (site/'src/internal-cyclone-live-qa-v1.js').write_text(source)
    (site/'src/operational-cyclone-panel-v1.js').write_text(panel)
    (site/'BUILD.txt').write_text('TEST ONLY\n')
    v36.apply(site,Path('frontend/src/cyclone-subsection-v1.css'))
    multi.apply(site)
    document=(site/'live3d-operational-v9.html').read_text()
    runtime=(site/'src/internal-cyclone-live-qa-v1.js').read_text()
    oper=(site/'src/operational-cyclone-panel-v1.js').read_text()
    for control in ('cycloneCurrentOverview','openCycloneForecastQa',
                    'cycloneForecastQaPanel','severeWeatherDetails',
                    'communityImpactsDetails','rainfallObservationsDetails',
                    'radarStormAnalysisDetails'):
        assert document.count('id="'+control+'"')==1, control
    assert document.index('id="cycloneCurrentOverview"')<document.index('id="cycloneForecastQaPanel"')
    for snippet in ('toggle.id="internalCycloneLiveToggle"',
                    'systemCards.id="internalCycloneSystems"',
                    'card.dataset.systemId=s.systemId','visibleIds.add(s.systemId)',
                    'visibleIds.delete(s.systemId)','for(const s of displayed)',
                    'focusCycloneThroughController',
                    'not verified by this forecast source',
                    'Currently no tropical cyclone warnings',
                    'Unable to verify current tropical cyclone warnings',
                    '300000'):
        assert snippet in runtime,snippet
    assert 'cycloneUseJasper' not in runtime
    assert 'Close cyclone details' in oper
    for name in ('internal-cyclone-live-qa-v1.js','operational-cyclone-panel-v1.js'):
        subprocess.run(['node','--check',str(site/'src'/name)],check=True)
    try:multi.update(runtime)
    except RuntimeError:pass
    else:raise AssertionError('Cannot apply the multi-system transform twice')
print('PASS 4-section cyclone subsection, original control IDs, independently toggleable issued tracks, camera-safe per-system focus, honest warning links and no duplicated source polling')
