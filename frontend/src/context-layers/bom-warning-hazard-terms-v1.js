// Bureau severe thunderstorm terminology: official 2026 warnings guide,
// spatial AMOC phenomena codes W/W+, LH/LH+, R/R+, TO.
// This classifies ONLY published bulletin/source text, never radar dBZ,
// model estimates, or individual cells inferred from a regional warning.
const RULES=Object.freeze([
 {code:"W+",label:"Destructive winds",phrase:/\bdestructive\s+(?:wind(?:s|\s+gusts)?|gusts?)\b/i},
 {code:"LH+",label:"Giant hail",phrase:/\bgiant\s+hail(?:stones)?\b/i},
 {code:"R+",label:"Intense rainfall",phrase:/\bintense\s+(?:rain(?:fall)?|showers)\b/i},
 {code:"TO",label:"Tornado",phrase:/\btornado(?:es)?\b/i},
 {code:"W",label:"Damaging winds",phrase:/\bdamaging\s+(?:wind(?:s|\s+gusts)?|gusts?)\b/i},
 {code:"LH",label:"Large hail",phrase:/\blarge\s+hail(?:stones)?\b/i},
 {code:"R",label:"Heavy rainfall",phrase:/\bheavy\s+(?:rain(?:fall)?|showers)\b/i}
]);
const HIGH_END=new Set(["W+","LH+","R+","TO"]);
const LEVELS=new Set(RULES.map(x=>x.code));
export function classifyPublishedBoMThunderstormHazards({headline="",description="",phenomena=""}={}){
 // Observed rainfall reports are NOT the forecast warning category.
 // 30 Oct 19:38 IDQ21033 warned of HEAVY rainfall, then separately said
 // "Heavy to locally intense rainfall has been reported" at stations.
 // Do not escalate the entire issued polygon from observations.
 const forecastLines=String(description??"").split(/\r?\n/)
   .filter(line=>!/(?:\b(?:has|have|had|was|were)\s+(?:been\s+)?(?:reported|recorded|observed)\b|\b\d+(?:\.\d+)?\s*mm\b)/i.test(line));
 const text=String(headline??"")+" "+forecastLines.join(" ");
 const tokens=new Set(String(phenomena??"").toUpperCase().split(/[\s,;|/]+/).filter(x=>LEVELS.has(x)));
 const flags=RULES.filter(rule=>tokens.has(rule.code)||rule.phrase.test(text)||
   rule.phrase.test(String(phenomena??"")));
 const codes=flags.map(x=>x.code);
 const highEnd=flags.filter(x=>HIGH_END.has(x.code)).map(x=>x.label);
 // Never turn source wording into a claim that a specific cell is dangerous:
 // regional IDQ21033 has area-wide warning text but NO cell locations.
 return {codes,highEnd,hazards:flags.map(x=>x.label),level:highEnd.length?"high-end":
   flags.length?"severe":"unspecified"};
}
