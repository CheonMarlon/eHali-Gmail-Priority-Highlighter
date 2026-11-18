/* eHali defaults and shared matching engine. No network access is used. */
const EHALI_VERSION = "1.0.0";
const EHALI_PALETTE = ["#DC2626", "#EA580C", "#CA8A04", "#059669", "#0891B2", "#2563EB", "#7C3AED", "#DB2777", "#6B7280"];
const EHALI_DEFAULT_RULES = [
  { id:"urgent", name:"Urgent", color:"#DC2626", enabled:true, keywords:["urgent","asap","immediate action","due today","deadline","final reminder","last chance","expires today","time sensitive","overdue"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"interview", name:"Interview", color:"#2563EB", enabled:true, keywords:["interview","shortlisted","hiring manager","job offer","offer letter"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"assessment", name:"Assessment", color:"#CA8A04", enabled:true, keywords:["assessment","coding challenge","technical test","online test","take-home","hackerrank","codility","exam"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"action", name:"Action required", color:"#7C3AED", enabled:true, keywords:["action required","please submit","kindly submit","please complete","please respond","requires your response","reply by","rsvp","verify your","confirm your","please upload"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"security", name:"Security", color:"#DB2777", enabled:true, keywords:["security alert","new sign-in","password","verification code","one-time","otp","suspicious"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"money", name:"Money", color:"#059669", enabled:true, keywords:["invoice","payment","transfer","transaction","refund","instapay","gcash","bank","billing","receipt"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"application", name:"Application", color:"#0891B2", enabled:true, keywords:["your application","application was","thanks for applying","thank you for applying","applying to","application received"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"jobs", name:"Jobs", color:"#4F46E5", enabled:true, keywords:["job alert","hiring","intern","internship","vacancy","career"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" },
  { id:"learning", name:"Learning", color:"#EA580C", enabled:true, keywords:["course","lesson","tutorial","learn","webinar","workshop"], senders:[], excludeKeywords:[], fields:["subject","snippet"], matchMode:"any", matchType:"phrase" }
];
const EHALI_DEFAULT_FALLBACK = { enabled:false, name:"Other", color:"#6B7280" };

function ehaliNormalizeRule(rule, index=0) {
  const r = rule && typeof rule === "object" ? rule : {};
  return {
    id: String(r.id || ("rule-" + index)),
    name: String(r.name || "Untitled").slice(0,32),
    color: /^#[0-9a-f]{6}$/i.test(r.color || "") ? r.color : "#4F46E5",
    enabled: r.enabled !== false,
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String).filter(Boolean).slice(0,200) : [],
    senders: Array.isArray(r.senders) ? r.senders.map(String).filter(Boolean).slice(0,100) : [],
    excludeKeywords: Array.isArray(r.excludeKeywords) ? r.excludeKeywords.map(String).filter(Boolean).slice(0,100) : [],
    fields: Array.isArray(r.fields) && r.fields.length ? r.fields.filter(x => ["sender","subject","snippet"].includes(x)) : ["sender","subject","snippet"],
    matchMode: r.matchMode === "all" ? "all" : "any",
    matchType: ["whole","contains","phrase"].includes(r.matchType) ? r.matchType : "phrase"
  };
}
function ehaliContains(haystack, needle, type) {
  const h = String(haystack || "").toLocaleLowerCase();
  const n = String(needle || "").trim().toLocaleLowerCase();
  if (!n) return false;
  if (type === "whole") {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^\\p{L}\\p{N}_])" + escaped + "($|[^\\p{L}\\p{N}_])", "u").test(h);
  }
  return h.includes(n);
}
function ehaliMatch(email, rules, fallback) {
  const data = {
    sender: String(email?.sender || ""),
    subject: String(email?.subject || ""),
    snippet: String(email?.snippet || "")
  };
  const hits = [];
  for (const raw of (rules || [])) {
    const r = ehaliNormalizeRule(raw);
    if (!r.enabled) continue;
    const searchable = r.fields.map(field => data[field]).join(" \n ");
    if (r.excludeKeywords.some(k => ehaliContains(searchable, k, r.matchType))) continue;
    const keywordHits = r.keywords.filter(k => ehaliContains(searchable, k, r.matchType));
    const senderHits = r.fields.includes("sender")
      ? r.senders.filter(s => ehaliContains(data.sender, s, "contains"))
      : [];
    const tests = [
      ...r.keywords.map(k => keywordHits.includes(k)),
      ...r.senders.map(s => senderHits.includes(s))
    ];
    if (!tests.length) continue;
    const matched = r.matchMode === "all" ? tests.every(Boolean) : tests.some(Boolean);
    if (matched) {
      const reasons = [
        ...keywordHits.map(k => `keyword "${k}"`),
        ...senderHits.map(s => `sender "${s}"`)
      ];
      hits.push({ ...r, reason: reasons.join(", ") });
    }
    if (hits.length >= 2) break;
  }
  if (hits.length) return hits;
  return fallback?.enabled ? [{ ...fallback, id:"fallback", reason:"No rule matched" }] : [];
}
