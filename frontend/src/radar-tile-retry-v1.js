// Retry only missing WMTS tiles once rather than discarding an entire radar
// timestamp due to one transient HTTP/CORS failure. Never patch missing data
// with transparent tiles; a frame is accepted only after every tile is real.
export async function loadCompleteRadarTiles(tasks, fetchTile, {
  retries = 1,
  stopOnPermanent = false,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (!Array.isArray(tasks) || !tasks.length || typeof fetchTile !== "function") {
    throw new TypeError("A non-empty radar tile list and a loader are required");
  }
  const results = new Array(tasks.length);
  let pending = tasks.map((task, i) => ({ task, i }));
  for (let attempt = 0; attempt <= retries; attempt++) {
    const loaded = await Promise.allSettled(
      pending.map(({ task }) => fetchTile(task.url))
    );
    const failures = [];
    loaded.forEach((record, i) => {
      const { task, i: index } = pending[i];
      if (record.status === "fulfilled" &&
          record.value?.width > 0 && record.value?.height > 0) {
        results[index] = { ...task, image: record.value };
      } else {
        failures.push({
          task,
          i: index,
          error: record.status === "rejected"
            ? record.reason?.message ?? String(record.reason)
            : "empty radar tile"
        });
      }
    });
    if (!failures.length) return results;
    // HTTP 400 is a permanently unavailable source tile for that exact
    // timestamp, and HTTP 403 is a refusal; retrying the same URL immediately
    // cannot make a complete, authentic BoM frame and may amplify a relay ban.
    const permanent = stopOnPermanent && failures.some(({error}) =>
      /(?:HTTP\s+(?:400|403|429)\b|relay cooldown|queue full)/i.test(error));
    if (attempt === retries || permanent) {
      const details = failures.slice(0, 6).map(({ task, error }) =>
        "tile " + task.col + "/" + task.row + ": " + error
      ).join("; ");
      throw new Error("Incomplete BoM reflectivity mosaic: " +
        failures.length + "/" + tasks.length + " tiles unavailable after " +
        (attempt + 1) + " attempt(s); " + details);
    }
    pending = failures.map(({ task, i }) => ({ task, i }));
    await wait(250);
  }
  throw new Error("Radar tile loading unexpectedly exhausted.");
}
