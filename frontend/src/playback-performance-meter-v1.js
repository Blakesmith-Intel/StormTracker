// Observed rendering diagnostics. Counts missed TARGET intervals, not
// fabricated/missing BoM frames; no weather science or scan timeline changes.
export function createPlaybackPerformanceMeter({windowSize=24}={}){
  const samples=[];
  function record({frameMs,targetMs,windMs=0,radarMs=0,volumeMs=0}){
    for(const value of [frameMs,targetMs,windMs,radarMs,volumeMs])
      if(!Number.isFinite(value)||value<0)throw new TypeError("Invalid playback timing");
    if(targetMs<=0)throw new RangeError("Target frame interval must be positive");
    const timing={frameMs,targetMs,windMs,radarMs,volumeMs,
      cadenceOverrun:frameMs>targetMs};
    samples.push(timing);
    while(samples.length>windowSize)samples.shift();
    return summary();
  }
  function summary(){
    const n=samples.length;
    if(!n)return {samples:0,averageMs:0,actualFps:0,
      targetFps:0,overruns:0,windMs:0,radarMs:0,volumeMs:0};
    const sum=key=>samples.reduce((acc,x)=>acc+x[key],0);
    const averageMs=sum("frameMs")/n;
    return {samples:n,averageMs,actualFps:averageMs?1000/averageMs:0,
      targetFps:1000/(sum("targetMs")/n),
      overruns:samples.filter(x=>x.cadenceOverrun).length,
      windMs:sum("windMs")/n,radarMs:sum("radarMs")/n,
      volumeMs:sum("volumeMs")/n};
  }
  return {record,summary,clear(){samples.length=0}};
}
