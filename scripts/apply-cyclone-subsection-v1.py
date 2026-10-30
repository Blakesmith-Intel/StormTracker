#!/usr/bin/env python3
"""V10.2.36: cyclone inline UI polish only, without touching any issued data.

Runs AFTER V10.2.35's validated production assembly. Moves the ACTUAL live
checkbox/status nodes from the existing nested cyclone details to a visible
row in Severe Weather; retains source logic, listeners, IDs and optional
source-control panel. Only precise UI anchors are modified. Fail closed.
"""
from pathlib import Path
import argparse

STAMP='CYCLONE SUBSECTION INLINE PRIMARY CONTROLS V10.2.36 — UI ONLY'
HTML_OLD='<div class="layer-row cyclone-forecast-row"><button id="openCycloneForecastQa" type="button" aria-controls="cycloneForecastQaPanel" aria-expanded="false">🌀 Cyclones</button></div>'
HTML_NEW=(
    '<div class="layer-row cyclone-forecast-row" aria-label="Cyclones">'
    '<strong class="cyclone-subsection-heading">🌀 Cyclones</strong>'
    '<button id="openCycloneForecastQa" type="button" '
    'aria-controls="cycloneForecastQaPanel" aria-expanded="false">'
    'Details</button></div>\n'
    '<div id="cycloneCurrentOverview" class="cyclone-current-overview" '
    'role="group" aria-label="Current cyclone map controls">'
    '<p class="note">Live cyclone source not yet checked.</p></div>'
)
UI_OLD='''  panel.insertBefore(container,panel.querySelector(".cyclone-qld-cases")??null);'''
UI_NEW='''  panel.insertBefore(container,panel.querySelector(".cyclone-qld-cases")??null);
  // Presentation-only: show the SAME bound checkbox and source status directly
  // under Cyclones, like other map layers. Never create another data checkbox,
  // another source poller or a second "no-current" status.
  const currentOverview=documentRef.getElementById("cycloneCurrentOverview");
  if(currentOverview?.closest(".severe-weather-cyclones")===
       panel.closest(".severe-weather-cyclones") &&
     currentOverview?.closest(".severe-weather-cyclones")){
    currentOverview.replaceChildren(line,status);
  }'''
OP_OLD='''    if (enabled) close.focus?.();'''
OP_NEW='''    button.textContent = enabled ? "Hide details" : "Details";
    // Keep keyboard focus on the disclosure control, as with other sections.'''
OP_CLOSE_OLD='''  close.textContent = "×";'''
OP_CLOSE_NEW='''  close.textContent = "Close";'''
OP_LABEL_OLD='''  close.setAttribute("aria-label", "Close cyclone forecast panel");'''
OP_LABEL_NEW='''  close.setAttribute("aria-label", "Close cyclone details");'''
SOURCE_CLEANUP_OLD='''      mapStamp.remove();container.remove();}'''
SOURCE_CLEANUP_NEW='''      mapStamp.remove();container.remove();
      currentOverview?.replaceChildren();}'''

def replace_once(s:str,needle:str,replacement:str,description:str)->str:
    count=s.count(needle)
    if count!=1:raise RuntimeError(f"Unknown {description} production UI contract: {count}")
    return s.replace(needle,replacement,1)

def apply(site:Path,style:Path)->None:
    html_path=site/'live3d-operational-v9.html'
    internal_path=site/'src/internal-cyclone-live-qa-v1.js'
    panel_path=site/'src/operational-cyclone-panel-v1.js'
    for p in (html_path,internal_path,panel_path,style):
        if not p.is_file():raise RuntimeError(f"Missing current-issue-only production input: {p}")
    original=html_path.read_text(encoding='utf-8')
    internal=internal_path.read_text(encoding='utf-8')
    panel=panel_path.read_text(encoding='utf-8')
    if original.count('id="severeWeatherDetails"')!=1 or (
        original.count('id="communityImpactsDetails"')!=1 or
        original.count('id="cycloneForecastQaPanel"')!=1 or
        'CURRENT BoM PRODUCTS ONLY' not in original):
        raise RuntimeError("Refusing to modify non-current or pre-V10.2.35 cyclone UI")
    for forbidden in ('cycloneUseJasper','cycloneUseAlfred','cycloneGmlFile'):
        if forbidden in original or forbidden in internal or forbidden in panel:
            raise RuntimeError("Refusing to touch historical cyclone features")
    original=replace_once(original,HTML_OLD,HTML_NEW,"cyclone heading and expander")
    internal=replace_once(internal,UI_OLD,UI_NEW,"live checkbox/status mounting")
    internal=replace_once(internal,SOURCE_CLEANUP_OLD,SOURCE_CLEANUP_NEW,
                          "existing cyclone UI destroy cleanup")
    panel=replace_once(panel,OP_OLD,OP_NEW,"expander keyboard focus")
    panel=replace_once(panel,OP_CLOSE_OLD,OP_CLOSE_NEW,"details close action")
    panel=replace_once(panel,OP_LABEL_OLD,OP_LABEL_NEW,"close accessible name")
    if original.count('</head>')!=1:raise RuntimeError("Malformed cyclone production page head")
    original=original.replace('</head>',
        '<link rel="stylesheet" href="./src/cyclone-subsection-v1.css?v=20261030-cyclone-inline-v1036">\n</head>',1)
    critical=('openCycloneForecastQa','cycloneForecastQaPanel','cycloneCurrentOverview',
              'severeWeatherDetails','officialBomWarningsStatus','showRiverGauges',
              'rainfallObservationsDetails','communityImpactsDetails','mapStyleDetails')
    for ident in critical:
        if original.count('id="'+ident+'"')!=1:
            raise RuntimeError("Missing or duplicated production layer control "+ident)
    if original.count('id="internalCycloneLiveToggle"')!=0:
        # The actual input is dynamically assigned by ID exactly once by the
        # original live module, never duplicated as a static checkbox in HTML.
        raise RuntimeError("Unexpected duplicate HTML-only live cyclone checkbox")
    for ident in ('toggle.id="internalCycloneLiveToggle"',
                  'status.id="internalCycloneQaStatus"',
                  'reload.id="internalCycloneRefresh"',
                  'focus.id="internalCycloneFocus"',
                  'select.id="internalCycloneSelectedSystem"'):
        if internal.count(ident)!=1:
            raise RuntimeError("Issued-source current cyclone control contract changed "+ident)
    css=style.read_text(encoding="utf-8")
    if "#cycloneCurrentOverview" not in css or "#openCycloneForecastQa" not in css:
        raise RuntimeError("Missing cyclone-specific inline visual contract")
    (site/'src/cyclone-subsection-v1.css').write_text(css,encoding="utf-8")
    html_path.write_text(original,encoding='utf-8')
    internal_path.write_text(internal,encoding='utf-8')
    panel_path.write_text(panel,encoding='utf-8')
    with (site/'BUILD.txt').open('a',encoding='utf-8') as f:f.write(STAMP+'\n')

if __name__=='__main__':
    arg=argparse.ArgumentParser()
    arg.add_argument('--site',type=Path,required=True)
    arg.add_argument('--css-source',type=Path,required=True)
    args=arg.parse_args()
    apply(args.site,args.css_source)
