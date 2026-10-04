import assert from 'node:assert/strict';
import { buildSharedProductTimeline } from '../src/shared-product-timeline-v1.js';
const time = n => new Date(Date.UTC(2026, 9, 4, 0, n)).toISOString();
const times = (start, end, step = 5) => Array.from({ length: (end - start) / step + 1 }, (_, i) => time(start + i * step));
const source = (start, end, step = 5) => ({ frames: times(start, end, step).map(observedUtc => ({ filename: `${observedUtc}.png`, observedUtc })) });
const histories = new Map([['66', source(0, 180)], ['50', source(120, 180)], ['08', source(90, 180)]]);
let plan = buildSharedProductTimeline(times(0, 180), histories);
assert.equal(plan.entries.length, 13);
assert.equal(plan.startUtc, time(120));
assert.equal(plan.spanMinutes, 60);
assert.ok(plan.entries.every(entry => entry.pairings.every(pair => pair.matched && pair.deltaMinutes <= 8)));
assert.equal(plan.entries.at(-1).observedUtc, time(180));
// Native cadence differences pair independently without widening actual bounds.
histories.set('50', source(122, 176, 6));
plan = buildSharedProductTimeline(times(0, 180), histories);
assert.equal(plan.startUtc, time(125));
assert.equal(plan.endUtc, time(175));
assert.equal(plan.entries[0].pairings.find(p => p.radarId === '50').candidate.observedUtc, time(122));
// Requested shorter windows remain shorter than the available shared history.
assert.equal(buildSharedProductTimeline(times(150, 175), histories).entries.length, 6);
// Internal outages must not silently freeze Doppler across a missing interval.
histories.set('50', {frames: [120, 125, 175, 180].map(n => ({ filename: `${n}.png`, observedUtc: time(n) }))});
plan = buildSharedProductTimeline(times(120, 180), histories);
assert.ok(!plan.entries.some(entry => entry.observedUtc === time(150)));
assert.ok(plan.entries.some(entry => entry.observedUtc === time(130)));
// Latest GIF is allowed at the original newest radar frame only.
histories.set('50', source(120, 170));
const latest = new Map([['50', { filename: 'IDR50I.gif', observedUtc: time(180) }]]);
plan = buildSharedProductTimeline(times(120, 180), histories, latest);
assert.equal(plan.entries.at(-1).pairings.find(p => p.radarId === '50').candidate.source_kind, 'latest');
assert.equal(plan.entries.at(-2).pairings.find(p => p.radarId === '50').candidate.source_kind, 'history');
// Truncating the end does not promote an older frame to latest-GIF eligibility.
histories.set('08', source(120, 175));
histories.set('50', source(120, 165));
plan = buildSharedProductTimeline(times(120, 180), histories, latest);
assert.equal(plan.endUtc, time(170));
assert.ok(!plan.entries.some(entry => entry.pairings.some(pair => pair.candidate?.source_kind === 'latest')));
// Partial outages are explicit; unavailable sources do not invalidate healthy sources.
histories.delete('08');
plan = buildSharedProductTimeline(times(120, 180), histories, latest);
assert.deepEqual(plan.unavailableRadarIds, ['08']);
assert.ok(plan.entries.every(entry => !entry.pairings.find(p => p.radarId === '08').matched));
assert.equal(buildSharedProductTimeline(times(0, 30), histories).entries.length, 0);
assert.equal(buildSharedProductTimeline(times(0, 180), new Map(), latest).entries.length, 0);
assert.equal(buildSharedProductTimeline(['bad timestamp'], histories).entries.length, 0);
// Unsorted duplicates and malformed descriptors cannot extend the loop.
histories.set('50', {frames: [...source(120, 180).frames.reverse(), { observedUtc:'bad', filename:'bad' }]});
plan = buildSharedProductTimeline([...times(120,180).reverse(), time(120), 'bad'], histories);
assert.deepEqual(plan.entries.map(entry => entry.observedUtc), times(120,180));
console.log('21 shared-product timeline checks passed.');
