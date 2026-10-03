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
