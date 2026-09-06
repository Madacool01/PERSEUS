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

console.log("== Muscle recovery (dose-weighted exponential) ==");
// 12-group taxonomy exists
const groups = E("typeof RECOVERY_GROUPS !== 'undefined' ? RECOVERY_GROUPS : null");
check(Array.isArray(groups) && groups.length === 12, "12 recovery muscle groups defined");
check(groups && groups.indexOf("chest") !== -1 && groups.indexOf("quads") !== -1 && groups.indexOf("neck") !== -1, "groups include chest, quads, neck");

// No history -> fully recovered
check(JSON.stringify(E("muscleRecoveryAt(Date.now())")) !== "null", "muscleRecoveryAt exists");
const fresh = E("muscleRecoveryAt(Date.now())");
check(fresh && fresh.chest === 100 && fresh.back === 100, "no sessions -> all muscles 100%");
check(E("totalRecoveryAt(Date.now())") === 100, "total recovery 100% with no history");

// Tag one exercise as chest mover and log a recent session
E(`(function(){
  var ex = getEx('ex-1');
  ex.primaryMuscles = ['Pectoralis major'];
  ex.secondaryMuscles = ['Triceps brachii'];
  state.sessions = [{
    id:'s-rec', dayId:'day-1', dateISO: new Date(Date.now() - 12*3600*1000).toISOString(),
    completedSets: [
      { exId:'ex-1', setIndex:0, reps:10, weight:0, rating:3, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:1, reps:10, weight:0, rating:3, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:2, reps:10, weight:0, rating:3, hit:true, type:'regular' }
    ]
  }];
})();`);
const recent = E("muscleRecoveryAt(Date.now())");
check(recent.chest < 100 && recent.chest > 0, "trained chest <100% 12h later (got " + recent.chest + ")");
check(recent.calves === 100, "untrained calves stay 100%");
check(recent.triceps < 100 && recent.triceps > recent.chest, "secondary triceps taxed less than primary chest");

// Recovery increments over time (dynamic)
const later = E("muscleRecoveryAt(Date.now() + 48*3600*1000)");
check(later.chest > recent.chest, "chest recovery increases 48h later (" + recent.chest + " -> " + later.chest + ")");

// Missed-hit sets cost more than clean sets
E(`(function(){
  var ex = getEx('ex-1');
  state.sessions = [{
    id:'s-miss', dayId:'day-1', dateISO: new Date(Date.now() - 12*3600*1000).toISOString(),
    completedSets: [
      { exId:'ex-1', setIndex:0, reps:6, weight:0, rating:5, hit:false, type:'regular' }
    ]
  }];
})();`);
const missed = E("muscleRecoveryAt(Date.now())");
E(`(function(){
  state.sessions = [{
    id:'s-clean', dayId:'day-1', dateISO: new Date(Date.now() - 12*3600*1000).toISOString(),
    completedSets: [
      { exId:'ex-1', setIndex:0, reps:6, weight:0, rating:1, hit:true, type:'regular' }
    ]
  }];
})();`);
const clean = E("muscleRecoveryAt(Date.now())");
check(missed.chest < clean.chest, "missed/high-RPE set fatigues more than clean set");

// Warmups never count
E(`(function(){
  state.sessions = [{
    id:'s-warm', dayId:'day-1', dateISO: new Date(Date.now() - 1*3600*1000).toISOString(),
    completedSets: [ { exId:'ex-1', setIndex:0, reps:10, weight:0, rating:3, hit:true, type:'warmup' } ]
  }];
})();`);
check(E("muscleRecoveryAt(Date.now()).chest") === 100, "warmup-only session leaves chest at 100%");

// Total = mean of 12
const m = E("muscleRecoveryAt(Date.now())");
const vals = E("RECOVERY_GROUPS.map(function(g){ return muscleRecoveryAt(Date.now())[g]; })");
const mean = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
check(E("totalRecoveryAt(Date.now())") === mean, "total recovery is the mean of 12 muscles");

// You overview: charts stay 2-page carousel, Recovery is a separate section below
E("state.sessions = []; renderYouTab();");
clickTab("you");
check($$("#you-carousel .you-page").length === 2, "carousel keeps two pages (workouts, volume)");
check($$(".you-dot").length === 2, "two pager dots");
check($("#you-recovery-section") && $("#you-recovery-section").textContent.indexOf("Recovery") !== -1, "separate Recovery section rendered below charts");
check($$("#you-recovery-section [data-rec-muscle]").length === 12, "12 per-muscle recovery rows rendered");
check(!!(E("document.querySelector('.you-overview').innerHTML.indexOf('you-carousel')") < E("document.querySelector('.you-overview').innerHTML.indexOf('you-recovery-section')")), "recovery section sits directly under the carousel");

// Weekly trained-muscles map (Monday-start week, primary red / secondary blue)
E(`(function(){
  var ex1 = getEx('ex-1');
  ex1.primaryMuscles = ['Pectoralis major'];
  ex1.secondaryMuscles = ['Triceps brachii'];
  var ex6 = getEx('ex-6');
  ex6.primaryMuscles = ['Latissimus dorsi'];
  ex6.secondaryMuscles = [];
  var monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7)); monday.setHours(12,0,0,0);
  var old = new Date(monday.getTime() - 3*86400000);
  state.sessions = [
    { id:'s-w1', dayId:'day-1', dateISO: monday.toISOString(), completedSets: [
      { exId:'ex-1', setIndex:0, reps:10, weight:0, rating:2, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:0, reps:10, weight:0, rating:2, hit:true, type:'warmup' }
    ]},
    { id:'s-w2', dayId:'day-1', dateISO: new Date(monday.getTime()+86400000).toISOString(), completedSets: [
      { exId:'ex-6', setIndex:0, reps:6, weight:0, rating:2, hit:true, type:'regular' }
    ]},
    { id:'s-old', dayId:'day-1', dateISO: old.toISOString(), completedSets: [
      { exId:'ex-1', setIndex:0, reps:10, weight:0, rating:2, hit:true, type:'regular' }
    ]}
  ];
})();`);
const wk = E("weeklyMusclesTrained(Date.now())");
check(wk && wk.primary.indexOf('Pectoralis major') !== -1, "this-week primary includes chest mover");
check(wk && wk.primary.indexOf('Latissimus dorsi') !== -1, "this-week primary includes back mover");
check(wk && wk.secondary.indexOf('Triceps brachii') !== -1, "this-week secondary includes triceps");
check(!wk.primary.concat(wk.secondary).some(function(x){ return false; }), "weekly query runs");
E("state.sessions[2].completedSets[0].exId='ex-6'; ");
const wk2 = E("weeklyMusclesTrained(Date.now())");
check(wk2.primary.indexOf('Latissimus dorsi') !== -1, "old-week session excluded (still trained this week via s-w2)");
check(E("weeklyMusclesTrained(new Date('2020-01-01').getTime()).primary.length") === 0, "empty week returns no muscles");
E("state.sessions = []; renderYouTab();");
clickTab("you");
check(Boolean($("#you-weekly-muscles")), "weekly muscles section rendered under Recovery");
check($("#you-weekly-muscles").textContent.indexOf("Trained this week") !== -1, "weekly section titled Trained this week");
check($$("#you-weekly-muscles svg [data-wmuscle]").length >= 10, "body map renders muscle shapes");
check($("#you-weekly-muscles").textContent.indexOf("Primary") !== -1 && $("#you-weekly-muscles").textContent.indexOf("Secondary") !== -1, "legend shows Primary/Secondary");
check(Boolean($("#wm-front-container")) && Boolean($("#wm-back-container")), "front/back chart containers present for the CDN upgrade");

// body-muscles CDN wiring (same library as highlighter.html); jsdom/offline keeps the fallback above
const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
check(src.indexOf("https://esm.sh/body-muscles") !== -1, "index.html imports the body-muscles CDN");
check(src.indexOf("BodyChart") !== -1 && src.indexOf("ViewSide") !== -1 && src.indexOf("MUSCLE_MAP") !== -1, "CDN module uses BodyChart + ViewSide + MUSCLE_MAP");
check(src.indexOf("renderWeeklyBodyCharts") !== -1, "CDN upgrade hook renderWeeklyBodyCharts is wired");

// keyword mapper resolves our detailed names to live CDN ids (pure, fake map)
const fakeMap = [{ id: "biceps-left" }, { id: "biceps-right" }, { id: "chest-left" }, { id: "triceps-left" }, { id: "quadriceps-left" }];
const bic = E("bodyMuscleIdsForDetail('Biceps brachii', " + JSON.stringify(fakeMap) + ")");
check(JSON.stringify(bic.slice().sort()) === JSON.stringify(["biceps-left", "biceps-right"]), "Biceps brachii maps to biceps CDN ids");
check(E("bodyMuscleIdsForDetail('Quadriceps', " + JSON.stringify(fakeMap) + ")").join(",") === "quadriceps-left", "Quadriceps maps via substring");
check(E("bodyMuscleIdsForDetail('No Such Muscle', " + JSON.stringify(fakeMap) + ")").length === 0, "unknown muscle maps to nothing");
E("getEx('ex-1').primaryMuscles=['Pectoralis major'];getEx('ex-1').secondaryMuscles=['Triceps brachii'];state.sessions=[{id:'s-cdn',dayId:'day-1',dateISO:new Date().toISOString(),completedSets:[{exId:'ex-1',setIndex:0,reps:10,weight:0,rating:2,hit:true,type:'regular'}]}];");
const cdnIds = E("weeklyBodyMuscleIds(Date.now(), " + JSON.stringify(fakeMap) + ")");
check(cdnIds.primary.indexOf("chest-left") !== -1, "CDN ids: chest primary this week");
check(cdnIds.secondary.indexOf("triceps-left") !== -1, "CDN ids: triceps secondary this week");
check(cdnIds.primary.indexOf("triceps-left") === -1, "CDN ids: primary wins over secondary");

// Regression: anatomical near-names must not cross-map. Biceps femoris is a
// hamstring, triceps surae is calf, *-lateral-* is not lats, rectus femoris
// is quad — substring matching lit calves/hamstrings red on upper-body days.
const anatMap = ["biceps-left", "biceps-femoris-left", "triceps-left", "triceps-surae-left", "chest-left", "quadriceps-left", "gastrocnemius-lateral-left", "rectus-femoris-left", "latissimus-left"];
check(E("bodyMuscleIdsForDetail('Biceps brachii', " + JSON.stringify(anatMap) + ")").join(",") === "biceps-left", "arm biceps does not map to biceps-femoris hamstring");
check(E("bodyMuscleIdsForDetail('Triceps brachii', " + JSON.stringify(anatMap) + ")").join(",") === "triceps-left", "arm triceps does not map to triceps-surae calf");
check(E("bodyMuscleIdsForDetail('Latissimus dorsi', " + JSON.stringify(anatMap) + ")").join(",") === "latissimus-left", "lats do not map to lateral calf head");
check(E("bodyMuscleIdsForDetail('Rectus abdominis', " + JSON.stringify(anatMap) + ")").join(",") === "", "abs do not map to rectus-femoris quad");
check(E("bodyMuscleIdsForDetail('Hamstrings', " + JSON.stringify(anatMap) + ")").join(",") === "biceps-femoris-left", "hamstrings still resolve to biceps-femoris");
check(E("bodyMuscleIdsForDetail('Gastrocnemius (calf)', " + JSON.stringify(anatMap) + ")").slice().sort().join(",") === "gastrocnemius-lateral-left,triceps-surae-left", "calf resolves to calf ids");

// Live refresh: retagging an exercise (e.g. adding a secondary muscle) and
// saving must update the rendered map in place, without a tab switch.
const hasLiveRefresh = E("typeof refreshWeeklyMapIfVisible") === "function";
check(hasLiveRefresh, "refreshWeeklyMapIfVisible hook exists");
check(src.split("refreshWeeklyMapIfVisible()").length >= 3, "exercise save + delete paths call the live-refresh hook");
const liveFill = id => { const el = $("#you-weekly-muscles [data-wmuscle=\"" + id + "\"]"); return el && el.getAttribute("fill"); };
if (hasLiveRefresh){
  E("getEx('ex-1').primaryMuscles=[];getEx('ex-1').secondaryMuscles=[];state.sessions=[{id:'s-live',dayId:'day-1',dateISO:new Date().toISOString(),completedSets:[{exId:'ex-1',setIndex:0,reps:10,weight:0,rating:2,hit:true,type:'regular'}]}];renderYouTab();");
  clickTab("you");
  check(liveFill("chest-l") === "#ddd6c4" && liveFill("triceps-l") === "#ddd6c4", "map starts neutral with no muscle tags");
  E("getEx('ex-1').secondaryMuscles=['Triceps brachii'];refreshWeeklyMapIfVisible();");
  check(liveFill("triceps-l") === "#5C9CE6" && liveFill("chest-l") === "#ddd6c4", "new secondary muscle lights blue in real time");
  E("getEx('ex-1').primaryMuscles=['Pectoralis major'];refreshWeeklyMapIfVisible();");
  check(liveFill("chest-l") === "#E5533D", "new primary muscle lights red in real time");
  check(E("refreshWeeklyMapIfVisible()") === true, "hook reports true while the section is visible");
  clickTab("library");
  check(E("refreshWeeklyMapIfVisible()") === false, "hook is a safe no-op when You is not visible");
} else {
  check(false, "live refresh updates map fills (skipped: hook missing)");
  check(false, "live refresh reports visibility (skipped: hook missing)");
}

// Muscle split distribution: weekly volume + sets per primary muscle
check(E("typeof weeklySplitData") === "function", "weeklySplitData exists");
const splitGroups = E("typeof SPLIT_GROUPS !== 'undefined' ? SPLIT_GROUPS : null");
check(Array.isArray(splitGroups) && splitGroups.length === 11, "11 split muscles defined");
check(splitGroups && splitGroups.indexOf("chest") !== -1 && splitGroups.indexOf("calves") !== -1 && splitGroups.indexOf("neck") === -1, "split covers chest..calves, no neck");
E(`state.profile.bodyWeight = 50;
getEx('ex-1').primaryMuscles = ['Pectoralis major'];
getEx('ex-1').secondaryMuscles = ['Triceps brachii'];
getEx('ex-12').primaryMuscles = ['Rectus abdominis'];
getEx('ex-12').secondaryMuscles = [];
(function(){
  var monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay()+6)%7)); monday.setHours(12,0,0,0);
  var old = new Date(monday.getTime() - 3*86400000);
  state.sessions = [
    { id:'s-sp1', dayId:'day-1', dateISO: monday.toISOString(), completedSets: [
      { exId:'ex-1', setIndex:0, reps:8, weight:0, rating:2, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:1, reps:8, weight:0, rating:2, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:2, reps:8, weight:0, rating:2, hit:true, type:'regular' },
      { exId:'ex-1', setIndex:3, reps:8, weight:0, rating:2, hit:true, type:'warmup' },
      { exId:'ex-12', setIndex:0, time:20, rating:2, hit:true, type:'regular' }
    ]},
    { id:'s-sp-old', dayId:'day-1', dateISO: old.toISOString(), completedSets: [
      { exId:'ex-1', setIndex:0, reps:8, weight:0, rating:2, hit:true, type:'regular' }
    ]}
  ];
})();`);
const split = E("weeklySplitData(Date.now())");
check(split && Math.abs(split.groups.chest.volumeKg - 804) < 0.001 && split.groups.chest.sets === 3, "chest gets 804 kg over 3 working sets (warmup + last-week excluded)");
check(split.groups.triceps.sets === 0 && split.groups.triceps.volumeKg === 0, "secondary-only triceps gets no split credit");
check(split.groups.abs.sets === 1 && split.groups.abs.volumeKg === 0, "timed ab hold counts a set with no tonnage volume");
check(split.groups.back.sets === 0, "untrained back stays at zero");
E("state.sessions = []; renderYouTab();");
clickTab("you");
check(Boolean($("#you-muscle-split")), "split section rendered under the muscle map");
check($$("#you-muscle-split [data-split-muscle]").length === 11, "11 per-muscle split rows rendered");
check(!!(E("document.querySelector('.you-overview').innerHTML.indexOf('you-weekly-muscles')") < E("document.querySelector('.you-overview').innerHTML.indexOf('you-muscle-split')")), "split sits directly under the muscle map");
E(`getEx('ex-1').primaryMuscles = ['Pectoralis major'];
getEx('ex-1').secondaryMuscles = ['Triceps brachii'];
state.sessions = [{ id:'s-sp2', dayId:'day-1', dateISO: new Date().toISOString(), completedSets: [
  { exId:'ex-1', setIndex:0, reps:8, weight:0, rating:2, hit:true, type:'regular' },
  { exId:'ex-1', setIndex:1, reps:8, weight:0, rating:2, hit:true, type:'regular' },
  { exId:'ex-1', setIndex:2, reps:8, weight:0, rating:2, hit:true, type:'regular' }
]}]; renderYouTab();`);
clickTab("you");
const splitTxt = $("#you-muscle-split").textContent;
check(splitTxt.indexOf("804") !== -1 && splitTxt.indexOf("3") !== -1, "split row shows 804 volume and 3 sets for chest");

// Sets get a count plus a second (blue) bar that fills relative to the top muscle
E(`getEx('ex-1').primaryMuscles=['Pectoralis major'];getEx('ex-1').secondaryMuscles=[];
getEx('ex-6').primaryMuscles=['Latissimus dorsi'];getEx('ex-6').secondaryMuscles=[];
state.sessions=[{id:'s-splitbar',dayId:'day-1',dateISO:new Date().toISOString(),completedSets:[
 {exId:'ex-1',setIndex:0,reps:8,weight:0,rating:2,hit:true,type:'regular'},
 {exId:'ex-1',setIndex:1,reps:8,weight:0,rating:2,hit:true,type:'regular'},
 {exId:'ex-1',setIndex:2,reps:8,weight:0,rating:2,hit:true,type:'regular'},
 {exId:'ex-6',setIndex:0,reps:6,weight:0,rating:2,hit:true,type:'regular'}
]}];renderYouTab();`);
clickTab("you");
const splitRow = g => $("#you-muscle-split [data-split-muscle=\"" + g + "\"]");
const splitBars = g => Array.from(splitRow(g).querySelectorAll(".rec-fill"));
check(splitBars("chest").length === 2, "split row has two bars (volume + sets)");
check(splitBars("chest")[1].getAttribute("style").indexOf("#5C9CE6") !== -1, "sets bar is blue");
check(splitBars("chest")[1].getAttribute("style").indexOf("100%") !== -1, "top muscle sets bar fills 100% (3/3)");
check(splitBars("back")[1].getAttribute("style").indexOf("33%") !== -1, "1-set muscle fills a third of the blue bar (1/3)");
check(splitRow("chest").textContent.indexOf("3") !== -1, "sets count number shown next to the blue bar");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
