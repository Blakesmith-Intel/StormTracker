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
assert.ok((block.match(/disableDepthTestDistance:\s*Number\.POSITIVE_INFINITY/g)??[]).length>=2,
  'track point and label must remain visible above 3-D primitives');
assert.match(block,/depthFailMaterial:\s*colour\.withAlpha/);
assert.match(block,/history\.push\(\{[\s\S]*altitude/);
assert.match(block,/hybrid-trail-/);
console.log('Track overlay visibility checks passed: fixed 1.2 km tracking plane, always-visible markers/labels and depth-fail trails.');
