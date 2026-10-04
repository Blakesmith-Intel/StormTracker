export const DOPPLER_REQUEST_TIMEOUT_MS = 20000;

// Bound the complete request, including response body/image decoding. Decoded
// timestamped frames are cached by the caller after successful validation.
export async function withFreshDopplerResponse(url, consume, {
  timeoutMs = DOPPLER_REQUEST_TIMEOUT_MS,
  fetchImpl = globalThis.fetch
} = {}) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Doppler request timed out after ${timeoutMs / 1000} seconds.`));
      controller.abort();
    }, timeoutMs);
  });
  const request = Promise.resolve().then(async () => {
    const response = await fetchImpl(url, { cache: 'no-store', signal: controller.signal });
    return consume(response);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
