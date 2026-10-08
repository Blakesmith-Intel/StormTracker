import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=new URL('../../',import.meta.url);
const source=readFileSync(fileURLToPath(new URL('frontend/src/live3d-operational-v9.js',root)),'utf8');
const start=source.indexOf('function renderHybridTracks(index)');
const end=source.indexOf('\nfunction updateHybridSourceMetrics',start);
assert.ok(start>=0&&end>start,'renderHybridTracks block missing');
const block=source.slice(start,end);
assert.match(block,/const altitude =\s*1200;/);
assert.doesNotMatch(block,/const altitude =\s*volume/);
assert.match(source,/createStormTrackLabelOverlay/,
  'track identifier dots and text must use the foreground overlay above 3-D primitives');
assert.match(block,/stormTrackMarkers\.push\(\{/,
  'observed storm ID must produce one paired dot-and-label marker');
assert.match(block,/stormTrackLabelOverlay\.setMarkers\(stormTrackMarkers\)/,
  'rendered markers must update with observed frame');
assert.doesNotMatch(block,/id:\s*`hybrid-\$\{index\}-\$\{track\.track_id\}`/,
  'do not leave an obscured or independently visible Cesium track dot');
assert.match(block,/depthFailMaterial:\s*colour\.withAlpha/);
assert.match(block,/history\.push\(\{[\s\S]*altitude/);
assert.match(block,/hybrid-trail-/);
assert.match(source,/function sameObservedInstant/);
assert.ok((source.match(/sameObservedInstant\(/g)??[]).length>=3,
  'timestamp-normalised matching must be used by track rendering and track-volume construction');
assert.doesNotMatch(source,/item\.observed_utc\s*===\s*hybridFrames\[index\]\.observedUtc/);
assert.doesNotMatch(source,/item\.observed_utc\s*===\s*frame\.observedUtc/);
assert.equal(Date.parse('2026-10-05T19:45:00Z'),Date.parse('2026-10-05T19:45:00.000Z'));
console.log('Track overlay visibility checks passed: timestamp-normalised observations, fixed 1.2 km tracking plane, foreground paired markers/labels and depth-fail trails.');
