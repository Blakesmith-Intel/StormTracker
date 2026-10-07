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


const RADAR_FRAME_KIND = "radar-history-v1";

function radarFrameKey(region, observedUtc) {
  return `${RADAR_FRAME_KIND}:${String(region)}:${String(observedUtc)}`;
}

export async function putRadarFrame(region, frame) {
  if (!frame?.observedUtc || !frame?.categories) {
    throw new Error("Radar cache requires a timestamped decoded frame.");
  }

  return putFrame({
    key: radarFrameKey(region, frame.observedUtc),
    kind: RADAR_FRAME_KIND,
    region: String(region),
    observedUtc: frame.observedUtc,
    storedAt: Date.now(),
    frame
  });
}

export async function getRadarFrames(
  region,
  sinceEpoch = 0
) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const request =
      db.transaction("frames", "readonly")
        .objectStore("frames")
        .getAll();

    request.onsuccess = () => {
      const wantedRegion = String(region);
      const cutoff = Number(sinceEpoch) || 0;

      const frames =
        (request.result ?? [])
          .filter(record =>
            record?.kind === RADAR_FRAME_KIND
            && record.region === wantedRegion
            && Number.isFinite(Date.parse(record.observedUtc))
            && Date.parse(record.observedUtc) >= cutoff
            && record.frame?.categories
          )
          .sort(
            (left, right) =>
              Date.parse(left.observedUtc)
              - Date.parse(right.observedUtc)
          )
          .map(record => record.frame);

      resolve(frames);
    };

    request.onerror = () =>
      reject(request.error);
  });
}

export async function pruneRadarFrames({
  beforeEpoch = 0,
  maxRecords = 240
} = {}) {
  const db = await openDb();

  const records =
    await new Promise((resolve, reject) => {
      const request =
        db.transaction("frames", "readonly")
          .objectStore("frames")
          .getAll();

      request.onsuccess = () =>
        resolve(request.result ?? []);

      request.onerror = () =>
        reject(request.error);
    });

  const radarRecords =
    records
      .filter(record =>
        record?.kind === RADAR_FRAME_KIND
        && Number.isFinite(Date.parse(record.observedUtc))
      )
      .sort(
        (left, right) =>
          Date.parse(left.observedUtc)
          - Date.parse(right.observedUtc)
      );

  const cutoff = Number(beforeEpoch) || 0;
  const keepCount =
    Math.max(1, Number(maxRecords) || 240);
  const overflow =
    Math.max(
      0,
      radarRecords.length - keepCount
    );

  const keysToDelete =
    radarRecords
      .filter(
        (record, index) =>
          Date.parse(record.observedUtc) < cutoff
          || index < overflow
      )
      .map(record => record.key);

  if (!keysToDelete.length) return 0;

  return new Promise((resolve, reject) => {
    const tx =
      db.transaction("frames", "readwrite");
    const store =
      tx.objectStore("frames");

    for (const key of keysToDelete) {
      store.delete(key);
    }

    tx.oncomplete = () =>
      resolve(keysToDelete.length);

    tx.onerror = () =>
      reject(tx.error);
  });
}
