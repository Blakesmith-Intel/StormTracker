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
