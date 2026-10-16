import assert from "node:assert/strict";
import {createResponsiveMemoryDiagnostics}
  from "../src/responsive-memory-diagnostics-v1.js";

class FakeElement {
  constructor(tag){
    this.tag=tag;this.children=[];this.style={};this.listeners={};
    this.attributes={};this.textContent="";this.open=false;this.id="";
  }
  appendChild(item){this.children.push(item);return item;}
  append(...items){this.children.push(...items);}
  addEventListener(name,callback){this.listeners[name]=callback;}
  setAttribute(name,value){this.attributes[name]=value; if(name==="open")this.open=true;}
  removeAttribute(name){delete this.attributes[name];if(name==="open")this.open=false;}
  click(){return this.listeners.click?.();}
  showModal(){this.open=true;this.modalCalls=(this.modalCalls??0)+1;}
  close(){this.open=false;this.closeCalls=(this.closeCalls??0)+1;}
  focus(){this.focused=true;}
}
const sidebar=new FakeElement("aside");
const body=new FakeElement("body");
const head=new FakeElement("head");
const documentRef={body,head,createElement:tag=>new FakeElement(tag)};
const readings={jsHeap:{usedMb:501,limitMb:999},secondarySiteGlyphs:
  Object.fromEntries(Array.from({length:12},(_,i)=>["Longreach-"+i,1200])),
  playbackTiming:{radarMs:800,volumeMs:150},
  source:"This long JSON string must not expand the controls sidebar ".repeat(30)
};
let captures=0,copied="";
const widget=createResponsiveMemoryDiagnostics({
  documentRef,sidebar,capture:()=>{captures++;return {...readings,capture:captures};},
  clipboard:{writeText:async value=>{copied=value;}}
});
assert.equal(sidebar.children.length,1);
assert.equal(body.children.length,1,"The full JSON dialog is NOT inside the constrained sidebar");
assert.equal(sidebar.children[0].id,"memoryQaPanel");
assert.match(widget.panel.style.cssText,/max-width:100%/);
assert.match(widget.dialog.style.cssText,/width:min\(780px,calc\(100vw - 20px\)\)/);
assert.match(widget.dialog.style.cssText,/max-height:calc\(100dvh - 20px\)/);
assert.match(widget.dialog.style.cssText,/overflow:auto/);
const output=widget.dialog.children.at(-1);
assert.equal(output.id,"stormtrackerMemoryJson");
assert.match(output.style.cssText,/white-space:pre-wrap/);
assert.match(output.style.cssText,/overflow-wrap:anywhere/);
assert.match(output.style.cssText,/max-width:100%/);
assert.match(output.style.cssText,/max-height:60dvh/);
assert.equal(captures,0,"No background memory sampling");
widget.open.click();
assert.equal(widget.dialog.open,true);
assert.equal(captures,1);
assert.match(widget.latestJson,/Longreach-11/);
assert.match(output.textContent,/500?1/);
const toolbar=widget.dialog.children[0];
const [title,refresh,copy,close]=toolbar.children;
assert.match(title.textContent,/Memory/);
refresh.click();
assert.equal(captures,2,"Refresh is explicit on-demand only");
assert.match(widget.latestJson,/"capture": 2/);
copy.click();
await Promise.resolve();
await Promise.resolve();
assert.equal(copied,widget.latestJson,"Copy contains complete untruncated JSON");
close.click();
assert.equal(widget.dialog.open,false);
assert.equal(widget.open.focused,true);
assert.equal(captures,2);
console.log("PASS full viewport-constrained diagnostics modal: sidebar no overflow, long JSON scrolls, refresh/copy/close and no hidden polling.");
