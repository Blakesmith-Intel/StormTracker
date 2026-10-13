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
const frames=new Map();
let nextFrameId=0;
const scheduleFrame=callback=>{const id=++nextFrameId;frames.set(id,callback);return id;};
const cancelFrame=id=>frames.delete(id);
function runFrame(){
  const callbacks=[...frames.values()];
  frames.clear();
  for(const callback of callbacks)callback();
}
const touch=createStormTrackerTouchCameraGestures({
  container,getController:()=>controller,onGesture:()=>gestures++,
  scheduleFrame,cancelFrame
});
let event=container.send('pointerdown',{pointerId:1,clientX:50,clientY:50});
assert.equal(event.prevented,true);assert.equal(event.stopped,true);assert.equal(touch.activeTouchCount(),1);
assert.equal(gestures,0,'simple touch-down must not trigger camera-performance mode');
container.send('pointermove',{pointerId:1,clientX:50.5,clientY:50.5});
runFrame();
assert.equal(gestures,0,'sub-pixel tap jitter must not trigger camera movement');
container.send('pointermove',{pointerId:1,clientX:70,clientY:60});
assert.equal(frames.size,1,'touch should request one frame, not redraw synchronously');
runFrame();
assert.deepEqual(calls.at(-1),['pan',.1,.1]);
container.send('pointerdown',{pointerId:2,clientX:130,clientY:60});
const before=state.range;
container.send('pointermove',{pointerId:2,clientX:170,clientY:70});
runFrame();
assert.ok(state.range < before,'pinch apart should zoom in continuously');
const multiView = calls.filter(x=>x[0]==='view').at(-1);
assert.ok(Number.isFinite(multiView?.[1]?.heading),'two-finger twist should update heading in the batched view');
assert.ok(Number.isFinite(multiView?.[1]?.pitch),'two-finger vertical motion should update pitch in the batched view');
assert.equal(calls.filter(x=>x[0]==='view').length,1,'one two-finger move should require only one camera view update');
container.send('pointerup',{pointerId:2,clientX:170,clientY:70});
assert.equal(touch.activeTouchCount(),1);
container.send('pointerup',{pointerId:1,clientX:70,clientY:60});
assert.equal(touch.activeTouchCount(),0);assert.equal(gestures,2,'only actual pan/pinch movement should count as camera interaction');
touch.destroy();
assert.equal((container.listeners.get('pointerdown')??[]).length,0);

// iOS can deliver 60-120+ touch samples per second while Cesium still renders
// the previous image: keep all displacement but issue only one view update.
const beforeBurst=calls.length;
let dragStarts=0,dragEnds=0;
let startedBeforeCamera=false;
const guardedController={
  ...controller,
  panByFraction(x,y){
    assert.ok(dragStarts>dragEnds,"detail suspension must begin BEFORE camera pan");
    startedBeforeCamera=true;
    controller.panByFraction(x,y);
  }
};
const fast=createStormTrackerTouchCameraGestures({
  container,getController:()=>guardedController,onGesture:()=>gestures++,
  onGestureStart:()=>dragStarts++,onGestureEnd:()=>dragEnds++,
  scheduleFrame,cancelFrame
});
container.send('pointerdown',{pointerId:3,clientX:70,clientY:60});
for(let i=1;i<=80;i++){
  container.send('pointermove',{pointerId:3,clientX:70+i,clientY:60});
}
assert.equal(frames.size,1,'80 pointer samples should share one RAF');
assert.equal(calls.length,beforeBurst,'no camera work in pointermove callback');
runFrame();
assert.equal(calls.length,beforeBurst+1,'latest position updates camera exactly once');
assert.deepEqual(calls.at(-1),['pan',.4,0],'all 80px of movement survives coalescing');
assert.equal(dragStarts,1,"bursty drag suspends detail only once");
assert.equal(dragEnds,0);
assert.equal(startedBeforeCamera,true);

// Touch-up and pinch-mode transitions must not discard the last gesture.
container.send('pointermove',{pointerId:3,clientX:180,clientY:60});
assert.equal(frames.size,1);
container.send('pointerup',{pointerId:3,clientX:180,clientY:60});
assert.equal(frames.size,0,'pending RAF cancelled after final flush');
assert.deepEqual(calls.at(-1),['pan',.15,0],'final 30px applied on touch-up');
assert.equal(fast.activeTouchCount(),0);
assert.equal(dragEnds,1,"last pointer releases imagery after its final movement");
container.send('pointerdown',{pointerId:4,clientX:70,clientY:60});
container.send('pointermove',{pointerId:4,clientX:90,clientY:60});
container.send('pointerdown',{pointerId:5,clientX:160,clientY:60});
assert.deepEqual(calls.at(-1),['pan',.1,0],'first pan flushed before second finger is tracked');
container.send('lostpointercapture',{pointerId:5});
assert.equal(fast.activeTouchCount(),1,'lost capture clears stale second finger');
container.send('pointercancel',{pointerId:4});
assert.equal(fast.activeTouchCount(),0,'cancelled gesture releases all touch pointers');
assert.equal(dragStarts,2,"second pan begun during transition only fires one suspension");
assert.equal(dragEnds,2,"lost capture plus last cancel restores suspended background");
container.send('pointerdown',{pointerId:6,clientX:20,clientY:20});
container.send('pointermove',{pointerId:6,clientX:35,clientY:20});
assert.equal(frames.size,1);
fast.destroy();
assert.equal(frames.size,0,'destroy cancels scheduled camera work');
assert.equal((container.listeners.get('lostpointercapture')??[]).length,0);
console.log('Touch checks passed: latest-sample RAF coalescing, complete pan/pinch motion, final move flush, lost capture and teardown.');
