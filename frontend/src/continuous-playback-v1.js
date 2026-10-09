// Await each complete scene update before advancing; never overlap renders.
export function createContinuousPlayback({ count, currentIndex, showFrame, delay, onPlayingChange = () => {}, onError = () => {} }) {
  let playing = false;
  let generation = 0;
  let pending = Promise.resolve();
  function pause() {
    playing = false;
    generation++;
    onPlayingChange(false);
    return pending;
  }
  function play() {
    if (playing || count() < 2) return pending;
    playing = true;
    const token = ++generation;
    onPlayingChange(true);
    // Queue behind a stopped render so rapid Pause/Play cannot overlap it.
    pending = pending.then(async () => {
      while (playing && token === generation && count() > 1) {
        const startedAt = performance.now();
        await showFrame((currentIndex() + 1) % count());
        if (!playing || token !== generation) return;
        // Old player waited AFTER image loading. Account for rendering time
        // in the interval so costly tiles don't add a second delay.
        const remaining = Math.max(0, delay() - (performance.now() - startedAt));
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      }
    }).catch(error => {
      if (token === generation) {
        pause();
        onError(error);
      }
    });
    return pending;
  }
  return { play, pause, isPlaying: () => playing };
}
