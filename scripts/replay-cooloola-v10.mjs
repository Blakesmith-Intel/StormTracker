import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Cooloola coast is a geographic subset of the November 24 Gympie 08 source
// archive, NOT a second independent radar dataset or a surveyed tornado track.
// Approximate screening envelope encompasses Cooloola coast and inland forests
// north and south of Tin Can Bay. It is deliberately broader than damage areas.
export const COOLOOLA_RESEARCH_BOX = Object.freeze({
  north:-25.80, south:-26.60, west:152.78, east:153.30
});
export function insideBox(location,bounds=COOLOOLA_RESEARCH_BOX) {
  return Number.isFinite(location?.latitude) &&
    Number.isFinite(location?.longitude) &&
    location.latitude>=bounds.south && location.latitude<=bounds.north &&
    location.longitude>=bounds.west && location.longitude<=bounds.east;
}
function km(a,b) {
  const dy=(a.latitude-b.latitude)*111.32;
  const dx=(a.longitude-b.longitude)*111.32 *
    Math.cos((a.latitude+b.latitude)*Math.PI/360);
  return Math.hypot(dx,dy);
}
export function radialEvidenceNear(location,record) {
  // Descriptive radial gate evidence only; NO tornado, gust, or severity
  // classification follows from counts or opposite signs.
  const samples=(record?.samples??[]).filter(s=>
    Number.isFinite(s.longitude)&&Number.isFinite(s.latitude)&&
    Number.isFinite(s.velocity_kmh) &&
    Math.abs(s.velocity_kmh)<=70);
  const radii=[3,5,8,10];
  return Object.fromEntries(radii.map(radius=>{
    const inside=samples.filter(s=>km(s,location)<=radius);
    const neg=inside.filter(s=>s.velocity_kmh<=-40);
    const pos=inside.filter(s=>s.velocity_kmh>=40);
    let nearest=null;
    for(const a of neg) for(const b of pos) {
      const d=km(a,b); if(nearest===null||d<nearest)nearest=d;
    }
    return [String(radius),{
      total_measured_samples:inside.length,
      radial_toward_at_least_40_kmh:neg.length,
      radial_away_at_least_40_kmh:pos.length,
      closest_opposite_sign_samples_km:nearest===null?null:Number(nearest.toFixed(3))
    }];
  }));
}
export function summariseCooloola(report,radialDir) {
  if(report.observed_scans_processed!==28 ||
     report.source_date!=="2025-11-24" ||
     report.time_inference_used!==false) {
    throw Error("Cooloola analysis requires actual archived November 24, 2025 Gympie scans");
  }
  const rows=report.rows.map(row=>{
    const located=(row.v10_candidates??[]).filter(x=>insideBox(x));
    const filename=row.source_filename;
    const doppler=JSON.parse(readFileSync(join(radialDir,filename+".doppler.json"),"utf8"));
    if(doppler.observedUtc!==row.observed_utc || doppler.radarId!=="08")
      throw Error("Unmatched source time/radar in "+filename);
    const evidence=located.map(x=>({
      ...x,nearby_measured_radial:radialEvidenceNear(x,doppler)
    }));
    return {
      observed_utc:row.observed_utc,
      source_filename:filename,
      region_candidates:evidence,
      region_candidate_counts:Object.fromEntries(
        ["hook_shape_only","tornadic_candidate","strong_radial_signature"]
        .map(key=>[key,evidence.filter(x=>x.category===key).length])
      ),
      total_original_radial_samples:row.doppler_samples
    };
  });
  const totals=Object.fromEntries(
    ["hook_shape_only","tornadic_candidate","strong_radial_signature"]
    .map(key=>[key,rows.reduce((count,row)=>count+row.region_candidate_counts[key],0)])
  );
  return {
    format:"StormTrackerCooloolaCoastSourceMatchedReplayV10",
    independent_event:false,
    source_date:"2025-11-24",
    original_radar:"08 Gympie (Mt Kanigan), genuine AURA Level-1",
    region_label:"Cooloola coast / Toolara forest broad screening envelope",
    region_extent_approximate:COOLOOLA_RESEARCH_BOX,
    region_extent_is_surveyed_damage_track:false,
    observed_scans_processed:rows.length,
    source_time_inference_used:false,
    regional_candidate_totals:totals,
    scientific_caveat:"No surveyed damage path or official tornado classification is correlated here. Same real event as the Gympie replay. Velocity is raw bounded co-elevation radial data, not a ground-level wind gust. No dealiasing, no proof of tornadic circulation. Null negatives do not establish absence.",
    independent_ground_truth_candidates:[
      {label:"Cooloola Coast aerial storm-damage reporting",url:"https://www.couriermail.com.au/news/queensland/gympie/severe-storm-rips-tornado-scar-across-cooloola-coast-forestry-in-stunning-photos/news-story/c58600a2511d731b0c017e4f4bf5bc17",status:"reported, not georeferenced or validated by this replay"},
      {label:"Queensland open natural disaster optical imagery",url:"https://spatial-img.information.qld.gov.au/arcgis/rest/services/EventsIncidents/NaturalDisaster_Imagery_OpenData/ImageServer",status:"public imagery service identified; specific acquisition covering this storm not established"},
      {label:"BoM tornado event archive",url:"https://www.bom.gov.au/australia/stormarchive/storm.php?stormType=tornado",status:"catalogue to query; event record not independently verified"}
    ],
    rows
  };
}
if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href){
  const [source,out,velocity]=process.argv.slice(2);
  if(!source||!out||!velocity)throw Error("Usage: node scripts/replay-cooloola-v10.mjs ALL_REGION_GYMPIE_REPORT.json COOLOOLA_REPORT.json DOPPLER_DIR");
  const result=summariseCooloola(JSON.parse(readFileSync(source,"utf8")),velocity);
  writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  console.log("COOLOOLA_V10_SUMMARY",JSON.stringify({
    observed:result.observed_scans_processed,
    totals:result.regional_candidate_totals,
    findings:result.rows.filter(row=>row.region_candidates.length>0)
      .map(row=>({observedUtc:row.observed_utc,candidates:row.region_candidates.length,
        trackIds:row.region_candidates.map(x=>x.track_id)}))
  }));
}
