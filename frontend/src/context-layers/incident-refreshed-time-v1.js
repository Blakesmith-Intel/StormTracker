// Format the timestamp of a SUCCESSFULLY fetched provider snapshot.
// No synthetic "just refreshed" time from the local UI clock.
export function formatIncidentRefreshTime(loadedAt,{failed=false,expired=false}={}){
 const ms=Number(loadedAt);
 if(!Number.isFinite(ms)||ms<=0)return failed?"Refresh unavailable":"Not checked yet";
 const time=new Intl.DateTimeFormat("en-AU",{
   timeZone:"Australia/Brisbane",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).format(new Date(ms));
 if(expired)return "Data expired · last successful "+time+" AEST";
 if(failed)return "Refresh failed · last successful "+time+" AEST";
 return "Last refreshed "+time+" AEST";
}
