import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { segmentWebMercatorCategoryFrame } from "../frontend/src/segmentation.js";
import { cellsToRadarObservations, deduplicateRadarCells, updateTracks, trackToDict } from "../frontend/src/tracking.js";
import { findExperimentalHookArc } from "../frontend/src/severe-storm-alerts-v1.js";
import { assessV10RadarFrame } from "../frontend/src/severe-storm-v10.js";

export const CHRISTMAS_2023_WARNING_ANCHORS = Object.freeze([
  {type:"Gold Coast detailed warning",aest:"19:49",utc:"2023-12-25T09:49:00Z"},
  {type:"Very dangerous thunderstorm warning",aest:"19:56",utc:"2023-12-25T09:56:00Z"},
  {type:"Destructive wind warning escalation",aest:"20:40",utc:"2023-12-25T10:40:00Z"},
  {type:"Gold Coast Seaway observed gust 106 km/h",aest:"21:12",utc:"2023-12-25T11:12:00Z"}
]);
export const GOLDCOAST_SCREENING_AREAS = Object.freeze({
  north_gold_coast: {south:-28.03,north:-27.72,west:153.00,east:153.52},
  tamborine_approach:{south:-28.03,north:-27.65,west:152.72,east:153.28}
});

export function candidateInArea(alert,area) {
  return Number.isFinite(alert?.latitude)&&Number.isFinite(alert?.longitude) &&
    alert.latitude>=area.south&&alert.latitude<=area.north &&
    alert.longitude>=area.west&&alert.longitude<=area.east;
}

export function replayGoldCoastRadar(dir,radarId) {
  const index=JSON.parse(readFileSync(join(dir,"observed_frame_index.json"),"utf8"));
  if(index.length<8)throw Error("Not enough authentic measured Gold Coast observations");
  let tracks=[],nextTrack=1,previousFrame=null,previousResult=null,previousUTC=null;
  const rows=[];
  for(const entry of index){
    const utc=entry.observedUtc;
    if(!Number.isFinite(Date.parse(utc))||utc.slice(0,10)!=="2023-12-25")
      throw Error("Source time not 25 December 2023 "+utc);
    if(previousUTC && Date.parse(utc)<=Date.parse(previousUTC))
      throw Error("Input scans not ordered by source UTC");
    const categories=new Uint8Array(readFileSync(join(dir,entry.categoriesFile)));
    if(categories.length!==entry.width*entry.height)throw Error("Bad observed category raster size");
    const frame={...entry,sourceId:"BOM-MOSAIC",radarId:"BOM-MOSAIC",categories};
    if(frame.sourceMetadata?.temporalInference)throw Error("Refusing display-interpolated evidence");
    const segmentation=segmentWebMercatorCategoryFrame({
      categories, width:frame.width,height:frame.height,
      georef:frame.georef,sourceId:"BOM-MOSAIC",
      thresholdCategory:7,minPixels:8,connectivity:8
    });
    const original=cellsToRadarObservations("BOM-MOSAIC",utc,segmentation.cells);
    const observations=deduplicateRadarCells(original);
    nextTrack=updateTracks(tracks,observations,nextTrack,140,12);
    const result={tracks:tracks.map(trackToDict),segmentations:[segmentation]};
    const sourceRecord=JSON.parse(readFileSync(join(
      dir,entry.sourceMetadata.sourceFilename+".doppler.json"),"utf8"));
    if(String(sourceRecord.radarId)!==radarId||sourceRecord.observedUtc!==utc)
      throw Error("Rejected measured velocity source misalignment "+utc);
    const detection=assessV10RadarFrame({
      frame,result,previousFrame,previousResult,
      dopplerState:{records:[sourceRecord]}
    });
    const signatures=detection.alerts.map(alert=>({
      category:alert.category,track_id:alert.track_id,
      observed_utc:alert.observed_utc,source_utc:alert.source_utc??null,
      longitude:alert.longitude,latitude:alert.latitude,
      radial_velocity_kmh:alert.velocity_kmh??null,
      radial_shear_kmh:alert.radial_shear_kmh??null,
      sample_count:alert.sample_count??null,
      explanation:alert.caveat,
      in_north_gold_coast:candidateInArea(alert,GOLDCOAST_SCREENING_AREAS.north_gold_coast),
      in_tamborine_approach:candidateInArea(alert,GOLDCOAST_SCREENING_AREAS.tamborine_approach)
    }));
    const experimentalShapes=result.tracks.filter(track=>track.history?.some(
      observation=>observation.observed_utc===utc)).map(track=>
      findExperimentalHookArc(frame,result,track.track_id)).filter(Boolean);
    const record={
      observed_utc:utc, source_filename:entry.sourceMetadata.sourceFilename,
      active_measured_tracks:observations.length, segmented_cells:segmentation.cells.length,
      measured_pixels_at_least_40dbz:entry.statistics.sampled_40_dbz_pixels,
      quality_filtered_measured_radial_samples:sourceRecord.samples.length,
      single_frame_unvalidated_shape_flags:experimentalShapes.length,
      v10_signatures:signatures
    };
    rows.push(record);
    console.log("GOLDCOAST_V10_OBSERVED",radarId,utc,
      "real_cells",record.segmented_cells,
      "real_radial_samples",record.quality_filtered_measured_radial_samples,
      "candidates",JSON.stringify(signatures.slice(0,16)));
    previousFrame=frame;previousResult=result;previousUTC=utc;
  }
  const keys=["hook_shape_only","tornadic_candidate","strong_radial_signature"];
  const totals=Object.fromEntries(keys.map(k=>[k,rows.reduce((n,row)=>
    n+row.v10_signatures.filter(x=>x.category===k).length,0)]));
  return {
    source_radar:radarId,source_type:"AURA Level1 original measured lowest-elevation HDF5 scans",
    observed_scans:rows.length,observation_window_utc:[rows[0].observed_utc,rows.at(-1).observed_utc],
    v10_totals:totals,
    v10_in_north_gold_coast:Object.fromEntries(keys.map(k=>[k,rows.reduce((n,row)=>
      n+row.v10_signatures.filter(x=>x.category===k&&x.in_north_gold_coast).length,0)])),
    evidence_data_quality:"Nearest native polar gate; 40+dBZ quality; raw +/-70 km/h; no velocity dealiasing or gust conversion.",
    rows
  };
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
  const [root,out,...radars]=process.argv.slice(2);
  if(!root||!out||!radars.length)throw Error("Usage: node scripts/replay-goldcoast-v10.mjs DATA_DIR REPORT.json 66 [50]");
  const results=radars.map(id=>replayGoldCoastRadar(join(root,id),id));
  const report={
    format:"StormTrackerV10GoldCoastChristmas2023MeasuredReplayV1",
    event_date_aest:"2023-12-25",
    data_kind:"original AURA source measurements only; never synthetic scenario frames",
    boM_warning_anchors:CHRISTMAS_2023_WARNING_ANCHORS,
    area_boxes_are_screens_not_surveyed_tornado_paths:true,
    screening_areas:GOLDCOAST_SCREENING_AREAS,
    official_measured_surface_gust:{station:"Gold Coast Seaway",
       gust_kmh:106,observed_aest:"21:12",
       is_station_observation_not_radar_estimate:true,
       classification:"damaging",source:"BoM historical report"},
    limitations:"No vortex de-aliasing, multi-tilt validation, independently surveyed Coomera/Helensvale tornado ground truth or station wind match. These are research signatures only; absence is not proof of no severe winds or tornado.",
    results
  };
  writeFileSync(out,JSON.stringify(report,null,2)+"\n");
  console.log("GOLDCOAST_V10_VERDICT",JSON.stringify(results.map(x=>({
    radar:x.source_radar,scans:x.observed_scans,totals:x.v10_totals,
    northCoast:x.v10_in_north_gold_coast,window:x.observation_window_utc
  }))));
}
