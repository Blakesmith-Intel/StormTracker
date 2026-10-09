import assert from "node:assert/strict";
import { extractNativeDopplerPanel, reprojectNativeDopplerPanel,
  NATIVE_DOPPLER_DISPLAY_SIZE, NATIVE_DOPPLER_ANNOTATION_START_ROW,
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
// Footer timestamp/range is printed INTO the Doppler image. The original
// source stays byte-for-byte intact for scientific velocity analysis; display
// excludes only the known lower annotation rows instead of inventing wind.
assert.equal(NATIVE_DOPPLER_ANNOTATION_START_ROW,472);
assert.equal(isNativeDopplerDisplayAnnotationRow(471),false);
assert.equal(isNativeDopplerDisplayAnnotationRow(472),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(511),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(512),false);
dot(6+300,6+470,[0,0,255]); // same measured velocity, outside text region
dot(6+300,6+480,[255,0,0]); // text region: not recoverable as observed wind
const cleaned=extractNativeDopplerPanel(source,palette);
assert.deepEqual(Array.from(cleaned.data.slice((470*512+300)*4,(470*512+300)*4+4)),[0,0,255,255]);
assert.equal(cleaned.data[(480*512+300)*4+3],0);
assert.deepEqual(Array.from(source.data.slice(((6+480)*524+6+300)*4,((6+480)*524+6+300)*4+4)),
  [255,0,0,255],"source decoded BoM pixels remain intact for later analysis");
// BoM's range rings, radial markers and text are inked into the native
// raster. An antialiased ink pixel can be only 1-2 RGB units away from an
// actual velocity swatch, so proximity matching falsely promoted it to wind.
// The DISPLAY copy accepts exact BoM swatches only. This is not wind inpainting.
const nearSource={width:512,height:512,data:new Uint8ClampedArray(512*512*4)};
function setNative(x,y,rgba){
  nearSource.data.set(rgba,(y*512+x)*4);
}
setNative(128,128,[255,0,0,255]);  // genuine outgoing radial velocity
setNative(129,128,[254,1,0,255]);  // antialiased ring ink near red
setNative(130,128,[0,0,255,255]);  // genuine incoming radial velocity
setNative(131,128,[1,0,254,255]);  // antialiased label ink near blue
setNative(132,128,[255,255,255,255]); // exact zero velocity, excluded by default
const sourceBefore=new Uint8ClampedArray(nearSource.data);
const exact=extractNativeDopplerPanel(nearSource,palette);
assert.equal(exact.nativePixelCount,2,"only original exact nonzero BoM swatches remain");
assert.equal(exact.data[(128*512+128)*4+3],255);
assert.equal(exact.data[(128*512+129)*4+3],0,
  "near-palette ring pixels must not be misrepresented as measured wind");
assert.equal(exact.data[(128*512+130)*4+3],255);
assert.equal(exact.data[(128*512+131)*4+3],0,
  "near-palette label pixels must not be misrepresented as measured wind");
assert.equal(exact.data[(128*512+132)*4+3],0);
const includeZero=extractNativeDopplerPanel(nearSource,palette,{includeZero:true});
assert.equal(includeZero.nativePixelCount,3,"exact zero swatch follows existing opt-in");
assert.deepEqual(nearSource.data,sourceBefore,"source is read-only and never repainted");
assert.throws(()=>extractNativeDopplerPanel(nearSource,{swatches:[]}),
  /Missing exact BoM Doppler velocity palette/);
console.log("PASS exact-source BoM velocity pixels, near-palette ring and label suppression, source immutability, footer masking and geographic projection.");
