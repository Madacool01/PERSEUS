/* The two session check-ins, one per side of the workout.
   Pre-session "readiness" (sleep, energy, soreness, stress, pain) is asked
   before the first set; post-session "reflection" (difficulty, performance,
   pump, fatigue, pain, note) is asked after the last one. This covers the
   rails (accessible radio groups, exclusive selection, live verdict), the
   muscle-readiness strip, what survives into the stored session, and what the
   coach actually receives. */
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
    window.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
    window.scrollTo = () => {};
    window.confirm = () => true;
    window.addEventListener("error", e => errors.push(e && e.message || String(e)));
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
const G = name => W.eval(name);
const $ = s => W.document.querySelector(s);
const $$ = s => Array.from(W.document.querySelectorAll(s));
const click = el => el.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
const input = (el, v) => { el.value = v; el.dispatchEvent(new W.Event("input", { bubbles: true })); };

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  \u2713 " + m); } else { fail++; console.log("  \u2717 FAIL: " + m); } };
const section = t => console.log("\n== " + t + " ==");
/* Tap a rail option the way a user does (a real click on a real button). */
const tap = (block, key, val) => click($("#view-log [data-rail-block='" + block + "'][data-rail-key='" + key + "'][data-val='" + val + "']"));
const fillDay = () => {
  const ctx = G("logCtx");
  E("getDay('day-1').exercises").forEach(de => {
    const ent = ctx.entries[de.exId];
    if (!ent) return;
    const ex = E("getEx('" + de.exId + "')");
    ent.sets.forEach(s => {
      if (ex.mode === "time") s.time = 30; else s.reps = 10;
      s.rating = 2;
    });
  });
};

section("A session opens on the readiness check-in, not on the sets");
E("switchView('log')");
E("startLog('day-1')");
check(Boolean($("#view-log #rd-verdict")), "readiness screen renders first");
check($$("#view-log .rail[data-rail]").length === 4, "four readiness questions");
check($$("#view-log [role='radiogroup']").length === 4, "each question is an accessible radiogroup");
check($$("#view-log .rail-opt").length === 19, "sleep/energy/stress offer five steps, soreness four");
check($("#view-log .rail-opt[aria-checked='true']") === null, "nothing is pre-answered — a default is not an answer");
check(/Tap to answer/.test($("#view-log").textContent), "unanswered questions invite a tap");
check(!$("#view-log .set-cell"), "no set grid until training starts");

section("Selection is exclusive and the verdict reacts to it");
tap("rd", "sleep", "2");
check(E("logCtx.readiness.sleep") === 2, "the pick lands in logCtx.readiness");
check($$("#view-log [data-rail-key='sleep'][aria-checked='true']").length === 1, "only one option per rail is checked");
tap("rd", "sleep", "5");
check($$("#view-log [data-rail-key='sleep'][aria-checked='true']").length === 1, "re-tapping moves the selection instead of adding one");
check(E("logCtx.readiness.sleep") === 5, "the new value replaces the old");
check($("#view-log [data-rail-val='rd-sleep']").textContent === "Excellent", "the rail echoes the chosen label");
check(/Four taps/.test($("#rd-verdict").textContent), "the verdict waits for three answers before judging");

tap("rd", "energy", "2"); tap("rd", "soreness", "3"); tap("rd", "stress", "2");
check($("#rd-verdict").className.indexOf("red") !== -1, "poor sleep, low energy, high stress and heavy soreness read red");
check(/reduce today's load/i.test($("#rd-verdict").textContent), "red says what to do about it");
tap("rd", "sleep", "5"); tap("rd", "energy", "4"); tap("rd", "soreness", "0"); tap("rd", "stress", "5");
check($("#rd-verdict").className.indexOf("green") !== -1, "a well-recovered morning reads green");
check(/train as planned/i.test($("#rd-verdict").textContent), "green confirms the plan as written");
check(/not lost strength/i.test($("#rd-verdict").textContent), "the verdict states what the coach does with it");

section("Today's muscles, from the same engine as the You tab");
E("getEx('ex-1').primaryMuscles=['Pectoralis major']");
E("state.sessions=[{id:'s-chest',dayId:'day-1',dateISO:new Date(Date.now()-2*3600*1000).toISOString(),completedSets:[" +
  "{exId:'ex-1',setIndex:0,reps:12,weight:0,rating:4,hit:true,type:'regular'}," +
  "{exId:'ex-1',setIndex:1,reps:12,weight:0,rating:5,hit:true,type:'regular'}," +
  "{exId:'ex-1',setIndex:2,reps:10,weight:0,rating:5,hit:true,type:'regular'}]}]");
E("render()");
const row = $("#view-log [data-ready-group='chest']");
check(Boolean(row), "a muscle trained by today's routine gets a readiness row");
const chestPct = row ? parseInt(row.querySelector(".ready-pct").textContent, 10) : 100;
check(chestPct > 0 && chestPct < 100, "hard chest work two hours ago shows below 100% (" + chestPct + "%)");
check(/to ready/.test(row ? row.querySelector(".ready-eta").textContent : ""), "the row says how long until it is ready");
check(E("document.querySelector('#view-log .ready-fill').style.width") === chestPct + "%", "the meter width matches the score");
E("state.sessions=[]; render();");
check(/ready to train/.test($("#view-log [data-ready-group='chest']").textContent), "with no logged work the group reads ready");

section("The answers reach the stored session");
E("state.sessions=[]; render();");
tap("rd", "sleep", "4"); tap("rd", "energy", "3"); tap("rd", "soreness", "1"); tap("rd", "stress", "4");
input($("#view-log [data-rd-field='pain']"), "left knee");
click($("#view-log #rd-start"));
check(E("logCtx.readyScreen") === false && Boolean($("#view-log .set-cell")), "start training moves on to the sets");
check(E("logCtx.readiness.pain") === "left knee", "the pain field is read on the way in");
fillDay();
E("logCtx.idx = logCtx.stepTotal - 1; render();");
const wrap = $("#view-log #log-reflect");
check(Boolean(wrap) && /Wrap up/.test(wrap.textContent), "the last set step offers 'Wrap up' instead of recovery questions");
click(wrap);
check(Boolean($("#view-log #ref-finish")), "wrapping up opens the reflection form");
check(Boolean($("#view-log [data-rail-block='fb']")), "the reflection form asks its own questions rather than re-asking recovery");

section("The reflection asks only what the session can answer");
check($$("#view-log [data-rail-block='fb']").length === 16, "difficulty/performance/fatigue offer five steps, pump three");
check($("#view-log .checkin-recap") && /Sleep/.test($("#view-log .checkin-recap").textContent),
  "the pre-session answers are handed back on the reflection screen");
check(!/Sleep last night/.test($("#view-log .log-step").textContent), "sleep is not asked a second time");
tap("fb", "performance", "3"); tap("fb", "difficulty", "1");
check(/adding a rep/i.test($("#fb-hint").textContent), "above plan at low effort tells the user a step is coming");
tap("fb", "difficulty", "5");
check(/holds progression/i.test($("#fb-hint").textContent), "an all-out session reads as a reason to hold");

section("Both check-ins survive save, history and the coach payload");
tap("fb", "performance", "1"); tap("fb", "difficulty", "4"); tap("fb", "pump", "0"); tap("fb", "fatigue", "4");
input($("#view-log [data-fb-field='pain']"), "twinge on dips");
input($("#view-log [data-fb-field='note']"), "grinder of a session");
click($("#view-log #ref-finish"));

const ses = G("state.sessions[state.sessions.length-1]");
check(Boolean(ses), "the session saved");
check(ses.readiness && ses.readiness.sleep === 4 && ses.readiness.pain === "left knee",
  "readiness stored on the session");
check(ses.feedback && ses.feedback.difficulty === 4 && ses.feedback.performance === 1,
  "reflection stored on the session");
check(ses.feedback.pump === 0, "a 0 answer is an answer, not a skip");
check(ses.feedback.note === "grinder of a session" && ses.feedback.pain === "twinge on dips",
  "the free-text note and pain report survive");
check(ses.readiness.stress === 4, "an answered stress score is kept");
check(!("recovery" in ses.feedback) && !("sleep" in ses.feedback), "the old post-hoc recovery blob is gone from new sessions");

const payload = E("JSON.parse(JSON.stringify(buildAIPayload({ session: state.sessions[state.sessions.length-1], day: getDay('day-1'), entries:{}, base:[] })))");
check(payload.readiness && payload.readiness.sleep === 4, "the coach receives the pre-session check-in");
check(payload.feedback && payload.feedback.note === "grinder of a session", "the coach receives the post-session reflection");
const sp = E("systemPrompt()");
check(/readiness/.test(sp) && /BEFORE the first set/.test(sp), "the prompt explains what readiness is for");
check(/feedback/.test(sp) && /AFTER the last set/.test(sp), "the prompt explains what the reflection is for");
check(/attribution/i.test(sp) && /progression signal/i.test(sp), "each check-in is given a distinct job");
check(/skipped/i.test(sp), "the prompt is told that missing fields are skips, not answers");

check(/Session felt/.test($("#view-log").textContent), "the done screen reflects the session difficulty back");

section("History shows both check-ins");
E("switchView('history')");
click($("#view-history [data-sess]"));
const detail = $("#view-history .sess-detail");
check(Boolean(detail), "the session detail opens");
const rows = $$("#view-history .hist-checkin").map(el => el.textContent);
check(rows.some(t => /^Before/.test(t) && /sleep good/i.test(t)), "history shows what the athlete arrived with");
check(rows.some(t => /^After/.test(t) && /difficulty very hard/i.test(t)), "history shows how it landed");
check(rows.some(t => /Pain in session/.test(t)), "history keeps the pain report");

section("Sessions saved before the split still explain themselves");
E("state.sessions.push({ id:'s-legacy', dayId:'day-1', dateISO:'2026-01-05T10:00:00.000Z', type:'hypertrophy', completedSets:[{exId:'ex-1',setIndex:0,reps:8,rating:3,hit:true}], recovery:{ recovery:2, sleep:2, energy:2, soreness:1, pain:'shoulder', note:'slept badly' }, finalized:true }); renderHistory();");
const legacyCard = $$("#view-history [data-sess]").find(el => el.dataset.sess === "s-legacy");
check(Boolean(legacyCard), "the older session is still listed");
click(legacyCard);
const legacyText = $$("#view-history .sess-detail").filter(el => /slept badly/.test(el.textContent)).map(el => el.textContent).join(" ");
check(/slept badly/.test(legacyText), "the old post-hoc blob is still readable in history");
check(/Older check-in/.test(legacyText) && /sleep 2/.test(legacyText), "and it is labelled as an older check-in with its values");

check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\n===================================");
console.log("RESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
