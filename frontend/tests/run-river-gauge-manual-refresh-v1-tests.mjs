import assert from "node:assert/strict";
import {bindRiverGaugeManualRefresh} from "../src/context-layers/river-gauges-operational-v1.js";

function makeButton(){
  const attrs=new Map();
  return {
    disabled:false,
    textContent:"↻ Refresh",
    attrs,
    addEventListener(type,fn){
      assert.equal(type,"click");
      this.handleClick=fn;
    },
    setAttribute(name,value){attrs.set(name,value);}
  };
}
assert.equal(bindRiverGaugeManualRefresh(null,async()=>{}),false);
const button=makeButton();
let calls=0,release;
const pending=new Promise(resolve=>{release=resolve;});
assert.equal(bindRiverGaugeManualRefresh(button,()=>{
  calls++;
  return pending;
}),true);
const click=button.handleClick();
assert.equal(calls,1);
assert.equal(button.disabled,true);
assert.equal(button.attrs.get("aria-busy"),"true");
assert.equal(button.textContent,"Refreshing…");
await button.handleClick();
assert.equal(calls,1,"Repeated taps during an in-flight refresh should not refetch");
release();
await click;
assert.equal(button.disabled,false);
assert.equal(button.attrs.get("aria-busy"),"false");
assert.equal(button.textContent,"↻ Refresh");
const failed=makeButton();
bindRiverGaugeManualRefresh(failed,async()=>{throw Error("BoM unavailable");});
await failed.handleClick();
assert.equal(failed.disabled,false,"Failed refresh must not permanently lock controls");
assert.equal(failed.attrs.get("aria-busy"),"false");
assert.equal(failed.textContent,"↻ Refresh");
const recovered=makeButton();
let refreshed=false;
bindRiverGaugeManualRefresh(recovered,async()=>{refreshed=true;});
await recovered.handleClick();
assert.equal(refreshed,true,"Manual refresh should work independently of gauge visibility");
console.log("Flood-gauge manual refresh UI passed: click calls operational refresh, busy state prevents double requests, error recovers, accessible label preserved.");
