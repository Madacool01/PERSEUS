/* Regression: finishing a workout must leave the reflection form on the FIRST
   "Generate coach suggestions" click. A stale reflectScreen flag used to keep
   re-rendering the reflection form after the session was saved, so the screen
   never advanced and users could re-log the same workout, piling up duplicate
   sessions and coach batches. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const errors = [];

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
    window.confirm = () => true;
    window.addEventListener("error", e => errors.push(e && e.message || String(e)));
  },
});
const { window } = dom;
const $ = sel => window.document.querySelector(sel);
const $$ = sel => Array.from(window.document.querySelectorAll(sel));
const E = expr => window.eval(expr);

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
}

// Drive a session to the reflection form (same path the UI takes).
function driveToReflection() {
  window.switchView("log");
  window.startLog("day-1");
  const ctx = E("logCtx");
  E("getDay('day-1').exercises").forEach(de => {
    const ent = ctx.entries[de.exId];
    if (!ent) return;
    ent.sets.forEach(s => { s.reps = 8; s.rating = 1; });
  });
  ctx.readiness = { sleep: 4, energy: 3, soreness: 0, stress: 4, pain: "" };
  ctx.feedback = { difficulty: 3, performance: 2, pump: 1, fatigue: 3, pain: "", note: "" };
  E("logCtx.reflectScreen = true; render();");
}

console.log("\n== Finish flow: one click, one session ==");
console.log("\n== Pre-session readiness check-in ==");
window.switchView("log");
window.startLog("day-1");
check(Boolean($("#view-log #rd-start")) && Boolean($("#view-log [data-rail-block='rd']")), "readiness check-in renders before the sets");
check(E("logCtx.readyScreen") === true && !$("#view-log #log-next"), "no set screen while the check-in is open");
const tap = (key, val) => $("#view-log [data-rail-block='rd'][data-rail-key='" + key + "'][data-val='" + val + "']")
  .dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
tap("sleep", 2);
check(E("logCtx.readiness.sleep") === 2, "tapping a rail writes the answer into logCtx");
check(/Four taps/.test($("#view-log #rd-verdict").textContent), "the verdict waits until three check-ins are answered");
tap("energy", 2); tap("stress", 2);
check(E("logCtx.readiness.energy") === 2 && E("logCtx.readiness.stress") === 2, "every rail lands in the readiness block");
check(/Amber|Red/.test($("#view-log #rd-verdict").textContent), "the verdict reacts to poor sleep, low energy and high stress");
$("#view-log #rd-start").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(E("logCtx.readyScreen") === false && Boolean($("#view-log .log-step")), "start training moves on to the sets");
E("logCtx=null; render();");
driveToReflection();
check(Boolean($("#view-log #ref-finish")), "reflection form is shown before finishing");
$("#view-log #ref-finish").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(Boolean($("#view-log #log-finish")), "done screen appears after the FIRST click");
check(!$("#view-log #ref-finish"), "reflection form is no longer on screen");
check(E("state.sessions.length") === 1 && E("state.pending.length") === 1,
  "exactly one session and one coach batch created (count=" + E("state.sessions.length") + "/" + E("state.pending.length") + ")");
check(E("state.sessions[0].readiness.sleep") === 4 && E("state.sessions[0].feedback.difficulty") === 3,
  "the session stored both check-ins (readiness + feedback)");
check(E("logCtx.finished") === true && E("logCtx.reflectScreen") === false,
  "logCtx finished with reflectScreen cleared");

console.log("\n== Finish workout returns to the log picker ==");
const btn = $("#view-log #log-finish");
check(btn && btn.textContent.trim() === "Finish workout", "primary button reads 'Finish workout'");
btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(E("logCtx") === null, "logCtx cleared after finishing");
check($$("#view-log [data-start]").length === 2, "original log picker is shown again");

console.log("\n== Button disappears after one click (no repeat presses possible) ==");
driveToReflection();
$("#view-log #ref-finish").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(!$("#view-log #ref-finish"), "second press impossible — button already gone");
check(E("state.sessions.length") === 2 && E("state.pending.length") === 2,
  "no duplicate batches from the finishing flow (count=" + E("state.sessions.length") + "/" + E("state.pending.length") + ")");

check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
