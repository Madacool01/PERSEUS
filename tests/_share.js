/* Shared workouts: link/code/file payloads, duplicate merging, edge cases.
 *
 * Three jsdom instances (each load of index.html is slow):
 *   A - payload build/pack/validate (pure)
 *   B - import planning + commit (mutates state, reset between phases)
 *   C - UI: share sheet, import dialog, deep link
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/* Decode a share code in node, so a case can start from a real wire payload
   (P1 is deflate-raw, P0 is the uncompressed fallback). */
function decodeWire(code) {
  const body = code.slice(3);
  const buf = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const json = code.slice(0, 3) === "P1." ? zlib.inflateRawSync(buf).toString("utf8") : buf.toString("utf8");
  return JSON.parse(json);
}

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  \u2713 " + msg); }
  else { fail++; console.log("  \u2717 FAIL: " + msg); }
}
function section(t) { console.log("\n== " + t + " =="); }

function makeDom() {
  const store = {};
  const failOnce = {};
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/index.html",
    beforeParse(window) {
      // storage the test can actually inspect (and make fail on demand:
      // jsdom's own Storage ignores plain property patching)
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          return {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => {
              if (failOnce[k]) { failOnce[k] = false; throw new Error("QuotaExceededError"); }
              store[k] = String(v);
            },
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
  return {
    W: W, store: store, failOnce: failOnce, errors: errors,
    E: expr => W.eval(expr),
    $: sel => W.document.querySelector(sel),
    $$: sel => Array.from(W.document.querySelectorAll(sel)),
    click: el => el.dispatchEvent(new W.MouseEvent("click", { bubbles: true })),
    sleep: ms => new Promise(r => setTimeout(r, ms)),
  };
}
(async () => {
  /* ------------------------------------------------------------------ A */
  const A = makeDom();
  const { W: WA, E: EA } = A;

  section("Payload: build, pack, unpack, validate");
  const code1 = await A.E("sharePackPayload(shareBuildPayload('day-1', {}))");
  check(/^P[01]\./.test(code1), "seeded routine packs into a share code (" + code1.slice(0, 12) + "…, " + code1.length + " chars)");
  let obj1 = null;
  try { obj1 = await A.E("shareUnpackCode(" + JSON.stringify(code1) + ")"); }
  catch (e) { check(false, "unpack threw: " + e.message); }
  check(Boolean(obj1 && obj1.app === "perseus" && obj1.kind === "workout"), "payload carries app + kind markers");
  check(obj1 && obj1.v === 1, "payload declares format version 1");
  check(obj1 && obj1.n === "Workout A" && obj1.t === "hypertrophy", "payload carries routine name + session type");
  check(obj1 && obj1.ex.length === 4 && obj1.pr.length === 4, "payload carries 4 exercises and 4 prescriptions");
  check(obj1 && obj1.pid && /^[0-9a-f]{8}$/.test(obj1.pid), "payload carries an 8-char content id (" + (obj1 && obj1.pid) + ")");
  check(obj1 && String(obj1.ex[0].n).length > 0, "first shared exercise is named (" + (obj1 && obj1.ex[0].n) + ")");
  check(!/profile|sessions|apiKey|pending/.test(JSON.stringify(obj1)), "payload leaks no profile, history, key or coach records");

  section("Payload: the receiver's round trip is identical");
  const valid1 = await A.E("shareValidatePayload(" + JSON.stringify(obj1) + ")");
  check(valid1.name === "Workout A" && valid1.exercises.length === 4, "validate keeps every exercise");
  check(valid1.entries.length === 4 && valid1.entries.every(e => e.ref >= 0 && e.ref < 4), "every prescription points at a kept exercise");
  check(valid1.unit === "kg", "unit travels with the payload");

  section("Payload: the sender's own data never leaves");
  const EX_KEYS = ["n", "m", "eq", "wa", "ds", "dr", "dt", "dw", "no", "ins", "bp", "pm", "sm", "lf", "ls", "img", "pg"];
  const PR_KEYS = ["r", "s", "rp", "ti", "w", "sr", "st", "ty", "sw", "f"];
  const WIRE_TOP = "app,ex,kind,n,pid,pr,src,ss,t,ts,u,v";
  // give the sender a key, a name, a theme, a session note and a coach record
  A.E("state.profile.apiKey = 'ZZSECRET-KEY'; state.profile.name = 'ZZSECRET-NAME';" +
      "state.profile.theme = 'ZZSECRET-THEME';" +
      "state.sessions.push({ id:'sess-zz', startedAt:'2026-01-02T10:00:00Z', note:'ZZSECRET-HISTORY', entries:[] });" +
      "state.pending.push({ id:'pend-zz', text:'ZZSECRET-COACH' });");
  check(A.E("(state.profile.apiKey + state.profile.name + state.profile.theme + state.sessions.map(s=>s.note||'').join('') + state.pending.map(p=>p.text||'').join('')).indexOf('ZZSECRET') !== -1") === true,
    "sanity: the sender's install really holds a key, a name, a theme, a history note and a coach record");
  const secretPayload = await A.E("shareBuildPayload('day-1', {})");
  const secretValid = await A.E("shareValidatePayload(" + JSON.stringify(secretPayload) + ")");
  const secretWire = decodeWire(await A.E("sharePackPayload(shareBuildPayload('day-1', { withImages:true }))"));
  const wireTop = Object.keys(secretWire).sort().join(",");
  check(wireTop === WIRE_TOP, "the wire payload holds exactly the allow-listed top-level fields (" + wireTop + ")");
  const stray = secretWire.ex.reduce((a, e) => a.concat(Object.keys(e).filter(k => EX_KEYS.indexOf(k) === -1)), [])
    .concat(secretWire.pr.reduce((a, e) => a.concat(Object.keys(e).filter(k => PR_KEYS.indexOf(k) === -1)), []));
  check(stray.length === 0, "every exercise and prescription field is on the allow-list (" + (stray.join(",") || "none") + ")");
  check(JSON.stringify(secretPayload).indexOf("ZZSECRET") === -1 &&
        JSON.stringify(secretValid).indexOf("ZZSECRET") === -1 &&
        JSON.stringify(secretWire).indexOf("ZZSECRET") === -1,
    "no sender key, name, theme, history or coach text reaches the payload or the receiver's view of it");

  section("Payload: the saved .json file carrier");
  const fileJson = A.E(`(()=>{
    const RealBlob = window.Blob, c0 = URL.createObjectURL, r0 = URL.revokeObjectURL;
    let parts = null;
    window.Blob = function(list, opt){ parts = list; return new RealBlob(list, opt); };
    URL.createObjectURL = ()=> "blob:test";
    URL.revokeObjectURL = ()=>{};
    try{ shareSaveFile("day-1", {}); }catch(e){ return "ERR:" + e.message; }
    window.Blob = RealBlob; URL.createObjectURL = c0; URL.revokeObjectURL = r0;
    return parts ? String(parts[0]) : "NOBLOB";
  })()`);
  let filePayload = null;
  try { filePayload = JSON.parse(fileJson); } catch (e) {}
  check(Boolean(filePayload && filePayload.app === "perseus"), "the saved .json file is a readable share payload");
  check(filePayload && Object.keys(filePayload).sort().join(",") === WIRE_TOP, "the saved file carries the same allow-listed fields as the code");
  check(fileJson.indexOf("ZZSECRET") === -1, "the saved .json file contains no sender key, name, theme, history or coach text");
  check(filePayload && filePayload.pid === secretPayload.pid, "the saved file is the same workout as the code (" + (filePayload && filePayload.pid) + ")");

  section("Payload: a hostile share cannot smuggle account fields in");
  const smuggle = {
    app: "perseus", kind: "workout", v: 1, u: "kg", n: "Smuggle", t: "hypertrophy",
    profile: { apiKey: "ZZSECRET-SMUGGLE" }, apiKey: "ZZSECRET-SMUGGLE", aiModel: "ZZSECRET-SMUGGLE",
    sessions: [{ note: "ZZSECRET-SMUGGLE" }], pending: [{ text: "ZZSECRET-SMUGGLE" }],
    ex: [{ n: "Squat", m: "reps", apiKey: "ZZSECRET-SMUGGLE", profile: { name: "ZZSECRET-SMUGGLE" } }],
    pr: [{ r: 0, s: 3, profile: "ZZSECRET-SMUGGLE" }]
  };
  const smuggled = A.E("shareValidatePayload(" + JSON.stringify(smuggle) + ")");
  check(JSON.stringify(smuggled).indexOf("ZZSECRET") === -1, "profile / key / history fields riding along in a payload are dropped");
  const smTop = Object.keys(smuggled).sort().join(",");
  check(smTop === "droppedEntries,droppedExercises,droppedGroups,droppedImages,entries,exercises,groups,name,pid,src,ts,type,unit",
    "the validated payload is a fresh allow-listed object (" + smTop + ")");
  const smEx = Object.keys(smuggled.exercises[0]).join(",");
  check(smEx.indexOf("apiKey") === -1 && smEx.indexOf("profile") === -1, "the parsed exercise keeps only recognised fields (" + smEx + ")");
  const smEn = Object.keys(smuggled.entries[0]).join(",");
  check(smEn.indexOf("apiKey") === -1 && smEn.indexOf("profile") === -1, "the parsed prescription keeps only recognised fields (" + smEn + ")");

  section("Payload: extraction from what people actually paste");
  const link = await A.E("sharePayloadLink(" + JSON.stringify(code1) + ")");
  check(link.indexOf("#perseus-share=" + code1) !== -1, "link appends the code as a hash");
  check(A.E("shareFindCode(" + JSON.stringify("hey, here is my workout " + link + " enjoy!") + ")") === code1, "a code is found inside a chat message");
  check(A.E("shareFindCode(" + JSON.stringify(code1.slice(0, 3) + "\n  " + code1.slice(3)) + ")") !== null, "wrapped/whitespaced code still parses");
  check(A.E("shareFindCode('no code here at all')") === null, "junk text yields no code");
  const fromJson = await A.E("shareDecodeInput(" + JSON.stringify(JSON.stringify(obj1)) + ")");
  check(fromJson.name === "Workout A", "a .json share file decodes through the same path");

  section("Payload: damaged and hostile input is refused");
  async function refuse(expr, label) {
    try { await A.E(expr); check(false, label + " (was accepted)"); }
    catch (e) { check(true, label + ": " + String(e.message).slice(0, 72)); }
  }
  await refuse("shareUnpackCode('P0.not-base-64-@@@')", "garbage base64 rejected");
  await refuse("shareUnpackCode('XX.abcdef')", "unknown prefix rejected");
  await refuse("shareValidatePayload({ app:'perseus', kind:'workout', v:99 })", "future format version refused");
  await refuse("shareValidatePayload({ app:'other', kind:'workout', v:1 })", "foreign payload refused");
  await refuse("shareValidatePayload(null)", "null payload refused");
  await refuse("shareValidatePayload({ app:'perseus', kind:'workout', v:1, ex:[], pr:[] })", "empty workout refused");
  await refuse("shareDecodeInput(JSON.stringify({ profile:{}, exercises:[{}], days:[{}] }))", "full backup pointed at Settings");
  await refuse("shareDecodeInput('hello friend')", "plain text refused");
  await refuse("shareDecodeInput('')", "empty paste refused");

  section("Payload: sanitization of a malicious/broken share");
  const nasty = {
    app: "perseus", kind: "workout", v: 1, u: "xx", n: "  Bad\u0000Name  ", t: "nonsense",
    ex: [{
      n: "Squat", m: "reps", eq: ["dumbbell", "nonsense"], wa: true,
      ds: 9999, dr: -50, dt: "abc", dw: 99999,
      bp: ["Chest", "NotAPart"], pm: ["Quadriceps", "Made Up"], sm: "nope",
      lf: 5000, ls: "evil", pg: [7, 0],
      img: "data:image/jpeg;base64," + "A".repeat(500001)
    }],
    pr: [{ r: 0, s: 999, rp: 900, ti: 99999, w: 99999, sr: [1, 2, 3], ty: ["evil", "drop"], f: "silly" }, { r: 9, s: 3 }],
    ss: [[0, 9], [9, 9]]
  };
  const clean = A.E("shareValidatePayload(" + JSON.stringify(nasty) + ")");
  check(clean.name === "Bad Name", "control characters stripped from the name");
  check(clean.type === "hypertrophy" && clean.unit === "kg", "unknown session type and unit fall back");
  check(clean.exercises.length === 1, "unreferenced / invalid exercises dropped");
  const cx = clean.exercises[0];
  check(cx.defaultSets === 15 && cx.defaultReps === 0 && cx.defaultTime === 30 && cx.defaultWeight === 1000, "absurd defaults clamped (sets/reps/time/weight)");
  check(cx.equipment.join(",") === "dumbbell", "unknown equipment dropped");
  check(cx.bodyParts.join(",") === "Chest" && cx.primaryMuscles.join(",") === "Quadriceps" && cx.secondaryMuscles.length === 0, "unknown muscles/body parts dropped");
  check(cx.loadFactor === null && cx.image === "", "oversized photo and absurd load factor refused");
  check(cx.progressions.length === 0, "out-of-range progression refs dropped");
  check(clean.entries.length === 1, "entry pointing at a missing exercise dropped");
  const ce = clean.entries[0];
  check(ce.targetSets === 15 && ce.reps === 100 && ce.weight === 1000, "absurd prescription clamped");
  check(ce.setTypes[0] === "regular" && ce.setTypes[1] === "drop", "unknown set type becomes regular (" + ce.setTypes.join(",") + ")");
  check(!ce.focus, "unknown hybrid focus dropped");
  const budget = A.E("(()=>{ const big='data:image/jpeg;base64,'+'A'.repeat(250000); const ex=[], pr=[]; for(let i=0;i<5;i++){ ex.push({n:'Photo '+i, m:'reps', img:big}); pr.push({r:i, s:3}); } return shareValidatePayload({app:'perseus',kind:'workout',v:1,ex:ex,pr:pr}); })()");
  check(budget.exercises.filter(x=>x.image).length === 4, "a share carries photos only up to its total photo budget (" + budget.exercises.filter(x => x.image).length + " of 5)");
  check(budget.droppedImages === 1, "the photo that did not fit is counted for the receiver");

  section("Payload: paste cap vs file cap");
  const padded = "{" + " ".repeat(30000) + "}";
  try { await A.E("shareDecodeInput(" + JSON.stringify(padded) + ")"); check(false, "a 30k-character paste is refused"); }
  catch (e) { check(/too long/.test(e.message), "a 30k-character paste is refused (" + e.message.slice(0, 40) + "…)"); }
  try { await A.E("shareDecodeInput(" + JSON.stringify(padded) + ", { fromFile:true })"); check(false, "the file path skips the paste cap"); }
  catch (e) { check(/not a PERSEUS workout/.test(e.message), "the file path skips the paste cap and only payload rules stop it"); }

  const proto = A.E("(()=>{ const o = shareValidatePayload(JSON.parse('{\"app\":\"perseus\",\"kind\":\"workout\",\"v\":1,\"__proto__\":{\"polluted\":true},\"ex\":[{\"n\":\"X\"}],\"pr\":[{\"r\":0,\"s\":3}]}')); return ({}).polluted === undefined && o.exercises.length === 1; })()");
  check(proto === true, "prototype-pollution keys in a payload stay inert");

  /* ------------------------------------------------------------------ B */
  const B = makeDom();
  const { W: WB, E: EB } = B;
  const codeB = await B.E("sharePackPayload(shareBuildPayload('day-1', {}))");
  const payloadB = await B.E("shareDecodeInput(" + JSON.stringify(codeB) + ")");
  const importPayload = (p, opts) => B.E("importSharePayload(" + JSON.stringify(p) + ", " + JSON.stringify(opts || {}) + ")");
  let sendSeq = 0;
  const sendBack = () => importPayload(payloadB, { name: "Imported " + (++sendSeq) });

  section("Import: duplicate exercises are linked, not duplicated");
  const beforeDays = B.E("state.days.length");
  // a receiver with none of the shared movements — except one they spell their own way
  const sharedNames = payloadB.exercises.map(e => e.name);
  B.E("var SHARED=" + JSON.stringify(sharedNames) + ";" +
      "state.exercises = state.exercises.filter(x=>SHARED.indexOf(x.name) === -1);" +
      "state.days.forEach(d=>{ d.exercises = d.exercises.filter(de=>state.exercises.some(x=>x.id===de.exId)); });");
  const beforeEx = B.E("state.exercises.length");
  B.E("state.exercises.push({ id:'ex-mine', name:'Ring  DIP!', mode:'reps', equipment:['rings'], weightAvailable:true, defaultSets:5, defaultReps:5, defaultTime:30, defaultWeight:12, notes:'mine', instructions:'', bodyParts:[], primaryMuscles:[], secondaryMuscles:[], plan:{ targetSets:5, reps:5, time:30, weight:12, setReps:[5,5,5,5,5], setTypes:null, setWeights:null, modifiedAt:1 } })");
  const res1 = await sendBack();
  check(res1.ok === true, "import reports success");
  check(B.E("state.exercises.length") === beforeEx + 1 + 3, "3 missing exercises added on top of the receiver's own (" + (beforeEx + 1) + " -> " + B.E("state.exercises.length") + ")");
  check(res1.report.added.length === 3, "report counts 3 new exercises (" + res1.report.added.join(", ") + ")");
  check(res1.report.linked.length === 1 && res1.report.linked[0].id === "ex-mine", "'Ring  DIP!' matched the shared 'Ring Dip' by name");
  const mineEntry = B.E("getDay(" + JSON.stringify(res1.dayId) + ").exercises.find(x=>x.exId==='ex-mine')");
  check(Boolean(mineEntry), "the imported routine uses the existing exercise id");
  check(mineEntry && mineEntry.targetSets === 5 && mineEntry.reps === 5, "the receiver's own prescription wins for an exercise they already own");
  check(res1.report.keptTargets >= 1, "report tells the user their targets were kept");
  const rowId = B.E("state.exercises.find(x=>x.name==='Ring Row').id");
  const rowEntry = B.E("getDay(" + JSON.stringify(res1.dayId) + ").exercises.find(x=>x.exId===" + JSON.stringify(rowId) + ")");
  check(Boolean(rowEntry && rowEntry.reps === 8 && rowEntry.targetSets === 3), "a brand-new exercise keeps the sender's prescription (" + (rowEntry && rowEntry.targetSets + "x" + rowEntry.reps) + ")");
  check(B.E("state.sessions.length") === 0, "no session history arrives with the routine");
  check(B.E("state.profile.apiKey") === "" && B.E("state.profile.name") === "", "profile untouched by an import");
  check(B.E("state.days.length") === beforeDays + 1, "exactly one routine was added");
  check(B.E("getDay(" + JSON.stringify(res1.dayId) + ").shared.pid") === payloadB.pid, "the routine remembers which share it came from");
  const planSet = B.E("getEx(" + JSON.stringify(rowId) + ").plan && getEx(" + JSON.stringify(rowId) + ").plan.reps === 8");
  check(planSet === true, "a new exercise's canonical plan is written so routine sync stays coherent");
  check(B.E("state.days.every(d=>new Set(d.exercises.map(x=>x.exId)).size === d.exercises.length)"), "no duplicate exercise entries inside the new routine");

  section("Import: a routine named exactly like the incoming one is refused");
  const collBefore = B.E("state.days.length");
  const resDup = await importPayload(payloadB, {});   // the seed already owns "Workout A"
  check(resDup.ok === false, "importing under the seeded name 'Workout A' is refused");
  check(Boolean(resDup.report && resDup.report.nameTaken), "the report flags the name as taken");
  check(/already have a routine named/i.test(resDup.error || ""), "the user is told about the clash: " + JSON.stringify(resDup.error));
  check(B.E("state.days.length") === collBefore, "a refused import adds no routine");
  const resNew = await importPayload(payloadB, { name: "Workout A Shared" });
  check(resNew.ok === true && resNew.report.name === "Workout A Shared", "renaming the routine on import succeeds ('" + resNew.report.name + "')");
  check(resNew.report.alreadyImported === true, "the same share arriving again is reported as already imported");
  const resAgain = await importPayload(payloadB, { name: "Workout A Shared" });
  check(resAgain.ok === false && resAgain.report.nameTaken === true, "a second copy under the same name is refused too");
  const res4 = await B.E("importSharePayload(" + JSON.stringify(payloadB) + ", { name:'My Legs' })");
  check(res4.ok === true && res4.report.name === "My Legs", "the receiver can still name the routine however they like");

  section("Import: units are converted for the receiver");
  const kgNow = B.E("weightUnit()");
  const lbWire = decodeWire(codeB);
  lbWire.u = "lb";
  lbWire.n = "Imperial Probe";
  lbWire.ex.forEach((e, i) => { e.n = "Share Probe " + (i + 1); e.m = "reps"; e.wa = true; e.dw = 100; });
  lbWire.pr.forEach(e => { e.s = 3; e.rp = 8; e.sr = [8, 8, 8]; e.w = 100; e.sw = [100, 100, 100]; delete e.ti; delete e.st; });
  const lbValid = await B.E("shareDecodeInput(" + JSON.stringify(JSON.stringify(lbWire)) + ")");
  const resLb = await importPayload(lbValid, {});
  check(kgNow === "kg", "receiver profile is metric");
  check(res1.report.converted === false, "a same-unit share is not flagged as converted");
  check(resLb.report.converted === true && resLb.report.unitFrom === "lb" && resLb.report.unitTo === "kg", "report states the conversion");
  const conv = B.E("getDay(" + JSON.stringify(resLb.dayId) + ").exercises[0].setWeights[0]");
  check(Math.abs(conv - 45.5) < 0.01, "100 lb became " + conv + " kg");
  const convDefault = B.E("state.exercises.find(x=>x.name==='Share Probe 1').defaultWeight");
  check(Math.abs(convDefault - 45.5) < 0.01, "the exercise's default load is converted too (" + convDefault + " kg)");

  section("Import: supersets, unknown refs and dead exercises");
  const groupWire = decodeWire(codeB);
  groupWire.n = "Group Probe";
  groupWire.ss = [[0, 1], [0, 99]];
  groupWire.pr.push({ r: 42, s: 3 });
  groupWire.ex.push({ n: "Ghost Press", m: "reps" });
  const groupValid = await B.E("shareDecodeInput(" + JSON.stringify(JSON.stringify(groupWire)) + ")");
  const resG = await importPayload(groupValid, {});
  check(resG.report.groups === 1 && resG.report.groupsDropped === 1, "one superset kept, the one with a bogus member dropped (kept " + resG.report.groups + ", dropped " + resG.report.groupsDropped + ")");
  const grp = B.E("getDay(" + JSON.stringify(resG.dayId) + ").supersets[0]");
  check(Boolean(grp) && grp.exIds.length === 2 && grp.id.indexOf("ss-") === 0, "superset remapped onto fresh ids");
  check(B.E("(()=>{ const g = getDay(" + JSON.stringify(resG.dayId) + ").supersets[0]; return g.exIds.length === 2 && g.exIds.every(id=>getDay(" + JSON.stringify(resG.dayId) + ").exercises.some(x=>x.exId===id)); })()") === true, "every superset member is a real row in the new routine");
  check(resG.report.droppedEntries === 1, "the prescription row with a bogus exercise ref is reported as skipped");
  check(B.E("state.exercises.some(x=>x.name==='Ghost Press')") === false, "an exercise nobody references is not imported");

  section("Import: all-or-nothing when the browser refuses to save");
  const daysBefore = B.E("state.days.length"), exBefore = B.E("state.exercises.length"), nextBefore = B.E("state.counts.nextId");
  B.failOnce["perseus-v1"] = true;
  const resFail = await sendBack();
  check(resFail.ok === false && /storage/i.test(resFail.error), "a refused write is reported to the user");
  check(B.E("state.days.length") === daysBefore && B.E("state.exercises.length") === exBefore, "no routine or exercise was half-written");
  check(B.E("state.counts.nextId") === nextBefore, "the id counter rolled back too");
  const stored = JSON.parse(B.store["perseus-v1"]);
  check(stored.days.length === daysBefore, "the persisted state matches the rolled-back memory state");

  section("Import: a stale counters object cannot break id minting");
  B.E("state.counts = null");
  const resC = await sendBack();
  check(resC.ok === true && typeof B.E("state.counts.nextId") === "number", "missing counters are rebuilt (" + resC.report.name + ")");
  check(B.E("state.exercises.some(x=>x.id==='ex-id-1')") === true, "the library already owns ex-id-1 (minted by an earlier import)");
  // a payload of brand-new movements while the counter is back at 1
  const probeWire = decodeWire(codeB);
  probeWire.n = "Collision Probe Day";
  probeWire.ex.forEach((e, i) => { e.n = "Collision Probe Ex " + (i + 1); });
  const probeValid = await B.E("shareDecodeInput(" + JSON.stringify(JSON.stringify(probeWire)) + ")");
  B.E("state.counts = { nextId: 1 };");
  const resD = await importPayload(probeValid, {});
  check(resD.ok === true, "import still succeeds with a stale counter");
  check(B.E("state.exercises.filter(x=>x.id==='ex-id-1').length") === 1, "the reused id was skipped instead of overwritten");
  const ids = B.E("state.exercises.map(x=>x.id)");
  check(new Set(ids).size === ids.length, "every exercise id in the library stays unique");
  const dayIds = B.E("getDay(" + JSON.stringify(resD.dayId) + ").exercises.map(x=>x.exId)");
  check(new Set(dayIds).size === dayIds.length, "the new routine lists each movement once");

  section("Import: the receiver's own data is byte-identical afterwards");
  B.E("state.profile.apiKey = 'gsk_RECEIVER_KEY'; state.profile.aiModel = 'openai/gpt-oss-20b';" +
      "state.profile.name = 'Receiver'; state.profile.theme = 'noir';" +
      "state.profile.weightUnit = 'kg'; state.profile.experience = 'intermediate';" +
      "state.sessions.push({ id:'sess-keep', startedAt:'2026-02-02T09:00:00Z', note:'KEEPME', entries:[] });" +
      "state.pending.push({ id:'pend-keep', text:'KEEPME' });");
  const profBefore = B.E("JSON.stringify(state.profile)");
  const sessBefore = B.E("JSON.stringify(state.sessions)");
  const pendBefore = B.E("JSON.stringify(state.pending)");
  const resKeep = await sendBack();
  check(resKeep.ok === true, "the import still succeeds on a configured install");
  check(B.E("JSON.stringify(state.profile)") === profBefore, "profile is byte-identical after an import (key, model, name, theme, unit, experience)");
  check(B.E("JSON.stringify(state.sessions)") === sessBefore, "session history is untouched by an import");
  check(B.E("JSON.stringify(state.pending)") === pendBefore, "coach records are untouched by an import");
  check(B.E("state.profile.apiKey") === "gsk_RECEIVER_KEY" && B.E("state.profile.aiModel") === "openai/gpt-oss-20b", "the receiver's AI key and model survive the import");
  check(B.E("state.profile.theme") === "noir" && B.E("state.profile.name") === "Receiver", "the receiver's theme and name survive the import");
  const DAY_KEYS = ["id", "name", "type", "exercises", "supersets", "shared"];
  const dayKeys = B.E("Object.keys(getDay(" + JSON.stringify(resKeep.dayId) + "))");
  check(dayKeys.every(k => DAY_KEYS.indexOf(k) !== -1), "the imported routine carries only routine fields (" + dayKeys.slice().sort().join(",") + ")");
  check(B.E("getDay(" + JSON.stringify(resKeep.dayId) + ").shared && getDay(" + JSON.stringify(resKeep.dayId) + ").shared.unit === 'kg'") === true, "the routine records only provenance: which share and which unit it came from");
  check(typeof B.E("state.counts.nextId") === "number" && B.E("state.counts.nextId") > 0, "the id counter stays a healthy number (" + B.E("state.counts.nextId") + ")");
  const profFile = B.E("JSON.stringify(state.profile)");
  const fileValid = await B.E("shareDecodeInput(" + JSON.stringify(fileJson) + ", { fromFile:true })");
  const resFile = await importPayload(fileValid, { name: "From the file" });
  check(resFile.ok === true, "the sender's .json file imports through the same path");
  check(B.E("JSON.stringify(state.profile)") === profFile, "importing from a .json file leaves the profile untouched too");
  check(B.E("JSON.stringify(state.sessions)") === sessBefore, "importing from a .json file leaves the history untouched too");

  /* ------------------------------------------------------------------ C */
  const C = makeDom();
  const { W: WC, E: EC } = C;

  section("UI: share sheet");
  const codeC = await C.E("sharePackPayload(shareBuildPayload('day-1', {}))");
  C.E("switchView('workouts')");
  const shareBtns = C.$$("#view-workouts [data-share-day]");
  check(shareBtns.length === 2, "each routine offers a Share button (" + shareBtns.length + ")");
  check(C.$$("#view-workouts #import-share").length === 1, "the workout list offers 'Open a shared workout'");
  C.click(shareBtns[0]);
  await C.sleep(40);
  check(C.$$("#share-host .sh-card").length === 1, "share sheet opens");
  const sheetOut = C.$("#share-host [data-sh-out]");
  check(Boolean(sheetOut && sheetOut.value.indexOf("#perseus-share=P") !== -1), "sheet shows a ready share link");
  check(C.$("#share-host [data-sh-act='code']") && C.$("#share-host [data-sh-act='file']"), "sheet offers link, code and file carriers");
  C.E("Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText: function(t){ window.__copied = t; return Promise.resolve(); } } });");
  C.click(C.$("#share-host [data-sh-act='code']"));
  await C.sleep(10);
  const copied = C.E("window.__copied");
  check(typeof copied === "string" && copied.slice(0, 3) === "P0.", "Copy code copies the bare payload with no URL prefix");
  check(copied && decodeWire(copied).pid === decodeWire(codeC).pid, "the copied code is the same workout as the link");
  check(C.E("document.querySelector('#share-host').textContent.indexOf('never your history') !== -1") === true, "sheet states that history never travels");
  C.click(C.$("#share-host [data-sh-close]"));
  check(C.$$("#share-host .sh-card").length === 0, "sheet closes");

  section("UI: import dialog end to end");
  C.click(C.$("#view-workouts #import-share"));
  const ta = C.$("#share-host [data-imp-in]");
  check(Boolean(ta), "import dialog opens with a paste box");
  ta.value = "my friend sent this: " + codeC;
  C.click(C.$("#share-host [data-imp-go]"));
  await C.sleep(60);
  check(C.$$("#share-host [data-imp-add]").length === 1, "preview offers 'Add to my routines'");
  const tags = C.$$("#share-host .sh-tag");
  check(tags.length === 4, "preview tags every incoming exercise (" + tags.length + ")");
  check(C.$$("#share-host .sh-tag.keep").length === 4, "a same-install share shows all four as already yours");
  const nameIn = C.$("#share-host [data-imp-name]");
  check(Boolean(nameIn) && nameIn.value === "Workout A", "preview pre-fills the incoming name ('" + (nameIn && nameIn.value) + "')");
  check(C.$$("#share-host .sh-err").length === 1, "a routine-name clash is shown as an error");
  check(Boolean(C.$("#share-host [data-imp-add]").disabled), "Add is blocked while the name clashes");
  const daysBeforeUI = C.E("state.days.length");
  C.E("(()=>{ const el=document.querySelector('#share-host [data-imp-name]'); el.value='Workout A Shared'; el.dispatchEvent(new Event('input',{bubbles:true})); })()");
  await C.sleep(10);
  check(C.$$("#share-host .sh-err").length === 0, "the error clears once the name is free");
  check(C.$("#share-host [data-imp-add]").disabled === false, "Add unlocks for a free name");
  C.click(C.$("#share-host [data-imp-add]"));
  await C.sleep(60);
  check(C.E("state.days.length") === daysBeforeUI + 1, "clicking Add imported the routine");
  check(C.E("state.days[state.days.length-1].name") === "Workout A Shared", "the routine lands under the chosen name");
  check(C.$$("#share-host [data-sh-open]").length === 1, "result view offers to open the new routine");
  check(C.E("state.exercises.some(x=>x.name==='Ring Dip')") === true, "the shared exercises landed in the receiver's library");
  C.click(C.$("#share-host [data-sh-open]"));
  check(C.E("planMode") === "edit" && C.E("planEditId") === C.E("state.days[state.days.length-1].id"), "Open routine jumps into the imported routine");

  section("UI: a share link opens by itself");
  C.E("location.hash = '#perseus-share=' + " + JSON.stringify(codeC));
  C.E("shareHandleDeepLink()");
  await C.sleep(60);
  check(C.$$("#share-host .sh-card").length === 1, "the deep link opened the import dialog");
  check(C.$$("#share-host [data-imp-add]").length === 1, "the deep link previewed the workout without a click");
  check(C.E("location.hash") === "" || C.E("location.hash") === "#", "the share hash is consumed so a refresh does not re-open it");
  check(C.E("document.querySelector('#share-host').textContent.indexOf('already imported') !== -1") === true, "an already-imported share says so");
  C.E("shareHandleDeepLink()");
  check(C.E("location.hash") === "" || C.E("location.hash") === "#", "an unrelated hash stays untouched");

  section("Runtime errors");
  const errs = A.errors.concat(B.errors, C.errors);
  check(errs.length === 0, "no window errors" + (errs.length ? " -> " + errs.join(" | ") : ""));

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
