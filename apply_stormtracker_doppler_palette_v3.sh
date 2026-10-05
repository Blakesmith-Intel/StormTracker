#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — Doppler footer-only palette diagnostic V3"
echo

for f in \
  frontend/src/bom-doppler-intake-v1.js
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file: $f"
    exit 1
  fi
done

cat > frontend/src/doppler-footer-palette-v3.js <<'JS'
function rgbAt(data,width,x,y) {
  const i=(y*width+x)*4;
  return [data[i],data[i+1],data[i+2],data[i+3]];
}

function sameRgb(a,b) {
  return a[0]===b[0] && a[1]===b[1] && a[2]===b[2];
}

function rowRuns(imageData,y) {
  const {width,data}=imageData;
  const runs=[];

  let start=0;
  let previous=rgbAt(data,width,0,y);

  for (let x=1;x<=width;x++) {
    const current=x<width?rgbAt(data,width,x,y):null;

    if (current && sameRgb(previous,current)) {
      continue;
    }

    runs.push({
      start,
      end:x-1,
      width:x-start,
      rgb:previous.slice(0,3),
      alpha:previous[3]
    });

    start=x;
    previous=current;
  }

  return runs;
}

function isPaletteLike(rgb) {
  const [r,g,b]=rgb;
  const maximum=Math.max(r,g,b);
  const minimum=Math.min(r,g,b);
  const spread=maximum-minimum;

  // Saturated coloured swatches, including dark blues.
  if (maximum>=35 && spread>=28) {
    return true;
  }

  // Bright neutral / near-white zero-velocity swatch.
  if (minimum>=175) {
    return true;
  }

  return false;
}

function candidateClusters(runs) {
  const eligible=runs.filter(run=>
    run.alpha>0 &&
    run.width>=3 &&
    run.width<=60 &&
    isPaletteLike(run.rgb)
  );

  if (!eligible.length) {
    return [];
  }

  const clusters=[];
  let current=[eligible[0]];

  for (let i=1;i<eligible.length;i++) {
    const previous=current.at(-1);
    const next=eligible[i];
    const gap=next.start-previous.end-1;

    if (gap<=2) {
      current.push(next);
    } else {
      clusters.push(current);
      current=[next];
    }
  }

  clusters.push(current);
  return clusters;
}

function coefficientOfVariation(values) {
  if (!values.length) return Infinity;
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  if (!(mean>0)) return Infinity;

  const variance=values.reduce(
    (sum,value)=>sum+(value-mean)**2,
    0
  )/values.length;

  return Math.sqrt(variance)/mean;
}

function scoreCluster(cluster) {
  if (cluster.length<6) return -Infinity;

  const widths=cluster.map(run=>run.width);
  const widthCv=coefficientOfVariation(widths);
  const span=cluster.at(-1).end-cluster[0].start+1;

  return (
    cluster.length*150 +
    span*2 -
    widthCv*500
  );
}

export function footerGeometry(imageData) {
  const {width,height}=imageData;

  // BOM radar GIFs used here are a square radar panel plus a footer.
  // For the current public products: 524 x 564 => footer y=524..563.
  const footerStart=Math.min(width,height);

  if (height<=footerStart) {
    throw new Error(
      `No footer area detected: image is ${width}x${height}.`
    );
  }

  return {
    footerStart,
    footerHeight:height-footerStart
  };
}

export function locateFooterVelocityBar(imageData) {
  const {width,height}=imageData;
  const {footerStart}=footerGeometry(imageData);

  let best=null;

  for (let y=footerStart;y<height;y++) {
    const runs=rowRuns(imageData,y);

    for (const cluster of candidateClusters(runs)) {
      const score=scoreCluster(cluster);

      if (!best || score>best.score) {
        best={
          y,
          footerRow:y-footerStart,
          score,
          minX:cluster[0].start,
          maxX:cluster.at(-1).end,
          runs:cluster
        };
      }
    }
  }

  return best;
}

export function createFooterCanvas(sourceCanvas,{scale=8}={}) {
  const width=sourceCanvas.width;
  const height=sourceCanvas.height;
  const footerStart=Math.min(width,height);

  if (height<=footerStart) {
    throw new Error(
      `No footer area in ${width}x${height} image.`
    );
  }

  const footerHeight=height-footerStart;

  const canvas=document.createElement("canvas");
  canvas.width=width*scale;
  canvas.height=footerHeight*scale;

  const context=canvas.getContext("2d");
  context.imageSmoothingEnabled=false;

  context.drawImage(
    sourceCanvas,
    0,
    footerStart,
    width,
    footerHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    footerStart,
    footerHeight,
    scale
  };
}

export function createBarStripCanvas(
  sourceCanvas,
  bar,
  {scale=12,padding=3}={}
) {
  if (!bar) return null;

  const x0=Math.max(0,bar.minX-5);
  const x1=Math.min(sourceCanvas.width-1,bar.maxX+5);
  const y0=Math.max(0,bar.y-padding);
  const y1=Math.min(sourceCanvas.height-1,bar.y+padding);

  const width=x1-x0+1;
  const height=y1-y0+1;

  const canvas=document.createElement("canvas");
  canvas.width=width*scale;
  canvas.height=height*scale;

  const context=canvas.getContext("2d");
  context.imageSmoothingEnabled=false;

  context.drawImage(
    sourceCanvas,
    x0,
    y0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

export function analyseFooterPalette(sourceCanvas) {
  const context=sourceCanvas.getContext(
    "2d",
    {willReadFrequently:true}
  );

  const imageData=context.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const geometry=footerGeometry(imageData);
  const bar=locateFooterVelocityBar(imageData);

  return {
    geometry,
    bar,
    footer:createFooterCanvas(sourceCanvas),
    barCanvas:createBarStripCanvas(sourceCanvas,bar)
  };
}
JS

cat > frontend/doppler-palette-v3.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>StormTracker — Doppler Footer Palette V3</title>

<style>
  *{box-sizing:border-box}
  body{
    margin:0;
    background:#0b141a;
    color:#eef5f8;
    font-family:Inter,system-ui,sans-serif;
  }
  main{
    max-width:1500px;
    margin:0 auto;
    padding:18px;
  }
  h1{margin:0 0 5px}
  .note{
    color:#a9bbc4;
    max-width:1100px;
    line-height:1.45;
  }
  button{
    padding:9px 12px;
    border:1px solid #496473;
    border-radius:6px;
    background:#1a2d38;
    color:#fff;
    cursor:pointer;
    margin:10px 0;
  }
  .card{
    margin-top:12px;
    padding:12px;
    border:1px solid #30424d;
    border-radius:8px;
    background:#111e26;
  }
  #status{
    white-space:pre-wrap;
    font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  .meta{
    display:grid;
    grid-template-columns:170px 1fr;
    gap:4px 8px;
    font-size:12px;
  }
  .meta span:nth-child(odd){color:#9fb2bc}
  .scroll{
    width:100%;
    overflow:auto;
    padding:8px;
    background:#020507;
    border-radius:6px;
    margin-top:7px;
  }
  .scroll canvas{
    display:block;
    max-width:none;
    image-rendering:pixelated;
  }
  .runs{
    display:flex;
    flex-wrap:wrap;
    gap:7px;
    margin-top:8px;
  }
  .run{
    min-width:155px;
    display:grid;
    grid-template-columns:22px 1fr;
    gap:6px;
    align-items:center;
    font-size:10px;
    color:#b8c6ce;
  }
  .swatch{
    width:22px;
    height:14px;
    border:1px solid rgba(255,255,255,.4);
  }
  .warning{
    margin-top:10px;
    padding:8px;
    border-left:3px solid #d6aa3a;
    background:#182129;
    color:#d8e2e7;
    font-size:11px;
    line-height:1.45;
  }
</style>
</head>

<body>
<main>
  <h1>StormTracker Doppler footer-only palette V3</h1>

  <p class="note">
    This version does not search the radar map at all. For the 524×564 Bureau
    Doppler GIF it treats rows 0–523 as the square radar panel and only rows
    524–563 as the footer. The entire 40-pixel footer is enlarged 8×, then the
    velocity-bar candidate is selected only from inside that footer.
  </p>

  <button id="loadAll">
    Load footer-only diagnostics for 66 / 50 / 08
  </button>

  <section class="card">
    <strong>Status</strong>
    <div id="status">Ready.</div>
  </section>

  <div id="results"></div>
</main>

<script type="module">
import {
  loadDopplerDiagnostic
} from "./src/bom-doppler-intake-v1.js?v=footer-v3";

import {
  analyseFooterPalette
} from "./src/doppler-footer-palette-v3.js?v=footer-v3";

const status=document.getElementById("status");
const results=document.getElementById("results");

function rgbCss(rgb){
  return `rgb(${rgb.join(",")})`;
}

async function inspect(radarId){
  status.textContent=`Loading radar ${radarId}…`;

  const source=await loadDopplerDiagnostic(radarId);
  const analysis=analyseFooterPalette(source.canvas);

  const card=document.createElement("section");
  card.className="card";

  const heading=document.createElement("h2");
  heading.textContent=`${radarId} — ${source.product}`;
  card.appendChild(heading);

  const meta=document.createElement("div");
  meta.className="meta";

  meta.innerHTML=`
    <span>Source image</span>
    <strong>${source.width} × ${source.height}</strong>

    <span>Footer rows</span>
    <strong>${analysis.geometry.footerStart}…${source.height-1}</strong>

    <span>Footer height</span>
    <strong>${analysis.geometry.footerHeight}px</strong>

    <span>Candidate bar row</span>
    <strong>${analysis.bar ? `source y=${analysis.bar.y}, footer row ${analysis.bar.footerRow}` : "not found"}</strong>

    <span>Candidate swatches</span>
    <strong>${analysis.bar?.runs.length ?? 0}</strong>
  `;

  card.appendChild(meta);

  const footerTitle=document.createElement("h3");
  footerTitle.textContent="8× full footer — NO MAP PIXELS";
  card.appendChild(footerTitle);

  const footerScroll=document.createElement("div");
  footerScroll.className="scroll";
  footerScroll.appendChild(analysis.footer.canvas);
  card.appendChild(footerScroll);

  if(analysis.bar && analysis.barCanvas){
    const barTitle=document.createElement("h3");
    barTitle.textContent="12× detected velocity-bar row";
    card.appendChild(barTitle);

    const barScroll=document.createElement("div");
    barScroll.className="scroll";
    barScroll.appendChild(analysis.barCanvas);
    card.appendChild(barScroll);

    const runsTitle=document.createElement("h3");
    runsTitle.textContent="Exact RGB runs from footer-only candidate";
    card.appendChild(runsTitle);

    const runs=document.createElement("div");
    runs.className="runs";

    for(const [index,run] of analysis.bar.runs.entries()){
      const item=document.createElement("div");
      item.className="run";

      const swatch=document.createElement("span");
      swatch.className="swatch";
      swatch.style.background=rgbCss(run.rgb);

      const label=document.createElement("span");
      label.textContent=
        `${String(index+1).padStart(2,"0")}: ` +
        `${run.rgb.join(",")} (${run.width}px)`;

      item.append(swatch,label);
      runs.appendChild(item);
    }

    card.appendChild(runs);
  }

  const warning=document.createElement("div");
  warning.className="warning";
  warning.textContent=
    "No numeric velocity mapping is being assumed. The full enlarged footer is " +
    "the authoritative check. If the Bureau's printed scale is visible there, " +
    "we will map those labels to the exact footer swatches only.";
  card.appendChild(warning);

  results.appendChild(card);

  return analysis;
}

document.getElementById("loadAll").addEventListener("click",async()=>{
  try{
    results.innerHTML="";
    const summary=[];

    for(const radarId of ["66","50","08"]){
      const analysis=await inspect(radarId);

      summary.push(
        `${radarId}:footer=${analysis.geometry.footerHeight}px,` +
        `swatches=${analysis.bar?.runs.length ?? 0}`
      );
    }

    status.textContent=
      "DOPPLER FOOTER-ONLY V3: PASS — " +
      summary.join(" | ") +
      ". Map rows were excluded before palette analysis.";
  }catch(error){
    console.error(error);
    status.textContent=`ERROR — ${error.message}`;
  }
});
</script>
</body>
</html>
HTML

cat > frontend/tests/run-doppler-footer-v3-tests.mjs <<'JS'
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
JS

echo
echo "Checking syntax..."
node --check frontend/src/doppler-footer-palette-v3.js

echo
echo "Running V3 footer tests..."
node frontend/tests/run-doppler-footer-v3-tests.mjs

echo
echo "Running Doppler intake tests..."
node frontend/tests/run-doppler-intake-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "SUCCESS"
echo "Expected:"
echo "  7 Doppler footer V3 tests passed."
echo "  5 Doppler intake tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/doppler-palette-v3.html frontend/src/doppler-footer-palette-v3.js frontend/tests/run-doppler-footer-v3-tests.mjs'
echo 'git commit -m "Restrict Doppler palette analysis to Bureau footer"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/doppler-palette-v3.html"
echo
echo "Press:"
echo "  Load footer-only diagnostics for 66 / 50 / 08"
echo
echo "Send back one screenshot of the V3 page."
