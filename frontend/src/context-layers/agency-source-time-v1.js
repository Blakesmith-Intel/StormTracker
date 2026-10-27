// Presentation-only source-agency timestamp styles for operational hazard
// information panels and reports. All instants remain UTC milliseconds in
// the source models: this module does NOT alter parsing, filtering, freshness,
// time-of-observation provenance or the UI layout.
const ZONE_QLD="Australia/Brisbane";
const ZONE_NSW="Australia/Sydney";
function dateParts(date,zone){
  const fields=new Intl.DateTimeFormat("en-AU",{
    timeZone:zone,day:"2-digit",month:"2-digit",year:"numeric",
    weekday:"long",hour:"2-digit",minute:"2-digit",second:"2-digit",
    hourCycle:"h23",timeZoneName:"short"
  }).formatToParts(date);
  const out={};
  for(const item of fields)if(item.type!=="literal")out[item.type]=item.value;
  return out;
}
function monthName(date,zone){
  return new Intl.DateTimeFormat("en-AU",{
    timeZone:zone,month:"long"
  }).format(date);
}
function sourceInstant(value){
  if(value instanceof Date)return Number.isFinite(value.getTime())?value:null;
  if(value===null||value===undefined||String(value).trim()==="")return null;
  const numeric=Number(value);
  const timestamp=typeof value==="number"&&Number.isFinite(value)||
    /^\d{13}$/.test(String(value).trim()) ? numeric:Date.parse(String(value));
  return Number.isFinite(timestamp)&&timestamp>0?new Date(timestamp):null;
}
function clock12(p){
  const hour=Number(p.hour);
  return (hour%12||12)+":"+p.minute+(hour>=12?"pm":"am");
}
// BoM station tables use 24-hour "14:43 27/10/2026" in Queensland AEST.
// BoM issued products may instead use "06:23 PM AEST Tuesday 27 October 2026".
// Energex/Ergon outage finder lists "27 October 2026, 2:43pm".
// Essential Energy KML lists "27/10/2026 15:43:00" in NSW local time.
// QLDTraffic's published road-network report uses "9:00am 27 October 2026".
// QFD's public incident feed contains machine timestamps without a published
// human-facing pattern: keep its existing 24-hour AEST panel presentation.
export function formatAgencyTimestamp(value,agency="bom-gauge"){
  const instant=sourceInstant(value);
  if(!instant)return String(value??"").trim();
  const name=String(agency).trim().toLowerCase();
  const zone=name==="essential energy"||name==="essential-energy"?ZONE_NSW:ZONE_QLD;
  const p=dateParts(instant,zone);
  const long=monthName(instant,zone);
  const d=Number(p.day),year=p.year;
  const tz=zone===ZONE_QLD?"AEST":p.timeZoneName;
  const dateNumeric=p.day+"/"+p.month+"/"+year;
  const ampm=clock12(p);
  if(name==="bom-gauge"||name==="bom-rainfall")
    return p.hour+":"+p.minute+" "+dateNumeric+" AEST";
  if(name==="bom-issued")
    return String(Number(p.hour)%12||12).padStart(2,"0")+":"+p.minute+
      (Number(p.hour)>=12?" PM":" AM")+
      " AEST "+p.weekday+" "+d+" "+long+" "+year;
  if(name==="energex"||name==="ergon")
    return d+" "+long+" "+year+", "+ampm+" AEST";
  if(name==="essential energy"||name==="essential-energy")
    return dateNumeric+" "+p.hour+":"+p.minute+":"+p.second+" "+tz;
  if(name==="qldtraffic")
    return ampm+" "+d+" "+long+" "+year+" AEST";
  // Existing QFD incident style (public feed itself specifies no UI pattern).
  return p.day+" "+new Intl.DateTimeFormat("en-AU",{
    timeZone:zone,month:"short"
  }).format(instant)+" "+year+", "+p.hour+":"+p.minute+" "+tz;
}
