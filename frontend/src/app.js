import { RadarWorkerClient } from "./worker-client.js?v=live-bom-v1";
import { createCesiumView } from "./cesium-view.js?v=camera-lock-v3";
import { SOURCE_PALETTES } from "./palette.js?v=live-bom-v1";
import { reflectivityFromFile, reflectivityFromUrl } from "./radar-source.js?v=live-bom-v1";
import { loadLatestBomReflectivityMosaic } from "./bom-wmts.js?v=relay-v2";
import { putState, getState, clearAll } from "./storage.js";

const worker = new RadarWorkerClient();
const view = createCesiumView("cesiumContainer");
const $ = id => document.getElementById(id);
let latestResult = null;
let sourceMode = "none";

function setStatus(text, kind="") {
  const el = $("status");
  el.textContent = text;
  el.dataset.kind = kind;
}

function fmt(value, digits=1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function renderPanels(result) {
  latestResult = result;
  view.render(result);
  const active = new Set(result.active_track_ids ?? []);
  const likelihoodById = new Map((result.likelihoods ?? []).map(x => [x.track_id,x]));
  const tracks = (result.tracks ?? []).slice().sort((a,b) => (active.has(b.track_id)?1:0)-(active.has(a.track_id)?1:0) || b.observation_count-a.observation_count);

  $("trackRows").innerHTML = tracks.length ? tracks.map(track => {
    const o = track.latest;
    const l = likelihoodById.get(track.track_id);
    return `<tr class="${active.has(track.track_id)?"active":""}">
      <td><strong>${track.track_id}</strong></td>
      <td>${track.observation_count}</td>
      <td>≥${fmt(o.maximum_dbzh_lower_bound,0)} dBZ</td>
      <td>${track.motion ? `${fmt(track.motion.speed_kmh)} km/h @ ${fmt(track.motion.heading_degrees,0)}°` : "—"}</td>
      <td>${track.algorithmic_confidence}</td>
      <td>${l ? `${l.display_category} (${fmt(l.score,0)})` : "—"}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="muted">No tracks yet.</td></tr>`;

  const segmentations = result.segmentations ?? [];
  $("segmentationSummary").innerHTML = segmentations.map(s =>
    `<div><strong>Radar ${s.radar_id}</strong>: ${s.retained_cell_count} retained cell${s.retained_cell_count===1?"":"s"} from ${s.raw_component_count} raw components</div>`
  ).join("") || "No frame processed.";

  const liveCount = (result.active_track_ids ?? []).length;
  setStatus(`${liveCount} active ST track${liveCount===1?"":"s"}; ${tracks.length} total in worker state.`, "ok");
  putState("lastResult", result).catch(console.warn);
}

function syntheticFrame(step, observedUtc) {
  const width = 128, height = 128;
  const categories = new Uint8Array(width*height);
  const doppler = new Int16Array(width*height); doppler.fill(-32768);
  const cx = 48 + step*2;
  const cy = 72 - step;
  for (let row=0; row<height; row++) for (let col=0; col<width; col++) {
    const dx=col-cx, dy=row-cy, r=Math.hypot(dx,dy), i=row*width+col;
    if (r <= 6) categories[i]=10;
    if (r <= 4) categories[i]=12;
    if (r <= 2) categories[i]=14;
    if (r <= 6) doppler[i] = dx < 0 ? -60 : 60;
  }
  // Add small noise fragments that should be rejected by the 8-pixel minimum.
  categories[10*width+10]=12; categories[10*width+11]=12; categories[11*width+10]=12;
  return { radarId:"66", observedUtc, width, height, categories, doppler };
}

async function runSyntheticDemo() {
  sourceMode = "synthetic";
  setStatus("Running reconstructed browser regression demo…");
  await worker.reset();
  const end = Date.now();
  let result;
  for (let step=0; step<4; step++) {
    const observedUtc = new Date(end - (3-step)*5*60000).toISOString();
    result = await worker.processFrameBucket({ frames:[syntheticFrame(step,observedUtc)], referenceTime: observedUtc });
  }
  renderPanels(result);
}

async function loadCategoryJson(file) {
  sourceMode = "manual";
  const data = JSON.parse(await file.text());
  if (!data.radarId || !data.observedUtc || !data.width || !data.height || !data.categories) {
    throw new Error("Category JSON requires radarId, observedUtc, width, height and categories.");
  }
  const frame = {
    radarId: String(data.radarId), observedUtc: data.observedUtc,
    width: Number(data.width), height: Number(data.height),
    categories: Uint8Array.from(data.categories),
    doppler: data.doppler ? Int16Array.from(data.doppler) : null
  };
  const result = await worker.processFrameBucket({ frames:[frame], referenceTime: frame.observedUtc });
  renderPanels(result);
}

async function loadImageFile(file) {
  sourceMode = "manual";
  if (!SOURCE_PALETTES.reflectivityRgb.length) throw new Error("The exact Bureau reflectivity RGB table still needs calibration from a verified source frame. Use category JSON or the synthetic demo until that table is restored.");
  const decoded = await reflectivityFromFile(file,SOURCE_PALETTES.reflectivityRgb,0);
  const frame = {
    radarId: $("radarSelect").value,
    observedUtc: new Date().toISOString(),
    width: decoded.width, height: decoded.height, categories: decoded.categories
  };
  renderPanels(await worker.processFrameBucket({frames:[frame],referenceTime:frame.observedUtc}));
}

async function loadImageUrl() {
  sourceMode = "manual";
  const url = $("imageUrl").value.trim();
  if (!url) throw new Error("Enter an HTTPS image URL.");
  if (!SOURCE_PALETTES.reflectivityRgb.length) throw new Error("Palette calibration is required before decoding live image pixels.");
  const decoded = await reflectivityFromUrl(url,SOURCE_PALETTES.reflectivityRgb,0);
  const frame = { radarId: $("radarSelect").value, observedUtc:new Date().toISOString(), width:decoded.width,height:decoded.height,categories:decoded.categories };
  renderPanels(await worker.processFrameBucket({frames:[frame],referenceTime:frame.observedUtc}));
}

async function loadLiveBomReflectivity() {
  setStatus("Loading latest public BOM reflectivity mosaic…");

  if (sourceMode !== "bom-live") {
    await worker.reset();
    sourceMode = "bom-live";
  }

  const frame = await loadLatestBomReflectivityMosaic();

  const result = await worker.processFrameBucket({
    frames: [frame],
    referenceTime: frame.observedUtc
  });

  renderPanels(result);

  const meta = frame.sourceMetadata ?? {};
  setStatus(
    `Live BOM reflectivity ${frame.observedUtc}; ` +
    `${meta.strongPixelCount ?? 0} pixels at ≥40 dBZ; ` +
    `${result.active_track_ids?.length ?? 0} active storm tracks. ` +
    `Source is the public 2-D BOM mosaic; true volumetric mode remains separate.`,
    "ok"
  );
}

$("demoButton").addEventListener("click", () => runSyntheticDemo().catch(e => setStatus(e.message,"error")));
$("liveBomButton").addEventListener("click", () => loadLiveBomReflectivity().catch(e => setStatus(e.message,"error")));
$("resetButton").addEventListener("click", async () => {
  await worker.reset(); await clearAll().catch(()=>{}); latestResult=null; sourceMode="none";
  view.render({tracks:[],active_track_ids:[]});
  $("trackRows").innerHTML=`<tr><td colspan="6" class="muted">No tracks yet.</td></tr>`;
  $("segmentationSummary").textContent="No frame processed.";
  setStatus("Worker state reset.","ok");
});
$("categoryFile").addEventListener("change", event => {
  const file=event.target.files?.[0]; if(file) loadCategoryJson(file).catch(e=>setStatus(e.message,"error"));
});
$("imageFile").addEventListener("change", event => {
  const file=event.target.files?.[0]; if(file) loadImageFile(file).catch(e=>setStatus(e.message,"error"));
});
$("loadUrlButton").addEventListener("click", () => loadImageUrl().catch(e=>setStatus(e.message,"error")));

getState("lastResult").then(result => {
  if (result?.tracks) {
    // Saved display is restored for convenience; worker tracking state deliberately starts clean.
    renderPanels(result);
    setStatus("Restored previous display. Run a demo or load a frame to rebuild live worker state.","ok");
  } else runSyntheticDemo().catch(e=>setStatus(e.message,"error"));
}).catch(() => runSyntheticDemo().catch(e=>setStatus(e.message,"error")));
