import assert from "node:assert/strict";
import { extractNativeDopplerPanel, reprojectNativeDopplerPanel,
  NATIVE_DOPPLER_DISPLAY_SIZE, NATIVE_DOPPLER_ANNOTATION_START_ROW,
  NATIVE_DOPPLER_ANNOTATION_FADE_START_ROW, nativeDopplerDisplayFooterOpacity,
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
// The scanned UTC/range/angle footer is present in both historical BoM
// weather PNG and composite GIF. The underlying decoded source retains ALL
// measured pixel values for downstream scientific analysis.
assert.equal(NATIVE_DOPPLER_ANNOTATION_FADE_START_ROW,438);
assert.equal(NATIVE_DOPPLER_ANNOTATION_START_ROW,459);
assert.equal(nativeDopplerDisplayFooterOpacity(420),1);
assert.equal(nativeDopplerDisplayFooterOpacity(459),0);
assert.equal(nativeDopplerDisplayFooterOpacity(500),0);
assert.ok(nativeDopplerDisplayFooterOpacity(447)>0 &&
  nativeDopplerDisplayFooterOpacity(447)<1);
assert.equal(isNativeDopplerDisplayAnnotationRow(458),false);
assert.equal(isNativeDopplerDisplayAnnotationRow(459),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(511),true);
assert.equal(isNativeDopplerDisplayAnnotationRow(512),false);
dot(6+300,6+420,[0,0,255]); // genuine science outside the display footer
dot(6+300,6+447,[255,0,0]); // transition band
dot(6+300,6+480,[255,0,0]); // annotation region
const originalSource=new Uint8ClampedArray(source.data);
const cleaned=extractNativeDopplerPanel(source,palette);
assert.equal(cleaned.data[(420*512+300)*4+3],255);
const feather=cleaned.data[(447*512+300)*4+3];
assert.ok(feather>0 && feather<255,
  "display-only footer transition must avoid a hard rectangular edge");
assert.equal(cleaned.data[(480*512+300)*4+3],0);
const rawSource=extractNativeDopplerPanel(source,palette,{maskAnnotationRows:false});
assert.equal(rawSource.data[(480*512+300)*4+3],255,
  "uncropped ORIGINAL source remains accessible for scientific inspection");
assert.deepEqual(source.data,originalSource,
  "image display filtering must NEVER modify decoded BoM source pixels");
console.log("PASS BoM footer fade on historical Doppler PNG display, smooth alpha boundary, source science unchanged.");
