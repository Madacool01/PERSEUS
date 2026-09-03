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

// Collapsed view: charts only, no period selectors, default last 3 months
check(!$("#you-count"), "no standalone workout count widget");
check(!$("#you-page-0 .you-period"), "no period selector on the collapsed workouts view");
check(!$("#you-page-1 .you-period"), "no period selector on the collapsed volume view");
check(E("youPeriod") === "3m" && E("youVolPeriod") === "3m", "both views default to the last 3 months");
check($$("#you-carousel .you-page").length === 2, "carousel has two pages");
check($$(".you-dot").length === 2, "two pager dots at the bottom");
check($(".you-dot").classList.contains("active"), "first dot active (workouts per week)");

const p0 = $("#you-page-0");
check(p0.textContent.indexOf("Workouts per week") !== -1, "page 1 titled Workouts per week");
check(Boolean($("#you-page-0 .vis-empty")), "empty state when no sessions logged");

const p1 = $("#you-page-1");
check(p1.textContent.indexOf("Total volume") !== -1, "page 2 titled Total volume");
check(Boolean($("#you-page-1 .vis-empty")), "volume shows an empty state (no fake bars) before any sessions are logged");
check(p1.textContent.indexOf("Placeholder data") === -1, "volume is no longer labelled as placeholder data");
check(p1.textContent.indexOf("Add your current body weight in Settings") !== -1, "volume nudges to add a body weight while it is missing");

// Inject real history: push-ups (67% body weight) plus a timed hold, and weighted
// ring dips (90% body weight + 10 kg). Then set the profile body weight so the
// tonnage math can run: reps × (added weight + body weight × load factor %).
E(`state.profile.bodyWeight = 50;
state.sessions = [
  { id:"s1", dayId:"day-1", dateISO: new Date(Date.now() - 10*86400000).toISOString(), completedSets:[
      { exId:"ex-1", setIndex:0, reps:8, weight:0, rating:1, hit:true },
      { exId:"ex-1", setIndex:1, reps:8, weight:0, rating:1, hit:true },
      { exId:"ex-1", setIndex:2, reps:8, weight:0, rating:1, hit:true },
      { exId:"ex-12", setIndex:0, time:20, rating:1, hit:true }
  ]},
  { id:"s2", dayId:"day-1", dateISO: new Date(Date.now() - 2*86400000).toISOString(), completedSets:[
      { exId:"ex-3", setIndex:0, reps:8, weight:10, rating:1, hit:true },
      { exId:"ex-3", setIndex:1, reps:8, weight:10, rating:1, hit:true },
      { exId:"ex-3", setIndex:2, reps:8, weight:10, rating:1, hit:true }
  ]},
  { id:"s3", dayId:"day-1", dateISO: new Date(Date.now() - 3*86400000).toISOString(), completedSets:[] }
];`);
E("renderYouTab();");
check($$("#you-page-0 .you-line-path").length === 1, "weekly chart renders a line after logging");
check($$("#you-page-0 .you-dot").length === E("youWeeksData('3m').bars.length"), "every week (including empty ones) is a point on the line");
check(!$("#you-page-0 .vis-empty"), "empty state gone once sessions exist");

// Real math, straight from the engine: push-ups 3×8×(0 + 50×0.67) = 804 kg per
// session (the 20 s ring L-sit is a timed hold and must not count); weighted
// ring dips 3×8×(10 + 50×0.90) = 1320 kg. Both sessions sum to 2124 kg.
const sessVol = E("[state.sessions[0], state.sessions[1]].map(s => sessionVolumeKg(s))");
check(Math.abs(sessVol[0] - 804) < 0.001, "push-up session = 3 sets × 8 reps × (0 + 50 kg × 0.67) = 804 kg, timed hold ignored");
check(Math.abs(sessVol[1] - 1320) < 0.001, "weighted ring-dip session = 3 sets × 8 reps × (10 kg + 50 kg × 0.90) = 1320 kg");
check(Math.abs(E("youVolumeData('3m').total") - 2124) < 0.001, "weekly volume sums the logged history to 2124 kg");
check($$("#you-page-1 .you-line-path").length === 1, "volume chart renders a real line from logged history");
check($$("#you-page-1 .you-dot").length === E("youVolumeData('3m').bars.length"), "each week has a dot on the volume line");
check(!$("#you-page-1 .vis-empty"), "volume empty state gone once volume is countable");
check($("#you-page-1").textContent.indexOf("Add your current body weight in Settings") === -1, "body-weight nudge gone once a weight is set");

// Pager dots switch between the two views
click($$(".you-dot")[1]);
check($$(".you-dot")[1].classList.contains("active"), "second dot active after clicking");
check($$(".you-dot")[0].classList.contains("active") === false, "first dot no longer active");

// Workouts chart expands with its own period selector
click($("#you-page-0 .you-chart"));
check(Boolean($("#you-modal-host")), "clicking the workouts chart opens the expanded screen");
check($("#you-modal-host h2").textContent === "Workouts", "expanded screen titled Workouts");
check($$("#you-modal-host [data-you-modal-period]").length === 5, "expanded screen offers 5 period options");
check($$("#you-modal-host .you-line").length === 1, "expanded screen shows the weekly line chart");
click($$("#you-modal-host [data-you-modal-period]")[2]); // 6M
check(E("youPeriod") === "6m", "workouts period updated to 6M inside the expanded screen");
check($("#you-modal-host [data-you-modal-period].active").textContent === "6M", "6M pill active in the expanded screen");
click($("#you-modal-host [data-you-back]"));
check(!$("#you-modal-host"), "workouts expanded screen closes via back button");

// Volume chart expands with its own period selector
click($("#you-page-1 .you-chart"));
check(Boolean($("#you-modal-host")), "clicking the volume chart opens the expanded screen");
check($("#you-modal-host h2").textContent === "Total volume", "expanded screen titled Total volume");
check($$("#you-modal-host [data-you-modal-period]").length === 5, "volume expanded screen offers 5 period options");
check($$("#you-modal-host .you-line").length === 1, "expanded screen shows the volume line chart");
check($("#you-modal-host").textContent.indexOf("Placeholder data") === -1, "expanded volume screen is not labelled as placeholder");
click($$("#you-modal-host [data-you-modal-period]")[3]); // 1Y
check(E("youVolPeriod") === "1y", "volume period updated to 1Y inside the expanded screen");
check($("#you-modal-host [data-you-modal-period].active").textContent === "1Y", "1Y pill active in the volume expanded screen");
click($("#you-modal-host [data-you-back]"));
check(!$("#you-modal-host"), "volume expanded screen closes via back button");

// Clicking outside the expanded box closes it; clicking inside keeps it open
click($("#you-page-0 .you-chart"));
check(Boolean($("#you-modal-host")), "expanded screen reopened for backdrop test");
click($("#you-modal-host .you-modal-shell h2"));
check(Boolean($("#you-modal-host")), "clicking inside the box keeps the expanded screen open");
click($("#you-modal-host .you-modal")); // backdrop, outside the shell
check(!$("#you-modal-host"), "clicking outside the box closes the expanded screen");

// The collapsed charts still render (no selector, but they use the chosen period)
check($$("#you-page-0 .you-line").length > 0, "collapsed workouts line chart still rendered");
check($$("#you-page-1 .you-line").length > 0, "collapsed volume line chart still rendered");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
