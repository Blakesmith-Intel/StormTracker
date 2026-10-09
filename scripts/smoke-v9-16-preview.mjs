// Post-Pages deployment smoke: verify the real public origin rather than
// assuming that a checked-out feature branch or uploaded artifact was served.
const base = process.env.PAGES_URL;
const expectedSha = process.env.EXPECTED_PREVIEW_SHA;
if (!base?.startsWith("https://") || !/^[a-f0-9]{40}$/.test(expectedSha ?? "")) {
  throw new Error("PAGES_URL and 40-character EXPECTED_PREVIEW_SHA are required");
}
const origin = new URL(base.endsWith("/") ? base : base + "/");

async function read(relative) {
  const url = new URL(relative, origin);
  url.searchParams.set("build_probe", expectedSha.slice(0, 12));
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { "Cache-Control": "no-cache" }
  });
  if (!response.ok) {
    throw new Error(relative + " returned HTTP " + response.status);
  }
  return response.text();
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) throw new Error(label + " contract failed: " + pattern);
}

let deployed = false;
for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const build = await read("preview/v9.16/BUILD.txt");
    if (!build.includes(expectedSha)) {
      throw new Error("Published preview not yet at SHA " + expectedSha + ": " + build.trim());
    }
    deployed = true;
    break;
  } catch (error) {
    if (attempt === 18) throw error;
    console.log("Checking GitHub Pages propagation (" + attempt + "/18): " + error.message);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
}
if (!deployed) throw new Error("Expected preview was not published");

const [productionIndex, previewIndex, previewHtml, runtime, detection, dock, menuChoices] =
  await Promise.all([
    read("index.html"),
    read("preview/v9.16/index.html"),
    read("preview/v9.16/live3d-operational-v9.html"),
    read("preview/v9.16/src/live3d-operational-v9.js"),
    read("preview/v9.16/src/severe-storm-alerts-v1.js"),
    read("preview/v9.16/src/severe-storm-alert-overlay-v1.js"),
    read("preview/v9.16/src/operational-window-choices-v1.js")
  ]);

requireMatch(productionIndex, /live3d-operational-v9\.html\?v=9\.16-bom-native-rain30-v1/, "Production V9.16.1 native Doppler playback");
if (!productionIndex.includes("9.16-bom-native-rain30-v1")) throw new Error("Production entrypoint is not V9.16.1");
requireMatch(previewIndex, /live3d-operational-v9\.html\?v=9\.16-window-menu-v2/, "Preview own iframe");
const [productionHtml, productionRuntime] = await Promise.all([
  read("live3d-operational-v9.html"), read("src/live3d-operational-v9.js")
]);
requireMatch(productionHtml, /id="showSevereRadarAlerts" type="checkbox" disabled/, "Production radar research controls disabled");
requireMatch(productionHtml, /id="showExperimentalHookAlerts" type="checkbox" disabled/, "Production hook research controls disabled");
requireMatch(productionRuntime, /severeStormAlertOverlay\.setEnabled\(false\)/, "Production research overlay disabled");
requireMatch(productionRuntime, /function syncSevereStormAlerts\(index\) \{[\s\S]*?return;/, "Production experimental detection skipped");
requireMatch(productionRuntime, /buildOperationalWindowChoices\(\{/, "Production BoM-aligned window selector");
requireMatch(productionRuntime, /native-doppler-image-v1\.js/, "Production uses native BoM velocity image pixels");
requireMatch(productionRuntime, /loopDurationMinutes"\)\?\.value \|\| "30"/, "Production starts on 30-minute BoM rain loop");
requireMatch(productionRuntime, /return isDopplerSourceActive\(\) && isCombinedDopplerWindowSelected\(\)/, "Production rain-only wind suppression");
requireMatch(previewHtml, /value="66" selected>Brisbane \(Mt Stapylton\)/, "Mt Stapylton default");
requireMatch(previewHtml, /id="showSevereRadarAlerts"/, "Radar alerts control");
requireMatch(previewHtml, /id="showExperimentalHookAlerts"/, "Experimental hook control");
requireMatch(runtime, /const DEFAULT_RADAR_SITE_ID = "66"/, "Startup selected radar");
requireMatch(runtime, /syncSevereStormAlerts\(hybridFrameIndex\)/, "Radar frame synchronisation");
requireMatch(runtime, /buildIndependentDopplerFrames\(/, "Source-native Doppler history");
requireMatch(runtime, /playback = createContinuousPlayback\(/, "Single playback clock");
requireMatch(runtime, /independentDopplerRefresh = createLiveLoopRefresh\(/, "Independent Doppler source polling");
requireMatch(runtime, /nextNativeDopplerIndex\(windCycleCursor, independentDopplerFrames.length\)/, "Unrestricted wind-loop progression");
requireMatch(runtime, /driveWindFromCommonPlayback\(hybridFrameIndex\)/, "Master playback triggers wind animation");
requireMatch(runtime, /windRenderPending/, "Slow wind decoding cannot stop radar playback");
requireMatch(runtime, /const withDoppler = false/, "Reflectivity frame list independent of Doppler");
requireMatch(runtime, /independentDopplerCanvas\(/, "Independent Doppler map geometry");
requireMatch(previewHtml, /id="hybridPlayButton"/, "Single Play/Pause control");
requireMatch(previewHtml, /id="hybridFrameSlider"/, "Single playback scrubber");
requireMatch(previewHtml, /id="radarPlaybackTime"/, "Radar real source timestamp");
requireMatch(previewHtml, /id="dopplerPlaybackTime"/, "Doppler real source timestamp");
requireMatch(previewHtml, /id="sourceTimeGap"/, "Relative observation time difference");
requireMatch(runtime, /function updateDualSourceTimes\(\)/, "Original source AEST clocks and UTC source attribution");
requireMatch(runtime, /buildOperationalWindowChoices\(\{/, "Four-option window selector");
requireMatch(menuChoices, /Radar \+ Doppler — All available/, "Preserved combined Doppler window");
requireMatch(menuChoices, /RAIN_ONLY_LOOP_MINUTES = Object.freeze\(\[60,120,180\]\)/, "Only 60, 120 and 180 minute rain-only windows");
requireMatch(menuChoices, /Rain radar only/, "Rain-only window wording");
requireMatch(runtime, /function shouldDisplayDopplerForSelectedWindow\(\)/, "Doppler visibility follows combined mode");
requireMatch(runtime, /return isDopplerSourceActive\(\) && isCombinedDopplerWindowSelected\(\)/, "Rain-only Doppler suppression");
requireMatch(runtime, /const selected = choices.some\(choice => choice.value === previous\)/, "Never silently switch rain-only to combined playback");
requireMatch(runtime, /\$\("loadHybridButton"\).disabled = !selectedWindow/, "Disable unavailable playback load");
requireMatch(runtime, /renderDopplerOverlay\(\);\s*updateIndependentDopplerUi\(\);\s*updateLoopButtonLabel\(\)/, "Changing window clears lingering wind imagery");

requireMatch(runtime, /hybridCombinedSchedule = isCombined \? combinedSchedule : \[\]/, "Combined timeline playback assembly");
requireMatch(runtime, /hasNewDopplerWindow\(\) && hybridCombinedSchedule.length/, "Rebuild on newly observed wind frame");
requireMatch(runtime, /Doppler source frame · synchronising radar and wind loop/, "New Doppler source announcement");
requireMatch(previewHtml, /id="dopplerOpacity"/, "Doppler controlled by opacity");
if (/id="showDopplerOverlay"/.test(previewHtml) || /showDopplerOverlay/.test(runtime)) {
  throw new Error("Obsolete Doppler toggle present in V9.16");
}

if (/id="dopplerPlayButton"|id="dopplerFrameSlider"/.test(previewHtml) ||
    /independentDopplerPlayback/.test(runtime)) {
  throw new Error("Old second wind playback controls or clock remain");
}
if (/RADAR ONLY — Doppler unavailable/.test(runtime)) {
  throw new Error("Legacy shared-timeframe status still present");
}
if (/const timeline = withDoppler \? shared : radarHistoryTimeline/.test(runtime)) {
  throw new Error("V9.16 still discards valid radar frames through strict shared Doppler timeline");
}

requireMatch(detection, /DAMAGING_WIND_GUST_REFERENCE_KMH = 90/, "90 km/h source guard");
requireMatch(detection, /velocityRangeVerified === true/, "Future independently verified Doppler guard");
requireMatch(dock, /className = "storm-severe-alert-dock"/, "Published alert dock");
const [historicalHtml, historicalJson] = await Promise.all([
  read("preview/v9.16/historical-gympie-v1.html"),
  read("preview/v9.16/research-gympie/scan_meteorology.json")
]);
requireMatch(historicalHtml, /Gympie radar 8 — 24 November 2025/, "Genuine historical viewer");
requireMatch(historicalHtml, /AURA Level 1/, "Historical data provenance");
requireMatch(historicalHtml, /researchHookMarkers/, "Experimental hook markers on observed reflectivity");
requireMatch(historicalHtml, /nextCandidate/, "Jump between measured experimental candidates");
const auditedReport = JSON.parse(await read("preview/v9.16/research-gympie/gympie-hook-replay.json"));
if (auditedReport.format !== "StormTrackerExperimentalAURAHookReplayV1" ||
    auditedReport.observed_scans_processed !== 28 ||
    auditedReport.experimental_two_scan_hook_candidates !== 2 ||
    !auditedReport.rows.some(row => row.hook_candidates?.some(item => item.track_id === "ST0027"))) {
  throw new Error("Historical candidate report missing expected two measured ST0027 flags");
}
const actualScans = JSON.parse(historicalJson);
if (!Array.isArray(actualScans) || actualScans.filter(x => x.utc_time && !x.error).length !== 28) {
  throw new Error("Expected 28 successfully decoded real 2025 AURA radar scans");
}
const pngUrl = new URL("preview/v9.16/research-gympie/observed_scan_previews/8_20251124_070000.pvol.png", origin);
pngUrl.searchParams.set("build_probe", expectedSha.slice(0, 12));
const pngResponse = await fetch(pngUrl, { method:"HEAD", cache:"no-store", signal:AbortSignal.timeout(12000) });
if (!pngResponse.ok || !pngResponse.headers.get("content-type")?.includes("image/png")) {
  throw new Error("Historical measured reflectivity/Doppler preview image missing or invalid");
}


console.log("PASS Published V9.16 candidate at commit " + expectedSha);
console.log("PASS Mt Stapylton selected; severe storm evidence controls published");
console.log("PASS 90 km/h source guard, real-scan detection and alert dock published");
console.log("PASS Four window choices; rain-only removes Doppler imagery and preserves the verified Doppler-defined combined timeline");
console.log("PASS Production root uses V9.16.1 native Doppler / 30-minute rain; V9.16 research alerts stay isolated");
console.log("PASS Historical Gympie viewer plus 28 real decoded measured radar scans published");
console.log("PASS Two original-scan hook-shape indicators accessible in historical viewer; classification remains experimental");
console.log("Preview: " + new URL("preview/v9.16/", origin).href);
