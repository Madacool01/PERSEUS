/* Exercise the "zone discipline" features for EVERY session type:
   - a weight-capable exercise drifting past that type's zone -> ADD-LOAD suggestion
   - a weight-incapable (bodyweight) exercise drifting past the zone -> HARDER-PROGRESSION suggestion
   - accepting the progression swap replaces the exercise in the day's plan. */
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
const E = expr => window.eval(expr);
const G = name => window.eval(name);

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };
const section = t => console.log("\n== " + t + " ==");

(async () => {
  // Every session type routes the zone-discipline behavior when reps pass the zone top.
  // Reps = 30 clears every zone's top (strength/hypertrophy/hybrid/endurance).
  const zones = { strength: [3, 6], hypertrophy: [6, 12], hybrid: [4, 10], endurance: [15, 25] };
  for (const [type, [zmn, zmx]] of Object.entries(zones)) {
    section("Zone discipline on a " + type + " day (zone " + zmn + "-" + zmx + ")");
    E("state.profile.lastSessionType = '" + type + "'");
    const dayId = "day-" + type;
    E("state.days.push({ id:'" + dayId + "', name:'" + type.toUpperCase() + "', exercises:[ { exId:'ex-3', targetSets:3, reps:" + zmx + ", time:30, weight:20 }, { exId:'ex-1', targetSets:3, reps:" + zmx + ", time:30, weight:0 } ] })");
    E("startLog('" + dayId + "')");
    const ctx = G("logCtx");
    ["ex-3", "ex-1"].forEach(exId => {
      const ent = ctx.entries[exId];
      ent.sets.forEach(s => { s.reps = 30; s.rating = 1; }); // past every zone's top (endurance top is 25)
    });
    ctx.entries["ex-3"].sets.forEach(s => { s.weight = 20; }); // real load on Ring Dip
    ctx.recovery = { recovery: 3, sleep: 4, energy: 3, soreness: 0, pain: "", note: "" };
    E("saveLogSession()");
    await new Promise(r => setTimeout(r, 150)); // let produceCoach settle

    const pend = G("state.pending")[G("state.pending.length") - 1];
    const suggs = (pend && pend.suggestions) || [];
    check(suggs.length > 0, "[" + type + "] suggestions generated (" + suggs.length + ")");

    const wt = suggs.find(s => s.exId === "ex-3" && s.field === "weight");
    check(Boolean(wt), "[" + type + "] weight-capable drifted exercise gets an ADD-LOAD suggestion");
    if (wt) check(wt.to > wt.from, "[" + type + "] weight suggestion raises load (" + wt.from + " → " + wt.to + ")");

    const pro = suggs.find(s => s.exId === "ex-1" && s.field === "progression");
    check(Boolean(pro), "[" + type + "] bodyweight drifted exercise gets a HARDER-PROGRESSION suggestion");
    if (pro) {
      // next natural progression for Push-Up is the immediate harder variation in its chain
      check(pro.to === "ex-2", "[" + type + "] progression targets Diamond Push-Up (ex-2), got " + pro.to);
      check(pro.fromName === "Push-Up" && pro.toName === "Diamond Push-Up", "[" + type + "] card shows Push-Up → Diamond Push-Up");
    }
  }

  section("Accept the progression swap");
  E("state.profile.lastSessionType = 'strength'");
  E("state.days.push({ id:'day-s', name:'Strength', exercises:[ { exId:'ex-1', targetSets:3, reps:6, time:30, weight:0 } ] })");
  E("startLog('day-s')");
  const ctxs = G("logCtx");
  ctxs.entries["ex-1"].sets.forEach(s => { s.reps = 8; s.rating = 1; });
  ctxs.recovery = { recovery: 3, sleep: 4, energy: 3, soreness: 0, pain: "", note: "" };
  E("saveLogSession()");
  await new Promise(r => setTimeout(r, 150));
  const pend = G("state.pending")[G("state.pending.length") - 1];
  const pro = (pend && pend.suggestions || []).find(s => s.exId === "ex-1" && s.field === "progression");
  const day = E("getDay('day-s')");
  check(Boolean(day.exercises.find(x => x.exId === "ex-1")), "Push-Up present before accepting");
  if (pro) {
    E("recAct({recid:'" + pend.id + "', ai:'ex-1', act:'keep'},'')");
    check(Boolean(E("getDay('day-s').exercises.find(x=>x.exId==='ex-2')")), "Push-Up swapped for Diamond Push-Up in the plan");
    check(E("getDay('day-s').exercises.some(x=>x.exId==='ex-1')") === false, "ex-1 no longer in the day");
  }

  section("A brand-new custom exercise auto-resolves its harder progression");
  // A new exercise added without any manual chain wiring should still be recognized
  // as a member of a known movement and get its harder variations auto-resolved.
  const before = G("state.exercises").length;
  E("state.exercises.push({ id:'ex-custom', name:'Weighted Push-Up', mode:'reps', equipment:['dumbbell'], weightAvailable:true, defaultSets:3, defaultReps:8, defaultTime:30, defaultWeight:10, notes:'' })");
  E("resolveProgressions(state.exercises)");
  const cust = G("state.exercises").find(e => e.id === "ex-custom");
  check(G("state.exercises").length === before + 1, "custom exercise added");
  // The chain above Push-Up/near it is push-up; here 'Weighted Push-Up' isn't a
  // member, so it falls back to the other members of the push-up chain it maps to.
  check(cust.progressions && cust.progressions.length > 0, "custom exercise auto-got a progression chain (" + (cust.progressions||[]).length + ")");
  // And an unknown movement with no chain maps to empty without error.
  E("state.exercises.push({ id:'ex-mystery', name:'Quantum Lunges', mode:'reps', equipment:['bodyweight'], weightAvailable:false, defaultSets:3, defaultReps:10, defaultTime:30, defaultWeight:0, notes:'' })");
  E("resolveProgressions(state.exercises)");
  const mys = G("state.exercises").find(e => e.id === "ex-mystery");
  check(Array.isArray(mys.progressions) && mys.progressions.length === 0, "unknown movement gets an empty chain (no crash)");

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();