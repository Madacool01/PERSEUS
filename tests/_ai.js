/* Validate the Groq AI JSON contract with a mocked HTTP response. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
let capturedBody = null;

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    window.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    window.scrollTo = () => {};
    // Mock Groq endpoint: parse request, return an updated JSON payload
    window.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      const modelReturn = {
        summary: "Solid session — all prescribed sets completed with reps to spare.",
        changes: [
          { exId:"ex-3", field:"reps", before:8, after:10, reason:"Knocked out 8 reps across three sets with clear ease — push to 10 next time." },
          { exId:"ex-5", field:"reps", before:6, after:8, reason:"6 reps at P/R both sessions, move to 8." },
          { exId:"ex-12", field:"time", before:20, after:25, reason:"Held the L-sit 20s for every set — add 5s." },
          { exId:"ex-4", field:"sets", before:3, after:4, reason:"Attempt to violate set-count rule." }
        ]
      };
      return { ok:true, status:200, json: async ()=>({ choices:[{ message:{ content: JSON.stringify(modelReturn) } }] }) };
    };
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
const G = name => W.eval(name);
function $(s){ return W.document.querySelector(s); }

let pass=0, fail=0;
const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

(async () => {
  console.log("== Set AI key ==");
  E("state.profile.apiKey = 'gsk_test123'");
  check(G("state.profile.apiKey")==="gsk_test123", "api key set");

  console.log("== Start + fill a session ==");
  E("startLog('day-1')");
  const ctx = G("logCtx");
  const day1 = E("getDay('day-1')");
  day1.exercises.forEach(de=>{
    const ent = ctx.entries[de.exId]; if(!ent) return;
    const ex = E("getEx('"+de.exId+"')");
    ent.sets.forEach(s=>{
      if (ex.mode==="time"){ s.time=(de.time||0)+5; s.rating=1; }
      else { s.reps=(de.reps||0)+2; s.rating=1; }
    });
  });
  ctx.recovery = { recovery:3, sleep:4, energy:3, soreness:0, pain:"", note:"" };
  E("saveLogSession()");
  await new Promise(r=>setTimeout(r,300)); // let produceCoach finish

  console.log("== Confirm request payload shape ==");
  check(capturedBody && capturedBody.messages && capturedBody.messages.length===2, "groq request has system+user messages");
  if (capturedBody){
    check(capturedBody.response_format && capturedBody.response_format.type==="json_object", "asks for JSON object output");
    const user = JSON.parse(capturedBody.messages[1].content);
    check(user.plan && Array.isArray(user.plan) && user.plan.length>=4, "payload.plan present");
    check(user.performed && user.performed.length>=3, "payload.performed present");
    check(user.candidates && Array.isArray(user.candidates) && user.candidates.length>0, "payload.candidates present");
    check(typeof user.recovery === "object", "payload.recovery present");
  }

  console.log("== Confirm AI JSON was clamped + applied ==");
  const pend = G("state.pending")[G("state.pending.length")-1];
  // Merge semantics: AI refines entries it touches on top of the engine's structural
  // suggestions. The illegal 'sets' change is dropped, and the engine's untouched
  // Ring Row suggestion (ex-4) survives alongside the AI's three valid changes.
  check(pend.suggestions && pend.suggestions.length===4, "engine+AI merged to 4 suggestions (kept "+ (pend.suggestions||[]).length +")");
  check(!pend.suggestions.some(s=>s.field==="sets"), "no 'sets' field survived AI clamp");
  check(pend.suggestions.some(s=>s.exId==="ex-4" && s.field==="reps"), "engine suggestion for unaddressed ex-4 preserved");
  check(pend.suggestions.some(s=>s.field==="reps" && s.to===10), "AI reps suggestion (8->10) kept");
  check(pend.suggestions.some(s=>s.field==="time" && s.to===25), "AI time suggestion (20->25) kept");
  check(G("state.sessions")[G("state.sessions.length")-1].summary && G("state.sessions")[G("state.sessions.length")-1].summary.length>0, "session got AI summary");
  const reasons = pend.suggestions.filter(s=>s.reason && s.reason.length>20);
  check(reasons.length>=1, "AI wrote plain-language reasons");

  console.log("== Apply the kept reps suggestion ==");
  const ex3 = pend.suggestions.find(s=>s.exId==="ex-3");
  E("recAct({recid:'"+pend.id+"', ai:'ex-3', act:'keep'},'')");
  const de = E("getDay('day-1').exercises.find(x=>x.exId==='ex-3')");
  check(de.reps === 10, "plan reps updated to 10 by AI suggestion");

  console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
  process.exit(fail?1:0);
})();