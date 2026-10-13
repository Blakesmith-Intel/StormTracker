// Research-only V10 opposing-radial-velocity circulation candidates.
// Requires a verified quantitative source; intentionally does not enable map warnings.
import { validateDopplerSource } from "./doppler-source-validation-v10.js";

const EARTH_KM_PER_DEG = 111.32;
function separationKm(a,b) {
  const dy = (a.latitude - b.latitude)*EARTH_KM_PER_DEG;
  const dx = (a.longitude - b.longitude)*EARTH_KM_PER_DEG *
    Math.cos(((a.latitude+b.latitude)/2)*Math.PI/180);
  return Math.hypot(dx,dy);
}
function midpoint(a,b) {
  return {longitude:(a.longitude+b.longitude)/2,latitude:(a.latitude+b.latitude)/2};
}
export function detectCirculationCandidates({
  record, reflectivityUtc, nowUtc = null, minimumEachSign = 3,
  minimumAbsoluteKmh = 30, maximumPairSeparationKm = 4,
  minimumDeltaKmh = 70, minimumDistinctPositions = 3
} = {}) {
  const validation = validateDopplerSource(record,reflectivityUtc,{nowUtc});
  const empty = {candidates:[],source:validation,experimental:true,
    interpretation:"Opposed Doppler radial velocity is not proof of mesocyclone, tornado, or surface gust."};
  if (!validation.supported || record?.sourceFormat !== "verified-quantitative-velocity")
    return empty;
  if (!Number.isFinite(minimumAbsoluteKmh) || minimumAbsoluteKmh <= 0) return empty;
  const samples=(record.samples ?? []).filter(s=>
    Number.isFinite(s.velocity_kmh)&&Number.isFinite(s.longitude)&&Number.isFinite(s.latitude)
  );
  const inbound=samples.filter(s=>s.velocity_kmh<=-minimumAbsoluteKmh);
  const outbound=samples.filter(s=>s.velocity_kmh>=minimumAbsoluteKmh);
  if(inbound.length<minimumEachSign || outbound.length<minimumEachSign) return empty;
  let best=null;
  for(const a of inbound) for(const b of outbound) {
    const separation=separationKm(a,b);
    const difference=b.velocity_kmh-a.velocity_kmh;
    if(separation<=0 || separation>maximumPairSeparationKm || difference<minimumDeltaKmh) continue;
    const nearA=inbound.filter(s=>separationKm(s,a)<=1.5);
    const nearB=outbound.filter(s=>separationKm(s,b)<=1.5);
    const uniqueA=new Set(nearA.map(s=>s.longitude.toFixed(5)+":"+s.latitude.toFixed(5)));
    const uniqueB=new Set(nearB.map(s=>s.longitude.toFixed(5)+":"+s.latitude.toFixed(5)));
    if(nearA.length<minimumEachSign || nearB.length<minimumEachSign ||
       uniqueA.size<minimumDistinctPositions || uniqueB.size<minimumDistinctPositions) continue;
    const centre=midpoint(a,b);
    if(!best || difference>best.radial_shear_kmh) best={
      type:"circulation-research",radar_id:String(record.radarId),
      source_utc:record.observedUtc, ...centre,
      radial_shear_kmh:difference, couplet_separation_km:separation,
      inbound_samples:nearA.length,outbound_samples:nearB.length,
      caveat:"Experimental opposing-radial-velocity couplet; unverified rotation. Not a tornado detection or official warning."
    };
  }
  return {...empty,candidates:best?[best]:[]};
}
