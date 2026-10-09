import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { assessV10RadarFrame } from "../frontend/src/severe-storm-v10.js";
import { join } from "node:path";
import {
  segmentWebMercatorCategoryFrame
} from "../frontend/src/segmentation.js";
import {
  cellsToRadarObservations, deduplicateRadarCells, updateTracks, trackToDict
} from "../frontend/src/tracking.js";
import {
  buildSevereStormFrameAlerts, findExperimentalHookArc
} from "../frontend/src/severe-storm-alerts-v1.js";

// Exercise the actual deployed research detector against AURA-derived measured
// category frames (spatial regridding only). No temporal interpolation,
// no invented ST storm histories, and no claims about tornado ground truth.
const dir=process.argv[2];
const output=process.argv[3];
const velocityDir=process.argv[4] || null;
if (!dir || !output) throw Error("Usage: node scripts/replay-archived-gympie-hook-v1.mjs INPUT_DIR REPORT.json");
const index=JSON.parse(readFileSync(join(dir,"observed_frame_index.json"),"utf8"));
let tracks=[],nextTrack=1,previousFrame=null,previousResult=null;
const rows=[];
for(const entry of index){
  const categories=new Uint8Array(readFileSync(join(dir,entry.categoriesFile)));
  const frame={
    ...entry,
    sourceId:"BOM-MOSAIC",
    radarId:"BOM-MOSAIC",
    categories
  };
  const segmentation=segmentWebMercatorCategoryFrame({
    categories,
    width:frame.width,height:frame.height,
    georef:frame.georef,
    sourceId:"BOM-MOSAIC",
    thresholdCategory:7,
    minPixels:8,
    connectivity:8
  });
  const observations=cellsToRadarObservations("BOM-MOSAIC",frame.observedUtc,segmentation.cells);
  const globalObservations=deduplicateRadarCells(observations);
  nextTrack=updateTracks(tracks,globalObservations,nextTrack,140,12);
  const result={tracks:tracks.map(trackToDict),segmentations:[segmentation]};
  const shapes=[];
  for(const track of result.tracks){
    const observation=track.history.find(obs=>Date.parse(obs.observed_utc)===Date.parse(frame.observedUtc));
    if(!observation)continue;
    const candidate=findExperimentalHookArc(frame,result,track.track_id);
    if(candidate)shapes.push(candidate);
  }
  const sampleFile=velocityDir ? join(velocityDir,entry.sourceMetadata.sourceFilename+".doppler.json") : null;
  const dopplerState=sampleFile && existsSync(sampleFile)
    ? { records: [JSON.parse(readFileSync(sampleFile,"utf8"))] }
    : { records: [] };
  const v10=assessV10RadarFrame({frame,result,previousFrame,previousResult,dopplerState});
  const detections=buildSevereStormFrameAlerts({
    frame,result,
    previousFrame,previousResult,
    dopplerState:{records:[]}, enableExperimentalHook:true
  });
  const hooks=detections.alerts.filter(item=>item.type==="hook");
  const record={
    observed_utc:frame.observedUtc,
    source_filename:entry.sourceMetadata.sourceFilename,
    measured_reflectivity_40dbz_pixel_count:entry.statistics.sampled_40_dbz_pixels,
    segmented_measured_cells:segmentation.cells.length,
    tracked_current_cells:globalObservations.length,
    unconfirmed_shape_candidates:shapes.length,
    two_scan_experimental_hook_candidates:hooks.length,
    v10_candidates:v10.alerts.map(x=>({category:x.category,track_id:x.track_id,
      longitude:x.longitude,latitude:x.latitude,velocity_kmh:x.velocity_kmh ?? null,
      radial_shear_kmh:x.radial_shear_kmh ?? null,caveat:x.caveat})),
    v10_counts:{hook_shape_only:v10.alerts.filter(x=>x.category==="hook_shape_only").length,
      tornadic_candidate:v10.alerts.filter(x=>x.category==="tornadic_candidate").length,
      strong_radial_signature:v10.alerts.filter(x=>x.category==="strong_radial_signature").length},
    doppler_samples: dopplerState.records[0]?.samples?.length ?? 0,
    hook_candidates:hooks.map(item=>({
      track_id:item.track_id,
      longitude:item.longitude,
      latitude:item.latitude,
      arc_degrees:item.arc_degrees,
      description:item.caveat
    }))
  };
  rows.push(record);
  console.log("MEASURED",record.observed_utc,
    "≥40dBZ pixels",record.measured_reflectivity_40dbz_pixel_count,
    "cells",record.segmented_measured_cells,
    "single-scan shape candidates",record.unconfirmed_shape_candidates,
    "TWO-SCAN",record.two_scan_experimental_hook_candidates,
    hooks.length ? JSON.stringify(record.hook_candidates) : "");
  console.log("V10_GYMPIE",record.observed_utc,JSON.stringify(record.v10_counts),
    "velocity_samples",record.doppler_samples,
    "candidate_details",JSON.stringify(record.v10_candidates.slice(0,12)));
  previousFrame=frame;previousResult=result;
}
const total=rows.reduce((n,item)=>n+item.two_scan_experimental_hook_candidates,0);
const report={
  format:"StormTrackerExperimentalAURAHookReplayV1",
  source_date:"2025-11-24",
  source_radar:"8 Gympie / StormTracker 08",
  source:"Genuine AURA Level1 ODIM polar volumes, regridded by nearest measured gate",
  verdict:"Experimental geometric evidence only, not validated tornado detection or official ground truth",
  time_inference_used:false,
  radial_velocity_used_for_hook:false,
  v10_radial_velocity_input:velocityDir?"actual AURA ODIM measured lowest co-elevation VRAD, bounded to public ±70 km/h palette and QC >=40dBZ; research only":"none",
  v10_candidate_totals:Object.fromEntries(["hook_shape_only","tornadic_candidate","strong_radial_signature"].map(key=>[key,rows.reduce((n,r)=>n+r.v10_counts[key],0)])),
  observed_scans_processed:rows.length,
  experimental_two_scan_hook_candidates:total,
  frames_with_candidates:rows.filter(x=>x.two_scan_experimental_hook_candidates>0).length,
  rows
};
writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log("RESEARCH COMPLETE",rows.length,"actual Gympie scans,",
  report.frames_with_candidates,"frames with two-scan candidates,",
  total,"total shape flags. Cannot verify a tornado without independent ground truth.");
