import assert from 'node:assert/strict';
import { buildSharedProductTimeline } from '../src/shared-product-timeline-v1.js';
import {
  radarHistoryTimeline,
  needsChronologicalRadarRebuild,
  automaticRefreshUsesDopplerGate,
  automaticRefreshEndUtc,
  hasNewMatchedProducts,
  createLiveLoopRefresh
} from '../src/live-loop-refresh-v1.js';
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

// Automatic refresh must rebuild chronologically when browser-cached history
// introduces a real observation at/before the point already tracked through.
const processedTail = times(180, 6);
const expandedHistory = [
  time(145),
  time(150),
  ...processedTail,
  time(185)
];
assert.equal(
  needsChronologicalRadarRebuild(
    expandedHistory,
    time(180),
    processedTail
  ),
  true
);
assert.equal(
  needsChronologicalRadarRebuild(
    [...processedTail, time(185)],
    time(180),
    processedTail
  ),
  false
);
assert.equal(
  needsChronologicalRadarRebuild(
    expandedHistory,
    null,
    processedTail
  ),
  false
);
assert.equal(
  needsChronologicalRadarRebuild(
    [time(185)],
    time(180),
    processedTail
  ),
  false
);

// A radar-capable site must never wait for Doppler unless the user has
// explicitly selected the Doppler overlay.
assert.equal(
  automaticRefreshUsesDopplerGate(
    false,
    ["66"]
  ),
  false
);

assert.equal(
  automaticRefreshUsesDopplerGate(
    true,
    ["66"]
  ),
  true
);

assert.equal(
  automaticRefreshUsesDopplerGate(
    true,
    []
  ),
  false
);

assert.equal(
  automaticRefreshEndUtc({
    withDoppler: false,
    radarTimes: [
      time(175),
      time(180),
      time(185)
    ],
    sharedEndUtc:
      time(180)
  }),
  time(185)
);

assert.equal(
  automaticRefreshEndUtc({
    withDoppler: true,
    radarTimes: [
      time(175),
      time(180),
      time(185)
    ],
    sharedEndUtc:
      time(180)
  }),
  time(180)
);

// Timer re-arms only after completion; focus checks cannot overlap a fetch.
let callback, calls=0, release, cancelled=0, errors=[], delays=[];
const scheduler=createLiveLoopRefresh({schedule:(cb,delay)=>{callback=cb;delays.push(delay);return 1;},cancel:()=>cancelled++,
 refresh:()=>{calls++;return new Promise(resolve=>release=resolve);},onError:error=>errors.push(error)});
scheduler.start();scheduler.start();
assert.deepEqual(delays,[300000]);
const first=scheduler.check();await Promise.resolve();
const second=scheduler.check();await Promise.resolve();assert.equal(calls,1);
release();await Promise.all([first,second]);assert.equal(cancelled,1);
assert.deepEqual(delays,[300000,300000]);
callback();await Promise.resolve();assert.equal(calls,2);scheduler.stop();release();await Promise.resolve();await Promise.resolve();
assert.deepEqual(errors,[]);
let retries=0;
const failing=createLiveLoopRefresh({schedule:(cb,delay)=>{callback=cb;delays.push(delay);return 1;},cancel:()=>{},
 refresh:()=>{retries++;throw Error('fixture failure');},onError:error=>errors.push(error.message)});
failing.start();await failing.check();assert.equal(retries,1);assert.equal(errors.at(-1),'fixture failure');assert.equal(delays.at(-1),300000);failing.stop();
console.log('Live loop checks passed: radar history, automatic cached-history rebuild detection, radar-only refresh independence from Doppler, source advance, outages, no overlapping refreshes and retry scheduling.');
