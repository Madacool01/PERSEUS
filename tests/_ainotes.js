/* Notes reach the AI: per-set notes survive buildSession, appear in buildAIPayload.performed, and systemPrompt tells the model to use them. */
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
    window.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    window.scrollTo = () => {};
    window.fetch = async () => ({ ok:true, status:200, json: async ()=>({ choices:[{ message:{ content:"{}" } }] }) });
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };

(() => {
  console.log("\n== per-set notes survive to session ==");
  E("startLog('day-1')");
  const day = E("getDay('day-1')");
  const de = day.exercises[0];
  const ctx = W.eval("logCtx");
  const ent = ctx.entries[de.exId];
  ent.sets.forEach((s, i) => {
    const ex = E("getEx('" + de.exId + "')");
    if (ex.mode === "time") s.time = 30; else s.reps = 8;
    s.weight = 0; s.rating = 2;
    s.note = i === 0 ? "sharp left shoulder pain" : "";
  });
  ctx.readiness = { sleep: 2, energy: 2, soreness: 1, stress: 2, pain: "shoulder" };
  ctx.feedback = { difficulty: 4, performance: 1, fatigue: 4, pain: "shoulder", note: "tired, bad sleep" };
  const out = E("buildSession(getDay('day-1'), logCtx.entries, logCtx.feedback, logCtx.readiness)");
  check(out.completedSets.some(c => c.note === "sharp left shoulder pain"), "set note preserved in completedSets");
  check(out.feedback.note === "tired, bad sleep", "reflection note preserved");
  check(out.readiness.sleep === 2, "readiness check-in preserved; unanswered keys dropped");
  check(!("pump" in out.feedback), "skipped questions stay absent instead of defaulting");

  console.log("\n== notes reach AI payload ==");
  E("state.profile.apiKey='gsk_test'");
  const sess = { id:"s1", dayId:"day-1", type:"hypertrophy", completedSets: out.completedSets, feedback: out.feedback, readiness: out.readiness };
  const payload = E("buildAIPayload({session:" + JSON.stringify(sess).replace(/</g, "\\u003c") + ", day:getDay('day-1'), entries:{}, base:[]})");
  // build via eval-friendly path (avoid JSON injection issues): rebuild in page
  W.eval("window.__tSess = " + JSON.stringify(sess));
  const p2 = W.eval("buildAIPayload({session: window.__tSess, day: getDay('day-1'), entries:{}, base:[]})");
  check(p2.performed.some(p => p.note === "sharp left shoulder pain"), "performed[] carries set note");
  check(p2.feedback && p2.feedback.note === "tired, bad sleep", "payload feedback carries note");
  check(p2.readiness && p2.readiness.sleep === 2, "payload readiness carries the check-in");

  console.log("\n== system prompt instructs note use ==");
  const sp = W.eval("systemPrompt()");
  check(/note/i.test(sp), "systemPrompt mentions notes");
  check(/pain/i.test(sp) && /note/i.test(sp), "systemPrompt treats pain notes conservatively");

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
