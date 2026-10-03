export class RadarWorkerClient {
  constructor() {
    this.worker = new Worker(new URL("./workers/radar-worker.js?v=live-bom-v1", import.meta.url), { type: "module" });
    this.nextId = 1;
    this.pending = new Map();
    this.worker.onmessage = event => {
      const message = event.data ?? {};
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.ok ? pending.resolve(message.result) : pending.reject(new Error(message.error));
    };
    this.worker.onerror = event => console.error("StormTracker worker error", event);
  }
  call(type,payload={}) {
    const id = this.nextId++;
    return new Promise((resolve,reject) => {
      this.pending.set(id,{resolve,reject});
      this.worker.postMessage({id,type,payload});
    });
  }
  reset() { return this.call("reset"); }
  processFrameBucket(payload) { return this.call("processFrameBucket",payload); }
  state() { return this.call("state"); }
}
