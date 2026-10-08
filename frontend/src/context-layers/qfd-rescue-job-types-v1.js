// Exact QFD problem/job-type vocabulary supplied for StormTracker source
// discovery. This is *not* a substitute for a verified public job-type field.
// The public ESCAD Current Incidents layer exposes GroupedType instead.
export const QFD_JOB_TYPE_LABELS=Object.freeze({
  vertical:"RESCUE VERTICAL",
  water:"RESCUE WATER ALL TYPES",
  extraordinaryWater:"XE RESCUE WATER",
  mountain:"RESCUE MOUNTAIN RESCUE",
  extremeWeather:"ASSIST EXTREME WEATHER",
  largeMultiRoadCrash:"RESCUE RTC LARGE MULTI"
});

// Requested means included in the situational-awareness scope, NOT proof of
// current public availability, an exact rescue subtype, an SES tasking,
// or an official road closure.
// Exact-name classification only. Do not use keywords such as 'water',
// 'mountain', 'extreme' or incident location to infer a rescue subtype.
export function classifyQfdRescueJobType(jobType) {
  const type=String(jobType??"").trim().replace(/\s+/g," ").toUpperCase();
  switch(type) {
    case QFD_JOB_TYPE_LABELS.vertical:
      return {category:"vertical",rescue:true,requested:true};
    case QFD_JOB_TYPE_LABELS.water:
    case QFD_JOB_TYPE_LABELS.extraordinaryWater:
      return {category:"water",rescue:true,requested:true};
    case QFD_JOB_TYPE_LABELS.mountain:
      // Operationally relevant to QFD/SES; separate from vertical rescue.
      return {category:"mountain",rescue:true,requested:true};
    case QFD_JOB_TYPE_LABELS.extremeWeather:
      // Assistance can involve SES support even where no rescue is declared.
      return {category:"weather-assistance",rescue:false,requested:true};
    case QFD_JOB_TYPE_LABELS.largeMultiRoadCrash:
      // A possible traffic disruption, never proof of an official closure.
      return {category:"road-crash",rescue:true,requested:true};
    default:
      return {category:"unverified",rescue:false,requested:false};
  }
}

export function qfdPublicClassificationAvailability(schemaFields) {
  const fields=new Set((schemaFields??[]).map(f=>String(
    typeof f==="string"?f:f?.name??""
  ).trim().toLowerCase()));
  // Currently QFD publishes GroupedType only, which is insufficient.
  const subtypeFields=["jobtype","job_type","problemtype","problem_type",
    "incidenttype","incident_type","calldescription","call_type"];
  return {
    groupedTypeAvailable:fields.has("groupedtype"),
    detailedSubtypeField:subtypeFields.find(field=>fields.has(field))??null,
    waterRescueDistinguishable:subtypeFields.some(field=>fields.has(field)),
    verticalRescueDistinguishable:subtypeFields.some(field=>fields.has(field))
  };
}
