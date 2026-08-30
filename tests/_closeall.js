/* Throwaway verification for the History close-all button. */
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
const E = expr => window.eval(expr);
const G = name => window.eval(name);

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
}

// Seed two sessions directly
E(`state.sessions.push(
  { id:"s1", dayId:"day-1", dateISO:"2026-08-27", type:"hypertrophy", completedSets:[{exId:"ex-ring-dip",setIndex:0,reps:8,rating:3,hit:true}] },
  { id:"s2", dayId:"day-1", dateISO:"2026-08-28", type:"hypertrophy", completedSets:[{exId:"ex-ring-dip",setIndex:0,reps:9,rating:4,hit:true}] }
)`);

window.switchView("history");

const caBtn = $("#view-history [data-close-all]");
check(Boolean(caBtn), "close-all button rendered in Sessions box");
check(caBtn && caBtn.disabled === true, "close-all starts disabled");
check(caBtn && !caBtn.classList.contains("active"), "close-all starts unlit");

// Expand two sessions
$$("#view-history [data-sess]").forEach(el => el.dispatchEvent(new window.MouseEvent("click", { bubbles:true })));
check($$("#view-history .sess-detail").length === 2, "two session details expanded");
check(caBtn && caBtn.disabled === false, "close-all enabled when details are open");
check(caBtn && caBtn.classList.contains("active"), "close-all lit when details are open");
check(caBtn && /· 2/.test(caBtn.textContent), "close-all shows count (2): '" + (caBtn && caBtn.textContent.trim()) + "'");

// Per-detail close buttons exist and are the new style
const closeBtns = $$("#view-history .sess-detail [data-close]");
check(closeBtns.length === 2, "each detail has a close button");
check(closeBtns.every(b => b.classList.contains("sess-close")), "close buttons use the new sess-close style");

// Click one per-detail close -> button stays lit with count 1
closeBtns[0].dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check($$("#view-history .sess-detail").length === 1, "per-detail close removed one detail");
check(caBtn && /· 1/.test(caBtn.textContent), "close-all count drops to 1");
check(caBtn && caBtn.disabled === false, "close-all still lit with one open");

// Click close-all -> everything collapses, button dims
caBtn.dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check($$("#view-history .sess-detail").length === 0, "close-all collapsed every open session");
check(caBtn && caBtn.disabled === true, "close-all disabled again after closing all");
check(caBtn && !caBtn.classList.contains("active"), "close-all unlit again");

// Toggle: clicking an open card closes it
$$("#view-history [data-sess]")[0].dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check($$("#view-history .sess-detail").length === 1, "clicking a card expands it");
$$("#view-history [data-sess]")[0].dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check($$("#view-history .sess-detail").length === 0, "clicking the same card collapses it (no duplicates)");

check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
