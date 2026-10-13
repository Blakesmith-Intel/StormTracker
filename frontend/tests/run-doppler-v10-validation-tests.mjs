import assert from "node:assert/strict";
import { validateDopplerSource } from "../src/doppler-source-validation-v10.js";
import { detectCirculationCandidates } from "../src/circulation-candidates-v10.js";
const utc="2026-10-14T00:00:00Z";
function source(overrides={}) {return {
  radarId:"66",observedUtc:utc,timeBasis:"observed",
  velocityRangeVerified:true,verifiedRadialRangeKmh:140,
  spatialCalibrationVerified:true,signConventionVerified:true,dealiasingVerified:true,
  sourceFormat:"verified-quantitative-velocity",samples:[],...overrides
};}
const good=source();
assert.equal(validateDopplerSource(good,utc).supported,true);
assert.equal(validateDopplerSource(source({sourceFormat:"bom-colour-image",verifiedRadialRangeKmh:70}),utc).damagingRadialScreenPossible,false);
assert.equal(validateDopplerSource(source({sourceFormat:"bom-colour-image"}),utc).supported,false);
assert.equal(validateDopplerSource(source({dealiasingVerified:false}),utc).supported,false);
assert.equal(validateDopplerSource(source({timeBasis:"modified"}),utc).supported,false);
assert.equal(validateDopplerSource(source({radarId:"93"}),utc).supported,false);
assert.equal(validateDopplerSource(source({observedUtc:"2026-10-14T00:11:00Z"}),utc).supported,false);
assert.equal(validateDopplerSource(good,utc,{nowUtc:"2026-10-14T01:00:00Z"}).supported,false);
const samples=[];
for(let i=0;i<3;i++){
 samples.push({longitude:153+i*0.001,latitude:-27.0,velocity_kmh:-45});
 samples.push({longitude:153.01+i*0.001,latitude:-27.0,velocity_kmh:45});
}
const candidate=detectCirculationCandidates({record:source({samples}),reflectivityUtc:utc});
assert.equal(candidate.candidates.length,1);
assert.equal(candidate.candidates[0].type,"circulation-research");
assert.equal(detectCirculationCandidates({record:source({samples,dealiasingVerified:false}),reflectivityUtc:utc}).candidates.length,0);
assert.equal(detectCirculationCandidates({record:source({samples,sourceFormat:"bom-colour-image",verifiedRadialRangeKmh:70}),reflectivityUtc:utc}).candidates.length,0);
assert.equal(detectCirculationCandidates({record:source({samples:samples.slice(0,2)}),reflectivityUtc:utc}).candidates.length,0);
assert.equal(detectCirculationCandidates({record:source({samples:samples.map(s=>({...s,velocity_kmh:45}))}),reflectivityUtc:utc}).candidates.length,0);
console.log("V10 Doppler validation and circulation candidate contract tests passed");
