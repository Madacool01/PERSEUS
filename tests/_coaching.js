/* Coaching a friend: athlete snapshots, the separate roster, plan apply and
 * the overlay UI. The point of the feature is isolation, so the checks care
 * most about what does NOT change: the coach's own state, the athlete's set
 * counts, and the API key.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/index.html",
  beforeParse(window) {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        return {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
        };
      },
    });
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.addEventListener("error", e => errors.push((e && e.message) || String(e)));
  },
});

const W = dom.window;
const $ = s => W.document.querySelector(s);
const $$ = s => Array.from(W.document.querySelectorAll(s));
const E = expr => W.eval(expr);
const txt = el => el ? el.textContent.replace(/\s+/g, " ").trim() : "";
const click = el => el.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  \u2713 " + msg); }
  else { fail++; console.log("  \u2717 FAIL: " + msg); }
}
function section(t) { console.log("\n== " + t + " =="); }

(async () => {

  section("Athlete snapshot");
  E("state.profile.name = 'Sam Athlete'");
  E("state.profile.apiKey = 'gsk_secret_should_not_travel'");
  E("const de0 = state.days[0].exercises.find(x => x.exId === 'ex-3'); if (de0){ de0.targetSets = 3; de0.reps = 8; de0.setReps = [8,8,8]; de0.weight = 10; de0.setWeights = [10,10,10]; de0.modifiedAt = 1000; syncExercisePlan('ex-3', de0); }");

  const payload = E("coachBuildAthletePayload()");
  check(payload && payload.kind === "coach-athlete", "payload is an athlete share");
  check(payload.a === "Sam Athlete", "payload carries the athlete's name");
  check(payload.u === E("weightUnit()"), "payload carries the athlete's unit");
  check(payload.r.length >= 1 && payload.r[0].ex.length >= 1, "payload carries routines with exercises");
  const ring = payload.r[0].ex.find(x => x.n === E("getEx('ex-3').name"));
  check(Boolean(ring) && ring.s === 3, "the prescription travels with its set count");
  check(Boolean(ring) && JSON.stringify(ring.sr) === "[8,8,8]", "per-set reps travel");
  check(JSON.stringify(payload).indexOf("gsk_secret") === -1, "the AI key never travels");

  section("Code round trip");
  const code = await E("sharePackPayload(coachBuildAthletePayload())");
  check(typeof code === "string" && code.indexOf("P") === 0, "the snapshot packs into a normal share code");
  const parsed = await E("(async () => coachParseAthlete(await shareUnpackCode(" + JSON.stringify(code) + ")))()");
  check(parsed.routines.length === payload.r.length, "decoding returns the same routines");
  check(parsed.routines[0].exercises[0].sets >= 1, "decoded exercises keep a set count");

  section("Roster storage stays out of state");
  const stateBefore = store["perseus-v1"];
  E("coachStoreAthlete(" + JSON.stringify(parsed) + ")");
  check(E("coachRoster().length") === 1, "the athlete lands in the roster");
  check(Boolean(store["perseus-coaching-v1"]), "the roster has its own storage key");
  check(store["perseus-v1"] === stateBefore, "storing an athlete does not rewrite the coach's own state");
  check(E("state.profile.name") === "Sam Athlete", "the coach's profile is untouched");

  section("Plan payload");
  const draft = { r: payload.r[0].n, note: "Add a rep", ex: { i0: { setReps: [10,10,10], weight: 12.5 } } };
  const planPayload = E("coachBuildPlanPayload(coachRoster()[0], " + JSON.stringify(draft) + ")");
  check(planPayload.kind === "coach-plan", "the plan is its own payload kind");
  check(planPayload.note === "Add a rep", "the coach's note travels");
  check(planPayload.r[0].ex[0].s === payload.r[0].ex[0].s, "the plan repeats the athlete's set count");
  check(JSON.stringify(planPayload.r[0].ex[0].sr) === "[10,10,10]", "the plan carries the coach's per-set reps");

  const plan = E("coachParsePlan(" + JSON.stringify(planPayload) + ")");
  check(plan.routines[0].exercises[0].setReps.join(",") === "10,10,10", "a plan code parses back");

  section("Applying a plan keeps sets fixed");
  const beforeSets = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3').targetSets");
  E("const rep = coachApplyPlanToState(" + JSON.stringify(plan) + ")");
  const applied = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3')");
  check(applied.targetSets === beforeSets && applied.targetSets === 3, "the set count is never changed by a plan");
  check(applied.reps === 10, "reps follow the coach's plan");
  check(applied.weight === 12.5, "load follows the coach's plan");
  check(JSON.stringify(applied.setWeights) === "[12.5,12.5,12.5]", "every set weight follows");
  check(E("getEx('ex-3').plan.setReps.join(',')") === "10,10,10", "the shared plan is written, so other routines agree");
  check(E("coachRoster()[0].routines[0].exercises.find(x=>x.name===getEx('ex-3').name).setReps.join(',')") === "8,8,8", "the athlete's stored snapshot is not rewritten by applying");

  section("Mismatches are refused, not guessed");
  const bad = { app: "perseus", kind: "coach-plan", v: 1, u: "kg", c: "Coach",
    r: [{ n: "No Such Routine", ex: [{ n: "Ring Dip", m: "reps", s: 3, sr: [5,5,5] }] }] };
  const badPlan = E("coachParsePlan(" + JSON.stringify(bad) + ")");
  let refused = false;
  try { E("coachApplyPlanToState(" + JSON.stringify(badPlan) + ")"); }
  catch (e) { refused = /Nothing in that plan matched/.test(e.message); }
  check(refused, "a plan for routines the athlete does not have is refused");
  check(E("getDay('day-1').exercises.find(x=>x.exId==='ex-3').reps") === 10, "a refused plan leaves the plan alone");

  section("Settings entry point and overlay");
  E("switchView('settings')");
  check(Boolean($("#set-coach-open")) && Boolean($("#set-coach-share")) && Boolean($("#set-coach-apply")), "Settings offers coaching, share and apply");
  click($("#set-coach-open"));
  check(Boolean($("#coaching-host .sh-card")), "the coaching overlay opens");
  check(/Sam Athlete/.test(txt($("#coaching-host"))), "the roster lists the athlete");
  click($("#coaching-host [data-ch-open]"));
  check(/Recent sessions/.test(txt($("#coaching-host"))), "the athlete screen shows routines and sessions");
  click($("#coaching-host [data-ch-edit]"));
  check(Boolean($("#coaching-host [data-ch-send]")), "the plan editor opens");
  check(Boolean($("#coaching-host [data-ch-rep]")), "per-set reps are editable");
  E("document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }))");
  check(!$("#coaching-host .sh-card"), "Escape closes the overlay");

  section("Deep links");
  const planCode = await E("sharePackPayload(coachBuildPlanPayload(coachRoster()[0], { r: coachRoster()[0].routines[0].name, note: 'From the link', ex: {} }))");
  E("location.hash = '#perseus-plan=' + " + JSON.stringify(planCode));
  E("coachHandleDeepLink()");
  await sleep(200);
  check(/Plan from/.test(txt($("#coaching-host"))), "a plan link previews the coach's plan");
  check(/Set counts stay exactly as they are/.test(txt($("#coaching-host"))), "the preview says set counts are fixed");
  check(E("location.hash") === "" || E("location.hash") === "#", "the coaching hash is consumed");

  E("location.hash = '#perseus-coach=' + " + JSON.stringify(code));
  E("coachHandleDeepLink()");
  await sleep(200);
  check(/Set next targets/.test(txt($("#coaching-host"))) && /Sam Athlete/.test(txt($("#coaching-host"))), "an athlete link adds them and opens their screen");

  section("Runtime errors");
  check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
