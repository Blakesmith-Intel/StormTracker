// Compact sidebar entry and full-viewport, accessible on-demand diagnostics.
// Never put unbounded JSON inside the narrow scrolling controls sidebar.
export function createResponsiveMemoryDiagnostics({
  documentRef,sidebar,capture,clipboard
}) {
  if(!documentRef?.createElement || !sidebar?.appendChild ||
     typeof capture!=="function")
    throw new TypeError("Memory diagnostics requires a document, sidebar and capture callback");

  const panel=documentRef.createElement("details");
  panel.id="memoryQaPanel";
  panel.style.cssText="box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;font:12px sans-serif;margin:10px 6px;padding:8px;border:1px solid #57717b;border-radius:6px;color:inherit";
  const heading=documentRef.createElement("summary");
  heading.textContent="Memory diagnostics";
  const open=documentRef.createElement("button");
  open.type="button";
  open.textContent="Capture memory snapshot";
  open.style.cssText="box-sizing:border-box;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:8px 0;padding:8px;cursor:pointer";
  const hint=documentRef.createElement("p");
  hint.textContent="Opens a scrollable snapshot over the map; no background monitoring.";
  hint.style.cssText="margin:3px 0;font-size:11px;line-height:1.4;overflow-wrap:anywhere";
  panel.append(heading,open,hint);
  sidebar.appendChild(panel);

  // A native modal is in the browser top layer, NOT clipped by Cesium,
  // its iframe content, the sidebar or a narrow docked desktop window.
  const dialog=documentRef.createElement("dialog");
  dialog.id="stormtrackerMemoryDialog";
  dialog.setAttribute("aria-label","StormTracker full memory diagnostics");
  dialog.style.cssText=[
    "box-sizing:border-box",
    "width:min(780px,calc(100vw - 20px))",
    "max-width:calc(100vw - 20px)",
    "max-height:calc(100vh - 20px)",
    "max-height:calc(100dvh - 20px)",
    "margin:auto",
    "padding:12px",
    "overflow:auto",
    "border:1px solid #7d99aa",
    "border-radius:10px",
    "background:#101d25",
    "color:#e7f5ff",
    "font:12px/1.45 system-ui,sans-serif"
  ].join(";");
  const backdropStyle=documentRef.createElement("style");
  backdropStyle.textContent="#stormtrackerMemoryDialog::backdrop{background:rgba(0,0,0,.72)}";
  documentRef.head?.appendChild(backdropStyle);

  const toolbar=documentRef.createElement("div");
  toolbar.style.cssText="position:sticky;top:-12px;z-index:1;display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:8px 0;background:#101d25";
  const title=documentRef.createElement("strong");
  title.textContent="Memory & playback diagnostics";
  title.style.cssText="flex:1 1 190px;font-size:14px";
  const refresh=documentRef.createElement("button");
  refresh.type="button";refresh.textContent="Refresh";
  const copy=documentRef.createElement("button");
  copy.type="button";copy.textContent="Copy JSON";
  const close=documentRef.createElement("button");
  close.type="button";close.textContent="Close";
  for(const button of [refresh,copy,close])
    button.style.cssText="font:inherit;min-height:32px;max-width:100%;padding:5px 9px;cursor:pointer";
  toolbar.append(title,refresh,copy,close);

  const note=documentRef.createElement("p");
  note.style.cssText="margin:6px 0;overflow-wrap:anywhere";
  note.textContent="Browser GPU-process memory is shared and cannot be measured per tab.";
  const result=documentRef.createElement("pre");
  result.id="stormtrackerMemoryJson";
  result.style.cssText=[
    "box-sizing:border-box",
    "display:block",
    "width:100%",
    "max-width:100%",
    "max-height:60vh",
    "max-height:60dvh",
    "min-width:0",
    "overflow:auto",
    "white-space:pre-wrap",
    "overflow-wrap:anywhere",
    "word-break:break-word",
    "user-select:text",
    "padding:10px",
    "margin:8px 0 0",
    "font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace",
    "border:1px solid #415d6b",
    "border-radius:6px",
    "background:#0b161c",
    "color:inherit"
  ].join(";");
  dialog.append(toolbar,note,result);
  documentRef.body.appendChild(dialog);
  let json="";
  function snapshot(){
    try {
      json=JSON.stringify(capture(),null,2);
      result.textContent=json;
      note.textContent="Snapshot captured on demand. Scroll inside this window, or copy the complete JSON.";
    }catch(error){
      json="";
      result.textContent="Unable to capture diagnostic snapshot.";
      note.textContent=String(error?.message??error);
    }
    return json;
  }
  open.addEventListener("click",()=>{
    snapshot();
    if(typeof dialog.showModal==="function"){
      if(!dialog.open)dialog.showModal();
    }else{
      dialog.setAttribute("open","");
    }
  });
  refresh.addEventListener("click",snapshot);
  copy.addEventListener("click",()=>{
    if(!json)snapshot();
    if(typeof clipboard?.writeText!=="function"){
      note.textContent="Clipboard unavailable. Select the JSON below and copy it.";
      return;
    }
    Promise.resolve(clipboard.writeText(json)).then(()=>{
      note.textContent="Complete snapshot copied.";
    }).catch(()=>{
      note.textContent="Clipboard blocked. Select the JSON below and copy it.";
    });
  });
  close.addEventListener("click",()=>{
    if(typeof dialog.close==="function")dialog.close();
    else dialog.removeAttribute("open");
    open.focus?.();
  });
  return {panel,dialog,open,snapshot,close:()=>close.click?.(),
    get latestJson(){return json;}};
}
