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
    window.confirm = () => true;
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

// Seed two sessions directly (+ a coach record per session so the cascade is observable)
E(`state.sessions.push(
  { id:"s1", dayId:"day-1", dateISO:"2026-08-27", type:"hypertrophy", completedSets:[{exId:"ex-ring-dip",setIndex:0,reps:8,rating:3,hit:true}] },
  { id:"s2", dayId:"day-1", dateISO:"2026-08-28", type:"hypertrophy", completedSets:[{exId:"ex-ring-dip",setIndex:0,reps:9,rating:4,hit:true}] }
)`);
E(`state.pending.push(
  { id:"p1", sessionId:"s1", generatedAt:"2026-08-27T10:00:00.000Z", suggestions:[] },
  { id:"p2", sessionId:"s2", generatedAt:"2026-08-28T10:00:00.000Z", suggestions:[] }
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

// Delete a session: removed from history + its coach record is cleaned up
const delCard = $$("#view-history [data-sess]")[0];
const delId = delCard.dataset.sess; // reversed order: s2 is first
check(Boolean(delId), "session card carries its id");
delCard.dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
const delBtn = $("#view-history .sess-detail [data-del-sess]");
check(Boolean(delBtn), "expanded session has a delete button");
check(delBtn && delBtn.dataset.delSess === delId, "delete button targets the right session");
check(Boolean(delBtn && delBtn.querySelector("svg")), "delete affordance carries the trash icon");
delBtn.dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check(G("state.sessions").length === 1, "deleted session removed from state (count=" + G("state.sessions").length + ")");
check(!G("state.sessions").some(s => s.id === delId), "deleted session id gone");
check(G("state.pending").length === 1 && !G("state.pending").some(p => p.sessionId === delId),
  "coach record for the deleted session removed (remaining=" + G("state.pending").length + ")");
check($$("#view-history [data-sess]").length === 1, "history re-renders with one session card left");

// A single Delete button with the trash icon INSIDE it, left of the label
$$("#view-history [data-sess]")[0].dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
const delBtns = $$("#view-history .sess-detail [data-del-sess]");
check(delBtns.length === 1, "single Delete button in the detail header");
check(Boolean(delBtns[0]) && delBtns[0].firstElementChild && delBtns[0].firstElementChild.tagName.toLowerCase() === "svg", "trash icon is the first element inside the button");
check(Boolean(delBtns[0]) && delBtns[0].textContent.trim() === "Delete", "icon sits to the left of the word Delete");
delBtns[0].dispatchEvent(new window.MouseEvent("click", { bubbles:true }));
check(G("state.sessions").length === 0, "Delete removes the last session (count=" + G("state.sessions").length + ")");
check(G("state.pending").length === 0, "its coach record removed too (count=" + G("state.pending").length + ")");
check($$("#view-history [data-sess]").length === 0 && Boolean($("#view-history .empty")), "history shows its empty state after last delete");

check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
