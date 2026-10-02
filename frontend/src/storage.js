const DB_NAME = "stormtracker-browser";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("frames")) db.createObjectStore("frames", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putState(key,value) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction("state","readwrite");
    tx.objectStore("state").put(value,key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

export async function getState(key) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const req = db.transaction("state","readonly").objectStore("state").get(key);
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}

export async function putFrame(frame) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction("frames","readwrite");
    tx.objectStore("frames").put(frame);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}

export async function clearAll() {
  const db = await openDb();
  await Promise.all(["state","frames"].map(store => new Promise((resolve,reject) => {
    const tx = db.transaction(store,"readwrite"); tx.objectStore(store).clear();
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  })));
}
