#!/usr/bin/env python3
"""Add separate original track controls for EACH verified live cyclone.

The previous renderer displayed only the selected system even though the
strict BoM source contract already supports several current systems. Reuse
that validator unchanged, and add per-system independent map visibility,
focus and unambiguous links to separate BoM warning products. Never infer a
warning from a track or claim its current status without warning-bulletin data.
"""
from pathlib import Path
import argparse

STAMP='MULTI CYCLONE ORIGINAL TRACKS AND SEPARATE WARNING LINKS V10.2.36'
def once(src,old,new,what):
    n=src.count(old)
    if n!=1:raise RuntimeError(f'Unexpected {what} original source contract: {n}')
    return src.replace(old,new,1)

def update(code):
    code=once(code,
        '  container.appendChild(sourceRow);',
        '''  container.appendChild(sourceRow);
  const systemCards=el("div");
  systemCards.id="internalCycloneSystems";
  systemCards.setAttribute("aria-label","Current source-verified cyclone systems");
  container.insertBefore(systemCards,sourceRow);''',
        'multi-cyclone cards location')
    code=once(code,
        '  let storms=[],activeId=null, controller=null, timer=null, sequence=0, destroyed=false;',
        '''  let storms=[],activeId=null, controller=null, timer=null, sequence=0, destroyed=false;
  let visibleIds=new Set(),previousIds=new Set();''',
        'per-system track state')
    code=once(code,
        '''    storms=[];activeId=null;select.replaceChildren();select.disabled=true;
    focus.disabled=true;clearEntities();''',
        '''    storms=[];activeId=null;select.replaceChildren();select.disabled=true;
    visibleIds.clear();previousIds.clear();systemCards.replaceChildren();
    focus.disabled=true;clearEntities();''',
        'expiring all source forecasts clears independent cards')
    code=once(code,
        '''    const s=currentStorm();
    if(!s)return;
    if(Date.parse(s.expiresUtc)<=now().getTime()){
      clear();status.textContent="Issued cyclone map has expired. Refreshing or unavailable.";
      return;
    }
    const provenance="ORIGINAL BoM cyclone forecast · ISSUED SOURCE · "+
      s.productId+" · issued "+fmt(s.issueUtc)+" · expiry "+fmt(s.expiresUtc);
    for(const f of s.features){''',
        '''    const displayed=storms.filter(s=>visibleIds.has(s.systemId)&&
      Date.parse(s.expiresUtc)>now().getTime());
    if(!displayed.length){
      focus.disabled=!currentStorm();
      if(storms.some(s=>visibleIds.has(s.systemId)&&
        Date.parse(s.expiresUtc)<=now().getTime()))
        status.textContent="An original cyclone forecast has expired. Refresh source; do not assume no warnings.";
      return;
    }
    for(const s of displayed){
    const provenance="ORIGINAL BoM cyclone forecast · ISSUED SOURCE · "+
      s.productId+" · issued "+fmt(s.issueUtc)+" · expiry "+fmt(s.expiresUtc);
    for(const f of s.features){''',
        'draw independent source-confirmed cyclone forecasts concurrently')
    code=once(code,
        '''    mapStamp.textContent="BoM ISSUED FORECAST · "+s.cycloneName+
      " · issued "+fmt(s.issueUtc)+" · NOT a standalone official warning";''',
        '''    }
    mapStamp.textContent="BoM ISSUED FORECASTS · "+displayed.length+
      " of "+storms.length+" cyclone systems shown · NOT standalone official warnings";''',
        'track-map issued sources remain distinct from official cyclone warning bulletins')
    code=once(code,
        '''  function options(){
    select.replaceChildren();''',
        '''  function renderCycloneCards(){
    systemCards.replaceChildren();
    for(const s of storms){
      const card=el("section");
      card.className="cyclone-system-card";
      card.dataset.systemId=s.systemId;
      const name=el("strong",s.cycloneName);
      const source=el("small",s.productId+" · issued "+fmt(s.issueUtc)+
        " · expires "+fmt(s.expiresUtc));
      const mapLabel=el("label");
      const mapSwitch=el("input");
      mapSwitch.type="checkbox";
      mapSwitch.checked=visibleIds.has(s.systemId);
      mapSwitch.setAttribute("aria-label","Show track for "+s.cycloneName);
      mapLabel.append(mapSwitch,documentRef.createTextNode("Show issued track"));
      mapSwitch.addEventListener("change",()=>{
        if(mapSwitch.checked)visibleIds.add(s.systemId);
        else visibleIds.delete(s.systemId);
        draw();
      });
      const focusOne=el("button","Focus "+s.cycloneName);
      focusOne.type="button";
      focusOne.addEventListener("click",()=>focusStorm(s));
      const notice=el("p","Warnings for "+s.cycloneName+
        ": separately issued BoM bulletins, not verified by this forecast source.");
      notice.className="cyclone-warning-provenance";
      const warningLink=el("a","Check official BoM cyclone warnings");
      warningLink.href="https://www.bom.gov.au/weather-and-climate/"+
        "specialised-forecasts-and-observations/tropical-cyclone";
      warningLink.target="_blank";
      warningLink.rel="noopener noreferrer";
      card.append(name,source,mapLabel,focusOne,notice,warningLink);
      systemCards.appendChild(card);
    }
  }
  function options(){
    const previouslyVisible=new Set(visibleIds);
    const previouslyKnown=new Set(previousIds);
    visibleIds=new Set(storms.filter(s=>
      !previouslyKnown.has(s.systemId)||previouslyVisible.has(s.systemId)
    ).map(s=>s.systemId));
    previousIds=new Set(storms.map(s=>s.systemId));
    select.replaceChildren();''',
        'independent original cyclone cards and selected source retention')
    code=once(code,
        '''    select.value=activeId??"";
    draw();''',
        '''    select.value=activeId??"";
    renderCycloneCards();
    draw();''',
        'render all issued cyclone cards on latest source check')
    code=once(code,
        r'''      status.textContent=parsed.message+" · "+
        storms.length+" original cyclone forecast(s).\n"+
        (currentStorm()?.cycloneName??"")+" · "+
        (currentStorm()?fmt(currentStorm().issueUtc):"")+
        "\nSource: Bureau of Meteorology. Advisory text is a separate product.";''',
        r'''      status.textContent=parsed.message+" · "+
        storms.length+" original cyclone forecast(s).\n"+
        storms.map(s=>s.cycloneName).join(", ")+
        "\nSeparate BoM warning bulletins are NOT verified by this track feed.";''',
        'verified cyclone count and per-system source names')
    code=once(code,
        '''  focus.addEventListener("click",()=>{
    const s=currentStorm();
    if(!s)return;
    const all=s.features.filter(f=>''',
        '''  function focusStorm(s){
    if(!s||Date.parse(s.expiresUtc)<=now().getTime())return;
    const all=s.features.filter(f=>''',
        'each system camera focus uses accepted stable camera')
    code=once(code,
        '''    catch(error){status.textContent="Cannot focus source cyclone: "+String(error);}
  });''',
        '''    catch(error){status.textContent="Cannot focus source cyclone: "+String(error);}
  }
  focus.addEventListener("click",()=>focusStorm(currentStorm()));''',
        'preserve original Focus cyclone button')
    for id in (
        'toggle.id="internalCycloneLiveToggle"',
        'select.id="internalCycloneSelectedSystem"',
        'status.id="internalCycloneQaStatus"',
        'reload.id="internalCycloneRefresh"'
    ):
        if code.count(id)!=1:raise RuntimeError('Original live cyclone control changed: '+id)
    if code.count('systemCards.id="internalCycloneSystems"')!=1:
        raise RuntimeError('Missing multi cyclone card host')
    if code.count('function focusStorm(s)')!=1:
        raise RuntimeError('Missing source-bound focus per cyclone')
    if code.count('for(const s of displayed)')!=1:
        raise RuntimeError('Missing independent source geometry overlay loop')
    return code

def apply(site):
    source=site/'src/internal-cyclone-live-qa-v1.js'
    html=site/'live3d-operational-v9.html'
    if not source.is_file() or not html.is_file():raise RuntimeError('Missing operational cyclone input')
    site_html=html.read_text(encoding='utf-8')
    if not all(x in site_html for x in (
        'id="severeWeatherDetails"','id="cycloneCurrentOverview"',
        'id="cycloneForecastQaPanel"','CURRENT BoM PRODUCTS ONLY')):
        raise RuntimeError('Expected production-only cyclone subsection not present')
    upgraded=update(source.read_text(encoding='utf-8'))
    source.write_text(upgraded,encoding='utf-8')
    with (site/'BUILD.txt').open('a',encoding='utf-8') as f:f.write(STAMP+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--site',type=Path,required=True)
    args=parser.parse_args()
    apply(args.site)
