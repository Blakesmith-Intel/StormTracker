import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const html=read("../live3d-operational-v9.html");
const runtime=read("../src/live3d-operational-v9.js");
const css=read("../src/operational-dashboard-v9-1.css");
const native=read("../src/native-doppler-image-v1.js");

// Only ONE user-facing physical-radar selection: internal Doppler ID follows it.
assert.match(html,/<select id="radarSite"[^>]*>/);
assert.match(html,/<input type="hidden" id="dopplerOverlayRadar" value="66">/);
assert.doesNotMatch(html,/<select id="dopplerOverlayRadar"/);
assert.doesNotMatch(html,/for="dopplerOverlayRadar"/);
assert.doesNotMatch(html,/<option value="SEQ">/);
assert.match(runtime,/function configureRadarSite\(\)[\s\S]*?\$\("dopplerOverlayRadar"\)\.value=ids\[0\]\?\?""/);
assert.match(runtime,/configureRadarSite\(\); resetView\(\); clearDopplerOverlay\(\);/,
  "primary radar change must reset previous wind layers and frames");
assert.doesNotMatch(runtime,/\$\("dopplerOverlayRadar"\)\.addEventListener\("change"/);
assert.match(runtime,/function isDopplerSourceActive\(\) \{ return Boolean\(\$\("dopplerOverlayRadar"\)\?\.value\); \}/,
  "source-unavailable sites must not load Doppler");

// Remove redundant status and unsupported mode jargon while keeping
// live radar timestamps, track control and the genuine wind-velocity legend.
assert.doesNotMatch(html,/id="operationalDoppler"/);
assert.doesNotMatch(runtime,/\$\("operationalDoppler"\)/);
assert.doesNotMatch(html,/id="trackVolumeModeLabel"/);
assert.doesNotMatch(html,/Track-specific 3-D · always on/);
assert.match(html,/id="openDetailsButton"/);
assert.match(html,/id="showTrackLabels"/);
assert.match(html,/id="trackDisplayFilter"/);
assert.match(html,/id="showTrackThreatCone"/);
assert.match(html,/id="dopplerVelocityLegend"/);
assert.match(html,/id="radarClockGroup"/);
assert.match(html,/id="windClockGroup" hidden/);
assert.match(runtime,/\$\("radarClockGroup"\)\.hidden=windOnly/);
assert.match(runtime,/\$\("windClockGroup"\)\.hidden=!windOnly/);
assert.doesNotMatch(html,/id="dopplerOpacity"/);
assert.match(html,/id="volumeOpacity"/);
assert.match(html,/id="radarOpacity"/);

// Hard scan cut - source rows are either fully opaque or excluded; NEVER fade.
assert.match(native,/NATIVE_DOPPLER_ANNOTATION_START_ROW = 438/);
assert.doesNotMatch(native,/NATIVE_DOPPLER_ANNOTATION_FADE_START_ROW/);
assert.match(native,/if\(maskAnnotationRows && isNativeDopplerDisplayAnnotationRow\(row\)\)continue/);
assert.match(native,/data\[to \+ 3\] = alpha;/);
assert.match(runtime,/native-doppler-image-v1\.js\?v=9\.16\.14-hard-footer/);

// Permanent place-name stacking contract stays in the same tested release.
assert.match(css,/--stormtracker-geo-label-z:2000;/);
assert.match(css,/\.qld-place-foreground\s*\{[^}]*z-index:var\(--stormtracker-geo-label-z\)/);
console.log("PASS V9.16.14 sidebar consolidation, hidden Doppler auto-follow, independent clocks, hard crop and foreground labels.");
