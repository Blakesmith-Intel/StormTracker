// An inferred primary display frame is a presentation step, not a new BoM
// measurement. Secondary radar windows may HOLD a genuine prior image for a
// short, explicitly bounded gap; they never borrow the inferred UTC as a scan.
export function supplementalObservedAnchor(frame,frames=[],maximumHoldMinutes=15) {
  const epoch=Date.parse(frame?.observedUtc);
  if(!Number.isFinite(epoch))return null;
  if(!frame?.sourceMetadata?.temporalInference)
    return {observedUtc:frame.observedUtc,held:false,ageMinutes:0};
  const maxAge=Math.max(0,Number(maximumHoldMinutes)||0);
  let source=null,best=-Infinity;
  for(const candidate of frames){
    if(candidate?.sourceMetadata?.temporalInference)continue;
    if(candidate?.sourceMetadata?.region!==frame.sourceMetadata?.region)continue;
    const time=Date.parse(candidate?.observedUtc);
    if(Number.isFinite(time)&&time<=epoch&&time>best){source=candidate;best=time;}
  }
  if(!source)return null;
  const ageMinutes=(epoch-best)/60000;
  if(ageMinutes>maxAge)return null;
  return {observedUtc:source.observedUtc,held:true,ageMinutes};
}
