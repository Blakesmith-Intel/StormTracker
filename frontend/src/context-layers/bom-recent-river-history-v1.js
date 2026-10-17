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

// Keep genuine missing observations separate from a changed HTML format.
// No-date/no-level rows are normal for some BoM stations; numeric water levels
// with unparseable date strings indicate a source contract change instead.
export function inspectBomRecentWaterLevelTable(html,options={}) {
  const source=String(html??"");
  const table=source.match(/<table\b[^>]*\bid\s*=\s*["']tableStyle1["'][^>]*>([\s\S]*?)<\/table>/i);
  if(!table)return {formatRecognised:false,samples:[],dataRows:0};
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if(!rows.length || !/Date\/Time/i.test(cleanCell(rows[0][1])) ||
    !/Water\s*Level\s*\(m\)/i.test(cleanCell(rows[0][1])))
    return {formatRecognised:false,samples:[],dataRows:Math.max(0,rows.length-1)};
  let numericRows=0,parseableNumericRows=0;
  for(const row of rows.slice(1,3000)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if(cells.length!==2)continue;
    const height=cleanCell(cells[1][1]);
    if(!/^[-+]?\d+(?:\.\d+)?$/.test(height))continue;
    numericRows++;
    if(parseTableDate(cleanCell(cells[0][1]))!==null)parseableNumericRows++;
  }
  if(numericRows>0 && parseableNumericRows===0)
    return {formatRecognised:false,samples:[],dataRows:rows.length-1};
  return {formatRecognised:true,
    samples:parseBomRecentWaterLevels(source,options),
    dataRows:Math.max(0,rows.length-1)};
}

// A gap also exists when BoM supplies no valid table link. Do not silently
// treat an unscreenable rising gauge as a negative rapid-rise result.
export function recentFloodHistoryGap(feature,history={},nowMs=Date.now()) {
  const p=feature?.properties??{};
  const tidal=String(p.location_types??"").toLowerCase().includes("tide gauge");
  const flood=String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase();
  const observed=parseQueenslandObservationTime(p.STORMTRACKER_OBSERVED_TEXT,nowMs);
  if(observed===null || nowMs-observed>FLOOD_SIGNAL_MAX_AGE_MS ||
     String(p.STORMTRACKER_TENDENCY??"").toLowerCase()!=="rising" ||
     (!tidal&&flood!=="minor"))return null;
  const sample=history[String(feature?.id??"")]??[];
  const valid=Array.isArray(sample)?sample.filter(x=>
    Number.isFinite(x?.time)&&Number.isFinite(x?.height)): [];
  const rate=latestRiseRate(valid,nowMs);
  const aligned=rate!==null&&Math.abs(rate.observedAt-observed)<=10*60000;
  if(aligned&&(!tidal||tidalRiseBaseline(valid,nowMs)!==null))return null;
  return {
    id:String(feature?.id??""),
    tidal,
    target:officialRecentTableTarget(p.STORMTRACKER_RECENT_DATA_HREF)
  };
}

export function recentFloodHistoryCandidate(feature,history={},nowMs=Date.now()) {
  const gap=recentFloodHistoryGap(feature,history,nowMs);
  return gap?.target?{id:gap.id,...gap.target,tidal:gap.tidal}:null;
}

// Distinguish an individual unavailable history table from a shared service
// failure. Unknown/network/timeout errors use service-level backoff.
export function classifyBoMRecentHistoryFailure(error) {
  const status=Number(error?.status)||0;
  const code=String(error?.code??"");
  if(["no_usable_observations","station_history_not_published",
      "invalid_station"].includes(code)||
      [400,404,410,422].includes(status))return "station";
  return "service";
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
    if(!response.ok){
      // The Worker returns typed JSON; legacy plain-text failures still fall
      // back to their HTTP status without discarding the failure.
      let failure=null;
      try{failure=await response.json();}catch{}
      const code=String(failure?.code??"").slice(0,80);
      const error=new Error("BoM recent data HTTP "+response.status+
        (code?" ("+code+")":""));
      error.status=response.status;
      error.code=code;
      error.upstreamStatus=Number(failure?.upstreamStatus)||null;
      error.scope=classifyBoMRecentHistoryFailure(error);
      throw error;
    }
    const payload=await response.json();
    if(payload.format!=="StormTrackerBomRecentRiverHistoryV1"||
      payload.station!==target.station||payload.product!==target.product||
      !Array.isArray(payload.samples)||
      (payload.availability!==undefined &&
        !["available","no_recent_observations"].includes(payload.availability))||
      (payload.availability==="no_recent_observations" && payload.samples.length!==0))
      throw new Error("BoM station history response mismatch");
    return payload.samples.filter(x=>Number.isFinite(x?.time)&&Number.isFinite(x?.height))
      .slice(-225);
  }finally {
    clearTimeout(timer);
  }
}
