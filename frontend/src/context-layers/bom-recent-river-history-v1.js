import {parseQueenslandObservationTime, FLOOD_SIGNAL_MAX_AGE_MS, tidalRiseBaseline, latestRiseRate} from "./river-flood-signals-v1.js?v=9.13.0";

// BoM publishes recent tabular readings alongside each public .plt.shtml
// gauge plot. Parse only the first date/water-level table; never infer data
// from chart pixels or use undocumented alternative hosts.
export const RECENT_TABLE_PATH_PATTERN =
  /^\/fwo\/(IDQ65\d{3})\/\1\.(\d{5,7})\.plt\.shtml$/i;

export function officialRecentTableTarget(href) {
  const raw=String(href??"");
  const match=RECENT_TABLE_PATH_PATTERN.exec(raw);
  if(!match)return null;
  return {
    product:match[1].toUpperCase(),
    station:match[2],
    url:`https://www.bom.gov.au/fwo/${match[1].toUpperCase()}/${match[1].toUpperCase()}.${match[2]}.tbl.shtml`
  };
}

function cleanCell(text) {
  return String(text??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ")
    .replace(/\s+/g," ").trim();
}
function parseTableDate(value) {
  const m=String(value??"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if(!m)return null;
  const [d,mo,y,h,mi]=m.slice(1).map(Number);
  if(h>23||mi>59)return null;
  const check=new Date(Date.UTC(y,mo-1,d));
  if(check.getUTCDate()!==d||check.getUTCMonth()!==mo-1||check.getUTCFullYear()!==y)return null;
  return Date.UTC(y,mo-1,d,h-10,mi); // BoM Queensland river tables use AEST.
}

export function parseBomRecentWaterLevels(html,{nowMs=Date.now(),maxAgeHours=48}={}) {
  const source=String(html??"");
  const table=source.match(/<table\b[^>]*\bid=["']tableStyle1["'][^>]*>([\s\S]*?)<\/table>/i);
  if(!table)return [];
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(!rows.length || !/Date\/Time/i.test(cleanCell(rows[0][1])) ||
    !/Water\s*Level\s*\(m\)/i.test(cleanCell(rows[0][1])))return [];
  const good=new Map(),bad=new Set();
  for(const row of rows.slice(1,3000)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if(cells.length!==2)continue;
    const time=parseTableDate(cleanCell(cells[0][1]));
    const level=cleanCell(cells[1][1]);
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(level))continue;
    const height=Number(level);
    if(time===null||!Number.isFinite(height)||time>nowMs+5*60000||
      time<nowMs-maxAgeHours*3600000)continue;
    if(good.has(time)&&Math.abs(good.get(time)-height)>0.001)bad.add(time);
    else good.set(time,height);
  }
  return [...good].filter(([time])=>!bad.has(time))
    .sort((a,b)=>a[0]-b[0])
    .slice(-225).map(([time,height])=>({time,height}));
}

export function recentFloodHistoryCandidate(feature,history={},nowMs=Date.now()) {
  const p=feature?.properties??{};
  const tidal=String(p.location_types??"").toLowerCase().includes("tide gauge");
  const flood=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase();
  const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  if(observed===null || nowMs-observed>FLOOD_SIGNAL_MAX_AGE_MS ||
     String(p.STORMTRACKER_TENDENCY??"").toLowerCase()!=="rising" ||
     (!tidal&&flood!=="minor"))return null;
  const target=officialRecentTableTarget(p.STORMTRACKER_RECENT_DATA_HREF);
  if(!target)return null;
  // Only candidate gauges whose history is insufficient for classification.
  const sample=history[String(feature?.id??"")]??[];
  const valid=Array.isArray(sample)?sample.filter(x=>Number.isFinite(x?.time)): [];
  if(tidal){
    if(tidalRiseBaseline(valid,nowMs)!==null && latestRiseRate(valid,nowMs)!==null)return null;
  }else if(valid.length>=2){
    const sorted=[...valid].sort((a,b)=>a.time-b.time);
    if(sorted.at(-1).time>=nowMs-90*60000 &&
      sorted.some(x=>sorted.at(-1).time-x.time>=30*60000 &&
       sorted.at(-1).time-x.time<=120*60000))return null;
  }
  return {id:String(feature.id),...target,tidal};
}

export const RECENT_HISTORY_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-recent-history";

export async function fetchBoMRecentHistory(target,{
  fetchImpl=globalThis.fetch,endpoint=RECENT_HISTORY_RELAY_URL,timeoutMs=15000
}={}) {
  if(!target?.station||!target?.product||!officialRecentTableTarget(
    "/fwo/"+target.product+"/"+target.product+"."+target.station+".plt.shtml"
  ))throw new Error("Invalid station in requested BoM history");
  const url=new URL(endpoint);
  url.searchParams.set("product",target.product);
  url.searchParams.set("station",target.station);
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),timeoutMs);
  try {
    const response=await fetchImpl(url.toString(),{
      headers:{Accept:"application/json"},signal:abort.signal
    });
    if(!response.ok)throw new Error("BoM recent data HTTP "+response.status);
    const payload=await response.json();
    if(payload.format!=="StormTrackerBomRecentRiverHistoryV1"||
      payload.station!==target.station||payload.product!==target.product||
      !Array.isArray(payload.samples))throw new Error("BoM station history response mismatch");
    return payload.samples.filter(x=>Number.isFinite(x?.time)&&Number.isFinite(x?.height))
      .slice(-225);
  }finally {
    clearTimeout(timer);
  }
}
