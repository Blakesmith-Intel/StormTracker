import { readFileSync, writeFileSync } from "node:fs";
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
    const observation=track.history.find(obs=>obs.observed_utc===frame.observedUtc);
    if(!observation)continue;
    const candidate=findExperimentalHookArc(frame,result,track.track_id);
    if(candidate)shapes.push(candidate);
  }
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
    "TWO-SCAN",record.two_scan_experimental_hook_candidates);
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
  observed_scans_processed:rows.length,
  experimental_two_scan_hook_candidates:total,
  frames_with_candidates:rows.filter(x=>x.two_scan_experimental_hook_candidates>0).length,
  rows
};
writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log("RESEARCH COMPLETE",rows.length,"actual Gympie scans,",
  report.frames_with_candidates,"frames with two-scan candidates,",
  total,"total shape flags. Cannot verify a tornado without independent ground truth.");
