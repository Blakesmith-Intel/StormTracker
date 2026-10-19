import assert from "node:assert/strict";
import {parseFtpRadarNames} from "../../relay/ftp-live-v1.js";
import {publishedFtpManifest} from "../src/ftp-reflectivity-operational-v1.js";

const now=Date.parse("2026-10-19T09:00:00Z");
const files=[
 "IDR083.T.202610190845.png",
 "IDR083.T.202610190850.png",
 "IDR503.T.202610190850.png",
 "IDR663.T.202610190850.png",
 "IDR083.T.202610190850.png",  // duplicate
 "IDR083.T.202610190700.png",  // stale
 "IDR083.T.202610191200.png",  // future
 "IDR9993.T.202610190850.png", // unapproved
 "../../IDR083.T.202610190850.png",
 "IDR083.T.202613990850.png" // invalid date
];
const data=parseFtpRadarNames(files.join("\r\n"),now);
assert.equal(data["08"].length,2);
assert.equal(data["50"].length,1);
assert.equal(data["66"].length,1);
assert.equal(data["999"],undefined);
assert(data["08"].every(x=>x.imageUrl.startsWith("https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/ftp-live-frame?file=")));
assert(!Object.values(data).flat().some(x=>x.filename.includes("0700")));
const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/ftp-live-manifest";
const manifest={schema:"StormTrackerBoMFtpReflectivityManifestV1",
 sourceKind:"ftp-live-direct-relay",generatedUtc:new Date(now).toISOString(),
 siteFrameHistory:data,siteGeoreference:{"08":{controlPoints:{one:1}}}};
const requests=[];
const fetched=await publishedFtpManifest({now,fetcher:async endpoint=>{
 requests.push(endpoint);
 return {ok:true,json:async()=>manifest};
}});
assert.equal(fetched.sourceKind,"ftp-live-direct-relay");
assert.deepEqual(requests,[url],"Never depend on GitHub Actions for a fresh direct FTP source");
console.log("DIRECT_LIVE_FTP_PARSER_AND_BROWSER_CONTRACT_PASS",Object.keys(data));
