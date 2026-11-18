"use strict";
const $ = id => document.getElementById(id);
const PALETTE = EHALI_PALETTE;
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => "eh-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
let rules = [];
let fallback = {...EHALI_DEFAULT_FALLBACK};
let enabled = true;
let openId = null;
let saveTimer = null;
let toastTimer = null;

function node(tag, attrs={}, ...children) {
  const el = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "checked") el.checked = !!value;
    else if (key === "value") el.value = value;
    else if (key === "on") el.addEventListener(value.event, value.handler);
    else if (value !== false && value != null) el.setAttribute(key, value === true ? "" : String(value));
  }
  children.flat().filter(x => x !== null && x !== undefined).forEach(child => el.append(child instanceof Node ? child : document.createTextNode(String(child))));
  return el;
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.hidden = true, 2600);
}
function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  chrome.storage.local.set({enabled, rules, fallback}, () => {
    if (chrome.runtime.lastError) {
      $("saved").textContent = "Couldn't save settings";
      showToast("Settings could not be saved. Try again.");
      return;
    }
    $("saved").textContent = "All changes saved locally";
  });
}
function save() {
  clearTimeout(saveTimer);
  $("saved").textContent = "Saving…";
  saveTimer = setTimeout(flushSave, 90);
}
window.addEventListener("pagehide", () => {
  if (saveTimer !== null) flushSave();
});
function makeSwitch(checked, label, callback) {
  const button = node("button", {class:"switch",type:"button",role:"switch","aria-label":label,"aria-checked":String(checked)}, node("span"));
  button.addEventListener("click", () => {
    const next = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked",String(next));
    callback(next);
  });
  return button;
}
function makePill(name,color) {
  const pill = node("span",{class:"pill"},name || "Untitled");
  pill.style.setProperty("--c",color || "#4F46E5");
  return pill;
}
function renderMaster() {
  $("master").setAttribute("aria-checked",String(enabled));
  $("masterLabel").textContent = enabled ? "Enabled" : "Paused";
  $("app").classList.toggle("off",!enabled);
}
$("master").addEventListener("click",() => { enabled=!enabled; renderMaster(); save(); });

function preview() {
  const value = $("try").value.trim();
  const out = $("tryOut");
  out.replaceChildren();
  if (!value) { out.textContent="Type a subject to preview matching labels."; return; }
  const hits = ehaliMatch({subject:value,sender:"",snippet:""},rules,fallback);
  if (!hits.length) { out.textContent="No matching label. This email would remain unmarked."; return; }
  hits.forEach(hit => out.append(makePill(hit.name,hit.color)));
  const explanation = node("span",{class:"preview-reason"},hits[0].id==="fallback" ? "No rule matched" : "Matched: " + hits.map(hit=>hit.reason).filter(Boolean).join("; "));
  out.append(explanation);
}
$("try").addEventListener("input",preview);

function chipEditor(rule,property,placeholder) {
  const box = node("div",{class:"chipbox"});
  const input = node("input",{class:"chip-input",type:"text",placeholder,"aria-label":placeholder});
  function draw() {
    box.querySelectorAll(".chip").forEach(chip=>chip.remove());
    rule[property].forEach((value,index) => {
      const remove = node("button",{type:"button","aria-label":"Remove "+value}, "×");
      remove.addEventListener("click",() => { rule[property].splice(index,1); draw(); save(); preview(); });
      box.insertBefore(node("span",{class:"chip"},value,remove),input);
    });
  }
  function commit() {
    const values=input.value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
    if (!values.length) return;
    values.forEach(value=>{
      if (!rule[property].some(old=>old.toLowerCase()===value.toLowerCase())) rule[property].push(value);
    });
    input.value="";
    draw(); save(); preview();
  }
  input.addEventListener("keydown",event=>{
    if(event.key==="Enter"||event.key===","){event.preventDefault();commit();}
    if(event.key==="Backspace"&&!input.value&&rule[property].length){rule[property].pop();draw();save();preview();}
  });
  input.addEventListener("blur",commit);
  input.addEventListener("paste",()=>setTimeout(commit,0));
  box.addEventListener("click",()=>input.focus());
  box.append(input); draw();
  return box;
}
function fieldSelect(rule) {
  const wrap=node("div",{class:"field-options"});
  [["sender","Sender"],["subject","Subject"],["snippet","Preview"]].forEach(([key,label])=>{
    const check=node("input",{type:"checkbox",checked:rule.fields.includes(key)});
    check.addEventListener("change",()=>{
      if(check.checked){if(!rule.fields.includes(key))rule.fields.push(key);}
      else rule.fields=rule.fields.filter(v=>v!==key);
      if(!rule.fields.length){check.checked=true;rule.fields=[key];showToast("At least one email field must be selected.");}
      save();preview();
    });
    wrap.append(node("label",{},check,label));
  });
  return wrap;
}
function selectControl(value,options,onChange) {
  const select=node("select",{class:"field"});
  options.forEach(([v,label])=>select.append(node("option",{value:v,selected:v===value},label)));
  select.addEventListener("change",()=>{onChange(select.value);save();preview();});
  return select;
}
function renderRules() {
  const list=$("rules");
  list.replaceChildren();
  $("empty").hidden=rules.length>0;
  $("ruleCount").textContent=rules.length;
  rules.forEach((rule,index)=>{
    rule=ehaliNormalizeRule(rule,index);
    const original=rules[index];
    Object.assign(original,rule);
    const row=node("li",{class:"rule-row"+(rule.enabled?"":" disabled")});
    const toggle=makeSwitch(rule.enabled,rule.name+" rule",value=>{rule.enabled=value;original.enabled=value;row.classList.toggle("disabled",!value);save();preview();});
    const expand=node("button",{class:"expand",type:"button","aria-expanded":String(openId===rule.id)},
      makePill(rule.name,rule.color),
      node("span",{class:"rule-name"},rule.name),
      node("span",{class:"rule-meta"},`${rule.keywords.length} keywords · ${rule.senders.length} senders`));
    expand.addEventListener("click",()=>{openId=openId===rule.id?null:rule.id;renderRules();});
    const actions=node("div",{class:"rule-actions"});
    const up=node("button",{class:"icon-button",type:"button","aria-label":"Move "+rule.name+" up",title:"Move up"},"↑");
    const down=node("button",{class:"icon-button",type:"button","aria-label":"Move "+rule.name+" down",title:"Move down"},"↓");
    up.disabled=index===0; down.disabled=index===rules.length-1;
    up.addEventListener("click",()=>moveRule(index,-1));
    down.addEventListener("click",()=>moveRule(index,1));
    actions.append(up,down);
    row.append(node("div",{class:"rule-head"},expand,actions,toggle));

    const editor=node("div",{class:"editor"});
    editor.hidden=openId!==rule.id;
    const name=node("input",{class:"field",type:"text",maxlength:"32",value:rule.name,"aria-label":"Label name"});
    name.addEventListener("input",()=>{rule.name=name.value;original.name=name.value;expand.querySelector(".rule-name").textContent=name.value||"Untitled";expand.querySelector(".pill").textContent=name.value||"Untitled";toggle.setAttribute("aria-label",(name.value||"Label")+" rule");save();preview();});
    const color=node("input",{class:"color-field",type:"color",value:rule.color,"aria-label":"Label color"});
    color.addEventListener("input",()=>{rule.color=color.value;original.color=color.value;expand.querySelector(".pill").style.setProperty("--c",color.value);save();preview();});
    const keywords=chipEditor(rule,"keywords","Add keywords; press Enter");
    const senders=chipEditor(rule,"senders","e.g. recruiter@company.com or @company.com");
    const exclusions=chipEditor(rule,"excludeKeywords","Words that should prevent a match");
    const mode=selectControl(rule.matchMode,[["any","Match any condition"],["all","Match every condition"]],v=>rule.matchMode=v);
    const type=selectControl(rule.matchType,[["phrase","Phrase / contains"],["whole","Whole word"]],v=>rule.matchType=v);
    const del=node("button",{class:"delete",type:"button"},"Delete label");
    del.addEventListener("click",()=>{if(!confirm(`Delete the "${rule.name}" label?`))return;rules.splice(index,1);openId=null;renderAll();save();});
    editor.append(
      node("div",{},node("label",{class:"field-label"},"Label name"),name),
      node("div",{class:"editor-grid"},node("div",{},node("label",{class:"field-label"},"Color"),color),node("div",{},node("label",{class:"field-label"},"Matching logic"),mode)),
      node("div",{},node("label",{class:"field-label"},"Match in"),fieldSelect(rule)),
      node("div",{},node("label",{class:"field-label"},"Keywords"),keywords,node("p",{class:"help"},"Separate multiple entries with commas or press Enter after each one.")),
      node("div",{},node("label",{class:"field-label"},"Sender addresses or domains"),senders,node("p",{class:"help"},"Examples: person@example.com or @example.com. Sender matches are case-insensitive.")),
      node("div",{},node("label",{class:"field-label"},"Exclude when any of these appear"),exclusions),
      node("div",{},node("label",{class:"field-label"},"Keyword matching"),type),
      node("div",{class:"editor-bottom"},del,node("span",{class:"help"},"Earlier labels have higher priority."))
    );
    row.append(editor);
    list.append(row);
  });
}
function moveRule(index,delta) {
  const next=index+delta;
  if(next<0||next>=rules.length)return;
  [rules[index],rules[next]]=[rules[next],rules[index]];
  renderRules();save();preview();
}
$("add").addEventListener("click",()=>{
  const rule={id:uid(),name:"New label",color:PALETTE[rules.length%PALETTE.length],enabled:true,keywords:[],senders:[],excludeKeywords:[],fields:["sender","subject","snippet"],matchMode:"any",matchType:"phrase"};
  rules.unshift(rule);openId=rule.id;renderRules();save();
  const input=$("rules").querySelector(".rule-row .editor input[type=text]");
  input?.focus();input?.select();
});

function renderFallback() {
  $("fallbackSwitch").setAttribute("aria-checked",String(!!fallback.enabled));
  $("fallbackEditor").hidden=!fallback.enabled;
  $("fallbackName").value=fallback.name||"Other";
  $("fallbackColor").value=fallback.color||"#6B7280";
}
$("fallbackSwitch").addEventListener("click",()=>{
  fallback.enabled=!fallback.enabled;renderFallback();save();preview();
});
$("fallbackName").addEventListener("input",()=>{fallback.name=$("fallbackName").value;save();preview();});
$("fallbackColor").addEventListener("input",()=>{fallback.color=$("fallbackColor").value;save();preview();});

function renderAll(){renderMaster();renderRules();renderFallback();preview();}
$("reset").addEventListener("click",()=>{
  if(!confirm("Reset eHali to its starter labels and settings? Your current custom rules will be replaced."))return;
  rules=clone(EHALI_DEFAULT_RULES);fallback={...EHALI_DEFAULT_FALLBACK};enabled=true;openId=null;
  renderAll();save();showToast("Starter settings restored.");
});
$("export").addEventListener("click",()=>{
  const payload={app:"eHali",version:EHALI_VERSION,exportedAt:new Date().toISOString(),enabled,rules,fallback};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=node("a",{href:url,download:"ehali-settings.json"});
  document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  showToast("Settings exported.");
});
$("import").addEventListener("click",()=>$("importFile").click());
$("importFile").addEventListener("change",async()=>{
  const file=$("importFile").files?.[0];if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error("File is larger than 1 MB.");
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.rules))throw new Error("This file does not contain an eHali rules list.");
    rules=data.rules.slice(0,100).map(ehaliNormalizeRule);
    fallback=data.fallback&&typeof data.fallback==="object"
      ? {enabled:data.fallback.enabled===true,name:String(data.fallback.name||"Other").slice(0,32),color:/^#[0-9a-f]{6}$/i.test(data.fallback.color||"")?data.fallback.color:"#6B7280"}
      : {...EHALI_DEFAULT_FALLBACK};
    enabled=data.enabled!==false;openId=null;renderAll();save();showToast("Settings imported.");
  }catch(error){showToast("Import failed: "+error.message);}
  $("importFile").value="";
});

chrome.storage.local.get({enabled:true,rules:null,fallback:null},stored=>{
  if(chrome.runtime.lastError){showToast("Couldn't load saved settings.");return;}
  enabled=stored.enabled!==false;
  rules=Array.isArray(stored.rules)?stored.rules.map(ehaliNormalizeRule):clone(EHALI_DEFAULT_RULES);
  fallback=stored.fallback&&typeof stored.fallback==="object"
    ? {enabled:stored.fallback.enabled===true,name:String(stored.fallback.name||"Other"),color:/^#[0-9a-f]{6}$/i.test(stored.fallback.color||"")?stored.fallback.color:"#6B7280"}
    : {...EHALI_DEFAULT_FALLBACK};
  renderAll();
});
