const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) { window.scrollTo = () => {}; },
});
const W = dom.window;
const E = expr => W.eval(expr);
const $ = s => W.document.querySelector(s);
const clickTab = v => $(`.tab-btn[data-view="${v}"]`).dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

console.log("== View restore across refresh ==");
check($("#view-workouts").classList.contains("active"), "first visit starts on workouts");
const viewKey = E("VIEW_KEY");
check(typeof viewKey === "string" && viewKey.length > 0, "view key constant readable");

// Switch tabs through the real UI
clickTab("library");
check($("#view-library").classList.contains("active"), "Exercises tab active after click");
check(E("localStorage.getItem(VIEW_KEY)") === "library", "active view written to storage ('" + viewKey + "')");

// Simulate a refresh: reset to the workout default, then run the bootstrap restore path
E("currentView = 'workouts'; restoreView(); render();");
check($("#view-library").classList.contains("active"), "after simulated refresh, Exercises section is active again");
check(!$("#view-workouts").classList.contains("active"), "workouts NOT active after restore");
check(Boolean($("#view-library .exercise-item")), "library content rendered after restore");

// The restore tracks the latest tab switched to
clickTab("settings");
E("currentView = 'workouts'; restoreView(); render();");
check($("#view-settings").classList.contains("active"), "restore tracks the latest tab (settings)");

// No remembered view (first-ever visit) keeps the workouts default
E("localStorage.removeItem(VIEW_KEY)");
E("currentView = 'library'; restoreView(); render();");
check($("#view-workouts").classList.contains("active"), "no remembered view falls back to workouts");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);