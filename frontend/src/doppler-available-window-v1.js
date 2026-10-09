// Doppler-scoped optional playback. Both sources retain real observation
// timestamps, and neither requires coincident frames. This module owns only
// playback selection; it does not alter science, measurement or track identity.
export const DOPPLER_AVAILABLE_LOOP_VALUE = "doppler-available";

const epoch = value => Date.parse(value);
const timesOf = source => [...new Set((source??[])
  .map(x => typeof x==="string" ? x : x?.observedUtc)
  .filter(x => Number.isFinite(epoch(x))))]
  .sort((a,b)=>epoch(a)-epoch(b));

export function dopplerAvailableWindow(radarTimes, dopplerFrames) {
  const wind=timesOf(dopplerFrames), radar=timesOf(radarTimes);
  if (wind.length<2 || radar.length<1) return null;
  const start=epoch(wind[0]), end=epoch(wind.at(-1));
  const inWindow=radar.filter(t=>epoch(t)>=start && epoch(t)<=end);
  if(!inWindow.length)return null;
  const gapMinutes=(end-start)/60000;
  return {startUtc:wind[0],endUtc:wind.at(-1),
    spanMinutes:gapMinutes,radarTimes:inWindow,
    dopplerTimes:wind, radarCount:inWindow.length, dopplerCount:wind.length};
}

export function buildDopplerAvailableSchedule(radarTimes,dopplerFrames) {
  const window=dopplerAvailableWindow(radarTimes,dopplerFrames);
  if(!window)return [];
  const {radarTimes:radar,dopplerTimes:wind,startUtc,endUtc}=window;
  const radarAll=timesOf(radarTimes);
  // The first Doppler observation may precede the first radar observation.
  // A preceding genuine radar scan may be shown briefly, at its *real* time,
  // but only if it is within 8min of the first wind observation.
  const before=radarAll.filter(t=>epoch(t)<epoch(startUtc)).at(-1);
  const radarDisplay=before && (epoch(startUtc)-epoch(before)<=8*60000)
    ? [before,...radar] : radar;
  const events=[...new Set([...radar,...wind])].sort((a,b)=>epoch(a)-epoch(b));
  const floorAt=(arr,t)=> {
    let result=-1;
    for(let i=0;i<arr.length;i++) if(epoch(arr[i])<=epoch(t))result=i;
    return result>=0?result:0; // nearest future real scan, never fabricated
  };
  return events.map(t=>({
    timelineUtc:t,
    radarObservedUtc:radarDisplay[floorAt(radarDisplay,t)],
    dopplerObservedUtc:wind[floorAt(wind,t)],
    dopplerIndex:floorAt(wind,t),
    isDopplerObservation:wind.includes(t),
    isRadarObservation:radar.includes(t)
  }));
}

// Dedicated Doppler playback: one actual BoM wind observation per UI step.
// Reflectivity continues to be processed independently for measured science,
// but its timestamps never add frames to the displayed wind loop.
export function buildDopplerOnlySchedule(radarTimes, dopplerFrames) {
  return buildDopplerAvailableSchedule(radarTimes,dopplerFrames)
    .filter(step=>step.isDopplerObservation);
}
