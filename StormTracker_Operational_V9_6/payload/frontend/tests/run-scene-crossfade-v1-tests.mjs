import assert from 'node:assert/strict';
import { createSceneCrossfade } from '../src/scene-crossfade-v1.js';

function fixture(reduced = false, timeout = 1000) {
  const listeners = new Set();
  let draws = 0, resolveAnimation, options, cancelled = 0;
  const overlay = { hidden: true, width: 0, height: 0, setAttribute() {},
    getContext: () => ({ drawImage() { draws++; } }),
    animate: (frames, supplied) => {
      options = supplied;
      assert.deepEqual(frames, [{ opacity: 1 }, { opacity: 0 }]);
      return { finished: new Promise(resolve => { resolveAnimation = resolve; }), cancel() { cancelled++; resolveAnimation?.(); } };
    }
  };
  const scene = { canvas: { width: 100, height: 50 }, requestRender() {},
    postRender: { addEventListener(callback) { listeners.add(callback); return () => listeners.delete(callback); } } };
  const crossfade = createSceneCrossfade({ scene, container: { appendChild() {} },
    documentImpl: { createElement: () => overlay }, reducedMotion: () => reduced, renderTimeoutMs: timeout });
  return { crossfade, overlay, listeners, fire: () => [...listeners].forEach(callback => callback()),
    draws: () => draws, options: () => options, end: () => resolveAnimation(), cancelled: () => cancelled };
}
const test = fixture();
const capture = test.crossfade.capture();
assert.equal(test.draws(), 0);assert.equal(test.overlay.hidden, true);
test.fire();assert.equal(await capture, true);
assert.equal(test.draws(), 1);assert.equal(test.overlay.width, 100);assert.equal(test.overlay.height, 50);
assert.equal(test.overlay.hidden, false);
const playing = test.crossfade.play(180);
test.fire();await Promise.resolve();test.fire();await Promise.resolve();
assert.equal(test.options().duration, 180);test.end();await playing;
assert.equal(test.overlay.hidden, true);assert.equal(test.listeners.size, 0);
const interrupted = test.crossfade.capture();test.crossfade.clear();assert.equal(await interrupted, false);
assert.equal(test.overlay.hidden, true);assert.equal(test.listeners.size, 0);
const next = test.crossfade.capture();test.fire();await next;
const cancelled = test.crossfade.play();test.fire();await Promise.resolve();test.fire();await Promise.resolve();
test.crossfade.clear();await cancelled;
assert.equal(test.overlay.hidden, true);assert.equal(test.listeners.size, 0);
const reduced = fixture(true);assert.equal(await reduced.crossfade.capture(), false);assert.equal(reduced.draws(), 0);
const stalled = fixture(false, 5);assert.equal(await stalled.crossfade.capture(), false);
assert.equal(stalled.overlay.hidden, true);assert.equal(stalled.listeners.size, 0);
console.log('Scene crossfade checks passed: post-render snapshots, real scene blending, cancellation/cleanup, reduced motion and stalled render fallback.');
