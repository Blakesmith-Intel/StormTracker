import assert from 'node:assert/strict';
import {
  shortestAngleDelta,
  touchPairMetrics,
  pinchRange,
  createStormTrackerTouchCameraGestures
} from '../src/touch-camera-gestures-v1.js';

assert.ok(Math.abs(shortestAngleDelta(Math.PI - .1, -Math.PI + .1) - .2) < 1e-9);
assert.deepEqual(touchPairMetrics({x:0,y:0},{x:3,y:4}), {
  distance:5, angle:Math.atan2(4,3), midpointX:1.5, midpointY:2
});
assert.equal(pinchRange(100000,100,200),50000);
assert.equal(pinchRange(1000,100,1000,{minimumRange:800}),800);
assert.equal(pinchRange(4000000,100,10,{maximumRange:5000000}),5000000);

class FakeContainer {
  constructor(){this.clientWidth=200;this.clientHeight=100;this.listeners=new Map();this.captured=new Set();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)??[]).filter(x=>x!==fn));}
  setPointerCapture(id){this.captured.add(id);} hasPointerCapture(id){return this.captured.has(id);} releasePointerCapture(id){this.captured.delete(id);}
  send(type,props){const event={pointerType:'touch',pointerId:1,clientX:0,clientY:0,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...props};for(const fn of this.listeners.get(type)??[])fn(event);return event;}
}
const container=new FakeContainer();
const calls=[];
let state={range:100000};
const controller={
  panByFraction:(x,y)=>calls.push(['pan',x,y]),
  getState:()=>({...state}),
  setView:v=>{state={...state,...v};calls.push(['view',v]);},
  rotateDegrees:v=>calls.push(['rotate',v]),
  tiltDegrees:v=>calls.push(['tilt',v])
};
let gestures=0;
const touch=createStormTrackerTouchCameraGestures({container,getController:()=>controller,onGesture:()=>gestures++});
let event=container.send('pointerdown',{pointerId:1,clientX:50,clientY:50});
assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(touch.activeTouchCount(),1);
container.send('pointermove',{pointerId:1,clientX:70,clientY:60});
assert.deepEqual(calls.at(-1),['pan',.1,.1]);
container.send('pointerdown',{pointerId:2,clientX:130,clientY:60});
const before=state.range;
container.send('pointermove',{pointerId:2,clientX:170,clientY:70});
assert.ok(state.range < before,'pinch apart should zoom in continuously');
const multiView = calls.filter(x=>x[0]==='view').at(-1);
assert.ok(Number.isFinite(multiView?.[1]?.heading),'two-finger twist should update heading in the batched view');
assert.ok(Number.isFinite(multiView?.[1]?.pitch),'two-finger vertical motion should update pitch in the batched view');
assert.equal(calls.filter(x=>x[0]==='view').length,1,'one two-finger move should require only one camera view update');
container.send('pointerup',{pointerId:2,clientX:170,clientY:70});
assert.equal(touch.activeTouchCount(),1);
container.send('pointerup',{pointerId:1,clientX:70,clientY:60});
assert.equal(touch.activeTouchCount(),0);assert.ok(gestures>=5);
touch.destroy();
assert.equal((container.listeners.get('pointerdown')??[]).length,0);
console.log('Touch camera gesture checks passed: one-finger pan, batched pinch/rotate/pitch updates and cleanup.');
