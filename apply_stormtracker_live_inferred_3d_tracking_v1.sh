#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — live inferred 3-D storm tracking v1"
echo

for f in \
  frontend/live3d.html \
  frontend/src/live3d-v1.js \
  frontend/src/inferred-volume-v1.js \
  frontend/src/bom-wmts-loop-v1.js \
  frontend/3d-models/inferred_vertical_profile_model_v1.json
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-live3d-tracks-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/live3d.html "$BACKUP_DIR/live3d.html"
cp frontend/src/live3d-v1.js "$BACKUP_DIR/live3d-v1.js"

cat > frontend/src/inferred-storm-tracking-v1.js <<'JS'
import {
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=tracks-v1";

export const INFERRED_STORM_CONFIG = Object.freeze({
  detectionThresholdDbz: 30,
  occupancyThreshold: 0.35,
  minimumVoxels: 12,
  minimumHorizontalPixels: 4,
  minimumVerticalLevels: 2,
  maxSpeedKmh: 140,
  positionMarginKm: 5,
  maxGapFrames: 1,
  minimumOverlapScore: 0.12,
  minimumNoOverlapScore: 0.35
});

export function encodeVoxelKey(zIndex,row,column,width,height) {
  return (zIndex * height + row) * width + column;
}

function altitudeLevelsFromModel(model) {
  const values = new Set();
  for (const profile of model?.profiles ?? []) {
    for (const level of profile.levels ?? []) {
      const altitude = Number(level.altitude_m_amsl);
      if (Number.isFinite(altitude)) values.add(altitude);
    }
  }
  return Array.from(values).sort((a,b)=>a-b);
}

function medianSpacing(values,fallback) {
  if (values.length < 2) return fallback;
  const diffs=[];
  for (let i=1;i<values.length;i++) {
    const d=values[i]-values[i-1];
    if (d>0) diffs.push(d);
  }
  if (!diffs.length) return fallback;
  diffs.sort((a,b)=>a-b);
  return diffs[Math.floor(diffs.length/2)];
}

export function buildInferredSparseVolume(
  frame,
  model,
  {
    occupancyThreshold=INFERRED_STORM_CONFIG.occupancyThreshold,
    detectionThresholdDbz=INFERRED_STORM_CONFIG.detectionThresholdDbz
  }={}
) {
  if (!frame?.categories || !frame?.georef) {
    throw new Error("Inferred sparse volume requires a georeferenced BOM category frame.");
  }

  const levels=altitudeLevelsFromModel(model);
  if (!levels.length) throw new Error("Inferred model has no altitude levels.");

  const levelIndex=new Map(levels.map((v,i)=>[String(v),i]));
  const dx=(frame.georef.maxX-frame.georef.minX)/frame.width;
  const dy=(frame.georef.maxY-frame.georef.minY)/frame.height;
  const dz=medianSpacing(levels,500);
  const voxels=[];

  for (let row=0;row<frame.height;row++) {
    for (let column=0;column<frame.width;column++) {
      const pixelIndex=row*frame.width+column;
      const inputDbz=representativeDbzForCategory(frame.categories[pixelIndex]);
      if (inputDbz==null) continue;

      const inferred=inferColumn(model,inputDbz,{
        occupancyThreshold,
        minimumOutputDbz:detectionThresholdDbz
      });
      if (!inferred.length) continue;

      const mercator=pixelCentreMercator(frame,column,row);
      const geographic=webMercatorToDegrees(mercator.x,mercator.y);

      for (const point of inferred) {
        if (point.dbzh < detectionThresholdDbz) continue;
        const zIndex=levelIndex.get(String(Number(point.altitude_m_amsl)));
        if (zIndex==null) continue;

        voxels.push({
          key:encodeVoxelKey(zIndex,row,column,frame.width,frame.height),
          z_index:zIndex,
          row,
          column,
          x_m:mercator.x,
          y_m:mercator.y,
          longitude:geographic.longitude,
          latitude:geographic.latitude,
          altitude_m_amsl:Number(point.altitude_m_amsl),
          dbzh:Number(point.dbzh),
          confidence:Number(point.confidence)
        });
      }
    }
  }

  return {
    observedUtc:frame.observedUtc,
    width:frame.width,
    height:frame.height,
    altitude_levels_m:levels,
    spacing:{dx_m:Math.abs(dx),dy_m:Math.abs(dy),dz_m:Math.abs(dz)},
    georef:frame.georef,
    voxels
  };
}

function mean(values) {
  return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
}

export function segmentInferredSparseVolume(volume,config=INFERRED_STORM_CONFIG) {
  const voxelMap=new Map(volume.voxels.map(v=>[v.key,v]));
  const visited=new Set();
  const raw=[];

  for (const seed of volume.voxels) {
    if (visited.has(seed.key)) continue;
    const queue=[seed];
    const component=[];
    visited.add(seed.key);

    for (let q=0;q<queue.length;q++) {
      const current=queue[q];
      component.push(current);

      for (let dz=-1;dz<=1;dz++) for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
        if (dz===0 && dr===0 && dc===0) continue;
        const zi=current.z_index+dz;
        const row=current.row+dr;
        const col=current.column+dc;

        if (
          zi<0 || zi>=volume.altitude_levels_m.length ||
          row<0 || row>=volume.height ||
          col<0 || col>=volume.width
        ) continue;

        const key=encodeVoxelKey(zi,row,col,volume.width,volume.height);
        const neighbour=voxelMap.get(key);
        if (!neighbour || visited.has(key)) continue;
        visited.add(key);
        queue.push(neighbour);
      }
    }

    raw.push(component);
  }

  const accepted=[];

  for (const component of raw) {
    const horizontalPixels=new Set(component.map(v=>v.row*volume.width+v.column)).size;
    const verticalLevels=new Set(component.map(v=>v.z_index)).size;

    if (
      component.length<config.minimumVoxels ||
      horizontalPixels<config.minimumHorizontalPixels ||
      verticalLevels<config.minimumVerticalLevels
    ) continue;

    const weights=component.map(v=>Math.max(1,v.dbzh-config.detectionThresholdDbz+1));
    const totalWeight=weights.reduce((a,b)=>a+b,0);
    const weighted=field=>component.reduce((sum,v,i)=>sum+v[field]*weights[i],0)/totalWeight;

    const centroidX=weighted("x_m");
    const centroidY=weighted("y_m");
    const centroidZ=weighted("altitude_m_amsl");
    const centroidGeo=webMercatorToDegrees(centroidX,centroidY);

    const xs=component.map(v=>v.x_m);
    const ys=component.map(v=>v.y_m);
    const zs=component.map(v=>v.altitude_m_amsl);
    const minX=Math.min(...xs),maxX=Math.max(...xs);
    const minY=Math.min(...ys),maxY=Math.max(...ys);
    const minZ=Math.min(...zs),maxZ=Math.max(...zs);
    const envelopeGeo=webMercatorToDegrees((minX+maxX)/2,(minY+maxY)/2);

    const echoTop=threshold=>{
      const values=component.filter(v=>v.dbzh>=threshold).map(v=>v.altitude_m_amsl);
      return values.length ? Math.max(...values) : null;
    };

    const dbzh=component.map(v=>v.dbzh);
    const confidence=component.map(v=>v.confidence);

    accepted.push({
      local_cell_id:0,
      voxel_count:component.length,
      horizontal_pixels:horizontalPixels,
      vertical_levels:verticalLevels,
      sampled_horizontal_area_km2:
        horizontalPixels*volume.spacing.dx_m*volume.spacing.dy_m/1e6,
      sampled_voxel_volume_km3:
        component.length*volume.spacing.dx_m*volume.spacing.dy_m*volume.spacing.dz_m/1e9,
      maximum_dbzh:Math.max(...dbzh),
      mean_dbzh:mean(dbzh),
      mean_profile_confidence:mean(confidence),
      echo_top_40_m_amsl:echoTop(40),
      echo_top_50_m_amsl:echoTop(50),
      centroid:{
        x_m:centroidX,
        y_m:centroidY,
        altitude_m_amsl:centroidZ,
        longitude:centroidGeo.longitude,
        latitude:centroidGeo.latitude
      },
      display_envelope:{
        longitude:envelopeGeo.longitude,
        latitude:envelopeGeo.latitude,
        altitude_m_amsl:(minZ+maxZ)/2,
        east_west_m:maxX-minX+volume.spacing.dx_m,
        north_south_m:maxY-minY+volume.spacing.dy_m,
        vertical_m:maxZ-minZ+volume.spacing.dz_m
      },
      voxel_keys:component.map(v=>v.key)
    });
  }

  accepted.sort((a,b)=>b.maximum_dbzh-a.maximum_dbzh || b.voxel_count-a.voxel_count);
  accepted.forEach((cell,index)=>{cell.local_cell_id=index+1;});

  return {
    observedUtc:volume.observedUtc,
    raw_component_count:raw.length,
    retained_cell_count:accepted.length,
    rejected_component_count:raw.length-accepted.length,
    cells:accepted
  };
}

function countOverlap(aKeys,bKeys) {
  const smaller=aKeys.length<=bKeys.length?aKeys:bKeys;
  const larger=new Set(smaller===aKeys?bKeys:aKeys);
  let count=0;
  for (const key of smaller) if (larger.has(key)) count++;
  return count;
}

function predictPosition(observations,currentTimeMs) {
  const last=observations.at(-1);
  if (observations.length<2) return {x_m:last.x_m,y_m:last.y_m};

  const previous=observations.at(-2);
  const t0=Date.parse(previous.observed_utc);
  const t1=Date.parse(last.observed_utc);
  const history=(t1-t0)/1000;
  if (!(history>0)) return {x_m:last.x_m,y_m:last.y_m};

  const vx=(last.x_m-previous.x_m)/history;
  const vy=(last.y_m-previous.y_m)/history;
  const forecast=(currentTimeMs-t1)/1000;
  if (!(forecast>0)) return {x_m:last.x_m,y_m:last.y_m};

  return {x_m:last.x_m+vx*forecast,y_m:last.y_m+vy*forecast};
}

function candidateScore(track,cell,frameIndex,observedUtc,overlapVoxels,config) {
  const last=track.observations.at(-1);
  const currentTime=Date.parse(observedUtc);
  const lastTime=Date.parse(last.observed_utc);
  const dt=(currentTime-lastTime)/1000;
  if (!(dt>0)) return null;

  const gap=frameIndex-last.frame_index-1;
  if (gap>config.maxGapFrames) return null;

  const dx=cell.centroid.x_m-last.x_m;
  const dy=cell.centroid.y_m-last.y_m;
  const rawDistance=Math.hypot(dx,dy);
  const rawSpeed=rawDistance/dt*3.6;
  if (rawSpeed>config.maxSpeedKmh) return null;

  const predicted=predictPosition(track.observations,currentTime);
  const predictionError=Math.hypot(
    cell.centroid.x_m-predicted.x_m,
    cell.centroid.y_m-predicted.y_m
  );

  const scale=(config.maxSpeedKmh/3.6)*dt+config.positionMarginKm*1000;
  const distanceScore=Math.max(0,1-rawDistance/scale);
  const predictionScore=Math.max(0,1-predictionError/scale);

  const previousVoxels=Math.max(1,last.voxel_count);
  const currentVoxels=Math.max(1,cell.voxel_count);
  const sizeScore=Math.min(previousVoxels,currentVoxels)/Math.max(previousVoxels,currentVoxels);
  const intensityScore=Math.max(0,1-Math.abs(cell.maximum_dbzh-last.maximum_dbzh)/30);

  let score,method,minimum,overlapFraction=0,iou=0;

  if (overlapVoxels>0) {
    overlapFraction=overlapVoxels/Math.min(previousVoxels,currentVoxels);
    const union=previousVoxels+currentVoxels-overlapVoxels;
    if (union>0) iou=overlapVoxels/union;
    score=
      0.45+
      0.20*overlapFraction+
      0.10*iou+
      0.10*distanceScore+
      0.05*predictionScore+
      0.05*intensityScore+
      0.05*sizeScore;
    method="overlap+motion";
    minimum=config.minimumOverlapScore;
  } else {
    score=
      0.45*distanceScore+
      0.25*predictionScore+
      0.15*sizeScore+
      0.15*intensityScore;
    method="motion";
    minimum=config.minimumNoOverlapScore;
  }

  if (gap>0) {
    score*=0.80**gap;
    method=`gap+${method}`;
  }

  if (score<minimum) return null;

  return {
    score,
    method,
    raw_distance_m:rawDistance,
    raw_speed_kmh:rawSpeed,
    prediction_error_m:predictionError,
    overlap_voxels:overlapVoxels,
    overlap_fraction:overlapFraction,
    iou,
    gap_frames:gap
  };
}

function makeObservation(frameIndex,observedUtc,cell,previous,match) {
  let motion=null;

  if (previous) {
    const dt=(Date.parse(observedUtc)-Date.parse(previous.observed_utc))/1000;
    if (dt>0) {
      const dx=cell.centroid.x_m-previous.x_m;
      const dy=cell.centroid.y_m-previous.y_m;
      const distance=Math.hypot(dx,dy);
      motion={
        distance_m:distance,
        speed_kmh:distance/dt*3.6,
        bearing_degrees:(Math.atan2(dx,dy)*180/Math.PI+360)%360
      };
    }
  }

  return {
    frame_index:frameIndex,
    observed_utc:observedUtc,
    local_cell_id:cell.local_cell_id,
    x_m:cell.centroid.x_m,
    y_m:cell.centroid.y_m,
    longitude:cell.centroid.longitude,
    latitude:cell.centroid.latitude,
    altitude_m_amsl:cell.centroid.altitude_m_amsl,
    voxel_count:cell.voxel_count,
    maximum_dbzh:cell.maximum_dbzh,
    mean_dbzh:cell.mean_dbzh,
    mean_profile_confidence:cell.mean_profile_confidence,
    echo_top_40_m_amsl:cell.echo_top_40_m_amsl,
    echo_top_50_m_amsl:cell.echo_top_50_m_amsl,
    sampled_voxel_volume_km3:cell.sampled_voxel_volume_km3,
    display_envelope:cell.display_envelope,
    motion_from_previous:motion,
    match
  };
}

export function trackInferredSegments(segmentedFrames,config=INFERRED_STORM_CONFIG) {
  const tracks=[];
  let nextTrackNumber=1;
  const outputFrames=[];

  for (let frameIndex=0;frameIndex<segmentedFrames.length;frameIndex++) {
    const frame=segmentedFrames[frameIndex];
    const candidates=[];

    for (const track of tracks) {
      const last=track.observations.at(-1);
      if (frameIndex-last.frame_index-1>config.maxGapFrames) continue;

      for (const cell of frame.cells) {
        const overlap=
          last.frame_index===frameIndex-1
            ? countOverlap(track._last_voxel_keys,cell.voxel_keys)
            : 0;

        const candidate=candidateScore(
          track,cell,frameIndex,frame.observedUtc,overlap,config
        );
        if (candidate) candidates.push({track,cell,candidate});
      }
    }

    candidates.sort((a,b)=>b.candidate.score-a.candidate.score);

    const assignedTracks=new Set();
    const assignedCells=new Set();
    const assignments=new Map();

    for (const item of candidates) {
      if (
        assignedTracks.has(item.track.track_id) ||
        assignedCells.has(item.cell.local_cell_id)
      ) continue;

      assignedTracks.add(item.track.track_id);
      assignedCells.add(item.cell.local_cell_id);
      assignments.set(item.cell.local_cell_id,item);
    }

    const frameCells=[];

    for (const cell of frame.cells) {
      const assignment=assignments.get(cell.local_cell_id);
      let track,match,previous=null;

      if (assignment) {
        track=assignment.track;
        match=assignment.candidate;
        previous=track.observations.at(-1);
      } else {
        track={
          track_id:`ST${String(nextTrackNumber++).padStart(4,"0")}`,
          observations:[],
          _last_voxel_keys:[]
        };
        tracks.push(track);
        match={score:null,method:"new-track"};
      }

      const observation=makeObservation(
        frameIndex,frame.observedUtc,cell,previous,match
      );

      track.observations.push(observation);
      track._last_voxel_keys=cell.voxel_keys;

      frameCells.push({
        track_id:track.track_id,
        local_cell_id:cell.local_cell_id,
        voxel_count:cell.voxel_count,
        maximum_dbzh:cell.maximum_dbzh,
        mean_dbzh:cell.mean_dbzh,
        mean_profile_confidence:cell.mean_profile_confidence,
        echo_top_40_m_amsl:cell.echo_top_40_m_amsl,
        echo_top_50_m_amsl:cell.echo_top_50_m_amsl,
        sampled_voxel_volume_km3:cell.sampled_voxel_volume_km3,
        centroid:cell.centroid,
        display_envelope:cell.display_envelope,
        motion_from_previous:observation.motion_from_previous,
        match
      });
    }

    outputFrames.push({
      frame_index:frameIndex,
      observed_utc:frame.observedUtc,
      raw_component_count:frame.raw_component_count,
      retained_cell_count:frame.retained_cell_count,
      cells:frameCells
    });
  }

  const cleanTracks=tracks.map(track=>({
    track_id:track.track_id,
    observation_count:track.observations.length,
    maximum_dbzh:Math.max(...track.observations.map(o=>o.maximum_dbzh)),
    maximum_echo_top_40_m_amsl:
      Math.max(
        0,
        ...track.observations
          .map(o=>o.echo_top_40_m_amsl)
          .filter(Number.isFinite)
      ) || null,
    maximum_speed_kmh:
      Math.max(
        0,
        ...track.observations
          .map(o=>o.motion_from_previous?.speed_kmh)
          .filter(Number.isFinite)
      ) || null,
    observations:track.observations
  }));

  const latest=outputFrames.at(-1);

  return {
    frames:outputFrames,
    tracks:cleanTracks,
    summary:{
      total_tracks:cleanTracks.length,
      persistent_tracks_3plus:
        cleanTracks.filter(t=>t.observation_count>=3).length,
      active_track_ids:
        latest ? latest.cells.map(c=>c.track_id) : [],
      total_detected_cells:
        outputFrames.reduce((sum,f)=>sum+f.cells.length,0)
    }
  };
}
JS

cp frontend/src/live3d-v1.js frontend/src/live3d-tracks-v1.js

python3 - <<'PY'
from pathlib import Path

p=Path("frontend/src/live3d-tracks-v1.js")
text=p.read_text(encoding="utf-8")

old='''import {
  loadLatestBomReflectivityMosaic
} from "./bom-wmts-diagnostics-v1.js?v=live3d-v1";'''

new='''import {
  loadLatestBomReflectivityMosaic,
  loadRecentBomReflectivityMosaics
} from "./bom-wmts-loop-v1.js?v=live3d-tracks-v1";'''

if old not in text:
    raise SystemExit("ERROR: BOM import not found.")
text=text.replace(old,new,1)

marker='''const MODEL_URL =
  "./3d-models/inferred_vertical_profile_model_v1.json";'''

tracking_import='''import {
  buildInferredSparseVolume,
  segmentInferredSparseVolume,
  trackInferredSegments
} from "./inferred-storm-tracking-v1.js?v=live3d-tracks-v1";

'''

if marker not in text:
    raise SystemExit("ERROR: MODEL_URL marker not found.")
text=text.replace(marker,tracking_import+marker,1)

state='''let restoringCamera = false;'''

state_new='''let restoringCamera = false;

let trackingFrames = [];
let trackingResult = null;
let trackingFrameIndex = 0;
let trackingPlaying = false;

const trackingSource =
  new Cesium.CustomDataSource(
    "live-inferred-3d-tracks"
  );

viewer.dataSources.add(
  trackingSource
);'''

if state not in text:
    raise SystemExit("ERROR: state marker not found.")
text=text.replace(state,state_new,1)

insert_before='''async function loadLatest() {'''

functions=r'''
function trackColour(trackId) {
  const n=Number(String(trackId).replace(/\D/g,""))||1;
  return Cesium.Color.fromHsl((n*0.61803398875)%1,0.78,0.58,1);
}

function clearTrackingOverlay() {
  trackingSource.entities.removeAll();
  $("trackingCurrentObjects").textContent="0";
  $("trackingActiveIds").textContent="—";
  scene.requestRender();
}

function renderTrackingObjects(frameIndex) {
  trackingSource.entities.suspendEvents();

  try {
    trackingSource.entities.removeAll();

    if (!trackingResult) return;

    const frame=trackingResult.frames[frameIndex];
    if (!frame) return;

    const activeIds=new Set(frame.cells.map(cell=>cell.track_id));

    for (const cell of frame.cells) {
      const colour=trackColour(cell.track_id);
      const centre=cell.centroid;
      const position=Cesium.Cartesian3.fromDegrees(
        centre.longitude,
        centre.latitude,
        displayAltitude(centre.altitude_m_amsl)
      );

      trackingSource.entities.add({
        id:`live-cell-${frameIndex}-${cell.track_id}`,
        position,
        point:{
          pixelSize:11,
          color:colour,
          outlineColor:Cesium.Color.WHITE,
          outlineWidth:1
        },
        label:{
          text:`${cell.track_id}  ${cell.maximum_dbzh.toFixed(0)} dBZ`,
          font:"12px sans-serif",
          pixelOffset:new Cesium.Cartesian2(0,-18),
          fillColor:Cesium.Color.WHITE,
          showBackground:true,
          backgroundColor:Cesium.Color.BLACK.withAlpha(0.62)
        }
      });

      if ($("showTrackingEnvelopes")?.checked) {
        const envelope=cell.display_envelope;
        const boxPosition=Cesium.Cartesian3.fromDegrees(
          envelope.longitude,
          envelope.latitude,
          displayAltitude(envelope.altitude_m_amsl)
        );

        trackingSource.entities.add({
          id:`live-box-${frameIndex}-${cell.track_id}`,
          position:boxPosition,
          orientation:Cesium.Transforms.headingPitchRollQuaternion(
            boxPosition,
            new Cesium.HeadingPitchRoll(0,0,0)
          ),
          box:{
            dimensions:new Cesium.Cartesian3(
              envelope.east_west_m,
              envelope.north_south_m,
              envelope.vertical_m*Number($("verticalScale").value)
            ),
            material:colour.withAlpha(0.055),
            outline:true,
            outlineColor:colour.withAlpha(0.72)
          }
        });
      }
    }

    for (const track of trackingResult.tracks) {
      const observations=track.observations.filter(o=>o.frame_index<=frameIndex);
      if (observations.length<2) continue;

      const colour=trackColour(track.track_id);
      const positions=observations.map(o=>Cesium.Cartesian3.fromDegrees(
        o.longitude,
        o.latitude,
        displayAltitude(o.altitude_m_amsl)
      ));

      trackingSource.entities.add({
        id:`live-trail-${track.track_id}`,
        polyline:{
          positions,
          width:activeIds.has(track.track_id)?3:1.5,
          material:colour.withAlpha(activeIds.has(track.track_id)?0.88:0.30),
          clampToGround:false
        }
      });
    }

    $("trackingCurrentObjects").textContent=String(frame.cells.length);
    $("trackingActiveIds").textContent=
      frame.cells.length
        ? frame.cells.map(cell=>cell.track_id).join(", ")
        : "none";
  } finally {
    trackingSource.entities.resumeEvents();
  }

  scene.requestRender();
}

function updateSourceMetrics(frame) {
  $("sourceTime").textContent=
    frame.observedUtc.replace("T"," ").replace("Z"," UTC");

  $("decodedPixels").textContent=
    (frame.sourceMetadata?.colouredPixelCount??0).toLocaleString();

  const maximumCategory=frame.sourceMetadata?.maxCategory??0;
  const maxLower=frame.sourceMetadata?.maxDbzLowerBound;

  $("sourceMaximum").textContent=
    maximumCategory
      ? (maxLower==null
          ? `category ${maximumCategory}`
          : `category ${maximumCategory} (>=${maxLower} dBZ)`)
      : "none";
}

async function showTrackingFrame(index) {
  if (!trackingResult || !trackingFrames.length) return;

  trackingFrameIndex=Math.max(
    0,
    Math.min(trackingFrames.length-1,Number(index))
  );

  const frame=trackingFrames[trackingFrameIndex];
  latestFrame=frame;

  $("trackingFrameSlider").value=String(trackingFrameIndex);
  $("trackingFrameLabel").textContent=
    `${trackingFrameIndex+1}/${trackingFrames.length}`;

  await renderSurface(frame);
  renderInferredVolume(frame);
  renderTrackingObjects(trackingFrameIndex);
  updateSourceMetrics(frame);

  setStatus(
    `INFERRED LIVE 3-D tracking frame ${trackingFrameIndex+1}/${trackingFrames.length}: ` +
    `${frame.observedUtc}; ${trackingResult.frames[trackingFrameIndex].cells.length} inferred 3-D storm objects.`,
    "ok"
  );
}

function trackingDelay(ms) {
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function playTrackingOnce() {
  if (trackingPlaying || !trackingResult) return;

  trackingPlaying=true;
  $("playTrackingButton").disabled=true;

  try {
    for (let index=0;index<trackingFrames.length;index++) {
      await showTrackingFrame(index);
      await trackingDelay(650);
    }
  } finally {
    trackingPlaying=false;
    $("playTrackingButton").disabled=false;
  }
}

async function loadTrackingSequence() {
  setStatus("Loading latest 6 BOM frames and building inferred 3-D storm tracks…");
  clearTrackingOverlay();

  const frames=await loadRecentBomReflectivityMosaics(
    Date.now(),
    6,
    progress=>{
      if (progress.stage==="loading") {
        setStatus(
          `Loading BOM frame ${progress.index+1}/${progress.total}: ${progress.observedUtc}`
        );
      }
    }
  );

  const segments=[];

  for (let index=0;index<frames.length;index++) {
    setStatus(
      `Inferring and segmenting 3-D frame ${index+1}/${frames.length}: ${frames[index].observedUtc}`
    );

    const sparse=buildInferredSparseVolume(frames[index],model);
    segments.push(segmentInferredSparseVolume(sparse));
  }

  trackingFrames=frames;
  trackingResult=trackInferredSegments(segments);
  trackingFrameIndex=0;

  $("trackingFrameSlider").max=String(frames.length-1);
  $("trackingFrameSlider").disabled=false;
  $("playTrackingButton").disabled=false;
  $("trackingTotalTracks").textContent=
    String(trackingResult.summary.total_tracks);
  $("trackingPersistentTracks").textContent=
    String(trackingResult.summary.persistent_tracks_3plus);
  $("trackingTotalCells").textContent=
    String(trackingResult.summary.total_detected_cells);

  await playTrackingOnce();

  setStatus(
    `INFERRED LIVE 3-D TRACKING COMPLETE: ${frames.length} frames; ` +
    `${trackingResult.summary.total_detected_cells} inferred 3-D objects; ` +
    `${trackingResult.summary.total_tracks} track identities; ` +
    `${trackingResult.summary.persistent_tracks_3plus} persistent tracks observed in >=3 scans. ` +
    `Vertical structure remains inferred, not measured.`,
    "ok"
  );
}

'''

if insert_before not in text:
    raise SystemExit("ERROR: loadLatest marker not found.")
text=text.replace(insert_before,functions+insert_before,1)

load_start='''async function loadLatest() {
  setStatus('''

load_start_new='''async function loadLatest() {
  clearTrackingOverlay();
  trackingResult = null;
  trackingFrames = [];

  setStatus('''

if load_start not in text:
    raise SystemExit("ERROR: loadLatest start not found.")
text=text.replace(load_start,load_start_new,1)

listener='''$("loadButton").addEventListener(
  "click",'''

extra_listeners=r'''
$("loadTrackingButton").addEventListener(
  "click",
  () => loadTrackingSequence().catch(error=>{
    console.error(error);
    setStatus(error.message,"error");
  })
);

$("trackingFrameSlider").addEventListener(
  "input",
  event => showTrackingFrame(Number(event.target.value))
    .catch(error=>setStatus(error.message,"error"))
);

$("playTrackingButton").addEventListener(
  "click",
  () => playTrackingOnce()
    .catch(error=>setStatus(error.message,"error"))
);

$("showTrackingEnvelopes").addEventListener(
  "change",
  () => renderTrackingObjects(trackingFrameIndex)
);

'''

if listener not in text:
    raise SystemExit("ERROR: loadButton listener not found.")
text=text.replace(listener,extra_listeners+listener,1)

vertical='''    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }
  }
);

$("pointSize")'''

vertical_new='''    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }

    if (trackingResult) {
      renderTrackingObjects(
        trackingFrameIndex
      );
    }
  }
);

$("pointSize")'''

if vertical not in text:
    raise SystemExit("ERROR: vertical-scale listener not found.")
text=text.replace(vertical,vertical_new,1)

p.write_text(text,encoding="utf-8")
PY

cp frontend/live3d.html frontend/live3d-tracks.html

python3 - <<'PY'
from pathlib import Path

p=Path("frontend/live3d-tracks.html")
text=p.read_text(encoding="utf-8")

text=text.replace(
    "StormTracker — Live Inferred 3-D",
    "StormTracker — Live Inferred 3-D Tracking"
)

text=text.replace(
    "public BOM reflectivity • empirical vertical reconstruction • prototype V1",
    "public BOM reflectivity • inferred 3-D storm objects • persistent tracking • prototype V2"
)

marker='''    <section class="card">
      <h2>
        Historical validation
      </h2>'''

card='''    <section class="card">
      <h2>
        Inferred 3-D storm tracking
      </h2>

      <button
        id="loadTrackingButton"
        style="width:100%"
      >
        Load 30-min inferred 3-D tracks
      </button>

      <label>
        Tracking frame:
        <strong><span id="trackingFrameLabel">—</span></strong>
      </label>

      <input
        id="trackingFrameSlider"
        type="range"
        min="0"
        max="5"
        value="0"
        step="1"
        disabled
      >

      <div style="display:flex;gap:6px;margin-top:7px">
        <button
          id="playTrackingButton"
          disabled
          style="flex:1"
        >
          Play once
        </button>
      </div>

      <label style="display:flex;gap:7px;align-items:center">
        <input
          id="showTrackingEnvelopes"
          type="checkbox"
          checked
        >
        Show inferred 3-D object envelopes
      </label>

      <div class="metric" style="margin-top:8px">
        <span>Current objects</span>
        <strong id="trackingCurrentObjects">0</strong>

        <span>Total detected objects</span>
        <strong id="trackingTotalCells">—</strong>

        <span>Total track identities</span>
        <strong id="trackingTotalTracks">—</strong>

        <span>Persistent tracks ≥3 scans</span>
        <strong id="trackingPersistentTracks">—</strong>

        <span>Current IDs</span>
        <strong id="trackingActiveIds">—</strong>
      </div>

      <div style="margin-top:8px;color:#9fb1bb;font-size:10px;line-height:1.4">
        Tracking uses inferred 3-D voxel overlap plus physically constrained
        centroid motion. This prototype plays one 30-minute sequence once;
        final selectable 30-minute to 3-hour looping remains deferred until
        the core product is complete.
      </div>
    </section>

'''

if marker not in text:
    raise SystemExit("ERROR: Historical validation marker not found.")

text=text.replace(marker,card+marker,1)
text=text.replace(
    'src="./src/live3d-v1.js"',
    'src="./src/live3d-tracks-v1.js"'
)

p.write_text(text,encoding="utf-8")
PY

cat > frontend/tests/run-inferred-tracking-tests.mjs <<'JS'
import assert from "node:assert/strict";
import {
  encodeVoxelKey,
  segmentInferredSparseVolume,
  trackInferredSegments
} from "../src/inferred-storm-tracking-v1.js";

function makeVoxel(z,row,column,{width=40,height=40,dbzh=45}={}) {
  return {
    key:encodeVoxelKey(z,row,column,width,height),
    z_index:z,
    row,
    column,
    x_m:column*1000,
    y_m:row*1000,
    longitude:153+column*0.01,
    latitude:-27+row*0.01,
    altitude_m_amsl:250+z*500,
    dbzh,
    confidence:0.7
  };
}

function volume(observedUtc,voxels,width=40,height=40) {
  return {
    observedUtc,
    width,
    height,
    altitude_levels_m:Array.from({length:20},(_,i)=>250+i*500),
    spacing:{dx_m:1000,dy_m:1000,dz_m:500},
    voxels
  };
}

function block(rowOffset,columnOffset) {
  const voxels=[];
  for (let z=0;z<3;z++) {
    for (let row=0;row<2;row++) {
      for (let column=0;column<2;column++) {
        voxels.push(makeVoxel(z,row+rowOffset,column+columnOffset));
      }
    }
  }
  return voxels;
}

const accepted=segmentInferredSparseVolume(
  volume("2026-10-03T00:00:00Z",block(10,10))
);

assert.equal(accepted.retained_cell_count,1);
assert.equal(accepted.cells[0].voxel_count,12);
assert.equal(accepted.cells[0].horizontal_pixels,4);
assert.equal(accepted.cells[0].vertical_levels,3);

const rejected=segmentInferredSparseVolume(
  volume("2026-10-03T00:00:00Z",[
    makeVoxel(0,5,5),
    makeVoxel(1,5,5),
    makeVoxel(2,5,5)
  ])
);

assert.equal(rejected.retained_cell_count,0);

const frame0=segmentInferredSparseVolume(
  volume("2026-10-03T00:00:00Z",block(10,10))
);

const frame1=segmentInferredSparseVolume(
  volume("2026-10-03T00:05:00Z",block(10,11))
);

const plausible=trackInferredSegments([frame0,frame1]);

assert.equal(plausible.tracks.length,1);
assert.equal(plausible.tracks[0].track_id,"ST0001");
assert.equal(plausible.tracks[0].observation_count,2);

const farFrame=segmentInferredSparseVolume(
  volume("2026-10-03T00:05:00Z",block(10,35))
);

const impossible=trackInferredSegments([frame0,farFrame]);

assert.equal(impossible.tracks.length,2);
assert.equal(impossible.tracks[0].track_id,"ST0001");
assert.equal(impossible.tracks[1].track_id,"ST0002");

console.log("4 inferred-tracking tests passed.");
JS

echo
echo "Checking JavaScript syntax..."
node --check frontend/src/inferred-storm-tracking-v1.js
node --check frontend/src/live3d-tracks-v1.js

echo
echo "Running inferred 3-D tracking tests..."
node frontend/tests/run-inferred-tracking-tests.mjs

echo
echo "Running inferred-volume tests..."
node frontend/tests/run-inferred-volume-tests.mjs

echo
echo "Running existing StormTracker regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Deployable files:"
ls -lh \
  frontend/live3d-tracks.html \
  frontend/src/live3d-tracks-v1.js \
  frontend/src/inferred-storm-tracking-v1.js \
  frontend/tests/run-inferred-tracking-tests.mjs

echo
echo "SUCCESS"
echo "Expected:"
echo "  4 inferred-tracking tests passed."
echo "  4 inferred-volume tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/live3d-tracks.html frontend/src/live3d-tracks-v1.js frontend/src/inferred-storm-tracking-v1.js frontend/tests/run-inferred-tracking-tests.mjs'
echo 'git commit -m "Add live inferred 3-D storm tracking prototype"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/live3d-tracks.html"
echo
echo "Then press:"
echo "  Load 30-min inferred 3-D tracks"
echo
echo "Send back the final green status line and one screenshot."
