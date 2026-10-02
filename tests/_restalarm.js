/* Rest-end countdown cue: while logging mode is on, audio/rest-end.mp3
   (beep-beep-beep-boop) starts 4s before the rest ends so 3-2-1-go lands on
   zero. Toasts still say where to go next. Logging mode off is silent. */
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
    // Stand-in for HTMLAudio: count every play() and remember the src.
    window.__cuePlays = 0;
    window.__cueSrc = "";
    window.Audio = function(src){
      window.__cueSrc = src;
      this.preload = "";
      this.load = function(){};
      this.play = function(){ window.__cuePlays++; };
    };
    // Web Audio fallback stand-in: should stay silent while the MP3 works.
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

  console.log("\n== between-set rest: cue 4s before the end ==\n");
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
  check(W.__cuePlays === 0, "no cue while the rest is still long");
  check(/rest-end\.mp3/.test(W.__cueSrc), "cue uses audio/rest-end.mp3 (" + W.__cueSrc + ")");

  E("restTimer.left = 5"); E("restTick()");
  check(E("restTimer.left") === 4, "countdown reaches the 4s lead-in");
  check(W.__cuePlays === 1, "beep-beep-beep-boop starts 4s before the end");
  check(E("restTimer.running") === true, "timer keeps running during the cue");

  E("restTimer.left = 1"); E("restTick()");
  check(E("restTimer.running") === false, "the rest runs out");
  check(E("restTimer.kind") === "set", "a between-set rest is a 'set' rest");
  check(W.__cuePlays === 1, "cue plays once (no replay at zero)");
  check(W.__osc === 0, "no synth fallback while the MP3 plays");
  check(lastToast() === "Rest over — next set", "between-set rest cues the next set");

  console.log("\n== last set of an exercise → next exercise ==\n");
  E("restClear()");
  const nextName = E("getEx('ex-5').name");
  E("maybeAutoStartRest(90, true)");
  check(E("restTimer.kind") === "exercise", "the transition rest is an 'exercise' rest");
  check(E("restTimer.next") === nextName, "it remembers the next exercise name (" + nextName + ")");
  check(W.__cuePlays === 1, "long transition rest starts silent");

  const before = W.__cuePlays;
  E("restTimer.left = 5"); E("restTick()");
  check(W.__cuePlays - before === 1, "transition cue starts at the 4s lead-in");
  E("restTimer.left = 1"); E("restTick()");
  check(W.__cuePlays - before === 1, "transition cue plays once");
  check(/on to /.test(lastToast()) && lastToast().indexOf(nextName) !== -1, "transition alarm names the next exercise (" + lastToast() + ")");

  console.log("\n== last set of the session → wrap up ==\n");
  E("restClear(); logCtx.idx = logStepsForDay(getDay('day-1')).length - 1;");
  E("maybeAutoStartRest(90, true)");
  check(E("restTimer.kind") === "finish", "the final rest has no next exercise ('finish')");
  const finBefore = W.__cuePlays;
  E("restTimer.left = 5"); E("restTick()");
  check(W.__cuePlays - finBefore === 1, "final cue starts at the 4s lead-in");
  E("restTimer.left = 1"); E("restTick()");
  check(W.__cuePlays - finBefore === 1, "final cue plays once");
  check(/wrap up/i.test(lastToast()), "final rest cues the session wrap-up");

  console.log("\n== short rest plays the cue at once ==\n");
  E("restClear()");
  const shortBefore = W.__cuePlays;
  E("restStart(3, 'Rest', { kind:'set' })");
  check(W.__cuePlays - shortBefore === 1, "3s rest fires the countdown immediately");
  E("restTimer.left = 1"); E("restTick()");
  check(W.__cuePlays - shortBefore === 1, "short-rest cue plays once");

  console.log("\n== logging mode off is silent ==\n");
  E("restClear(); state.profile.loggingMode = false;");
  const off = W.__cuePlays;
  const offOsc = W.__osc;
  E("restStart(30, 'Rest', { kind:'exercise', next:'X' });");
  E("restTimer.left = 5"); E("restTick()");
  E("restTimer.left = 1"); E("restTick()");
  check(W.__cuePlays === off, "no cue plays when logging mode is off");
  check(W.__osc === offOsc, "no fallback beeps when logging mode is off");

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
