const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "_orig_index.html"), "utf8");

// Simulate a user with existing data under the OLD key only.
const store = { "adaptive-coach-v1": JSON.stringify({
  profile: { name:"Alex", weightUnit:"kg", experience:"beginner", apiKey:"", autoApply:false },
  exercises: [ { id:"ex-1", name:"Custom Press", mode:"reps", equipment:["dumbbell"], weightAvailable:true,
    defaultSets:4, defaultReps:6, defaultTime:30, defaultWeight:10, notes:"" } ],
  days: [ { id:"day-1", name:"MyDay", exercises:[{ exId:"ex-1", targetSets:4, reps:6, time:30, weight:10 }] } ],
  sessions: [ { id:"sess-1", dayId:"day-1", dateISO:"2026-01-01T10:00:00.000Z",
    completedSets:[{ exId:"ex-1", setIndex:0, reps:7, time:null, weight:10, rating:1, note:"", hit:true }],
    recovery:{}, finalized:true } ],
  pending: [],
  counts:{ nextId:10 }
})};

const dom = new JSDOM(html, {
  runScripts:"dangerously", pretendToBeVisual:true, url:"http://localhost/",
  beforeParse(w){
    w.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    w.scrollTo=()=>{};
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
let pass=0,fail=0; const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

check(E("state.profile.name")==="Alex", "migrated profile name loads: Alex");
check(E("state.exercises.length")===1 && E("state.exercises[0].name")==="Custom Press", "migrated exercise loads");
check(E("state.days[0].name")==="MyDay", "migrated day loads");
check(E("state.sessions.length")===1, "migrated session loads");
check(E("state.counts.nextId")===10, "migrated id counter preserved");
check(!("adaptive-coach-v1" in store), "legacy key removed after migration");
check("perseus-v1" in store, "data now stored under perseus-v1");

console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);