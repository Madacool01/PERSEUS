/* History session details: opening runs the same measured reveal as closing,
   and still opens instantly when motion is reduced or GSAP is unavailable. */
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
    window.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    };
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  },
});
const W = dom.window;
const $ = s => W.document.querySelector(s);
const $$ = s => Array.from(W.document.querySelectorAll(s));
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
};

E("state.sessions.push({ id:'sess-anim', dayId:'day-1', dateISO:new Date().toISOString(), type:'hypertrophy', completedSets:[{ exId:'ex-3', setIndex:0, reps:8, rating:3, hit:true }], finalized:true })");
W.switchView("history");

const calls = [];
W.gsap = {
  from(el, vars) { calls.push({ el, vars }); },
  killTweensOf() {},
};
E("FX.ok = true");
$("#view-history [data-sess]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

check(Boolean($("#view-history .sess-detail")), "session detail opens");
check(calls.length >= 2, "opening animates the card and its content");
const cardCall = calls.find(c => c.el.classList && c.el.classList.contains("sess-detail"));
const contentCall = calls.find(c => c.el !== (cardCall && cardCall.el));
check(Boolean(cardCall), "card itself is animated");
check(cardCall && cardCall.vars.height === 0 && cardCall.vars.opacity === 0, "card unfolds from zero height and transparency");
check(cardCall && cardCall.vars.duration === 0.42, "card uses the intended reveal duration");
check(Boolean(contentCall) && contentCall.vars.stagger > 0, "inner session blocks settle in with a stagger");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
