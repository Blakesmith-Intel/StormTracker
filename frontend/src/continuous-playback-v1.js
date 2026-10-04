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
        await new Promise(resolve => setTimeout(resolve, delay()));
        if (!playing || token !== generation) return;
        await showFrame((currentIndex() + 1) % count());
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
