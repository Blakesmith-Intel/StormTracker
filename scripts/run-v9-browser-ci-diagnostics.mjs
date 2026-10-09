// V9.16.15: CI-only OS/browser telemetry wrapper. Does not alter application code
// or replace BoM imagery; runs the existing browser acceptance test unchanged.
import {spawn, spawnSync} from "node:child_process";
import {mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync} from "node:fs";
import os from "node:os";

const engine=process.env.BROWSER_ENGINE==="webkit"?"webkit":"chromium";
const directory="qa-screenshots";
mkdirSync(directory,{recursive:true});
const started=Date.now();
const events=[];
const sampleFile=`${directory}/${engine}-host-timing.json`;
const summaryFile=process.env.GITHUB_STEP_SUMMARY;
const child=spawn(process.execPath,["scripts/smoke-v9-multi-radar-browser.mjs"],{
  stdio:"inherit",env:process.env
});
function sample(){
  const now=Date.now();
  const result=spawnSync("ps",["-eo","pid=,ppid=,comm=,pcpu=,rss=,args="],{
    encoding:"utf8",timeout:4500,maxBuffer:3*1024*1024
  });
  const lines=(result.stdout||"").split("\n").filter(line=>
    /chromium|chrome|webkit|swiftshader|playwright|smoke-v9|run-v9-browser|python3/i.test(line)
  );
  const sample={
    elapsedSec:Math.round((now-started)/1000),time:new Date(now).toISOString(),
    loadAvg1m:os.loadavg()[0],systemFreeMemMiB:Math.round(os.freemem()/1048576),
    processes:lines.slice(0,22).map(x=>x.trim())
  };
  events.push(sample);
  console.log("V9_BROWSER_HOST_DIAGNOSTIC",JSON.stringify({
    elapsedSec:sample.elapsedSec,loadAvg1m:sample.loadAvg1m,
    systemFreeMemMiB:sample.systemFreeMemMiB,processes:sample.processes.slice(0,12)
  }));
}
sample();
const timer=setInterval(sample,4000);
const stop=(signal)=>{if(child.exitCode===null)child.kill(signal)};
process.on("SIGINT",()=>stop("SIGINT"));
process.on("SIGTERM",()=>stop("SIGTERM"));
child.on("error",err=>{console.error("V9_BROWSER_CHILD_ERROR",err);});
child.on("exit",(code,signal)=>{
  clearInterval(timer);
  sample();
  const reportName=`${directory}/${engine}-browser-report.json`;
  let browserReport=null;
  if(existsSync(reportName)){
    try{browserReport=JSON.parse(readFileSync(reportName,"utf8"))}catch{}
  }
  const result={
    engine,startedAt:new Date(started).toISOString(),finishedAt:new Date().toISOString(),
    durationSec:Math.round((Date.now()-started)/1000),childExitCode:code,
    childSignal:signal,runnerGpu:"GitHub-hosted runner (no hardware GPU assertion)",
    liveBomFramesSubstituted:false,
    lastPassedBrowserChecks:(browserReport?.events||[]).map(e=>e.name),
    browserErrors:browserReport?.errors||[],
    samples:events
  };
  writeFileSync(sampleFile,JSON.stringify(result,null,2)+"\n");
  const lastEvents=result.lastPassedBrowserChecks.slice(-10).join(", ");
  console.log("V9_BROWSER_HOST_SUMMARY",JSON.stringify({
    engine,code,signal,durationSec:result.durationSec,lastEvents,
    samples:events.length
  }));
  if(summaryFile)appendFileSync(summaryFile,
    `### V9.16.15 ${engine} browser telemetry\n\n`+
    `- Browser acceptance: **${code===0?"PASS":"FAIL"}** (signal ${signal||"none"})\n`+
    `- Total runtime: **${result.durationSec}s**; collected **${events.length}** OS samples\n`+
    `- Last observed UI checks: ${lastEvents||"none"}\n`+
    `- Evidence: uploaded \`${engine}-host-timing.json\` and browser report\n`+
    `- GPU note: this is a hosted CI runner, **not hardware-accelerated desktop acceptance**.\n\n`);
  process.exitCode=(code===0?0:code||1);
});
