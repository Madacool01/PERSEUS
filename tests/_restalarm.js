/* Rest-end ringtone: while logging mode is on, a finished rest plays an alarm
   and says where to go next. A between-set rest uses a short ping; the last
   set of an exercise uses a longer chime that names the next exercise, and
   the very last set cues the wrap-up. Logging mode off is silent. */
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
    // Minimal Web Audio stand-in: count every oscillator scheduled (one per note).
    window.__osc = 0;
    function Param(){}
    Param.prototype.setValueAtTime = function(){};
    Param.prototype.exponentialRampToValueAtTime = function(){};
    window.AudioContext = function(){
      this.currentTime = 0;
      this.state = "running";
      this.destination = {};
      this.resume = function(){};
      this.createOscillator = function(){ return { type:"", frequency:{ value:0 }, connect(){}, start(){ window.__osc++; }, stop(){} }; };
      this.createGain = function(){ return { gain: new Param(), connect(){} }; };
    };
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
const $ = s => W.document.querySelector(s);
const input = (el, v) => { el.value = v; el.dispatchEvent(new W.Event("input", { bubbles: true })); };
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };
const lastToast = () => W.__toasts[W.__toasts.length - 1];

(() => {
  // Capture toasts the app raises when a rest ends.
  W.eval("window.__toasts = []; toast = function(m){ window.__toasts.push(m); };");

  console.log("\n== between-set rest ==\n");
  E("state.profile.loggingMode = true");
  E("getDay('day-1').defaultRestSec = 60");
  E("switchView('log')");
  E("startLog('day-1')");
  $("#view-log #rd-start").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

  const de = E("getDay('day-1').exercises[0]");
  const ex = E("getEx('" + de.exId + "')");
  const field = ex.mode === "time" ? ".s-time" : ".s-reps";
  const cell0 = $('#view-log .set-cell[data-set="0"]');
  check(Boolean(cell0), "first exercise renders a set cell");
  input(cell0.querySelector(field), "8");
  check(E("restTimer.running") === true, "logging a set auto-starts the rest countdown");
  check(W.__osc === 0, "no alarm while the rest is still running");

  E("restTimer.left = 1"); E("restTick()");
  check(E("restTimer.running") === false, "the rest runs out");
  check(E("restTimer.kind") === "set", "a between-set rest is a 'set' rest");
  check(W.__osc === 2, "two-note ping plays for a between-set rest");
  check(lastToast() === "Rest over — next set", "between-set rest cues the next set");

  console.log("\n== last set of an exercise → next exercise ==\n");
  E("restClear()");
  const nextName = E("getEx('ex-5').name");
  E("maybeAutoStartRest(90, true)");
  check(E("restTimer.kind") === "exercise", "the transition rest is an 'exercise' rest");
  check(E("restTimer.next") === nextName, "it remembers the next exercise name (" + nextName + ")");

  const before = W.__osc;
  E("restTimer.left = 1"); E("restTick()");
  check(W.__osc - before === 3, "three-note chime plays for the exercise transition");
  check(/on to /.test(lastToast()) && lastToast().indexOf(nextName) !== -1, "transition alarm names the next exercise (" + lastToast() + ")");

  console.log("\n== last set of the session → wrap up ==\n");
  E("restClear(); logCtx.idx = logStepsForDay(getDay('day-1')).length - 1;");
  E("maybeAutoStartRest(90, true)");
  check(E("restTimer.kind") === "finish", "the final rest has no next exercise ('finish')");
  E("restTimer.left = 1"); E("restTick()");
  check(/wrap up/i.test(lastToast()), "final rest cues the session wrap-up");

  console.log("\n== logging mode off is silent ==\n");
  E("restClear(); state.profile.loggingMode = false;");
  const off = W.__osc;
  E("restStart(30, 'Rest', { kind:'exercise', next:'X' });");
  E("restTimer.left = 1"); E("restTick()");
  check(W.__osc === off, "no ringtone plays when logging mode is off");

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
