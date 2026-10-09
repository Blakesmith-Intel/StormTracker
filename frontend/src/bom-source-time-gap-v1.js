// Source observations are independent UTC measurements, never a measure
// of how long Cesium took to display a frame.
export function describeBomSourceTimeGap(radarUtc, dopplerUtc) {
  const radar=Date.parse(radarUtc ?? "");
  const wind=Date.parse(dopplerUtc ?? "");
  if(!Number.isFinite(radar)||!Number.isFinite(wind))
    return {available:false,minutes:null,warning:false,label:"",description:""};
  const minutes=Math.abs(wind-radar)/60000;
  const relationship=wind<radar?"earlier than":wind>radar?"later than":"at the same time as";
  const precision=minutes<10?1:0;
  return {
    available:true,minutes,warning:minutes>15,
    label:"BoM scans Δ"+minutes.toFixed(precision)+" min",
    description:"Doppler was observed "+minutes.toFixed(1)+" minutes "+relationship+
      " the reflectivity observation. This is the difference between actual BoM source timestamps, not app playback or rendering delay."
  };
}
