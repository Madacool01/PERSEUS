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
const $$ = s => Array.from(W.document.querySelectorAll(s));
const clickTab = v => $(`.tab-btn[data-view="${v}"]`).dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

console.log("== You tab (training analytics) ==");
const tabs = $$(".tab-btn");
const youBtn = $(".tab-btn[data-view='you']");
check(Boolean(youBtn), "You tab button exists in the primary nav");
check(youBtn.textContent.trim() === "You", "You tab is labelled You");
check(tabs.length === 7, "seven primary tabs total");
check(tabs[5].dataset.view === "you" && tabs[6].dataset.view === "settings", "You sits between Exercises and Settings, Settings last");

clickTab("you");
check($("#view-you").classList.contains("active"), "You view activates after click");
check($$("#view-you .sub-tab").length === 2, "two sub-tabs (Overview / Exercises)");
check(["Overview", "Exercises"].every((t, i) => $$("#view-you .sub-tab")[i].textContent === t), "sub-tab labels in order");
check($("#view-you .sub-tab").classList.contains("active"), "Overview sub-tab active by default");
check(Boolean($("#view-you #you-content .you-count")), "Overview sub-tab renders content (count widget)");

// Switch to the Exercises sub-tab through the real UI
$$("#view-you .sub-tab")[1].dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check($("#view-you .sub-tab:nth-child(2)").classList.contains("active"), "Exercises sub-tab becomes active");
check(Boolean($("#view-you #you-content .card")), "Exercises sub-tab renders content");

// The You view survives a simulated refresh via the view-restore path
clickTab("you");
E("currentView = 'workouts'; restoreView(); render();");
check($("#view-you").classList.contains("active"), "You section restored after refresh");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);