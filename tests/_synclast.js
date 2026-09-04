/* Last-modified-wins regression: when pre-sync data has divergent per-routine
   plans for the same exercise, the shared plan on load must come from the
   copy modified last — an explicit modifiedAt stamp when present, otherwise
   the routine trained most recently (latest logged session), NOT the first
   routine in the list. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };

function boot(fixture) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
    beforeParse(w) {
      // jsdom's real localStorage is what the page sees — seed it pre-bootstrap.
      w.localStorage.setItem("perseus-v1", JSON.stringify(fixture));
      w.scrollTo = () => {};
    },
  });
  return { W: dom.window, E: expr => dom.window.eval(expr) };
}

function baseFixture() {
  return {
    profile: { name:"Alex", weightUnit:"kg", experience:"beginner", apiKey:"", aiModel:"openai/gpt-oss-20b", autoApply:false, lastSessionType:"hypertrophy", defaultSessionType:"hypertrophy", bodyWeight:null, heightCm:null },
    exercises: [ { id:"ex-lat", name:"Lateral Raise (Dumbbell)", mode:"reps", equipment:["dumbbell"], weightAvailable:true, defaultSets:2, defaultReps:8, defaultTime:30, defaultWeight:4, notes:"" } ],
    days: [
      { id:"day-tue", name:"Tuesday", type:"hypertrophy", exercises:[{ exId:"ex-lat", targetSets:2, reps:7, time:30, weight:4, setReps:[7,6], setTypes:["regular","regular"] }] },
      { id:"day-fri", name:"Friday", type:"hypertrophy", exercises:[{ exId:"ex-lat", targetSets:2, reps:8, time:30, weight:4, setReps:[8,7], setTypes:["regular","regular"] }] },
    ],
    sessions: [], pending: [], counts:{ nextId: 1 }
  };
}

console.log("\n== Legacy, no timestamps: most recently trained routine wins ==");
{
  const f = baseFixture();
  // Friday is the SECOND routine but was trained most recently (the PR day).
  f.sessions = [
    { id:"s1", dayId:"day-tue", dateISO:"2026-08-25T10:00:00.000Z", completedSets:[], recovery:{}, finalized:true },
    { id:"s2", dayId:"day-fri", dateISO:"2026-09-03T10:00:00.000Z", completedSets:[{ exId:"ex-lat", setIndex:0, reps:8, time:null, weight:4, rating:1, note:"", hit:true },{ exId:"ex-lat", setIndex:1, reps:7, time:null, weight:4, rating:1, note:"", hit:true }], recovery:{}, finalized:true },
  ];
  const { E } = boot(f);
  check(E("getDay('day-tue').exercises[0].setReps.join(',')") === "8,7", "Tuesday unified to Friday's 8/7 (Friday trained most recently)");
  check(E("getDay('day-fri').exercises[0].setReps.join(',')") === "8,7", "Friday keeps its 8/7 plan");
  check(E("getEx('ex-lat').plan.setReps.join(',')") === "8,7", "canonical plan is 8/7");
}

console.log("\n== Explicit modifiedAt stamp wins over recency ==");
{
  const f = baseFixture();
  // No sessions; the SECOND routine's copy carries a newer modifiedAt stamp.
  f.days[0].exercises[0].modifiedAt = 1000; // Tuesday, older
  f.days[1].exercises[0].modifiedAt = 2000; // Friday, newer
  const { E } = boot(f);
  check(E("getDay('day-tue').exercises[0].setReps.join(',')") === "8,7", "Tuesday unified to Friday's 8/7 (Friday modified last)");
  check(E("getDay('day-tue').exercises[0].modifiedAt") === 2000, "stamp propagated to every copy (shared group)");
  check(E("getEx('ex-lat').plan.modifiedAt") === 2000, "canonical plan carries the winning stamp");
}

console.log("\n== Newest stamp wins even with a recent session on an older copy ==");
{
  const f = baseFixture();
  f.days[0].exercises[0].modifiedAt = 3000; // Tuesday stamped newest…
  f.days[1].exercises[0].modifiedAt = 1000; // …but Friday was trained most recently
  f.sessions = [
    { id:"s1", dayId:"day-fri", dateISO:"2026-09-03T10:00:00.000Z", completedSets:[], recovery:{}, finalized:true },
  ];
  const { E } = boot(f);
  check(E("getDay('day-fri').exercises[0].setReps.join(',')") === "7,6", "Tuesday's 7/6 wins (explicit newer stamp beats session recency)");
  check(E("getDay('day-tue').exercises[0].setReps.join(',')") === "7,6", "Friday unified to Tuesday's 7/6");
}

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);