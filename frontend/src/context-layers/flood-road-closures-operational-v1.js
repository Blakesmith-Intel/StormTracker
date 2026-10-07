import {
  createFloodRoadClosureLayer
} from "./flood-road-closures-v1.js";

const $ = id =>
  document.getElementById(id);

function setRoadStatus({
  kind = "normal",
  message = ""
} = {}) {
  const target =
    $("floodRoadClosureStatus");

  if (!target) return;

  target.textContent =
    message
    || "QLDTraffic · flood closures only";

  target.dataset.kind =
    kind;
}

export function initialiseOperationalFloodRoadClosures({
  viewer,
  CesiumRef = globalThis.Cesium
} = {}) {
  const checkbox =
    $("showFloodRoadClosures");

  const layer =
    createFloodRoadClosureLayer({
      viewer,
      CesiumRef,
      visible:
        Boolean(
          checkbox?.checked
        ),
      onStatus:
        setRoadStatus
    });

  checkbox?.addEventListener(
    "change",
    event => {
      layer.setVisible(
        event.target.checked
      );

      if (!event.target.checked) {
        setRoadStatus({
          kind: "normal",
          message:
            "QLDTraffic flood closures hidden"
        });
      }
    }
  );

  $("refreshFloodRoadClosuresButton")
    ?.addEventListener(
      "click",
      () => {
        layer.refresh({
          force: true
        }).catch(
          () => {}
        );
      }
    );

  layer.start();

  return layer;
}
