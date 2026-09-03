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
const click = el => el.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

console.log("== You overview: workouts per week + total volume ==");
clickTab("you");

// Count widget, carousel and pager dots
check(Boolean($("#you-count")), "workout count widget present");
check($("#you-count .you-count-num").textContent === "0", "count starts at 0 with no sessions");
check($$("#you-carousel .you-page").length === 2, "carousel has two pages");
check($$(".you-dot").length === 2, "two pager dots at the bottom");
check($(".you-dot").classList.contains("active"), "first dot active (workouts per week)");

// Weekly workouts page
const p0 = $("#you-page-0");
check(p0.textContent.indexOf("Workouts per week") !== -1, "page 1 titled Workouts per week");
check($$("[data-you-week-period]", p0).length === 5, "workouts view offers 5 period options");
check(Boolean($("#you-page-0 .vis-empty")), "empty state when no sessions logged");

// Volume page: placeholder vertical bars + its own period selector
const p1 = $("#you-page-1");
check(p1.textContent.indexOf("Total volume") !== -1, "page 2 titled Total volume");
check($$("[data-you-vol-period]", p1).length === 5, "volume view offers 5 period options");
check($$("#you-page-1 .you-bar").length > 0, "volume shows placeholder bars (one vertical rectangle per week)");
check(p1.textContent.indexOf("Placeholder data") !== -1, "volume labelled as placeholder data");

// Inject sessions across two weeks and re-render the overview
E(`state.sessions = [
  { id:"s1", dayId:"day-1", dateISO: new Date(Date.now() - 3*86400000).toISOString(), completedSets:[] },
  { id:"s2", dayId:"day-1", dateISO: new Date(Date.now() - 2*86400000).toISOString(), completedSets:[] },
  { id:"s3", dayId:"day-1", dateISO: new Date(Date.now() - 10*86400000).toISOString(), completedSets:[] }
];`);
E("renderYouTab();");
check($("#you-count .you-count-num").textContent === "3", "count shows 3 workouts after logging");
check($$("#you-page-0 .you-bar").length > 0, "weekly chart renders bars");
check($$("#you-page-0 .you-bar.zero").length > 0, "weeks without workouts show as empty stubs");
check(!$("#you-page-0 .vis-empty"), "empty state gone once sessions exist");

// Period selector on the workouts page updates state and the count widget
click($$("[data-you-week-period]", p0)[0]); // 1M
check(E("youPeriod") === "1m", "workouts period updated to 1M");
check($("#you-page-0 [data-you-week-period].active").textContent === "1M", "1M pill becomes active");
check($("#you-count .you-count-num").textContent === "3", "count widget refreshed with the new period");

// Period selector on the volume page
click($$("[data-you-vol-period]", p1)[3]); // 1Y
check(E("youVolPeriod") === "1y", "volume period updated to 1Y");
check($("#you-page-1 [data-you-vol-period].active").textContent === "1Y", "1Y pill becomes active on the volume page");

// Pager dots switch between the two views
click($$(".you-dot")[1]);
check($$(".you-dot")[1].classList.contains("active"), "second dot active after clicking");
check($$(".you-dot")[0].classList.contains("active") === false, "first dot no longer active");

// Expanded screen opens from the count widget
click($("#you-count"));
check(Boolean($("#you-modal-host")), "clicking the count opens the expanded screen");
check($("#you-modal-host h2").textContent === "Workouts", "expanded screen titled Workouts");
check($$("#you-modal-host [data-you-modal-period]").length === 5, "expanded screen offers 5 period options");
check($("#you-modal-host .you-count-static .you-count-num").textContent === "3", "expanded screen shows the workout count");

// Period selection inside the expanded screen
click($$("#you-modal-host [data-you-modal-period]")[2]); // 6M
check(E("youPeriod") === "6m", "expanded screen period updated to 6M");
check($("#you-modal-host [data-you-modal-period].active").textContent === "6M", "6M pill active in the expanded screen");

// Close via back button; underlying overview refreshes with the chosen period
click($("#you-modal-host [data-you-back]"));
check(!$("#you-modal-host"), "expanded screen closes via back button");
check($("#you-count .you-count-num").textContent === "3", "count widget still present after close");
check($("#you-page-0 [data-you-week-period].active").textContent === "6M", "overview workouts view picked up the expanded-screen period");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);