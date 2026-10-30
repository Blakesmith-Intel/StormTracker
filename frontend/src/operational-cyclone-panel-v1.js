// Operational cyclone panel: strip historical case/import QA from the
// real-time situational-awareness UI. The separate incremental-3d preview
// retains the unchanged reference tools and original GML QA tests.
export function createOperationalCyclonePanel({documentRef = document} = {}) {
  const $ = id => documentRef.getElementById(id);
  const button = $("openCycloneForecastQa");
  const panel = $("cycloneForecastQaPanel");
  if (!button || !panel) throw new Error("Missing operational cyclone controls");
  // Keep production free of archived map annotations; QA remains separate.
  const oldStamp = $("historicalCycloneMapStamp");
  oldStamp?.remove();
  // Remove *every* historical/archived subtree from production, not just
  // the two named buttons, and do not initialise the historical map layer.
  panel.replaceChildren();
  panel.setAttribute("aria-label", "Current BoM tropical cyclone forecasts");
  const header = documentRef.createElement("header");
  const heading = documentRef.createElement("div");
  const title = documentRef.createElement("strong");
  title.textContent = "Tropical cyclone forecasts";
  const subtitle = documentRef.createElement("small");
  subtitle.textContent = "Current issued BoM data only";
  heading.append(title, subtitle);
  const close = documentRef.createElement("button");
  close.type = "button";
  close.id = "cycloneOperationalClose";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close cyclone forecast panel");
  header.append(heading, close);
  panel.appendChild(header);
  button.setAttribute("aria-controls", panel.id);
  const show = enabled => {
    panel.hidden = !enabled;
    button.setAttribute("aria-expanded", String(enabled));
    if (enabled) close.focus?.();
  };
  // V10.2.36: cyclone controls behave like other Severe Weather layers:
  // original source switch/status visible; optional source details folded.
  // This does NOT enable a source feed or change its polling interval.
  show(true);
  button.hidden = true;
  button.setAttribute("aria-hidden", "true");
  button.tabIndex = -1;
  close.hidden = true;
  // The live-source initializer mounts its ORIGINAL bound controls
  // synchronously next. Move those very same nodes in one microtask.
  queueMicrotask(() => {
    const container = $("internalCycloneQa");
    if (!container || container.closest("#cycloneForecastQaPanel") !== panel ||
        container.querySelector("#cycloneSourceDetails")) return;
    const originalNodes = Array.from(container.children);
    const heading = originalNodes.find(node => node.tagName === "STRONG");
    const switchRow = originalNodes.find(node =>
      node.querySelector?.("#internalCycloneLiveToggle"));
    const status = $("internalCycloneQaStatus");
    const sourceRow = originalNodes.find(node =>
      node.querySelector?.("#internalCycloneRefresh"));
    const sourceSelect = originalNodes.find(node =>
      node.querySelector?.("#internalCycloneSelectedSystem"));
    const sourceLink = originalNodes.find(node =>
      node.tagName === "A" && node.href?.includes("bom.gov.au"));
    const sourceNote = originalNodes.find(node =>
      node.tagName === "P" && node !== status);
    if (![heading, switchRow, status, sourceRow, sourceSelect,
          sourceLink, sourceNote].every(Boolean)) {
      console.warn("Cyclone presentation could not be regrouped; original controls preserved");
      return;
    }
    heading.textContent = "Cyclones";
    heading.className = "cyclone-inline-heading";
    const details = documentRef.createElement("details");
    details.id = "cycloneSourceDetails";
    details.className = "secondary-menu-details cyclone-source-details";
    const summary = documentRef.createElement("summary");
    summary.textContent = "Source details & actions";
    details.append(summary, sourceRow, sourceSelect, sourceLink, sourceNote);
    // Same nodes keep original checked state, status, refresh,
    // source-selection and camera-focus listeners.
    container.replaceChildren(heading, switchRow, status, details);
  });
  const onToggle = () => show(panel.hidden);
  const onClose = () => show(false);
  button.addEventListener("click", onToggle);
  close.addEventListener("click", onClose);
  return {
    open: () => show(true),
    close: onClose,
    destroy() {
      button.removeEventListener?.("click", onToggle);
      close.removeEventListener?.("click", onClose);
      show(false);
    }
  };
}
