/* Dev smoke test for index.html's inline app using jsdom. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const errors = [];
const store = {};

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    window.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    };
    window.scrollTo = () => {};
    window.addEventListener("error", e => errors.push(e && e.message || String(e)));
  },
});
const { window } = dom;

function $(sel) { return window.document.querySelector(sel); }
function $$(sel) { return Array.from(window.document.querySelectorAll(sel)); }
// top-level let/const/functions live in the page's lexical scope, not on window.
// Use eval through the window to access any global by name/expression.
const E = expr => window.eval(expr);
const G = name => window.eval(name);

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
}
function section(t){ console.log("\n== " + t + " =="); }

(async () => {
  section("Initial render");
  const woView = $("#view-workouts");
  check(Boolean(woView.innerHTML.length > 500), "workouts view rendered (len=" + woView.innerHTML.length + ")");
  check($$("#view-workouts input[data-dayname]").length === 2, "two seeded days shown");

  section("Navigation switches");
  ["workouts","log","coach","history","library","settings"].forEach(v => {
    window.switchView(v);
    check($("#view-" + v) && $("#view-" + v).classList.contains("active"), "view '" + v + "' active");
  });

  section("Exercise library");
  window.switchView("library");
  const libItems = $$("#view-library .exercise-item");
  check(libItems.length >= 20, "library shows " + libItems.length + " exercises");

  section("Start logging (simulate clicking a day)");
  window.switchView("log");
  const dayCards = $$("#view-log [data-start]");
  check(dayCards.length === 2, "log picker lists " + dayCards.length + " days");
  window.startLog("day-1");
  check(G("logCtx") && G("logCtx").dayId === "day-1", "logCtx started for day-1");
  const stepTitle = $("#view-log .big-title");
  check(Boolean(stepTitle && stepTitle.textContent), "log step shows exercise name: " + (stepTitle && stepTitle.textContent));

  section("Fill in session data & save (rules engine + AI fallback)");
  const ctx = G("logCtx");
  const day1 = E("getDay('day-1')");
  day1.exercises.forEach(de => {
    const ent = ctx.entries[de.exId];
    if (!ent) return;
    const ex = G("getEx('" + de.exId + "')");
    ent.sets.forEach(s => {
      if (ex.mode === "time") { s.time = (de.time || 0) + 5; s.rating = 1; }
      else if (ex.mode === "reps") { s.reps = (de.reps || 0) + 2; s.rating = 1; }
      else { s.reps = (de.reps||0)+2; s.weight = de.weight; s.rating = 1; }
    });
  });
  ctx.recovery = { recovery: 3, sleep: 4, energy: 3, soreness: 0, pain: "", note: "" };
  window.saveLogSession();

  let pend = G("state.pending")[G("state.pending.length")-1];
  await waitFor(() => (pend.suggestions && pend.suggestions.length > 0), "suggestions generated");

  check(G("logCtx") && G("logCtx").finished === true, "session finalized flag set");
  check(G("state.sessions.length") >= 1, "a session was saved (count=" + G("state.sessions.length") + ")");
  check(G("state.pending.length") >= 1, "a pending coach record was created");
  pend = G("state.pending")[G("state.pending.length")-1];
  check(pend.suggestions && pend.suggestions.length > 0, "suggestions generated (" + (pend.suggestions||[]).length + ")");
  if (pend.suggestions) pend.suggestions.forEach(s => {
    check(["reps","time","weight"].includes(s.field), "suggestion field='" + s.field + "' valid");
    check(s.from !== undefined && s.to !== undefined, "suggestion has from→to (" + s.from + "→" + s.to + ")");
  });
  check(!pend.suggestions.some(s => s.field === "sets"), "no suggestion changes set count");

  section("Review & apply a suggestion");
  window.switchView("coach");
  const recCards = $$("#view-coach .rec-card");
  check(recCards.length > 0, "coach feed renders " + recCards.length + " suggestion cards");
  if (recCards.length) {
    const tog = $$("#view-coach [data-act].btn")[0];
    if (tog) {
      const pendId = tog.dataset.recid, exId = tog.dataset.ai;
      // Click the REAL button to prove the DOM listener routes into recAct.
      tog.dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
      const p = G("state.pending").find(x => x.id === pendId);
      const sug = p.suggestions.find(x => x.exId === exId);
      check(sug.kept === true, "real button click accepted & marked kept");
      const day = window.getDay("day-1");
      const de = day.exercises.find(x => x.exId === exId);
      check(de[sug.field] === sug.to, "plan updated via click: " + sug.field + " → " + de[sug.field]);
      // Now a reject button (second card) through a real click should mark rejected
      window.switchView("coach");
      const rej = $$("#view-coach [data-act='reject'].btn")[0];
      if (rej){
        const rp = G("state.pending").find(x => x.id === rej.dataset.recid);
        const before = rp.suggestions.find(x=>x.exId===rej.dataset.ai).kept;
        rej.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
        const after = rp.suggestions.find(x=>x.exId===rej.dataset.ai).kept;
        check(before===null && after===false, "real button click rejected a suggestion");
      }
    }
  }

  section("History view");
  window.switchView("history");
  check($$("#view-history [data-sess]").length >= 1, "history lists sessions");

  section("Settings render");
  window.switchView("settings");
  check(Boolean($("#set-profile-save")), "settings profile section rendered");

  section("Runtime errors");
  check(errors.length === 0, "no window errors during flows" + (errors.length ? " -> " + errors.join(" | ") : ""));

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);

  function waitFor(fn, label, ms) { return new Promise(res => { const iv=setInterval(()=>{ if(fn()){clearInterval(iv);$&&console.log("    ✓ "+(label||""));res(true);} },10); setTimeout(()=>{clearInterval(iv);console.log("    ✗ timeout waiting for "+label);res(false);}, ms||5000); }); }
})();