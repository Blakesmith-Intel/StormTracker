// Visual legend only: preserves original BoM swatches, Doppler RGB palettes,
// native weather products and all current renderer/scientific functions.
export function mountPersistentWeatherLegend({
  selector=document.getElementById("loopDurationMinutes"),
  dock=document.getElementById("legendDock")
}={}){
 if(!selector||!dock)throw Error("Weather legend mount missing");
 const sync=()=>{
  const wind=selector.value==="doppler-available";
  dock.dataset.mode=wind?"wind":"rain";
  dock.setAttribute("aria-label",wind
    ?"BoM radial velocity legend in km/h":"BoM reflectivity legend in dBZ");
 };
 const mutation=typeof MutationObserver==="function"?
  new MutationObserver(sync):null;
 // Radar history availability may repopulate the selection asynchronously.
 mutation?.observe(selector,{childList:true,subtree:true,attributes:true,attributeFilter:["value","selected"]});
 selector.addEventListener("change",sync);
 selector.addEventListener("input",sync);
 sync();
 return {sync,destroy(){
   mutation?.disconnect();
   selector.removeEventListener("change",sync);
   selector.removeEventListener("input",sync);
 }};
}
