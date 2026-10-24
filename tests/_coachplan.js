/* Accepted coach changes must land in the shared exercise plan, so the routine
   list, routine editor, edit form, and Log tab all show the new prescription. */
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
const $$ = s => Array.from(W.document.querySelectorAll(s));
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
};

// Give Ring Dip (weighted) the same explicit per-set plan in two routines.
E("state.days[0].exercises.find(x=>x.exId==='ex-3').setReps = [8,8,8]");
E("state.days[0].exercises.find(x=>x.exId==='ex-3').setWeights = [10,10,10]");
E("state.days[0].exercises.find(x=>x.exId==='ex-3').setTypes = ['regular','regular','regular']");
E("state.days[0].exercises.find(x=>x.exId==='ex-3').weight = 10");
E("state.days[1].exercises.push({ exId:'ex-3', targetSets:3, reps:8, time:30, weight:10, setReps:[8,8,8], setWeights:[10,10,10], setTypes:['regular','regular','regular'], modifiedAt:1 })");
E("state.exercises.find(x=>x.id==='ex-3').plan = null");
E("syncExercisePlan('ex-3', getDay('day-1').exercises.find(x=>x.exId==='ex-3'))");

const sessionId = "sess-coachplan";
E("state.sessions.push({ id:'" + sessionId + "', dayId:'day-1', dateISO:new Date().toISOString(), completedSets:[], finalized:true })");
E("state.pending.push({ id:'pend-weight', sessionId:'" + sessionId + "', suggestions:[{ exId:'ex-3', field:'weight', from:10, to:12.5, reason:'Add load', kept:null }] })");
E("recAct({ recid:'pend-weight', ai:'ex-3', act:'keep', field:'weight' }, '')");

const d1w = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3')");
const d2w = E("getDay('day-2').exercises.find(x=>x.exId==='ex-3')");
const planW = E("getEx('ex-3').plan");
check(d1w.weight === 12.5, "accepted weight updates the session routine's working weight");
check(JSON.stringify(d1w.setWeights) === "[12.5,12.5,12.5]", "accepted weight updates every per-set weight (got " + d1w.setWeights + ")");
check(d2w.weight === 12.5 && JSON.stringify(d2w.setWeights) === "[12.5,12.5,12.5]", "accepted weight reaches the other routine");
check(planW.weight === 12.5 && JSON.stringify(planW.setWeights) === "[12.5,12.5,12.5]", "accepted weight updates the canonical shared plan");

E("state.pending.push({ id:'pend-reps', sessionId:'" + sessionId + "', suggestions:[{ exId:'ex-3', field:'reps', from:8, to:10, reason:'Add reps', kept:null }] })");
E("recAct({ recid:'pend-reps', ai:'ex-3', act:'keep', field:'reps' }, '')");
const d1r = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3')");
const d2r = E("getDay('day-2').exercises.find(x=>x.exId==='ex-3')");
check(d1r.reps === 10 && JSON.stringify(d1r.setReps) === "[10,10,10]", "accepted reps update every set in the session routine");
check(d2r.reps === 10 && JSON.stringify(d2r.setReps) === "[10,10,10]", "accepted reps reach the other routine");
check(d2r.weight === 12.5 && JSON.stringify(d2r.setWeights) === "[12.5,12.5,12.5]", "accepted reps do not disturb the updated weights");

E("currentView='workouts'; planMode='edit'; planEditId='day-1'; render()");
const rowTxt = $("#view-workouts .ex-row") ? $("#view-workouts .ex-row").textContent.replace(/\s+/g, " ").trim() : "";
check(rowTxt.indexOf("10×12.5") !== -1, "routine editor row shows the coach's reps and weight (" + rowTxt + ")");

E("openAddEx('day-1','ex-3')");
const modalReps = $$("#add-per-set .set-target-in").map(x => x.value);
const modalWeights = $$("#add-per-set .set-weight-in").map(x => x.value);
check(modalReps.join(",") === "10,10,10", "edit form shows the coach's reps (" + modalReps.join(",") + ")");
check(modalWeights.join(",") === "12.5,12.5,12.5", "edit form shows the coach's weights (" + modalWeights.join(",") + ")");

E("startLog('day-1')");
const logWeights = E("logCtx.entries['ex-3'].sets.map(s=>s.weight)");
check(JSON.stringify(logWeights) === "[12.5,12.5,12.5]", "Log tab pre-fills the coach's weights (" + logWeights.join(",") + ")");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
