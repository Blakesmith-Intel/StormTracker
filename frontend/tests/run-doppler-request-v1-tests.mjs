import assert from 'node:assert/strict';
import { createLiveLoopRefresh } from '../src/live-loop-refresh-v1.js';
import { withFreshDopplerResponse } from '../src/doppler-request-v1.js';
import {
  loadDopplerHistory, loadDopplerFrame, loadDopplerDiagnostic,
  createDopplerFrameFailureCooldown
} from '../src/bom-doppler-intake-v3.js';

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

// Reproduce a source-advertised but unavailable Mackay PNG. Playback and
// prewarm must not repeat the network 502 on every 1x/2x/3x loop cycle.
let clock=100000,fetchAttempts=0;
const cooldown=createDopplerFrameFailureCooldown({
  now:()=>clock,cooldownMs:75000,maxEntries:3
});
const unavailable=async()=>{fetchAttempts++;
  const e=Error("Doppler history frame relay failed: HTTP 502");e.status=502;
  throw e;
};
await assert.rejects(cooldown.run("IDR22I.T.first.png",unavailable),/HTTP 502/);
await assert.rejects(cooldown.run("IDR22I.T.first.png",unavailable),
  e=>e.sourceCooldown===true && e.status===502);
assert.equal(fetchAttempts,1,"Playback and prewarm share a per-frame negative window");
assert.equal(cooldown.unavailable("IDR22I.T.first.png"),true);
const otherFrame=await cooldown.run("IDR22I.T.second.png",async()=>{fetchAttempts++;return "verified PNG"});
assert.equal(otherFrame,"verified PNG","Other observed source timestamps still load");
clock+=75001;
assert.equal(await cooldown.run("IDR22I.T.first.png",async()=>{fetchAttempts++;return "recovered PNG"}),"recovered PNG");
assert.equal(fetchAttempts,3,"Expired negative window retries the genuine BoM image");
assert.equal(cooldown.size(),0,"Successful images and expired failures do not persist");
let denied=0;
const rejects=async()=>{denied++;const e=Error("HTTP 400");e.status=400;throw e;};
await assert.rejects(cooldown.run("invalid",rejects),/HTTP 400/);
await assert.rejects(cooldown.run("invalid",rejects),/HTTP 400/);
assert.equal(denied,2,"Invalid filename errors are not disguised as BoM transient outages");
// Real public intake also needs to suppress repeat browser HTTP 502 errors.
let liveCalls=0;
const originalLiveFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>{liveCalls++;return new Response("upstream unavailable",{status:502});};
  const badFrame={filename:"IDR22I.T.202610180529.png"};
  await assert.rejects(loadDopplerFrame("22",badFrame),/HTTP 502/);
  await assert.rejects(loadDopplerFrame("22",badFrame),
    e=>e.sourceCooldown===true && e.status===502);
  assert.equal(liveCalls,1,"Only one failed HTTP transaction for repeated same PNG");
}finally{globalThis.fetch=originalLiveFetch;}

console.log('Doppler request checks passed: fresh history/latest/PNG fetches, network/body timeout, abort, decode failure and successful retry.');
