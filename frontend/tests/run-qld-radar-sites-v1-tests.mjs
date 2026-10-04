import assert from 'node:assert/strict';
import { QLD_RADAR_SITES, QLD_DOPPLER_PRODUCTS, dopplerRadarsForRegion } from '../src/qld-radar-sites-v1.js';
import { reflectivityWindowForRegion } from '../src/bom-wmts-loop-v2.js';
import { buildSharedProductTimeline } from '../src/shared-product-timeline-v1.js';
import { radarHistoryTimeline } from '../src/live-loop-refresh-v1.js';
import { parseBomRadarLoopFrames } from '../../relay/doppler-history-v1.js';
import { dopplerMapCoordinateToLonLat, lonLatToDopplerMapCoordinate } from '../src/bom-doppler-georef-v1.js';
assert.equal(Object.keys(QLD_RADAR_SITES).length,19);
assert.equal(Object.keys(QLD_DOPPLER_PRODUCTS).length,14);
assert.deepEqual(dopplerRadarsForRegion(),['66','50','08']);
assert.throws(()=>dopplerRadarsForRegion('999'));
assert.throws(()=>reflectivityWindowForRegion('999'));
assert.deepEqual(reflectivityWindowForRegion(),{colStart:33,colEnd:35,rowStart:13,rowEnd:16});
const span=40075016.68557849/256;
for(const site of Object.values(QLD_RADAR_SITES)) {
 const w=reflectivityWindowForRegion(site.id),R=6378137;
 const x=R*site.longitude*Math.PI/180,y=R*Math.log(Math.tan(Math.PI/4+site.latitude*Math.PI/360));
 assert.ok(w.colStart>=0&&w.colEnd<43&&w.rowStart>=0&&w.rowEnd<33);
 assert.ok(w.colEnd>=w.colStart&&w.rowEnd>=w.rowStart);
 assert.ok(x>11584952+w.colStart*span&&x<11584952+(w.colEnd+1)*span);
 assert.ok(y< -740105.880375-w.rowStart*span&&y> -740105.880375-(w.rowEnd+1)*span);
 if(site.dopplerProduct) {
  assert.deepEqual(dopplerRadarsForRegion(site.id),[site.id]);
  const frames=parseBomRadarLoopFrames(`"${site.dopplerProduct}.T.202610040600.png"`,site.dopplerProduct);
  assert.equal(frames[0].observedUtc,'2026-10-04T06:00:00.000Z');
  if(!['08','50','66'].includes(site.id)) {
   const centre=dopplerMapCoordinateToLonLat(site.id,256,256);
   assert.ok(Math.abs(centre.latitude-site.dopplerLatitude)<1e-9);
   assert.ok(Math.abs(centre.longitude-site.dopplerLongitude)<1e-9);
   const pixel=lonLatToDopplerMapCoordinate(site.id,centre.longitude,centre.latitude);
   assert.ok(Math.abs(pixel.column-256)<1e-6&&Math.abs(pixel.row-256)<1e-6);
  }
 } else {
  assert.deepEqual(dopplerRadarsForRegion(site.id),[]);
  assert.throws(()=>parseBomRadarLoopFrames('',`IDR${site.id}I`));
 }
}
const times=['2026-10-04T05:50:00Z','2026-10-04T05:55:00Z','2026-10-04T06:00:00Z'];
const histories=new Map([['108',{frames:times.map((observedUtc,i)=>({observedUtc,filename:`IDR108I.T.${i}.png`}))}]]);
const shared=buildSharedProductTimeline(times,histories,new Map(),['108']);
assert.deepEqual(shared.radarIds,['108']);assert.equal(shared.entries.length,3);
assert.ok(shared.entries.every(e=>e.pairings.length===1&&e.pairings[0].radarId==='108'));
const empty=buildSharedProductTimeline(times,new Map(),new Map(),[]);empty.requestedRadarIds=[];
const standard=radarHistoryTimeline(times,empty);
assert.equal(standard.entries.length,3);assert.ok(standard.entries.every(e=>e.pairings.length===0));
console.log('Queensland coverage checks passed: 19 sites, 14 Doppler / 5 standard, regional tile bounds, three-digit products, single-site histories and radar-only timelines.');
// Exercise the transport worker, including all three-digit product routes.
const { default: relay } = await import('../../relay/worker.js');
const originalFetch=globalThis.fetch;
try {
 globalThis.fetch=async url=> {
  const match=String(url).match(/(IDR\d{2,3}I)/);assert.ok(match);
  return new Response(String(url).endsWith('.shtml') ? `${match[1]}.T.202610040600.png` : new Uint8Array([137,80,78,71]),
   {headers:{'Content-Type':String(url).endsWith('.shtml')?'text/html':'image/png'}});
 };
 for(const product of Object.values(QLD_DOPPLER_PRODUCTS)) {
  const request=path=>new Request(`https://relay.invalid/${path}`,{headers:{Origin:'https://blakesmith-intel.github.io'}});
  const history=await relay.fetch(request(`radar-history?product=${product}`));
  assert.equal(history.status,200);assert.equal((await history.json()).frames.length,1);
  const frame=await relay.fetch(request(`radar-frame?product=${product}&file=${product}.T.202610040600.png`));
  assert.equal(frame.status,200);
  assert.equal((await relay.fetch(request(`radar-frame?product=${product}&file=IDR999I.T.202610040600.png`))).status,400);
 }
 for(const site of Object.values(QLD_RADAR_SITES).filter(site=>!site.dopplerProduct)) {
  assert.equal((await relay.fetch(new Request(`https://relay.invalid/radar-history?product=IDR${site.id}I`))).status,403);
 }
 assert.equal((await relay.fetch(new Request('https://relay.invalid/radar-history?product=IDR108I',{headers:{Origin:'https://untrusted.invalid'}}))).status,403);
} finally {globalThis.fetch=originalFetch;}
assert.equal(Object.values(QLD_RADAR_SITES).filter(site=>site.analysisGeorefVerified).length,3);
console.log('Queensland relay routes passed: all 14 Doppler products accepted, standard/foreign products and cross-product filenames rejected; existing analytical calibration scope retained.');
