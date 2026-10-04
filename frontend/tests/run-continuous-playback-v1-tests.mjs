import assert from 'node:assert/strict';
import { createContinuousPlayback } from '../src/continuous-playback-v1.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let index = 0, active = 0, maxActive = 0;
const shown = [];
const changes = [];
let stop;
const completed = new Promise(resolve => { stop = resolve; });
const playback = createContinuousPlayback({
  count: () => 3, currentIndex: () => index, delay: () => 1,
  showFrame: async next => {
    active++;
    maxActive = Math.max(maxActive, active);
    await sleep(2);
    index = next;
    shown.push(next);
    active--;
    if (shown.length === 7) { playback.pause(); stop(); }
  },
  onPlayingChange: value => changes.push(value)
});
playback.play();
playback.play();
await completed;
await playback.pause();
assert.deepEqual(shown, [1, 2, 0, 1, 2, 0, 1]);
assert.equal(maxActive, 1);
assert.equal(playback.isPlaying(), false);
const pausedCount = shown.length;
await sleep(10);
assert.equal(shown.length, pausedCount);
assert.equal(changes.filter(Boolean).length, 1);
// Pausing and immediately restarting while a render is still pending stays serial.
let release, started;
const firstStarted = new Promise(resolve => { started = resolve; });
let renders = 0, overlaps = 0;
const blocked = createContinuousPlayback({
  count: () => 2, currentIndex: () => 0, delay: () => 1,
  showFrame: async () => {
    if (++renders > 1) overlaps++;
    started();
    await new Promise(resolve => { release = resolve; });
    renders--;
  }
});
blocked.play();
await firstStarted;
blocked.pause();
blocked.play();
blocked.pause();
release();
await blocked.pause();
assert.equal(overlaps, 0);
let errors = 0;
const failed = createContinuousPlayback({count:()=>2,currentIndex:()=>0,delay:()=>1,showFrame:async()=>{throw Error('failed');},onError:()=>errors++});
await failed.play();
assert.equal(errors, 1);
assert.equal(failed.isPlaying(), false);
let oneRendered = false;
const single = createContinuousPlayback({count:()=>1,currentIndex:()=>0,delay:()=>1,showFrame:async()=>{oneRendered=true;}});
await single.play();
assert.equal(oneRendered, false);
console.log('9 continuous-playback checks passed.');
