/* Cross-routine exercise sync: an exercise's prescription (set count, per-set
   reps/time, set types, weight) is shared across every routine that includes
   it. Adding the exercise to another routine pre-fills its current plan, and
   any change — a manual edit or an accepted coach suggestion — propagates to
   every routine. */
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
const { window } = dom;
const $ = s => window.document.querySelector(s);
const $$ = s => Array.from(window.document.querySelectorAll(s));
const E = expr => window.eval(expr);
const G = name => window.eval(name);

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };
const section = t => console.log("\n== " + t + " ==");
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const waitFor = (fn, label, ms) => new Promise(res => {
  const iv = setInterval(() => { if (fn()) { clearInterval(iv); console.log("    ✓ " + (label || "")); res(true); } }, 10);
  setTimeout(() => { clearInterval(iv); console.log("    ✗ timeout waiting for " + label); res(false); }, ms || 5000);
});

(async () => {
  section("Setup: Push-Up in Workout B becomes 2 sets x 5");
  E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').targetSets = 2");
  E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').reps = 5");
  E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').setReps = [5,5]");
  E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').setTypes = ['regular','regular']");
  E("state.days.push({ id:'day-3', name:'Workout C', type:'hypertrophy', exercises:[] })");
  E("planMode='edit'; planEditId='day-3'; render()");
  E("openAddEx('day-3')");
  const shared = G("exercisePlan('ex-1')");
  check(shared && shared.targetSets === 2 && shared.setReps[0] === 5 && shared.setReps[1] === 5,
    "exercisePlan derives 2 sets x 5 from the existing routine");
  check($("#add-ex-sets").value === "2", "add form pre-fills target sets = 2");
  const vals = $$("#add-per-set .set-target-in").map(i => i.value);
  check(vals.length === 2 && vals[0] === "5" && vals[1] === "5", "add form pre-fills per-set reps 5 / 5 (got " + vals.join(",") + ")");
  check(($("#add-sync-note").textContent || "").indexOf("Workout B") !== -1, "form explains the plan is shared with Workout B");

  section("Adding Push-Up to another routine keeps it in sync");
  click($("#add-ex-ok"));
  const d3pu = E("getDay('day-3').exercises.find(x=>x.exId==='ex-1')");
  const d2pu = E("getDay('day-2').exercises.find(x=>x.exId==='ex-1')");
  check(Boolean(d3pu), "Push-Up added to Workout C");
  check(d3pu.targetSets === 2 && d3pu.setReps[0] === 5 && d3pu.setReps[1] === 5, "Workout C Push-Up starts at 2 sets x 5");
  check(d2pu.targetSets === 2 && d2pu.setReps[0] === 5 && d2pu.setReps[1] === 5, "Workout B plan stays consistent (arrays materialized)");
  check(G("getEx('ex-1').plan") && G("getEx('ex-1').plan.targetSets") === 2, "canonical ex.plan stored on the exercise");

  section("Manual edit in one routine propagates to the other");
  E("openAddEx('day-3','ex-1')");
  check($("#add-ex-sets").value === "2", "edit form prefills from the shared plan");
  const inps = $$("#add-per-set .set-target-in");
  inps[0].value = "7";
  click($("#add-ex-ok"));
  check(E("getDay('day-3').exercises.find(x=>x.exId==='ex-1').setReps[0]") === 7, "Workout C set 1 now 7 reps");
  check(E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').setReps[0]") === 7, "Workout B set 1 also 7 reps (synced)");
  check(E("getDay('day-2').exercises.find(x=>x.exId==='ex-1').setReps[1]") === 5, "set 2 untouched at 5 in both routines");

  section("Dips example: accepted coach change syncs to the other routine");
  E("openAddEx('day-3')");
  // Ring Dip (ex-3) lives in Workout A (day-1) as 3 sets x 8 — pick it in the form.
  $("#add-ex-select").value = "ex-3";
  $("#add-ex-select").dispatchEvent(new window.Event("change", { bubbles: true }));
  check($("#add-ex-sets").value === "3", "dips add form pre-fills 3 sets from Workout A");
  click($("#add-ex-ok"));
  check(Boolean(E("getDay('day-3').exercises.find(x=>x.exId==='ex-3')")), "dips added to Workout C");
  // Friday session on Workout A: 10 reps everywhere, easy effort.
  E("startLog('day-1')");
  const ctx = G("logCtx");
  E("getDay('day-1').exercises").forEach(de => {
    const ent = ctx.entries[de.exId];
    if (!ent) return;
    ent.sets.forEach(s => { s.reps = 10; s.rating = 1; });
  });
  ctx.recovery = { recovery: 3, sleep: 4, energy: 3, soreness: 0, pain: "", note: "" };
  E("saveLogSession()");
  const pend = G("state.pending")[G("state.pending.length") - 1];
  await waitFor(() => (pend.suggestions && pend.suggestions.length > 0), "coach suggestions generated");
  const sug = (pend.suggestions || []).find(s => s.exId === "ex-3" && s.field === "reps" && s.to > s.from);
  check(Boolean(sug), "coach proposes raising dips reps");
  if (sug) {
    const before = E("getDay('day-3').exercises.find(x=>x.exId==='ex-3').setReps[0]");
    E("recAct({ recid:'" + pend.id + "', ai:'ex-3', act:'keep' }, '')");
    const d1 = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3')");
    const d3 = E("getDay('day-3').exercises.find(x=>x.exId==='ex-3')");
    check(d1.reps === sug.to && d3.reps === sug.to, "accepted bump (8 → " + sug.to + ") lands in Workout A and Workout C");
    check(JSON.stringify(d1.setReps) === JSON.stringify(d3.setReps), "per-set rep arrays identical across routines (" + d3.setReps.join("/") + ")");
    check(d3.setReps[0] > before, "other routine's dips plan actually changed (" + before + " → " + d3.setReps[0] + ")");
    const canon = G("getEx('ex-3').plan");
    check(canon && JSON.stringify(canon.setReps) === JSON.stringify(d3.setReps), "canonical ex.plan matches the synced entries");
  }

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();