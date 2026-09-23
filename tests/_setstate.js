/* Set state: a set with work but no effort (or effort but no work) is flagged
   yellow while logging. Only work (reps/time) counts as done in History — an
   effort-only set is dropped. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    window.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    window.scrollTo = () => {};
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
const $ = s => W.document.querySelector(s);
const $$ = s => Array.from(W.document.querySelectorAll(s));
const input = (el, v) => { el.value = v; el.dispatchEvent(new W.Event("input", { bubbles: true })); };
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };

(() => {
  console.log("\n== partial (yellow) set state while logging ==");
  E("switchView('log')");
  E("startLog('day-1')");
  // The session opens on the readiness check-in; start it to reach the set grid.
  $('#view-log #rd-start').dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  const de = E("getDay('day-1').exercises[0]");
  const ex = E("getEx('" + de.exId + "')");
  const field = ex.mode === "time" ? ".s-time" : ".s-reps";
  const cell0 = $('#view-log .set-cell[data-set="0"]');
  check(Boolean(cell0), "first exercise renders a set cell");
  check(!cell0.classList.contains("done") && !cell0.classList.contains("partial"), "blank set is neither done nor partial");

  const num = cell0.querySelector(field);
  input(num, ex.mode === "time" ? "30" : "8");
  check(cell0.classList.contains("partial"), "work without effort turns the set yellow (partial)");
  check(!cell0.classList.contains("done"), "…and is not yet marked done");

  // The "!" badge carries the hover explanation of what is still missing.
  const warn0 = cell0.querySelector(".set-warn");
  check(Boolean(warn0), "yellow set renders an exclamation badge");
  check(Boolean(warn0.dataset.tip) && /effort/i.test(warn0.dataset.tip), "badge tip explains the missing effort rating");

  const effort = cell0.querySelector(".effort-range");
  input(effort, "3");
  check(cell0.classList.contains("done"), "adding effort completes the set (done)");
  check(!cell0.classList.contains("partial"), "completed set drops the yellow flag");

  const clear = cell0.querySelector(".effort-clear");
  clear.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
  check(cell0.classList.contains("partial"), "clearing effort drops back to yellow (work still there)");

  console.log("\n== effort without work is yellow too ==");
  input(num, "");
  const cell1 = $('#view-log .set-cell[data-set="1"]') || cell0;
  const num1 = cell1.querySelector(field);
  if (num1) input(num1, "");
  const effort1 = cell1.querySelector(".effort-range");
  input(effort1, "4");
  check(cell1.classList.contains("partial"), "effort without work is flagged yellow (partial)");
  check(!cell1.classList.contains("done"), "effort alone never marks a set done");
  const warn1 = cell1.querySelector(".set-warn");
  check(Boolean(warn1) && /reps or time/i.test(warn1.dataset.tip), "badge tip explains the missing reps/time instead");

  console.log("\n== History counts work, not effort ==");
  const ent = E("logCtx.entries['" + de.exId + "']");
  ent.sets.forEach(s => { s.reps = ""; s.time = ""; s.rating = 0; });
  ent.sets[0][ex.mode === "time" ? "time" : "reps"] = ex.mode === "time" ? 30 : 8;
  ent.sets[0].rating = 0;                    // work, no effort -> counted
  if (ent.sets[1]) { ent.sets[1].rating = 3; } // effort, no work -> dropped
  const out = E("buildSession(getDay('day-1'), logCtx.entries, logCtx.feedback||{}, logCtx.readiness||{})");
  check(out.completedSets.some(c => c.exId === de.exId && c.setIndex === 0), "reps/time without effort still logs to History");
  check(!out.completedSets.some(c => c.exId === de.exId && c.setIndex === 1), "effort without reps/time does NOT log to History");
  check(E("logSetsDone(logCtx.entries['" + de.exId + "'])") === 1, "sets-logged tally counts work-only sets, not effort-only ones");

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
