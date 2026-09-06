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

// You overview shows Recovery page
E("state.sessions = []; renderYouTab();");
clickTab("you");
check($$("#you-carousel .you-page").length === 3, "carousel has three pages (workouts, volume, recovery)");
check($$(".you-dot").length === 3, "three pager dots");
check($("#you-page-2") && $("#you-page-2").textContent.indexOf("Recovery") !== -1, "page 3 titled Recovery");
check($$("#you-page-2 [data-rec-muscle]").length === 12, "12 per-muscle recovery rows rendered");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
