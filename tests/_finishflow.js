/* Regression: finishing a workout must leave the recovery form on the FIRST
   "Generate coach suggestions" click. A stale recoveryScreen flag used to keep
   re-rendering the recovery form after the session was saved, so the screen
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

// Drive a session to the recovery form (same path the UI takes).
function driveToRecovery() {
  window.switchView("log");
  window.startLog("day-1");
  const ctx = E("logCtx");
  E("getDay('day-1').exercises").forEach(de => {
    const ent = ctx.entries[de.exId];
    if (!ent) return;
    ent.sets.forEach(s => { s.reps = 8; s.rating = 1; });
  });
  ctx.recovery = { recovery: 3, sleep: 4, energy: 3, soreness: 0, pain: "", note: "" };
  E("logCtx.recoveryScreen = true; render();");
}

console.log("\n== Finish flow: one click, one session ==");
driveToRecovery();
check(Boolean($("#view-log #rec-finish")), "recovery form is shown before finishing");
$("#view-log #rec-finish").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(Boolean($("#view-log #log-finish")), "done screen appears after the FIRST click");
check(!$("#view-log #rec-finish"), "recovery form is no longer on screen");
check(E("state.sessions.length") === 1 && E("state.pending.length") === 1,
  "exactly one session and one coach batch created (count=" + E("state.sessions.length") + "/" + E("state.pending.length") + ")");
check(E("logCtx.finished") === true && E("logCtx.recoveryScreen") === false,
  "logCtx finished with recoveryScreen cleared");

console.log("\n== Finish workout returns to the log picker ==");
const btn = $("#view-log #log-finish");
check(btn && btn.textContent.trim() === "Finish workout", "primary button reads 'Finish workout'");
btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(E("logCtx") === null, "logCtx cleared after finishing");
check($$("#view-log [data-start]").length === 2, "original log picker is shown again");

console.log("\n== Button disappears after one click (no repeat presses possible) ==");
driveToRecovery();
$("#view-log #rec-finish").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
check(!$("#view-log #rec-finish"), "second press impossible — button already gone");
check(E("state.sessions.length") === 2 && E("state.pending.length") === 2,
  "no duplicate batches from the finishing flow (count=" + E("state.sessions.length") + "/" + E("state.pending.length") + ")");

check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
