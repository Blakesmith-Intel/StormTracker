// Pure source-native Doppler timeline, deliberately unrelated to any
// reflectivity timestamps, animation positions or radar-history windows.
export function buildIndependentDopplerFrames(history, latest = null) {
  const byIdentity = new Map();
  for (const frame of history?.frames ?? []) {
    if (!frame?.filename || !Number.isFinite(Date.parse(frame.observedUtc))) continue;
    byIdentity.set(frame.filename, {
      filename:frame.filename, observedUtc:frame.observedUtc, source_kind:"history"
    });
  }
  // Latest GIF has a real source timestamp and is displayed only if it is
  // newer than archived history; its image is never backdated.
  const valid = [...byIdentity.values()];
  const newest = valid.reduce((n,frame)=>Math.max(n,Date.parse(frame.observedUtc)),0);
  if (latest?.observedUtc && Number.isFinite(Date.parse(latest.observedUtc)) &&
      Date.parse(latest.observedUtc) > newest) {
    valid.push({ filename:latest.filename, observedUtc:latest.observedUtc, source_kind:"latest" });
  }
  return valid.sort((a,b)=>Date.parse(a.observedUtc)-Date.parse(b.observedUtc));
}

export function independentDopplerIndex(next, previous, index) {
  if (!next?.length) return 0;
  if (!previous?.length) return next.length - 1;
  const old = previous[Math.max(0,Math.min(index,previous.length-1))];
  const identical = next.findIndex(x=>x.filename===old.filename &&
    Date.parse(x.observedUtc)===Date.parse(old.observedUtc));
  if (identical>=0) return identical;
  // Following the newest frame should follow future genuinely new observations.
  if (index>=previous.length-1) return next.length-1;
  const oldEpoch=Date.parse(old.observedUtc);
  const prior=next.findIndex(x=>Date.parse(x.observedUtc)>=oldEpoch);
  return prior<0?next.length-1:prior;
}
