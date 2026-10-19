import assert from "node:assert/strict";
import { extractNativeDopplerPanel, reprojectNativeDopplerPanel,
  NATIVE_DOPPLER_DISPLAY_SIZE, NATIVE_DOPPLER_ANNOTATION_START_ROW,
  NATIVE_DOPPLER_STRICT_PALETTE_START_ROW,
  nativeDopplerDisplayFooterOpacity,
  isNativeDopplerDisplayAnnotationRow } from "../src/native-doppler-image-v1.js";
const source = {width:524, height:564, data:new Uint8ClampedArray(524*564*4)};
const dot=(x,y,rgb)=>{const i=(y*source.width+x)*4;
  source.data.set([rgb[0],rgb[1],rgb[2],255],i);};
const palette={swatches:[
  {rgb:[0,0,255],velocity_kmh:-20},
  {rgb:[255,0,0],velocity_kmh:20},
  {rgb:[255,255,255],velocity_kmh:0}
]};
dot(6+256,6+256,[0,0,255]); // observed native velocity
dot(6+257,6+256,[255,0,0]); // second observed native velocity
dot(6+255,6+256,[255,255,255]); // zero excluded like existing display
dot(6+252,6+256,[100,100,100]); // BoM basemap, not a velocity
dot(6+256,524,[0,0,255]); // GIF footer, never rendered
const panel=extractNativeDopplerPanel(source,palette);
assert.equal(panel.width,512);
assert.equal(panel.nativePixelCount,2);
assert.deepEqual(Array.from(panel.data.slice((256*512+256)*4,(256*512+256)*4+4)),[0,0,255,255]);
assert.equal(panel.data[(256*512+255)*4+3],0);
assert.equal(panel.data[(256*512+252)*4+3],0);
const projected=reprojectNativeDopplerPanel("66",panel);
assert.equal(projected.width,NATIVE_DOPPLER_DISPLAY_SIZE);
assert.ok(projected.displayedPixels>0,"true native velocity pixels survive coordinate projection");
assert.ok(projected.bounds.west<153.24&&projected.bounds.east>153.24);
const seen=new Set();
for(let i=0;i<projected.data.length;i+=4){
  if(!projected.data[i+3])continue;
  seen.add(projected.data[i]+","+projected.data[i+1]+","+projected.data[i+2]);
}
assert.ok(seen.has("0,0,255")||seen.has("255,0,0"));
assert.ok([...seen].every(rgb=>rgb==="0,0,255"||rgb==="255,0,0"),
  "raster contains only unchanged native BoM colours; no hybrid repaint");
// The source covers a nominal ±128 km: the display must never crop its
// southern rows even where BoM's embedded caption shares those same rows.
assert.equal(NATIVE_DOPPLER_STRICT_PALETTE_START_ROW,438);
assert.equal(NATIVE_DOPPLER_ANNOTATION_START_ROW,480);
assert.equal(nativeDopplerDisplayFooterOpacity(437),1);
assert.equal(nativeDopplerDisplayFooterOpacity(438),1);
assert.equal(nativeDopplerDisplayFooterOpacity(479),1);
assert.equal(nativeDopplerDisplayFooterOpacity(480),1);
assert.equal(nativeDopplerDisplayFooterOpacity(511),1);
assert.equal(nativeDopplerDisplayFooterOpacity(512),0);
assert.equal(isNativeDopplerDisplayAnnotationRow(479),false);
assert.equal(isNativeDopplerDisplayAnnotationRow(480),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(511),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(512),false);
dot(6+300,6+437,[0,0,255]); // retained weather
dot(6+300,6+438,[255,0,0]); // formerly cropped; real southern wind
dot(6+300,6+470,[255,0,0]); // 107 km south, should now survive
dot(6+300,6+479,[0,0,255]); // ~111.5 km, last fully valid source row
dot(6+300,6+480,[255,0,0]); // first annotation-risk row, STILL native wind
dot(6+300,6+500,[255,0,0]); // measured wind coexists with caption row
dot(6+300,6+511,[0,0,255]); // genuine velocity at southmost 128 km edge
dot(6+301,6+500,[0,0,0]); // printed black BoM caption, not velocity
dot(6+301,6+470,[250,4,0]); // near-colour anti-alias is not verified weather
dot(6+301,6+300,[250,4,0]); // unchanged legacy palette matching above margin
const originalSource=new Uint8ClampedArray(source.data);
const cleaned=extractNativeDopplerPanel(source,palette);
assert.equal(cleaned.data[(437*512+300)*4+3],255);
assert.equal(cleaned.data[(438*512+300)*4+3],255);
assert.equal(cleaned.data[(470*512+300)*4+3],255);
assert.equal(cleaned.data[(479*512+300)*4+3],255);
assert.equal(cleaned.data[(480*512+300)*4+3],255);
assert.equal(cleaned.data[(500*512+300)*4+3],255);
assert.equal(cleaned.data[(511*512+300)*4+3],255,
  "A flat horizontal image cutoff cannot remove the 128 km south edge");
assert.equal(cleaned.data[(500*512+301)*4+3],0,
  "Black embedded caption ink cannot be interpreted as measured velocity");
assert.equal(cleaned.data[(470*512+301)*4+3],0,
  "Antialiased source-text ink is excluded in the annotation-prone margin");
assert.equal(cleaned.data[(300*512+301)*4+3],255,
  "General genuine imagery keeps its established colour matching");
for(let i=3;i<cleaned.data.length;i+=4)
  assert.ok(cleaned.data[i]===0||cleaned.data[i]===255,
    "Doppler alpha must never use soft or synthetic transparency");
const rawSource=extractNativeDopplerPanel(source,palette,{maskAnnotationRows:false});
assert.equal(rawSource.data[(480*512+300)*4+3],255,
  "Uncropped source remains independently available for analysis");
assert.deepEqual(source.data,originalSource,
  "Display masking must never alter source observations");
console.log("PASS FULL native 128km southern Doppler range, per-pixel caption screening and unchanged source.");
