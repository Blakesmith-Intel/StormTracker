#!/usr/bin/env python3
"""Presentation-only V10.2.35 transform of the already-accepted assembled site.

Run AFTER the immutable source build, live-only cyclone stripping and the
V10.2.34 Severe Weather/Situational Awareness transform. Move original DOM
controls, never clone controls or replace original listener IDs. Fail closed.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re

MARKER="FOUR-SECTION OPERATOR MENU V10.2.35 — UI ONLY"
RADAR='<details id="radarPlaybackDetails" class="card loop-controls">'
TRACK='<section class="card storm-controls"'
SEVERE='<details id="severeWeatherDetails"'
GENERAL='<details id="situationalAwarenessDetails"'
SIDEBAR_END='\n  </aside>'
GROUP_FLOOD='<div class="severe-weather-group severe-weather-flood"'
GROUP_WARNING='<div class="severe-weather-group severe-weather-bom"'
GROUP_CYCLONE='<div class="severe-weather-group severe-weather-cyclones"'

def move_fragment(html:str,start:str,end:str,name:str)->tuple[str,str]:
    if html.count(start)!=1 or html.count(end)!=1:
        raise RuntimeError(f"V10.2.35 cannot isolate {name}: invalid source markers")
    a=html.index(start);b=html.index(end)
    if b<=a:raise RuntimeError(f"V10.2.35 {name} in unexpected order")
    return html[a:b],html[:a]+html[b:]

def reorganise(html:str)->str:
    for unique in (RADAR,TRACK,SEVERE,GENERAL,'id="nav"',
                   'id="mapTools"','id="basemapSelect"','id="openPowerOutageExplorer"',
                   'id="openRoadLgaExplorer"'):
        if html.count(unique)!=1:
            raise RuntimeError(f"V10.2.35 changed baseline structure: {unique}")
    if 'id="radarStormAnalysisDetails"' in html:
        raise RuntimeError("V10.2.35 already applied")
    for forbidden in ('cycloneUseJasper','cycloneUseAlfred','cycloneGmlFile'):
        if forbidden in html:raise RuntimeError("Historical cyclone QA must be absent")

    radar,html=move_fragment(html,RADAR,TRACK,"radar playback")
    storm,html=move_fragment(html,TRACK,SEVERE,"storm tracking")
    severe,html=move_fragment(html,SEVERE,GENERAL,"severe weather")
    general,html=move_fragment(html,GENERAL,SIDEBAR_END,"situational awareness")

    # Keep the existing radar playback details element and original ID, but
    # leave it open within the NEW collapsible parent so essential controls
    # require only a single expansion. Never change its bound input controls.
    radar=radar.replace(RADAR,
        '<details id="radarPlaybackDetails" class="card loop-controls" open>',1)
    opacity=re.search(r'      <div class="opacity-controls"[^>]*>[\s\S]*?      </div>',radar)
    if not opacity or opacity.group().count('id="radarOpacity"')!=1 or (
        opacity.group().count('id="volumeOpacity"')!=1):
        raise RuntimeError("Original radar display opacity control unavailable")
    appearance=(
        '      <details id="radarDisplayAppearanceDetails" '
        'class="secondary-menu-details radar-appearance-details">\n'
        '        <summary>Display appearance</summary>\n'+
        opacity.group()+'\n      </details>'
    )
    radar=radar[:opacity.start()]+appearance+radar[opacity.end():]
    radar_group=(
        '    <details id="radarStormAnalysisDetails" class="card '
        'operational-menu-section" aria-label="Radar and Storm Analysis">\n'
        '      <summary class="section-title">Radar &amp; Storm Analysis</summary>\n'
        '      <div class="operational-menu-body">\n'
        '        <div class="operational-subtitle">Radar playback</div>\n'
        +radar.rstrip()+'\n'+storm.rstrip()+'\n'
        '      </div>\n'
        '    </details>\n'
    )
    if radar_group.count('id="radarPlaybackDetails"')!=1 or (
        radar_group.count('id="stormControlsHeading"')!=1):
        raise RuntimeError("Could not preserve radar and storm tracking")

    # Original severe-weather items are already source-verified and inline.
    # Reorder warning -> flood -> cyclone without changing their input IDs.
    a=severe.find(GROUP_FLOOD);b=severe.find(GROUP_WARNING)
    c=severe.find(GROUP_CYCLONE)
    if not(0<a<b<c):raise RuntimeError("Expected three current severe weather groups")
    flood=severe[a:b]
    warning=severe[b:c]
    cyclone=severe[c:]
    legend=flood.find('<div id="riverGaugeSeverityLegend"')
    tail=flood.rfind('        </div>')
    if legend<0 or tail<=legend or flood.count('id="riverGaugeSeverityLegend"')!=1:
        raise RuntimeError("Missing published flood icon legend")
    flood=flood[:legend]+(
        '<details id="floodGaugeLegendDetails" '
        'class="secondary-menu-details flood-legend-disclosure">\n'
        '  <summary>Flood gauge symbols &amp; severity</summary>\n'
        +flood[legend:tail].rstrip()+'\n</details>\n'
        +flood[tail:]
    )
    severe=severe[:a]+warning+flood+cyclone
    if severe.count('id="severeWeatherDetails"')!=1 or (
        severe.count('id="cycloneForecastQaPanel"')!=1):
        raise RuntimeError("Severe weather source panel lost")

    # Remove the existing basemap SELECT and its containing row intact.
    # Put the SAME node in a compact native Map style disclosure at the map
    # toolbar, preserving basemapManager's original listeners and stored choice.
    basemap=re.search(r'      <div class="layer-row basemap-row">[^\n]*</div>',general)
    if not basemap or basemap.group().count('id="basemapSelect"')!=1:
        raise RuntimeError("Original basemap selector could not be isolated")
    basemap_row=basemap.group()
    general=general[:basemap.start()]+general[basemap.end():]

    # Significant rainfall is now a top-level peer, not a subset of impacts.
    rain_start='<!-- SIG_RAIN_ROW_START -->'
    rain_end='<!-- SIG_RAIN_ROW_END -->'
    if general.count(rain_start)!=1 or general.count(rain_end)!=1:
        raise RuntimeError("Significant rainfall original boundaries changed")
    a=general.index(rain_start);b=general.index(rain_end)+len(rain_end)
    rainfall=general[a:b]
    general=general[:a]+general[b:]
    status=re.search(r'<div id="significantRainfallStatus"[^>]*>[^<]*</div>',rainfall)
    if not status:raise RuntimeError("Source status for rainfall cannot be preserved")
    source_status=status.group()
    rainfall=rainfall[:status.start()]+rainfall[status.end():]
    original_report='      <div class="significant-rainfall-report-actions"'
    if rainfall.count(original_report)!=1:
        raise RuntimeError("Rainfall report actions missing")
    rainfall=rainfall.replace(original_report,
        '      '+source_status+'\n'
        '      <div class="operational-subtitle">Rainfall reports &amp; AEP</div>\n'
        +original_report,1)
    rain_group=(
        '    <details id="rainfallObservationsDetails" class="card '
        'operational-menu-section" aria-label="Rainfall Observations">\n'
        '      <summary class="section-title">Rainfall Observations</summary>\n'
        '      <div class="operational-menu-body">\n'
        +rainfall.rstrip()+'\n'
        '      </div>\n'
        '    </details>\n'
    )
    # The existing AEP rarity / rainfall colour guide is already a native
    # nested disclosure. Its accepted source text and colours are untouched.
    if rain_group.count('id="significantRainfallStatus"')!=1 or (
        rain_group.count('id="openRainfallAepReport"')!=1):
        raise RuntimeError("Rainfall status / AEP reports not retained")

    # Existing road/outage/QFD controls stay as direct descendants of the
    # layer-controls wrapper to preserve the accepted legend selectors.
    original_general='<details id="situationalAwarenessDetails" class="card layer-controls" aria-label="Situational Awareness Data">'
    original_heading='<summary class="section-title">◫ Situational Awareness Data</summary>'
    if general.count(original_general)!=1 or general.count(original_heading)!=1:
        raise RuntimeError("Original Situational Awareness menu missing")
    general=general.replace(original_general,
        '<details id="communityImpactsDetails" class="card layer-controls '
        'operational-menu-section" aria-label="Community Impacts">',1)
    general=general.replace(original_heading,
        '<summary class="section-title">Community Impacts</summary>',1)
    if general.count('id="showFloodRoadClosures"')!=1 or (
        general.count('id="showPowerOutages"')!=1 or
        general.count('id="showQfdTechnicalRescues"')!=1 or
        general.count('id="qfdIncidentLegendDetails"')!=1):
        raise RuntimeError("Original community impact controls lost")
    if 'id="showSignificantRainfall"' in general or 'id="basemapSelect"' in general:
        raise RuntimeError("Rainfall or basemap still nested inside impacts")

    # Replace four sidebar cards at the identical original sidebar position,
    # preserving the incident shortcuts and map root outside their hierarchy.
    if html.count('    </nav>\n')!=1:
        raise RuntimeError("Missing sidebar incident-shortcut boundary")
    cards=radar_group+severe.rstrip()+'\n'+rain_group+general.rstrip()+'\n'
    html=html.replace('    </nav>\n','    </nav>\n'+cards,1)

    nav_insert='<button id="resetButton"'
    if html.count(nav_insert)!=1 or html.count('id="multiRadarSelectButton"')!=1:
        raise RuntimeError("Original map toolbar changed")
    map_style=(
        '<details id="mapStyleDetails" class="map-style-disclosure" '
        'aria-label="Map style"><summary title="Change Street or Satellite map" '
        'aria-label="Map style"><span class="map-style-label">Map style</span>'
        '<span class="map-style-mobile" aria-hidden="true">◫</span></summary>'
        '<div class="map-style-content">'+basemap_row+'</div></details>'
    )
    html=html.replace(nav_insert,map_style+nav_insert,1)

    # Never overwrite style rules of the accepted storm/data layers.
    link='<link rel="stylesheet" href="./src/four-section-menu-v1.css?v=20261030-four-sections-v1035">'
    if html.count('</head>')!=1:raise RuntimeError("Malformed document head")
    html=html.replace('</head>','  '+link+'\n</head>',1)

    # Source integrity: an input's ORIGINAL ID is a stable API. Assert each
    # moved node exists EXACTLY once; zero fake source / radar / cyclone layers.
    ids=(
        'radarPlaybackDetails','stormControlsHeading','loopDurationMinutes',
        'loadHybridButton','loadButton','hybridPlayButton','jumpLatestButton',
        'hybridFrameSlider','playbackSpeed','status','radarOpacity','volumeOpacity',
        'dualSourceTimes','showTrackLabels','openDetailsButton','trackDisplayFilter',
        'showTrackThreatCone','trackThreatConeStatus','trackLabelsScopeNote',
        'showRiverGauges','riverGaugeSeverityLegend','openFloodGaugeReport',
        'refreshRiverGaugesButton','showOfficialBomWarnings',
        'locateOfficialBomWarnings','refreshOfficialBomWarnings',
        'officialBomWarningProduct','openOfficialBomWarningGroups',
        'officialBomWarningsStatus','openCycloneForecastQa',
        'cycloneForecastQaPanel','showSignificantRainfall','significantRainfallPeriod',
        'refreshSignificantRainfallButton','significantRainfallStatus',
        'openRainfallTotalsReport','openRainfallAepReport',
        'showFloodRoadClosures','showPowerOutages','showQfdTechnicalRescues',
        'qfdIncidentLegendDetails','qfdSymbolLegend','basemapSelect',
        'radarSite','multiRadarSelectButton','resetButton','measureToggle',
        'openRoadLgaExplorer','openPowerOutageExplorer','operatorGuideLink'
    )
    for id in ids:
        if html.count('id="'+id+'"')!=1:
            raise RuntimeError("Duplicate or missing accepted control "+id)
    for section in ('radarStormAnalysisDetails','severeWeatherDetails',
                    'rainfallObservationsDetails','communityImpactsDetails'):
        if html.count('id="'+section+'"')!=1:
            raise RuntimeError("Missing new four-section main menu "+section)
    if 'id="situationalAwarenessDetails"' in html:
        raise RuntimeError("Old fifth menu heading remains")
    if not (html.index('id="radarStormAnalysisDetails"')<
            html.index('id="severeWeatherDetails"')<
            html.index('id="rainfallObservationsDetails"')<
            html.index('id="communityImpactsDetails"')<
            html.index('</aside>')):
        raise RuntimeError("Incorrect operator-approved menu ordering")
    if html.count('id="mapStyleDetails"')!=1 or (
        html.index('id="mapStyleDetails"')<html.index('id="nav"')):
        raise RuntimeError("Basemap is not in original map toolbar")
    return html

def apply(site:Path,css_source:Path)->None:
    page=site/'live3d-operational-v9.html'
    if not page.is_file() or not css_source.is_file():
        raise RuntimeError("Missing accepted production HTML or CSS")
    code=reorganise(page.read_text(encoding='utf-8'))
    css=css_source.read_text(encoding='utf-8')
    if '#radarStormAnalysisDetails' not in css or '#mapStyleDetails' not in css:
        raise RuntimeError("Missing four-section style contract")
    (site/'src').mkdir(exist_ok=True,parents=True)
    (site/'src/four-section-menu-v1.css').write_text(css,encoding='utf-8')
    page.write_text(code,encoding='utf-8')
    with (site/'BUILD.txt').open('a',encoding='utf-8') as f:
        f.write(MARKER+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    parser.add_argument('--css-source',type=Path,required=True)
    args=parser.parse_args()
    apply(args.site,args.css_source)
