// Source links for operational map cards: only verified official HTTPS hosts
// and a validated BoM station plot path. All content stays textContent-only.
export const OFFICIAL_SOURCE_LINKS=Object.freeze({
  road:"https://qldtraffic.qld.gov.au/",
  qfd:"https://www.fire.qld.gov.au/Incident-Dashboard",
  bom:"https://www.bom.gov.au/qld/flood/rain_river.shtml",
  Energex:"https://www.energex.com.au/outages/outage-finder/outage-finder-map",
  Ergon:"https://www.ergon.com.au/network/outages/outage-finder/outage-finder-map",
  "Essential Energy":"https://www.essentialenergy.com.au/outages-and-faults/power-outages"
});
const allowedHosts=new Set([
  "www.bom.gov.au","bom.gov.au","www.fire.qld.gov.au","fire.qld.gov.au",
  "qldtraffic.qld.gov.au","www.qldtraffic.qld.gov.au",
  "www.energex.com.au","www.ergon.com.au","www.essentialenergy.com.au"
]);
export function officialUrl(value) {
  try {
    const url=new URL(String(value??""));
    return url.protocol==="https:" && !url.username && !url.password &&
      allowedHosts.has(url.hostname.toLowerCase())
      ? url.href:"";
  }catch {return "";}
}
export function bomGaugePlotUrl(href) {
  const value=String(href??"");
  const match=/^\/fwo\/(IDQ65\d{3})\/\1\.(\d{5,7})\.plt\.shtml$/i.exec(value);
  if (!match) return "";
  return `https://www.bom.gov.au/fwo/${match[1].toUpperCase()}/${match[1].toUpperCase()}.${match[2]}.plt.shtml`;
}
export function roadOfficialUrl(eventLink) {
  const href=officialUrl(eventLink);
  return href && new URL(href).hostname.toLowerCase().endsWith("qldtraffic.qld.gov.au")
    ? href:OFFICIAL_SOURCE_LINKS.road;
}
export function powerOfficialUrl(provider) {
  return OFFICIAL_SOURCE_LINKS[String(provider??"").trim()]??"";
}
export function addOfficialSourceRow(container,label,text,url) {
  const safe=officialUrl(url);
  const title=String(text??"").trim();
  if(!safe||!title||!container)return false;
  const key=document.createElement("span");
  key.textContent=label;
  const link=document.createElement("a");
  link.textContent=title;
  link.href=safe;
  link.target="_blank";
  link.rel="noopener noreferrer";
  link.title="Open official source in a new tab";
  container.append(key,link);
  return true;
}
