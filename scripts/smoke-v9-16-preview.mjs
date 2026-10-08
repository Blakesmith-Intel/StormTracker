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

const [productionIndex, previewIndex, previewHtml, runtime, detection, dock] =
  await Promise.all([
    read("index.html"),
    read("preview/v9.16/index.html"),
    read("preview/v9.16/live3d-operational-v9.html"),
    read("preview/v9.16/src/live3d-operational-v9.js"),
    read("preview/v9.16/src/severe-storm-alerts-v1.js"),
    read("preview/v9.16/src/severe-storm-alert-overlay-v1.js")
  ]);

requireMatch(productionIndex, /live3d-operational-v9\.html\?v=9\.15\.1-intensity40/, "Production root remains V9.15.1");
if (productionIndex.includes("9.16-alerts-preview")) throw new Error("Production root accidentally points to preview");
requireMatch(previewIndex, /live3d-operational-v9\.html\?v=9\.16-alerts-preview/, "Preview own iframe");
requireMatch(previewHtml, /value="66" selected>Brisbane \(Mt Stapylton\)/, "Mt Stapylton default");
requireMatch(previewHtml, /id="showSevereRadarAlerts"/, "Radar alerts control");
requireMatch(previewHtml, /id="showExperimentalHookAlerts"/, "Experimental hook control");
requireMatch(runtime, /const DEFAULT_RADAR_SITE_ID = "66"/, "Startup selected radar");
requireMatch(runtime, /syncSevereStormAlerts\(hybridFrameIndex\)/, "Radar frame synchronisation");
requireMatch(detection, /DAMAGING_WIND_GUST_REFERENCE_KMH = 90/, "90 km/h source guard");
requireMatch(detection, /velocityRangeVerified === true/, "Future independently verified Doppler guard");
requireMatch(dock, /className = "storm-severe-alert-dock"/, "Published alert dock");

console.log("PASS Published V9.16 candidate at commit " + expectedSha);
console.log("PASS Mt Stapylton selected; severe storm evidence controls published");
console.log("PASS 90 km/h source guard, real-scan detection and alert dock published");
console.log("PASS Production root still points to V9.15.1");
console.log("Preview: " + new URL("preview/v9.16/", origin).href);
