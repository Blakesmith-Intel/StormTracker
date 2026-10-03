import assert from "node:assert/strict";

import {
  footerGeometry,
  locateFooterVelocityBar
} from "../src/doppler-footer-palette-v3.js";

function fixture(){
  const width=100;
  const height=120;
  const data=new Uint8ClampedArray(width*height*4);

  function set(x,y,rgb){
    const i=(y*width+x)*4;
    data[i]=rgb[0];
    data[i+1]=rgb[1];
    data[i+2]=rgb[2];
    data[i+3]=255;
  }

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      set(x,y,[15,15,15]);
    }
  }

  // Strong map-like colours ABOVE the footer. V3 must ignore them.
  for(let x=10;x<90;x++){
    set(x,90,[255,150,0]);
  }

  // Footer starts at y=100 because width=100.
  const colours=[
    [0,0,160],
    [0,70,220],
    [0,160,255],
    [180,230,255],
    [245,245,245],
    [255,240,0],
    [255,160,0],
    [255,50,0]
  ];

  let x=10;
  for(const colour of colours){
    for(let n=0;n<10;n++){
      set(x+n,110,colour);
    }
    x+=10;
  }

  return {width,height,data};
}

const image=fixture();
const geometry=footerGeometry(image);

assert.equal(geometry.footerStart,100);
assert.equal(geometry.footerHeight,20);

const bar=locateFooterVelocityBar(image);

assert.ok(bar);
assert.equal(bar.y,110);
assert.equal(bar.footerRow,10);
assert.equal(bar.runs.length,8);
assert.deepEqual(bar.runs[0].rgb,[0,0,160]);
assert.deepEqual(bar.runs.at(-1).rgb,[255,50,0]);

console.log("7 Doppler footer V3 tests passed.");
