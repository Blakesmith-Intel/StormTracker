// Compass uses StormTracker's authorised camera controller, not Cesium setView.
export function normaliseCompassHeading(degrees) {
 const n=Number(degrees);
 if(!Number.isFinite(n))return 0;
 return ((n%360)+360)%360;
}
export function northArrowRotationDegrees(headingRadians) {
 return -normaliseCompassHeading(Number(headingRadians)*180/Math.PI);
}
export function mountNorthCompass({
 cameraController,mapPanel,documentRef=globalThis.document,
 windowRef=globalThis.window,intervalMs=200
}={}) {
 if(!cameraController?.getState||!cameraController?.setView||
    !mapPanel||!documentRef)throw Error("Compass requires operational map camera and panel");
 documentRef.getElementById("stormTrackerNorthCompass")?.remove();
 const styleId="stormTrackerNorthCompassStyle";
 if(!documentRef.getElementById(styleId)){
  const style=documentRef.createElement("style");
  style.id=styleId;
  style.textContent=[
   "#stormTrackerNorthCompass { position:absolute; top:72px; right:12px; z-index:38; width:56px; height:68px; padding:5px 4px 4px; border:1px solid rgba(148,165,179,.65); border-radius:12px; background:rgba(17,31,44,.85); color:#fff; box-shadow:0 3px 16px rgba(0,0,0,.3); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; cursor:pointer; touch-action:manipulation; user-select:none; -webkit-user-select:none; }",
   "#stormTrackerNorthCompass:focus-visible { outline:3px solid #89d2ff; outline-offset:2px; }",
   "#stormTrackerNorthCompass .stormtracker-north-arrow { display:block; width:32px; height:43px; transform-origin:50% 50%; transition:transform 80ms linear; pointer-events:none; }",
   "#stormTrackerNorthCompass .stormtracker-compass-caption { font:600 10px/1.3 system-ui,sans-serif; letter-spacing:.4px; pointer-events:none; }",
   "@media(max-width:650px) { #stormTrackerNorthCompass { top:76px;right:8px;width:48px;height:60px;padding:3px; } #stormTrackerNorthCompass .stormtracker-north-arrow { width:28px;height:38px; } }",
   "@media(prefers-reduced-motion:reduce) { #stormTrackerNorthCompass .stormtracker-north-arrow { transition:none; } }"
  ].join("\n");
  documentRef.head.appendChild(style);
 }
 const button=documentRef.createElement("button");
 button.id="stormTrackerNorthCompass";
 button.type="button";
 button.setAttribute("aria-label","Compass: align map to true north");
 const arrow=documentRef.createElement("span");
 arrow.className="stormtracker-north-arrow";
 arrow.setAttribute("aria-hidden","true");
 arrow.innerHTML='<svg viewBox="0 0 32 44" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg"><text x="16" y="9" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="11" fill="#ff7a78">N</text><path d="M16 11L27 34L16 28L5 34Z" fill="#ff7976" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 28L16 11L5 34Z" fill="#c54447"/></svg>';
 const caption=documentRef.createElement("span");
 caption.className="stormtracker-compass-caption";
 caption.textContent="NORTH";
 button.append(arrow,caption);
 mapPanel.appendChild(button);
 let previous=null;
 function update() {
  const state=cameraController.getState();
  const degrees=Math.round(normaliseCompassHeading(state.heading*180/Math.PI));
  if(previous===degrees)return;
  previous=degrees;
  arrow.style.transform="rotate("+northArrowRotationDegrees(state.heading)+"deg)";
  button.title="Heading "+degrees+"° true · click to face north (preserves map centre and zoom)";
 }
 function faceNorth(event){
  event.preventDefault();
  event.stopPropagation();
  cameraController.setView({heading:0});
  update();
 }
 button.addEventListener("click",faceNorth);
 update();
 const ticker=windowRef?.setInterval?.(()=>{
  if(!documentRef.hidden)update();
 },intervalMs);
 const dispose=()=>{
  if(ticker!==undefined)windowRef?.clearInterval?.(ticker);
  button.removeEventListener("click",faceNorth);
  button.remove();
  windowRef?.removeEventListener?.("pagehide",dispose);
 };
 windowRef?.addEventListener?.("pagehide",dispose,{once:true});
 return {element:button,update,dispose};
}
