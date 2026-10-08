// Pure decision for observed reflectivity/Doppler shared-loop frame eligibility.
// Never manufacture velocities or mislabel a radar load as a Doppler failure.
const rejected = reason => ({
  status: "rejected",
  reason: reason instanceof Error ? reason : new Error(String(reason ?? "unavailable"))
});
export function sourceFrameLoadDecision({
  radarLoad,
  dopplerLoad,
  requiresDoppler,
  requiredRadarIds = []
}) {
  if (radarLoad?.status !== "fulfilled") {
    return {
      accepted: false,
      kind: "radar-unreadable",
      message: String(radarLoad?.reason?.message ?? "Radar image unavailable"),
      missingRadarIds: []
    };
  }
  // Critical: Doppler preparation must not gate radar-only playback.
  if (!requiresDoppler) {
    return {
      accepted: true,
      kind: "radar-only",
      message: dopplerLoad?.status === "rejected"
        ? "Doppler unavailable; keeping valid observed reflectivity" : "",
      state: dopplerLoad?.status === "fulfilled"
        ? dopplerLoad.value
        : {
            reflectivityUtc: radarLoad.value?.observedUtc ?? null,
            pairings: [],
            records: [],
            sourceFailures: 0
          },
      missingRadarIds: []
    };
  }
  if (dopplerLoad?.status !== "fulfilled") {
    return {
      accepted: false,
      kind: "doppler-unreadable",
      message: String(dopplerLoad?.reason?.message ?? "Doppler image unavailable"),
      missingRadarIds: [...requiredRadarIds]
    };
  }
  const missingRadarIds = requiredRadarIds.filter(id =>
    !(dopplerLoad.value?.pairings ?? []).some(p =>
      String(p.radarId) === String(id) && p.matched === true
    )
  );
  if (missingRadarIds.length) {
    const details = missingRadarIds.map(id => {
      const pair = (dopplerLoad.value?.pairings ?? [])
        .find(p => String(p.radarId) === String(id));
      return pair?.loadError ??
        (pair?.deltaMinutes != null
          ? "Doppler " + id + " timestamp Δ" + Number(pair.deltaMinutes).toFixed(1) + " min outside tolerance"
          : "Doppler " + id + " unavailable or not time-matched");
    });
    return {
      accepted: false,
      kind: "doppler-unmatched",
      message: details.join("; "),
      missingRadarIds
    };
  }
  return {
    accepted: true,
    kind: "matched",
    message: "",
    state: dopplerLoad.value,
    missingRadarIds: []
  };
}

export function summariseSkippedObservedFrames(diagnostics = [], sampleLimit = 8) {
  if (!diagnostics.length) return { summary: "", detail: "" };
  const counts = new Map();
  for (const item of diagnostics) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  const labels = {
    "radar-unreadable": "reflectivity unreadable",
    "doppler-unreadable": "Doppler load failed",
    "doppler-unmatched": "Doppler unmatched"
  };
  const summary = [...counts.entries()]
    .map(([kind, count]) => count + " " + (labels[kind] ?? kind))
    .join(", ");
  const detail = diagnostics.slice(0, sampleLimit)
    .map(item => item.observedUtc + " · " + (labels[item.kind] ?? item.kind) +
      (item.message ? " · " + item.message : ""))
    .join("\n");
  return {
    summary: diagnostics.length + " skipped (" + summary + ")",
    detail: detail + (diagnostics.length > sampleLimit
      ? "\n+" + (diagnostics.length - sampleLimit) + " additional skipped" : "")
  };
}
