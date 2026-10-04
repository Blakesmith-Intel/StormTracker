import assert from 'node:assert/strict';
import { buildSharedProductTimeline } from '../src/shared-product-timeline-v1.js';
import { radarHistoryTimeline, hasNewMatchedProducts, createLiveLoopRefresh } from '../src/live-loop-refresh-v1.js';
const time = n => new Date(Date.UTC(2026,9,4,0,n)).toISOString();
const times = (end,count=36) => Array.from({length:count},(_,i)=>time(end-(count-1-i)*5));
const sources = (end, shifts={}) => new Map(['66','50','08'].map(id=>[id,{frames:times(end+(shifts[id]??0),7).map(observedUtc=>({observedUtc,filename:`${observedUtc}.png`}))}]));
const previous = buildSharedProductTimeline(times(180),sources(180));
const radar = radarHistoryTimeline(times(180),previous);
assert.equal(radar.entries.length,36);
assert.equal(radar.entries[0].observedUtc,time(5));
assert.ok(radar.entries[0].pairings.every(pair=>!pair.matched&&!pair.candidate));
assert.ok(radar.entries.at(-1).pairings.every(pair=>pair.matched));
assert.equal(hasNewMatchedProducts(previous,previous),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(180))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(180),sources(185))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(185,{'50':-5}))),false);
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),sources(185))),true);
const outage=sources(185);outage.delete('08');
assert.equal(hasNewMatchedProducts(previous,buildSharedProductTimeline(times(185),outage)),false);
assert.equal(hasNewMatchedProducts(null,buildSharedProductTimeline(times(185),new Map())),false);
assert.equal(radarHistoryTimeline(times(180),buildSharedProductTimeline(times(180),new Map())).entries.length,36);
// Timer re-arms only after completion; focus checks cannot overlap a fetch.
let callback, calls=0, release, cancelled=0, errors=[];
const scheduler=createLiveLoopRefresh({schedule:cb=>{callback=cb;return 1;},cancel:()=>cancelled++,
 refresh:()=>{calls++;return new Promise(resolve=>release=resolve);},onError:error=>errors.push(error)});
scheduler.start();scheduler.start();
const first=scheduler.check();await Promise.resolve();
const second=scheduler.check();await Promise.resolve();assert.equal(calls,1);
release();await Promise.all([first,second]);assert.equal(cancelled,1);
callback();await Promise.resolve();assert.equal(calls,2);scheduler.stop();release();await Promise.resolve();await Promise.resolve();
assert.deepEqual(errors,[]);
let retries=0;
const failing=createLiveLoopRefresh({schedule:cb=>{callback=cb;return 1;},cancel:()=>{},
 refresh:()=>{retries++;throw Error('fixture failure');},onError:error=>errors.push(error.message)});
failing.start();await failing.check();assert.equal(retries,1);assert.equal(errors.at(-1),'fixture failure');failing.stop();
console.log('Live loop checks passed: 36-frame radar history, absent older Doppler context, independent source advance, outages, no overlapping refreshes and retry scheduling.');
