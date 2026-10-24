/* Records tab predicted 1RM: pure weight-mode lifts read as kg, while
   bodyweight movements read as the lifter's bodyweight plus the extra load
   needed to reach the estimate. Both are the same Epley math. */
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
  },
});
const W = dom.window;
const $ = s => W.document.querySelector(s);
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
};
const txt = el => el ? el.textContent.replace(/\s+/g, " ").trim() : "";

E("state.profile.bodyWeight = 75; state.profile.weightUnit = 'kg'");
E("state.sessions.push({ id:'s-chin', dayId:'day-1', dateISO:'2026-01-05T10:00:00.000Z', completedSets:[{ exId:'ex-7', setIndex:0, reps:6, weight:10, type:'regular', hit:true }], finalized:true })");
E("state.sessions.push({ id:'s-curl', dayId:'day-1', dateISO:'2026-01-06T10:00:00.000Z', completedSets:[{ exId:'ex-26', setIndex:0, reps:10, weight:8, type:'regular', hit:true }], finalized:true })");
W.switchView("library");

function openRecords(exId) {
  E("openExVisualizer('" + exId + "')");
  const tab = $('[data-vis-tab="records"]');
  tab.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
}

console.log("\n== Bodyweight chin-up reads as bodyweight + added ==");
openRecords("ex-7");
const chinVal = txt($("#ex-vis-host [data-rm-val]"));
check(/75 kg\s*bodyweight/i.test(chinVal), "bodyweight component shown (got \"" + chinVal + "\")");
check(/27 kg\s*added/i.test(chinVal), "added component shown (got \"" + chinVal + "\")");
check(chinVal.indexOf("102") === -1, "the bare total kg is not the primary readout");
check($("#ex-vis-host [data-rm-val]").classList.contains("split"), "value uses the split bodyweight layout");
const chinSrc = txt($("#ex-vis-host [data-rm-src]"));
check(/6 reps × 85 kg lifted/.test(chinSrc), "source line names the lifted load (got \"" + chinSrc + "\")");
const chinCand = txt($("#ex-vis-host [data-rm-pick]"));
check(/bodyweight \+ 27 kg added/.test(chinCand), "candidate chip previews the same split (got \"" + chinCand + "\")");
const chinLive = txt($("#ex-vis-host [data-rm-live]"));
check(/75 kg\s*bodyweight/i.test(chinLive) && /27 kg\s*added/i.test(chinLive), "calculator output uses the split format");

console.log("\n== Calculator keeps the split when load changes ==");
E("var wIn = document.querySelector('#ex-vis-host [data-rm-w]'); wIn.value = '95'; wIn.dispatchEvent(new Event('input', { bubbles:true }))");
E("var rIn = document.querySelector('#ex-vis-host [data-rm-r]'); rIn.value = '3'; rIn.dispatchEvent(new Event('input', { bubbles:true }))");
const calcLive = txt($("#ex-vis-host [data-rm-live]"));
check(/75 kg\s*bodyweight/i.test(calcLive), "bodyweight stays constant (got \"" + calcLive + "\")");
check(/29\.5 kg\s*added/i.test(calcLive), "added load follows the new estimate (got \"" + calcLive + "\")");

console.log("\n== Pure weight-mode curl stays in kilograms ==");
openRecords("ex-26");
const curlVal = txt($("#ex-vis-host [data-rm-val]"));
check(curlVal === "10.7 kg", "curl 1RM is a single kg value (got \"" + curlVal + "\")");
check(!/bodyweight|added/i.test(curlVal), "no bodyweight wording for a weighted lift");
check(!$("#ex-vis-host [data-rm-val]").classList.contains("split"), "value does not use the split layout");
const curlCand = txt($("#ex-vis-host [data-rm-pick]"));
check(/→ 10\.7 kg$/.test(curlCand), "candidate chip ends in the pure kg estimate (got \"" + curlCand + "\")");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
