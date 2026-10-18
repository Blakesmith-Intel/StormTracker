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
  show(false);
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
