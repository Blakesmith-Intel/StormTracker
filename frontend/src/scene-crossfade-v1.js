// Blend complete rendered scenes; never interpolate radar samples or tracks.
// A canvas snapshot keeps the fade on the compositor instead of rewriting
// hundreds of thousands of Doppler/volume point colours every animation frame.
export function createSceneCrossfade({ scene, container, documentImpl = document,
  reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  renderTimeoutMs = 500 }) {
  const overlay = documentImpl.createElement('canvas');
  overlay.className = 'frame-crossfade';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  container.appendChild(overlay);
  let generation = 0, pending = null, animation = null;

  function clear() {
    generation++;
    pending?.(false);
    animation?.cancel();
    animation = null;
    overlay.hidden = true;
  }

  function rendered(action = () => {}) {
    return new Promise(resolve => {
      let remove, timer;
      const finish = value => {
        remove?.();
        clearTimeout(timer);
        if (pending === finish) pending = null;
        resolve(value);
      };
      pending = finish;
      remove = scene.postRender.addEventListener(() => {
        try { action(); finish(true); } catch { finish(false); }
      });
      timer = setTimeout(() => finish(false), renderTimeoutMs);
      scene.requestRender();
    });
  }

  async function capture() {
    clear();
    if (reducedMotion()) return false;
    const token = generation;
    const captured = await rendered(() => {
      const source = scene.canvas;
      if (overlay.width !== source.width) overlay.width = source.width;
      if (overlay.height !== source.height) overlay.height = source.height;
      const context = overlay.getContext('2d');
      if (!context) throw new Error('Snapshot canvas unavailable');
      // Capture inside postRender while the WebGL drawing buffer is intact.
      context.drawImage(source, 0, 0);
    });
    if (!captured || token !== generation) return false;
    overlay.hidden = false;
    return true;
  }

  async function play(duration = 180) {
    if (overlay.hidden) return;
    const token = generation;
    // Let the new imagery and point collections finish their first GPU update.
    const ready = await rendered() && await rendered();
    if (!ready || token !== generation || reducedMotion()) {
      if (token === generation) clear();
      return;
    }
    try {
      animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration, easing: 'ease-in-out'
      });
      await animation.finished;
    } catch {
      // Cancellation or an unsupported animation API leaves the real frame visible.
    } finally {
      if (token === generation) clear();
    }
  }
  return { capture, play, clear };
}
