import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const root = new URL('../', import.meta.url);
for (const name of ['live3d-operational-v9.js', 'bom-wmts-loop-v2.js', 'bom-doppler-intake-v3.js',
  'live-loop-refresh-v1.js', 'product-time-display-v1.js', 'doppler-request-v1.js', 'scene-crossfade-v1.js', 'touch-camera-gestures-v1.js', 'track-threat-cone-v1.js', 'radar-history-window-v1.js', 'radar-temporal-interpolation-v1.js', 'storage.js', 'frame-slider-v1.js', 'camera-performance-v1.js', 'doppler-layer-transition-v1.js', 'context-layers/basemap-manager-v1.js', 'context-layers/terrain-manager-v1.js', 'context-layers/flood-road-closure-filter-v1.js', 'context-layers/flood-road-closures-v1.js', 'context-layers/flood-road-closures-operational-v1.js', 'context-layers/power-outages-v1.js', 'context-layers/power-outages-operational-v1.js', 'context-layers/essential-energy-kml-v1.js', 'context-layers/queensland-mainland-filter-v1.js', 'context-layers/river-gauges-v1.js', 'context-layers/river-height-bulletin-v1.js', 'context-layers/river-gauge-observations-v1.js', 'context-layers/river-gauge-layer-v1.js', 'context-layers/river-gauges-operational-v1.js']) {
  run(['--check', fileURLToPath(new URL(`frontend/src/${name}`, root))]);
}
const tests = new URL('frontend/tests/', root);
const suites = readdirSync(tests).filter(name => /^run-.*-tests\.mjs$/.test(name)).sort();
if (!suites.length) throw new Error('No frontend regression suites found.');
for (const name of suites) run([fileURLToPath(new URL(name, tests))]);
console.log(`${suites.length} frontend regression suites passed; frontend validation complete.`);
