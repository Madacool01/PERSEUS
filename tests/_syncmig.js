/* Migration regression: data saved before cross-routine sync existed may hold
   different per-set plans for the same exercise in different routines (e.g.
   Lateral Raise 8/7 on Friday but 7/6 on Tuesday). On load they must converge
   to ONE shared prescription — the first routine containing the movement wins
   and every other routine's copy mirrors it. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const fixture = {
  profile: { name:"Alex", weightUnit:"kg", experience:"beginner", apiKey:"", aiModel:"openai/gpt-oss-20b", autoApply:false, lastSessionType:"hypertrophy", defaultSessionType:"hypertrophy", bodyWeight:null, heightCm:null },
  exercises: [ { id:"ex-lat", name:"Lateral Raise", mode:"reps", equipment:["dumbbell"], weightAvailable:true, defaultSets:2, defaultReps:8, defaultTime:30, defaultWeight:4, notes:"" } ],
  days: [
    { id:"day-fri", name:"Friday", type:"hypertrophy", exercises:[{ exId:"ex-lat", targetSets:2, reps:8, time:30, weight:4, setReps:[8,7], setTypes:["regular","regular"] }] },
    { id:"day-tue", name:"Tuesday", type:"hypertrophy", exercises:[{ exId:"ex-lat", targetSets:2, reps:7, time:30, weight:4, setReps:[7,6], setTypes:["regular","regular"] }] },
  ],
  sessions: [], pending: [], counts:{ nextId: 1 }
};

const dom = new JSDOM(html, {
  runScripts:"dangerously", pretendToBeVisual:true, url:"http://localhost/",
  beforeParse(w){
    // jsdom's real localStorage is what the page sees (window.localStorage is
    // an accessor we can't replace) — seed it before the bootstrap script runs.
    w.localStorage.setItem("perseus-v1", JSON.stringify(fixture));
    w.scrollTo=()=>{};
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
let pass=0,fail=0; const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

check(E("getDay('day-fri').exercises[0].setReps.join(',')") === "8,7", "Friday keeps its 8/7 plan");
check(E("getDay('day-tue').exercises[0].setReps.join(',')") === "8,7", "Tuesday unified to the shared 8/7 plan (was 7/6)");
check(E("getDay('day-tue').exercises[0].targetSets") === 2 && E("getDay('day-tue').exercises[0].reps") === 8, "Tuesday target sets + reps consistent after unification");
check(E("getEx('ex-lat').plan") && E("getEx('ex-lat').plan.setReps.join(',')") === "8,7", "canonical ex.plan written on load");

console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);