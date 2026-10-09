import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createStormTrackLabelOverlay } from "../src/storm-track-label-overlay-v1.js";

const rootUrl = new URL("../../", import.meta.url);
const read = path => readFileSync(fileURLToPath(new URL(path, rootUrl)), "utf8");
const javascript = read("frontend/src/live3d-operational-v9.js");
const html = read("frontend/live3d-operational-v9.html");
const css = read("frontend/src/operational-dashboard-v9-1.css");
const iframe = read("frontend/index.html");

function element(name) {
  return {
    name,
    style: {},
    attributes: {},
    children: [],
    hidden: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    remove() { this.removed = true; }
  };
}

const documentRef = { createElement: element };
const container = element("map-panel");
container.clientWidth = 300;
container.clientHeight = 200;

let postRender = null;
let listenerRemoved = false;
let renders = 0;
const scene = {
  camera: { positionWC: {} },
  globe: { ellipsoid: {} },
  postRender: {
    addEventListener(fn) {
      postRender = fn;
      return () => { listenerRemoved = true; postRender = null; };
    }
  },
  requestRender() { renders++; }
};
const CesiumRef = {
  SceneTransforms: {
    worldToWindowCoordinates(_scene, point) {
      return { x: point.x, y: point.y };
    }
  },
  EllipsoidalOccluder: class {
    isPointVisible(point) { return point.aboveHorizon !== false; }
  }
};

const overlay = createStormTrackLabelOverlay({ scene, CesiumRef, container, documentRef });
const visual = container.children[0];
assert.equal(visual.hidden, true);
assert.equal(visual.className, "storm-track-overlay");
assert.equal(visual.attributes["aria-hidden"], "true");
assert.equal(typeof postRender, "function");

overlay.setMarkers([
  { position: { x: 150, y: 100 }, text: "ST-1 ≥50 dBZ", colour: "rgb(12, 20, 45)", size: 12 },
  { position: { x: 350, y: 100 }, text: "OFF", colour: "rgb(1, 2, 3)", size: 8 },
  { position: { x: 100, y: 100, aboveHorizon: false }, text: "HORIZON", colour: "rgb(1, 2, 3)", size: 8 }
]);
assert.equal(overlay.markerCount, 3);
assert.equal(visual.children.length, 3);
assert.equal(visual.hidden, false);
assert.equal(visual.children[0].hidden, false);
assert.equal(visual.children[1].hidden, true);
assert.equal(visual.children[2].hidden, true);
assert.equal(visual.children[0].children[0].textContent, "ST-1 ≥50 dBZ");
assert.equal(visual.children[0].style.left, "150px");
assert.equal(visual.children[0].style.top, "100px");
assert.equal(visual.children[0].style.width, "12px");

overlay.setVisible(false);
assert.equal(overlay.visible, false);
assert.equal(visual.hidden, true, "point and label must disappear together immediately");
overlay.setVisible(true);
assert.equal(visual.hidden, false, "point and label must immediately reappear on a paused frame");
assert.equal(visual.children[0].hidden, false);

// Position must follow the moving Cesium camera without polling or frame advances.
const repositioned = { x: 180, y: 122 };
overlay.setMarkers([{ position: repositioned, text: "ST-2", colour: "#fff", size: 8 }]);
assert.equal(visual.children.length, 1, "frame replacement may not retain stale markers");
assert.equal(visual.children[0].style.left, "180px");
repositioned.x = 200;
postRender();
assert.equal(visual.children[0].style.left, "200px");
overlay.setVisible(false);
overlay.setMarkers([{ position: { x: 90, y: 60 }, text: "NEXT", colour: "#fff", size: 12 }]);
assert.equal(visual.hidden, true, "new frames must honour an already-disabled Labels control");
overlay.setVisible(true);
assert.equal(visual.children[0].children[0].textContent, "NEXT");
overlay.setMarkers([]);
assert.equal(visual.hidden, true, "no tracks must mean no orphaned marker labels");
assert.ok(renders >= 7);
overlay.destroy();
overlay.destroy();
assert.equal(listenerRemoved, true);
assert.equal(visual.removed, true);

// Guard against labels going back under the 3-D volume or decoupling point from label.
assert.match(css, /\.storm-track-overlay\s*\{[^}]*z-index:550/s);
assert.match(css, /\.storm-track-marker-label/);
assert.match(css, /\.storm-track-overlay\s*\{[^}]*pointer-events:none/s);
assert.doesNotMatch(css,/\.frame-crossfade/);
assert.match(javascript, /stormTrackLabelOverlay\.setMarkers\(stormTrackMarkers\)/);
assert.match(javascript, /stormTrackLabelOverlay\.setVisible\(Boolean\(\$\("showTrackLabels"\)\?\.checked\)\)/);
assert.match(javascript, /stormTrackMarkers\.push\(\{/);
assert.doesNotMatch(javascript, /id: \`hybrid-\$\{index\}-\$\{track\.track_id\}\`/);
assert.match(html, /id="showTrackLabels" type="checkbox" checked/);
assert.match(html, /v=source-native-playback-review-v1/);
assert.match(iframe, /v=source-native-playback-review-v1/);
console.log("Foreground storm marker overlay tests passed: opacity-independent, paired dots and labels; paused toggle; camera updates; horizon; frame swap; cache bust.");
