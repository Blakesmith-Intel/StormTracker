// One-shot evidence only, not part of routine CI or production polling.
import {parseBomRainfallMap,qldFloodMapCreatedAt}
  from "../frontend/src/context-layers/significant-rainfall-source-v1.js";
const regions=["seast","gulf","tvl2mck","border","north","west","mck2mry"];
await Promise.all(regions.map(async region=>{
  try{
    const r=await fetch("https://www.bom.gov.au/qld/flood/"+region+".shtml",
      {signal:AbortSignal.timeout(16000)});
    if(!r.ok)throw Error("HTTP "+r.status);
    const html=await r.text();
    const since9am=parseBomRainfallMap(html,"since9am",region);
    const lastHour=parseBomRainfallMap(html,"lastHour",region);
    const areaCounts=[...html.matchAll(/PopupRain\s*\(/gi)].length;
    const result={region,bytes:html.length,createdAt:qldFloodMapCreatedAt(html),
      sourceStationObservations:areaCounts,
      since9am50plus:since9am.length,lastHour50plus:lastHour.length,
      sample:[...since9am,...lastHour].slice(0,2)};
    if(!result.createdAt||areaCounts<1) {
      console.log("SOURCE_TIME_DIAG",region,JSON.stringify({
        createdAt:result.createdAt,areaCounts,
        footer:html.slice(-1100),
        dateHints:html.match(/(?:created|updated|issued|time).*?(?:UTC|AEST|2026)/gi)?.slice(-8)
      }).slice(0,1700));
      throw Error("Source missing timestamp or station IDs");
    }
    console.log("LIVE_BO_M_RAINFALL",JSON.stringify(result));
  }catch(e){console.log("LIVE_BO_M_RAINFALL_ERROR",region,String(e))}
}));
