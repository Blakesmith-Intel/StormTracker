// Operational visibility is separate from radar detection, measured tracks,
// and inferred volumes. Do not alter ST identities or science to declutter UI.
export function stormTrackPresentation(track, observation, frameUtc, selected=false){
  if(!observation)return {show:false,priority:0};
  const at=Date.parse(frameUtc);
  const seen=(track?.history??[]).filter(item=>Date.parse(item.observed_utc)<=at);
  const scans=seen.length;
  const dbz=Number(observation.maximum_dbzh_lower_bound)||0;
  // Use actual above-threshold connected raster pixels, never estimated km².
  const pixels=Math.max(0,Number(observation.pixel_count)||0);
  // A newly detected extreme core remains visible immediately. A second
  // measured scan establishes visibility for less-intense tracked echoes.
  const significant=dbz>=55 || (dbz>=50 && pixels>=80);
  const show=Boolean(selected || scans>=2 || significant);
  const priority=(selected?10000:0) + (significant?1000:0) +
    Math.min(200,scans*30) + dbz*6 + Math.min(100,pixels);
  return {show,priority,scans,significant};
}
