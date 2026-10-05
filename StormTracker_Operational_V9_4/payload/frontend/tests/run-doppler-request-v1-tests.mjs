import assert from 'node:assert/strict';
import { createLiveLoopRefresh } from '../src/live-loop-refresh-v1.js';
import { withFreshDopplerResponse } from '../src/doppler-request-v1.js';
import { loadDopplerHistory, loadDopplerFrame, loadDopplerDiagnostic } from '../src/bom-doppler-intake-v3.js';

let options;
assert.equal(await withFreshDopplerResponse('fixture', response => response.text(), {
  fetchImpl: async (url, supplied) => { options = supplied; return new Response('fresh'); }
}), 'fresh');
assert.equal(options.cache, 'no-store');
assert.equal(options.signal.aborted, false);
let aborted = false;
await assert.rejects(withFreshDopplerResponse('stalled', response => response, {
  timeoutMs: 15,
  fetchImpl: (url, supplied) => new Promise((resolve, reject) => {
    supplied.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  })
}), /timed out/);
assert.equal(aborted, true);
// A response with received headers can still stall while its body is consumed.
await assert.rejects(withFreshDopplerResponse('stalled body', () => new Promise(() => {}), {
  timeoutMs: 15, fetchImpl: async () => new Response('body')
}), /timed out/);
await assert.rejects(withFreshDopplerResponse('network failure', () => {}, {
  fetchImpl: async () => { throw new Error('offline'); }
}), /offline/);
await assert.rejects(withFreshDopplerResponse('decode failure', () => { throw new Error('bad image'); }, {
  fetchImpl: async () => new Response('body')
}), /bad image/);
assert.equal(await withFreshDopplerResponse('retry', response => response.text(), {
  fetchImpl: async () => new Response('recovered')
}), 'recovered');

const previousFetch = globalThis.fetch, previousBitmap = globalThis.createImageBitmap,
  previousDocument = globalThis.document;
const requests = [];
try {
  globalThis.fetch = async (url, supplied) => {
    requests.push({ url, options: supplied });
    if (url.includes('/radar-history')) return Response.json({ format: 'StormTrackerDopplerHistoryV1', frames: [] });
    return new Response('image', { headers: {
      'X-StormTracker-Product': 'IDR66I', 'X-StormTracker-Observed-UTC': '2026-10-04T04:00:00Z'
    } });
  };
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1 });
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray([0,0,0,255]) })
  }) }) };
  await loadDopplerHistory('66');
  await loadDopplerFrame('66', { filename: 'IDR66I.T.202610040400.png' });
  await loadDopplerDiagnostic('66');
  assert.equal(requests.length, 3);
  assert.ok(requests.every(request => request.options.cache === 'no-store' && request.options.signal));
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(loadDopplerFrame('66', { filename: 'IDR66I.T.202610040400.png' }), /HTTP 503/);
} finally {
  globalThis.fetch = previousFetch;
  globalThis.createImageBitmap = previousBitmap;
  globalThis.document = previousDocument;
}
// The scheduled refresh re-arms after a timed-out request, without manual load.
let scheduled, attempts = 0, recovered, finish;
const recovery = new Promise(resolve => { finish = resolve; });
const loop = createLiveLoopRefresh({
  schedule: callback => { scheduled = callback; return 1; }, cancel: () => {},
  refresh: async () => {
    attempts++;
    recovered = await withFreshDopplerResponse('scheduled retry', response => response.text(), {
      timeoutMs: 15,
      fetchImpl: async () => attempts === 1 ? new Promise(() => {}) : new Response('new Doppler image')
    });
    finish();
  }, onError: error => assert.match(error.message, /timed out/)
});
loop.start();await loop.check();assert.equal(attempts, 1);
scheduled();await recovery;loop.stop();
assert.equal(attempts, 2);assert.equal(recovered, 'new Doppler image');

console.log('Doppler request checks passed: fresh history/latest/PNG fetches, network/body timeout, abort, decode failure and successful retry.');
