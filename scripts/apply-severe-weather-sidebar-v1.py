#!/usr/bin/env python3
"""Move only approved operational sidebar controls into a Severe Weather disclosure.

Applied to the assembled production _site AFTER the current-only cyclone
sanitiser. Keeps every existing control ID and original runtime binding.
Refuse unknown document shapes instead of touching unrelated data layers.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re

WARNING_START='<div class="layer-row official-bom-warnings-row">'
BASEMAP_START='<div class="layer-row basemap-row">'
FLOOD_START='<div class="layer-row river-gauge-row">'
RAIN_START='<!-- SIG_RAIN_ROW_START -->'
CYCLONE_ROW='<div class="layer-row cyclone-forecast-row">'
LAYER_START='<section class="card layer-controls"><h2 class="section-title">◫ Layers</h2>'
CYCLONE_PANEL_PATTERN=re.compile(
    r'    <section id="cycloneForecastQaPanel"[^\n]*\n'
    r'.*?    </section>',re.S
)
NEW_TITLE='BoM Severe Weather and Thunderstorm Warnings'
RELEASE='20261030-severe-weather-sidebar-v1'

def only_slice(html:str,start:str,end:str,description:str)->tuple[str,str]:
    if html.count(start)!=1 or html.count(end)!=1:
        raise RuntimeError(f"Unknown {description} document shape: expected one anchor")
    a=html.index(start);b=html.index(end)
    if b<=a:
        raise RuntimeError(f"Unexpected {description} document order")
    return html[a:b],html[:a]+html[b:]

def reorganise(html:str)->str:
    if html.count(LAYER_START)!=1 or html.count('id="cycloneForecastQaPanel"')!=1:
        raise RuntimeError("Unknown sidebar or cyclone panel structure")
    if 'id="severeWeatherDetails"' in html:
        raise RuntimeError("Severe weather navigation has already been applied")
    # Production includes the CURRENT-only cyclone panel, stripped of QA
    # imports/fixtures; do not move a historical or archived QA panel.
    if 'CURRENT BoM PRODUCTS ONLY' not in html:
        raise RuntimeError("Cyclone panel is not the approved current-only production panel")
    matches=list(CYCLONE_PANEL_PATTERN.finditer(html))
    if len(matches)!=1:
        raise RuntimeError("Current cyclone panel must exist exactly once")
    cyclone_panel=matches[0].group(0)
    html=html[:matches[0].start()]+html[matches[0].end():]
    cyclone_row,html=only_slice(html,CYCLONE_ROW,WARNING_START,"cyclone control")
    warnings,html=only_slice(html,WARNING_START,BASEMAP_START,"BoM warning controls")
    flood,html=only_slice(html,FLOOD_START,RAIN_START,"flood gauge controls")
    if warnings.count('id="showOfficialBomWarnings"')!=1 or warnings.count('id="officialBomWarningProduct"')!=1:
        raise RuntimeError("BoM warning controls incomplete")
    if flood.count('id="showRiverGauges"')!=1 or flood.count('id="openFloodGaugeReport"')!=1:
        raise RuntimeError("Flood gauge controls incomplete")
    if cyclone_row.count('id="openCycloneForecastQa"')!=1:
        raise RuntimeError("Cyclone control incomplete")
    if cyclone_panel.count('id="cycloneForecastQaPanel"')!=1:
        raise RuntimeError("Cyclone inline content incomplete")
    if warnings.count(' BoM severe warnings</label>')!=1:
        raise RuntimeError("BoM warning label contract changed")
    warnings=warnings.replace(
        ' BoM severe warnings</label>',
        ' '+NEW_TITLE+'</label>',1)
    severe=(
        '    <details id="severeWeatherDetails" class="card severe-weather-controls" '
        'aria-label="Severe Weather">\n'
        '      <summary class="section-title">Severe Weather</summary>\n'
        '      <div class="severe-weather-content">\n'
        '        <div class="severe-weather-group severe-weather-flood" '
        'aria-label="Flood gauges">\n'+flood.rstrip()+'\n        </div>\n'
        '        <div class="severe-weather-group severe-weather-bom" '
        'aria-label="BoM Severe Weather and Thunderstorm Warnings">\n'
        +warnings.rstrip()+'\n        </div>\n'
        '        <div class="severe-weather-group severe-weather-cyclones" '
        'aria-label="Cyclones">\n'+cyclone_row.rstrip()+'\n'
        +cyclone_panel.strip()+'\n        </div>\n'
        '      </div>\n'
        '    </details>\n'
    )
    if html.count(LAYER_START)!=1:
        raise RuntimeError("Existing layer group changed during extraction")
    html=html.replace(LAYER_START,severe+
       '<section class="card layer-controls"><h2 class="section-title">'
       '◫ Situational Awareness Data</h2>',1)
    # Insert last-style override AFTER all previous CSS and ahead of app JS.
    css='<link rel="stylesheet" href="./src/severe-weather-sidebar-v1.css?v='+RELEASE+'">'
    if html.count('</head>')!=1:
        raise RuntimeError("Unexpected HTML document head")
    html=html.replace('</head>',f'  {css}\n</head>',1)
    for control_id in (
        "showRiverGauges","openFloodGaugeReport","refreshRiverGaugesButton",
        "riverGaugeSeverityLegend","showOfficialBomWarnings",
        "officialBomWarningProduct","openOfficialBomWarningGroups",
        "officialBomWarningsStatus","refreshOfficialBomWarnings",
        "openCycloneForecastQa","cycloneForecastQaPanel",
        "showSignificantRainfall","showPowerOutages","showFloodRoadClosures",
        "showQfdTechnicalRescues","basemapSelect",
    ):
        if html.count('id="'+control_id+'"')!=1:
            raise RuntimeError("Lost or duplicated existing control "+control_id)
    if html.count('id="severeWeatherDetails"')!=1:
        raise RuntimeError("Missing independent severe weather section")
    if html.count(NEW_TITLE)!=2:
        raise RuntimeError("Missing or duplicated renamed warning label")
    # Preserve the previously accepted no-historical-cyclone requirement.
    for forbidden in ("cycloneUseJasper","cycloneUseAlfred","cycloneGmlFile"):
        if forbidden in html:
            raise RuntimeError("Historical cyclone controls may not enter production")
    return html

def apply(site:Path,css_source:Path)->None:
    doc=site/"live3d-operational-v9.html"
    if not doc.is_file() or not css_source.is_file():
        raise RuntimeError("Production sidebar or CSS source missing")
    result=reorganise(doc.read_text(encoding="utf-8"))
    css=css_source.read_text(encoding="utf-8")
    if "#severeWeatherDetails" not in css or "#cycloneForecastQaPanel" not in css:
        raise RuntimeError("Inline cyclone/menu stylesheet does not contain required rules")
    (site/"src").mkdir(exist_ok=True,parents=True)
    (site/"src/severe-weather-sidebar-v1.css").write_text(css,encoding="utf-8")
    doc.write_text(result,encoding="utf-8")
    with (site/"BUILD.txt").open("a",encoding="utf-8") as f:
        f.write("SEVERE WEATHER SIDEBAR HIERARCHY 2026-10-30 V10.2.33 — UI ONLY\n")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--site",type=Path,required=True)
    p.add_argument("--css-source",type=Path,required=True)
    args=p.parse_args()
    apply(args.site,args.css_source)
