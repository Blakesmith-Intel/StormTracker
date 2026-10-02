import { RADARS, SEGMENTATION_DEFAULTS, TRACKING_DEFAULTS } from "../config.js";
import { segmentCategoryFrame, valuesForLabel } from "../segmentation.js";
import { cellsToRadarObservations, deduplicateRadarCells, updateTracks, trackToDict, activeTracks } from "../tracking.js";
import { buildTrackLikelihood } from "../lightning.js";

let tracks = [];
let nextTrackNumber = 1;

function cleanSegmentation(seg) {
  const { labels, ...rest } = seg;
  return rest;
}

function bestDopplerForTrack(trackDict, frameContexts) {
  const latest = trackDict.latest;
  if (!latest?.source_cells?.length) return [];
  let best = [];
  for (const [radarId, localCellId] of latest.source_cells) {
    const context = frameContexts.get(String(radarId));
    if (!context?.doppler || context.doppler.length !== context.segmentation.labels.length) continue;
    const values = valuesForLabel(context.doppler, context.segmentation.labels, Number(localCellId), -32768);
    if (values.length > best.length) best = values;
  }
  return best;
}

async function processFrameBucket(payload) {
  const frames = payload.frames ?? [];
  const frameContexts = new Map();
  const radarObservations = [];
  const segmentations = [];

  for (const frame of frames) {
    const radar = RADARS[String(frame.radarId)];
    if (!radar) throw new Error(`Unknown radar ${frame.radarId}`);
    const categories = frame.categories instanceof Uint8Array ? frame.categories : new Uint8Array(frame.categories);
    const segmentation = segmentCategoryFrame({
      categories,
      width: frame.width,
      height: frame.height,
      radar,
      thresholdCategory: frame.thresholdCategory ?? SEGMENTATION_DEFAULTS.thresholdCategory,
      minPixels: frame.minPixels ?? SEGMENTATION_DEFAULTS.minPixels,
      connectivity: frame.connectivity ?? SEGMENTATION_DEFAULTS.connectivity
    });
    const doppler = frame.doppler
      ? (frame.doppler instanceof Int16Array ? frame.doppler : new Int16Array(frame.doppler))
      : null;
    frameContexts.set(String(frame.radarId), { segmentation, doppler });
    segmentations.push(cleanSegmentation(segmentation));
    radarObservations.push(...cellsToRadarObservations(frame.radarId, frame.observedUtc, segmentation.cells));
  }

  const globalObservations = deduplicateRadarCells(
    radarObservations,
    payload.crossRadarTimeToleranceSeconds ?? TRACKING_DEFAULTS.crossRadarTimeToleranceSeconds
  );

  nextTrackNumber = updateTracks(
    tracks,
    globalObservations,
    nextTrackNumber,
    payload.maximumSpeedKmh ?? TRACKING_DEFAULTS.maximumSpeedKmh,
    payload.maximumGapMinutes ?? TRACKING_DEFAULTS.maximumGapMinutes
  );

  const referenceTime = payload.referenceTime
    ? new Date(payload.referenceTime)
    : new Date(Math.max(...frames.map(f => Date.parse(f.observedUtc))));

  const trackDicts = tracks.map(trackToDict);
  const likelihoods = trackDicts.map(track => buildTrackLikelihood(track, {
    dopplerValues: bestDopplerForTrack(track, frameContexts),
    referenceTime
  }));

  const active = activeTracks(tracks, referenceTime.toISOString(), payload.maximumGapMinutes ?? TRACKING_DEFAULTS.activeMinutes)
    .map(t => t.track_id);

  return {
    format: "StormTrackerBrowserFrameBucketV1",
    observed_utc: referenceTime.toISOString(),
    segmentations,
    global_observations: globalObservations,
    tracks: trackDicts,
    active_track_ids: active,
    likelihoods,
    scientific_status: "Persistent algorithmic STxxxx identities derived from public 2-D radar footprints. These are not measured volumetric storm objects."
  };
}

self.onmessage = async event => {
  const { id, type, payload } = event.data ?? {};
  try {
    if (type === "reset") {
      tracks = [];
      nextTrackNumber = 1;
      self.postMessage({ id, ok: true, result: { reset: true } });
      return;
    }
    if (type === "processFrameBucket") {
      const result = await processFrameBucket(payload ?? {});
      self.postMessage({ id, ok: true, result });
      return;
    }
    if (type === "state") {
      self.postMessage({ id, ok: true, result: { tracks: tracks.map(trackToDict), nextTrackNumber } });
      return;
    }
    throw new Error(`Unknown worker message type: ${type}`);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.stack || error?.message || String(error) });
  }
};
