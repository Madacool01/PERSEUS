/* Dev test for supersets in index.html's routine editor + logger (jsdom,
   same harness style as the other _*.js tests). Covers: the guided add flow,
   shared round count + equalization, unit reordering, round-by-round logging
   pulling each movement's own per-set plan, and clean per-exercise session
   records for history/analytics. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const errors = [];

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

const $ = s => window.document.querySelector(s);
const $$ = s => Array.from(window.document.querySelectorAll(s));
const E = x => window.eval(x);
const G = n => window.eval(n);
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const change = el => el.dispatchEvent(new window.Event("change", { bubbles: true }));

let pass = 0, fail = 0;
function check(c, m) {
  if (c) { pass++; console.log("  \u2713 " + m); }
  else { fail++; console.log("  \u2717 FAIL: " + m); }
}
function section(t) { console.log("\n== " + t + " =="); }

(async () => {
  section("Open the routine editor");
  window.switchView("workouts");
  click($("#view-workouts [data-edit-day]"));
  check(Boolean($("#view-workouts input[data-dayname]")), "day-1 editor open");
  const startIds = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(startIds === "ex-3,ex-5,ex-12,ex-4", "day-1 starts with 4 standalone exercises");

  section("Guided add-superset wizard");
  click($("#view-workouts [data-add-ss]"));
  check(Boolean($("#view-workouts #ss-sets")), "wizard card opened with a shared Rounds field");
  check($$("#view-workouts .ss-ex-sel").length === 2, "two member slots seeded");
  check($$("#view-workouts .ss-member").length === 2, "per-member target cards rendered");
  // two rounds, then pick Dumbbell Curl + Push-Up
  const setsIn = $("#view-workouts #ss-sets");
  setsIn.value = "2";
  change(setsIn);
  check($$("#view-workouts .ss-member .set-target").length === 4, "2 rounds x 2 members = 4 target inputs");
  const curl = E("state.exercises.find(x=>x.name==='Dumbbell Curl').id");
  const push = E("state.exercises.find(x=>x.name==='Push-Up').id");
  const sel0 = $("#view-workouts .ss-ex-sel[data-k='0']");
  sel0.value = curl; change(sel0);
  const sel1 = $("#view-workouts .ss-ex-sel[data-k='1']");
  sel1.value = push; change(sel1);
  check(E("getEx('" + curl + "').name") + "" !== "", "curl found in library");
  check($$("#view-workouts .ss-member").length === 2, "target cards follow the chosen exercises");
  // per-set targets + working weight straight from the wizard
  const w0 = $("#view-workouts .ss-weight-in[data-k='0']");
  check(Boolean(w0), "weight-capable member shows a working-weight field");
  if (w0) w0.value = "8";
  const t0s = $$("#view-workouts .ss-target-in[data-k='0']");
  t0s[0].value = "12"; t0s[1].value = "10";
  const t1s = $$("#view-workouts .ss-target-in[data-k='1']");
  t1s[0].value = "15"; t1s[1].value = "12";
  check($$("#view-workouts .ss-target-in[data-k='1']").length === 2, "second member ladder rendered");
  click($("#view-workouts #ss-ok"));

  const exIds = E("getDay('day-1').exercises.map(x=>x.exId)");
  check(exIds.join(",") === "ex-3,ex-5,ex-12,ex-4," + curl + "," + push,
    "members appended contiguously after the existing exercises");
  const grp = E("getDay('day-1').supersets[0]");
  check(Boolean(grp) && grp.exIds.join(",") === curl + "," + push, "one superset group links curl + push-up in round order");
  const deCurl = E("getDay('day-1').exercises.find(x=>x.exId==='" + curl + "')");
  const dePush = E("getDay('day-1').exercises.find(x=>x.exId==='" + push + "')");
  check(deCurl.targetSets === 2 && dePush.targetSets === 2, "members share the round count (2)");
  check(deCurl.setReps.join(",") === "12,10" && dePush.setReps.join(",") === "15,12",
    "per-set targets saved per movement (curl 12,10 · push-up 15,12)");
  check(deCurl.weight === 8, "curl working weight saved from the wizard");

  section("Editor renders the superset band");
  check(Boolean($("#view-workouts .super-band")), "routine shows a superset band");
  check($$("#view-workouts .super-band .ex-sub").length === 2, "band holds both member rows");
  check($$("#view-workouts .super-band .ex-sub").every(r => Boolean(r.querySelector(".grip")) === false),
    "member rows carry no own drag grip (band is the unit)");
  check($$("#view-workouts .ex-row").length === 5, "4 standalone rows + 1 band unit = 5 draggable units");
  check($("#view-workouts .day-head .pill.ss") && $("#view-workouts .day-head .pill.ss").textContent.indexOf("1 superset") === 0,
    "editor header shows the superset count pill");

  section("Equalize the round count from the band header");
  const bandIn = $("#view-workouts .super-sets-in");
  bandIn.value = "3"; change(bandIn);
  check(E("getDay('day-1').exercises.find(x=>x.exId==='" + curl + "').targetSets") === 3 &&
        E("getDay('day-1').exercises.find(x=>x.exId==='" + push + "').targetSets") === 3,
    "raising rounds to 3 updates every member");
  check(E("getDay('day-1').exercises.find(x=>x.exId==='" + curl + "').setReps.length") === 3,
    "curl ladder extended to 3 sets");
  check(E("getEx('" + curl + "').plan.targetSets") === 3, "shared plan propagated the new count");
  bandIn.value = "2"; change(bandIn);
  check(E("getDay('day-1').exercises.find(x=>x.exId==='" + curl + "').setReps.join(',')") === "12,10",
    "trimming back to 2 keeps the entered prefix (12,10)");

  section("Logging steps: superset expands into one step per round");
  const steps = E("logStepsForDay(getDay('day-1'))");
  check(steps.length === 6, "4 exercises + 2 rounds = 6 logging steps");
  check(steps[0].kind === "ex" && steps[4].kind === "round" && steps[4].r === 0 && steps[5].r === 1,
    "round steps come after the standalone exercises, in set order");
  check(E("logStepsForDay(getDay('day-2')).length") === 4, "a routine without supersets logs exercise by exercise");

  section("Round-by-round logging screens");
  window.switchView("log");
  window.startLog("day-1");
  check(G("logCtx.stepTotal") === 6, "session knows its 6 steps up front");
  G("logCtx.idx = 4"); E("render()");
  const cells = $$("#view-log .round-cell");
  check(cells.length === 2, "round 1 screen shows one panel per member");
  check(cells.every(c => c.dataset.set === "0"), "both panels are set 1 of this round");
  const title = $("#view-log .big-title").textContent;
  check(title.indexOf("Dumbbell Curl") !== -1 && title.indexOf("Push-Up") !== -1, "title names both movements");
  check($("#view-log .round-tags").textContent.indexOf("Round 1 of 2") !== -1, "round pill shows 1 of 2");
  const curlCell = cells.find(c => c.dataset.exid === curl);
  const pushCell = cells.find(c => c.dataset.exid === push);
  check(curlCell.querySelector(".set-plan").textContent.indexOf("12\u00d78") !== -1,
    "curl panel shows its own set-1 plan (12 reps x weight)");
  check(pushCell.querySelector(".set-plan").textContent.indexOf("15 reps") !== -1,
    "push-up panel shows its own set-1 plan (15 reps)");
  function fillCell(cell, reps, weight, rating) {
    const r = cell.querySelector(".s-reps"); if (r) r.value = String(reps);
    const w = cell.querySelector(".s-weight"); if (w) w.value = String(weight);
    r.dispatchEvent(new window.Event("input", { bubbles: true }));
    const range = cell.querySelector(".effort-range");
    range.value = String(rating);
    range.dispatchEvent(new window.Event("input", { bubbles: true }));
  }
  fillCell(curlCell, 12, 8, 3);
  fillCell(pushCell, 15, 0, 2.5);
  click($("#view-log #log-next"));
  const cells2 = $$("#view-log .round-cell");
  check(cells2.length === 2 && cells2.every(c => c.dataset.set === "1"),
    "next step brings up the SAME two exercises for set 2");
  check($("#view-log .round-tags").textContent.indexOf("Round 2 of 2") !== -1, "round pill shows 2 of 2");
  const curl2 = cells2.find(c => c.dataset.exid === curl);
  const push2 = cells2.find(c => c.dataset.exid === push);
  check(curl2.querySelector(".set-plan").textContent.indexOf("10\u00d78") !== -1,
    "set-2 curl plan pulled from the curl entry's second-set values (10)");
  check(push2.querySelector(".set-plan").textContent.indexOf("12 reps") !== -1,
    "set-2 push-up plan pulled from the push-up entry's second-set values (12)");
  fillCell(curl2, 10, 8, 2.5);
  fillCell(push2, 12, 0, 3);
  click($("#view-log #log-next"));
  check(Boolean($("#view-log #rec-finish")), "after the final round the session moves to recovery");

  section("Session save: per-exercise records, superset-safe");
  click($("#view-log #rec-finish"));
  await waitFor(() => G("state.sessions.length") === 1, "session saved");
  await waitFor(() => { const p = G("state.pending")[0]; return p && p.suggestions && p.suggestions.length > 0; }, "engine suggestions ready");
  const ses = G("state.sessions")[0];
  const curlSets = ses.completedSets.filter(c => c.exId === curl);
  const pushSets = ses.completedSets.filter(c => c.exId === push);
  check(curlSets.length === 2 && pushSets.length === 2, "each superset member recorded its own 2 sets");
  check(curlSets.map(c => c.setIndex).join(",") === "0,1", "curl sets indexed 0..1");
  check(curlSets.map(c => c.reps).join(",") === "12,10" && curlSets.every(c => c.weight === 8),
    "curl reps/weight came from the curl entries per set");
  check(pushSets.map(c => c.reps).join(",") === "15,12", "push-up reps came from the push-up entries per set");
  check(curlSets.every(c => c.hit === true) && pushSets.every(c => c.hit === true),
    "both movements' logged sets count as on-target");
  check(E("state.pending")[0].suggestions.some(s => s.exId === curl || s.exId === push),
    "coach evaluated the superset movements too");

  section("Whole-band reordering keeps the group intact");
  window.switchView("workouts");
  click($("#view-workouts [data-edit-day]"));
  check(Boolean($("#view-workouts .super-band")), "editor re-opened with the band still present");
  const before = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(G("reorderDayExercises")("day-1", 4, 0) === true, "band can be dragged as one unit");
  const after = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(after === curl + "," + push + ",ex-3,ex-5,ex-12,ex-4", "band moved to the front as a unit (got " + after + ")");
  check(E("getDay('day-1').supersets[0].exIds.join(',')") === curl + "," + push,
    "group membership survived the reorder");
  check(E("getDay('day-1').exercises.length") === 6, "no entries lost or duplicated");
  // put it back where it was for the unlink check
  G("reorderDayExercises")("day-1", 0, 4);
  check(E("getDay('day-1').exercises.map(x=>x.exId).join(',')") === before, "band moved back cleanly");

  section("Unlink turns the band back into separate exercises");
  click($("#view-workouts [data-unlink]"));
  check(E("getDay('day-1').supersets.length") === 0, "group dissolved on unlink");
  check(!$("#view-workouts .super-band") && $$("#view-workouts .ex-row").length === 6,
    "six standalone rows remain, no band");
  check(E("getDay('day-1').exercises.find(x=>x.exId==='" + curl + "').targetSets") === 2,
    "exercises keep their plans after unlinking");

  section("Runtime errors");
  check(errors.length === 0, "no window errors during flows" + (errors.length ? " -> " + errors.join(" | ") : ""));

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);

  function waitFor(fn, label) {
    return new Promise(res => {
      const iv = setInterval(() => { if (fn()) { clearInterval(iv); res(true); } }, 10);
      setTimeout(() => { clearInterval(iv); console.log("    \u2717 timeout waiting for " + label); res(false); }, 6000);
    });
  }
})();
