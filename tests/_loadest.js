/* Body-weight load factors: built-in defaults, editor presets/unset semantics,
   and the batched Groq AI estimation flow (mocked HTTP, same as _ai.js). */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
let fetchCalls = 0;
let lastReq = null;
let answers = {};       // exId -> loadPercent to fake (null = model can't judge)
let answerShape = "object"; // "object" -> {items:[...]}, "array" -> [...]

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    window.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.fetch = async (url, opts) => {
      fetchCalls++;
      lastReq = JSON.parse(opts.body);
      const user = JSON.parse(lastReq.messages[1].content);
      const items = (user.exercises || []).map(e => {
        const pct = (e.exId in answers) ? answers[e.exId] : null; // never guess for untested ids
        return { exId: e.exId, loadPercent: pct, confidence: "medium", reasoning: "Estimated from movement pattern of " + e.name + "." };
      });
      const content = answerShape === "array" ? items : { items };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) };
    };
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
const G = name => W.eval(name);
function $(s){ return W.document.querySelector(s); }
function $$(s){ return Array.from(W.document.querySelectorAll(s)); }

let pass=0, fail=0;
const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };
const click = el => el.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function until(fn, ms){
  const t0 = Date.now();
  while (Date.now() - t0 < (ms||2000)){ if (fn()) return true; await sleep(15); }
  return false;
}
const exById = id => E("state.exercises.find(e=>e.id==='" + id + "')");
const unknownIds = () => G("state.exercises").filter(e=>e.loadFactor==null).map(e=>e.id);
function addCustom(id, name, extra){
  E("state.exercises.push({ id:'" + id + "', name:'" + name + "', mode:'reps', type:'bodyweight', equipment:['bodyweight'], weightAvailable:false, defaultSets:3, defaultReps:8, defaultTime:30, defaultWeight:0, notes:'', instructions:'', bodyParts:[], primaryMuscles:[], secondaryMuscles:[], " + (extra||"") + " })");
}

(async () => {
  console.log("== Built-in defaults ==");
  const seedCount = G("state.exercises.length");
  check(seedCount === 27, "seed library has " + seedCount + " pre-built exercises");
  check(E("state.exercises.find(e=>e.id==='ex-1').loadFactor") === 67, "Push-Up default load 67%");
  check(E("state.exercises.find(e=>e.id==='ex-1').loadSource") === "builtin", "Push-Up source builtin");
  check(E("state.exercises.find(e=>e.id==='ex-6').loadFactor") === 100, "Pull-Up default load 100%");
  check(E("state.exercises.find(e=>e.id==='ex-26').loadFactor") === 0, "Dumbbell Curl default load 0%");
  check(G("state.exercises").every(e=>typeof e.loadFactor === "number"), "every pre-built exercise ships with a load factor");

  console.log("== Library banner states ==");
  W.switchView("library");
  check($("#lib-load-banner") && $("#lib-load-banner").textContent.trim() === "", "no banner while every exercise has a load factor");
  addCustom("ex-id-l1", "Feet-Elevated Push-Up", "notes:'heavier on the shoulders'");
  addCustom("ex-id-l2", "Ring Lean", "");
  W.switchView("library");
  check(($("#lib-load-banner") ? $("#lib-load-banner").textContent : "").indexOf("2 exercises without") !== -1, "banner counts 2 unknown-load exercises");
  check(Boolean($("#load-estimate")) && $("#load-estimate").disabled, "Estimate with AI disabled while no Groq key is set");
  check(Boolean($("#lib-load-banner [data-goto='settings']")), "no-key banner offers the Settings shortcut");

  console.log("== Editor: manual set / unset / untouched semantics ==");
  E("state.profile.apiKey = 'gsk_test123'");
  W.switchView("library");
  check(!$("#load-estimate").disabled, "Estimate with AI enabled once a key is set");
  E("openExEditor('ex-id-l1')");
  check(Boolean($("#ex-editor-host .lf-chip")), "editor shows load-factor preset chips");
  check($$("#ex-editor-host .lf-chip.on").length === 0, "no preset highlighted for an unset exercise");
  click($("#ex-editor-host .lf-chip[data-lf='75']"));
  check($("#ex-load-val").textContent === "75% of body weight", "chip click shows 75% of body weight");
  check($("#ex-editor-host .lf-chip[data-lf='75']").classList.contains("on"), "75% chip highlighted");
  click($("#ex-save"));
  let l1 = exById("ex-id-l1");
  check(l1 && l1.loadFactor === 75 && l1.loadSource === "manual", "saving a chip sets factor 75 with source manual");
  E("openExEditor('ex-id-l2')");
  click($("#ex-save")); // untouched
  let l2 = exById("ex-id-l2");
  check(l2 && l2.loadFactor == null && !l2.loadSource, "untouched save never silently assigns a load factor");
  E("openExEditor('ex-1')"); // built-in with a default
  check($("#ex-editor-host .lf-chip[data-lf='67']").classList.contains("on"), "built-in Push-Up opens with its 67% preset highlighted");
  click($("#ex-load-clear"));
  check($("#ex-load-val").textContent === "not set", "Unset action clears the value");
  click($("#ex-save"));
  let pushUp = exById("ex-1");
  check(pushUp.loadFactor == null && !pushUp.loadSource, "clearing a built-in load is respected on save");
  const unset1 = unknownIds();
  check(unset1.length === 2 && unset1.indexOf("ex-1") !== -1 && unset1.indexOf("ex-id-l2") !== -1, "unknown set is exactly the cleared built-in + untouched custom (got: " + unset1.join(",") + ")");

  console.log("== AI estimator: review, adjust, save ==");
  addCustom("ex-id-a1", "Claw Push-Up", "notes:'elevated feet, slow tempo'");
  addCustom("ex-id-a2", "Ring Pike Push-Up", "");
  answers = { "ex-1": null, "ex-id-l2": null, "ex-id-a1": 68, "ex-id-a2": 55 };
  W.switchView("library");
  const beforeCalls = fetchCalls;
  click($("#load-estimate"));
  await until(() => $$("#load-est-host .load-est-row").length === 4);
  check(fetchCalls === beforeCalls + 1, "one batched request for all unknown exercises");
  check(lastReq && lastReq.messages && lastReq.messages.length === 2, "estimate request has system+user messages");
  check(lastReq && lastReq.response_format && lastReq.response_format.type === "json_object", "estimate request asks for JSON");
  const sent = lastReq && JSON.parse(lastReq.messages[1].content);
  check(sent && Array.isArray(sent.exercises) && sent.exercises.length === 4, "payload carries all 4 unset exercises");
  check(sent && sent.exercises.some(e=>e.exId==="ex-id-a1" && e.notes==="elevated feet, slow tempo"), "payload includes each exercise's notes for context");
  const rowA1 = $(".load-est-row input[data-ex-id='ex-id-a1']");
  const rowA2 = $(".load-est-row input[data-ex-id='ex-id-a2']");
  const rowEx1 = $(".load-est-row input[data-ex-id='ex-1']");
  check(rowA1 && rowA1.value === "68", "AI suggestion 68% prefilled for Claw Push-Up");
  check(rowA2 && rowA2.value === "55", "AI suggestion 55% prefilled for Ring Pike Push-Up");
  check(rowEx1 && rowEx1.value === "", "rows the model can't judge open empty");
  check(Boolean($("#load-est-host .load-est-reason")), "model reasoning shown under each exercise");
  rowA1.value = "70";
  rowA1.dispatchEvent(new W.Event("change",{bubbles:true}));
  click($("#load-est-save"));
  await until(() => !$("#load-est-host"));
  let a1 = exById("ex-id-a1"), a2 = exById("ex-id-a2");
  check(a1.loadFactor === 70 && a1.loadSource === "manual", "user-adjusted suggestion saves as 70% with source manual");
  check(a2.loadFactor === 55 && a2.loadSource === "ai", "accepted suggestion saves as 55% with source ai");
  const unset2 = unknownIds();
  check(unset2.length === 2 && unset2.indexOf("ex-1") !== -1 && unset2.indexOf("ex-id-l2") !== -1, "cleared/untouched exercises were never written (got: " + unset2.join(",") + ")");

  console.log("== AI estimator: null / clamping / array shape ==");
  addCustom("ex-id-b1", "One-Arm Planche Lean", "");
  addCustom("ex-id-b2", "Deep Archer Dip", "");
  addCustom("ex-id-b3", "Tuck Jump Lunge", "");
  addCustom("ex-id-b4", "Wall Sit Pulse", "");
  answers = { "ex-1": null, "ex-id-l2": null, "ex-id-b1": null, "ex-id-b2": 500, "ex-id-b3": -4, "ex-id-b4": 12.6 };
  W.switchView("library");
  click($("#load-estimate"));
  await until(() => $$("#load-est-host .load-est-row").length === 6);
  const rowB1 = $(".load-est-row input[data-ex-id='ex-id-b1']");
  check(rowB1 && rowB1.value === "", "model 'can't judge' row starts empty");
  check((rowB1.parentNode.textContent).indexOf("couldn't judge") !== -1, "uncertain suggestion is labelled, not silently guessed");
  click($("#load-est-save"));
  await until(() => !$("#load-est-host"));
  check(exById("ex-id-b1").loadFactor == null, "null suggestion leaves the exercise unset");
  check(exById("ex-id-b2").loadFactor === 100, "500% suggestion clamped to 100");
  check(exById("ex-id-b3").loadFactor === 0, "-4% suggestion clamped to 0");
  check(exById("ex-id-b4").loadFactor === 13, "12.6% suggestion rounded to 13");
  const unset3 = unknownIds();
  check(unset3.length === 3 && unset3.indexOf("ex-id-b1") !== -1, "only the never-judged + cleared exercises stay unset (got: " + unset3.join(",") + ")");
  addCustom("ex-id-c1", "Sphinx Push-Up", "");
  answers = { "ex-1": null, "ex-id-l2": null, "ex-id-b1": null, "ex-id-c1": 42 };
  answerShape = "array";
  W.switchView("library");
  click($("#load-estimate"));
  await until(() => $$("#load-est-host .load-est-row").length === 1);
  click($("#load-est-save"));
  await until(() => !$("#load-est-host"));
  check(exById("ex-id-c1").loadFactor === 42, "raw-array response shape is accepted");

  console.log("== Reminders & profile rows ==");
  W.switchView("you");
  check(($("#you-page-1").textContent).indexOf("lack a body-weight load factor") !== -1, "volume view warns when unknown-load exercises exist");
  // set every remaining exercise so the warning clears
  E("state.exercises.find(e=>e.id==='ex-1').loadFactor = 67; state.exercises.find(e=>e.id==='ex-1').loadSource = 'builtin'");
  E("state.exercises.find(e=>e.id==='ex-id-l2').loadFactor = 70; state.exercises.find(e=>e.id==='ex-id-l2').loadSource = 'manual'");
  E("state.exercises.find(e=>e.id==='ex-id-b1').loadFactor = 100; state.exercises.find(e=>e.id==='ex-id-b1').loadSource = 'manual'");
  W.switchView("library");
  W.switchView("you");
  check(($("#you-page-1").textContent).indexOf("lack a body-weight load factor") === -1, "volume warning disappears when every exercise is set");
  W.switchView("library");
  E("openExEditor('ex-id-b1')");
  check($("#ex-load-val").textContent === "100% of body weight", "editor shows a stored factor on open");
  click($("#ex-cancel"));
  E("openExVisualizer('ex-1')");
  const kvSet = $$("#ex-vis-host .vis-kv").find(r => r.querySelector("span") && r.querySelector("span").textContent === "Load on muscles");
  check(Boolean(kvSet) && kvSet.textContent.indexOf("67% of body weight") !== -1 && kvSet.textContent.indexOf("built-in default") !== -1, "visualizer About shows a set load factor with its source");
  click($("#ex-vis-host [data-vis-back]"));
  E("state.exercises.find(e=>e.id==='ex-id-l2').loadFactor = null; delete state.exercises.find(e=>e.id==='ex-id-l2').loadSource");
  E("openExVisualizer('ex-id-l2')");
  const kvUnset = $$("#ex-vis-host .vis-kv").find(r => r.querySelector("span") && r.querySelector("span").textContent === "Load on muscles");
  check(Boolean(kvUnset) && kvUnset.textContent.indexOf("not counted in Total volume") !== -1, "visualizer About flags unset exercises as not counted");
  click($("#ex-vis-host [data-vis-back]"));

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
