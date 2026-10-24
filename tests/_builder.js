/* Workout maker: the format question, local format-aware generation, and the
   GroqCloud path. The format is a contract: a regular session stays straight
   sets, and supersets only appear when explicitly requested. */
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
    window.addEventListener("error", e => errors.push(e && e.message || String(e)));
  },
});
const W = dom.window;
const $ = s => W.document.querySelector(s);
const $$ = s => Array.from(W.document.querySelectorAll(s));
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
};
const section = t => console.log("\n== " + t + " ==");
const click = el => el && el.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

function setBrief(patch) {
  E("Object.assign(builderState, " + JSON.stringify(patch) + ", { attempt: 0 })");
  E("builderInvalidate()");
}
function localDraft(patch) {
  setBrief(patch);
  return E("generateWorkout(builderState)");
}
const kinds = d => Array.from(new Set(d.groups.map(g => g.type)));

(async () => {
  section("Format question in the seven-step flow");
  W.switchView("workouts");
  click($("#view-workouts [data-builder-open]"));
  check($$("#builder-host [data-bld-step]").length === 7, "builder has seven steps");
  check($$("#builder-host [data-bld-step]")[1].textContent.trim().indexOf("Format") !== -1, "step 2 is Format");
  check(E("builderState.format") === "regular", "regular is the default format");
  check($$("#builder-host .bld-stage [data-bld-format]").length === 0, "format choices are not on the goal step");

  click($$("#builder-host [data-bld-goal]")[0]);
  check(E("builderState.step") === 1, "choosing a goal advances to the format step");
  const fmtBtns = $$("#builder-host [data-bld-format]");
  check(fmtBtns.length === 4, "four session formats offered");
  const labels = fmtBtns.map(b => b.textContent.replace(/\s+/g, " ").trim());
  check(labels.some(t => /Regular session/i.test(t)), "regular session offered");
  check(labels.some(t => /More fun/i.test(t)), "fun session offered");
  check(labels.some(t => /Specific type/i.test(t)), "specific workout type offered");
  check(labels.some(t => /Surprise me/i.test(t)), "surprise offered");

  click($$("#builder-host [data-bld-format]").find(b => b.dataset.bldFormat === "regular"));
  check(E("builderState.format") === "regular" && E("builderState.step") === 2, "regular advances to focus");

  E("builderState.step = 1; renderWorkoutBuilder()");
  click($$("#builder-host [data-bld-format]").find(b => b.dataset.bldFormat === "specific"));
  check(E("builderState.step") === 1, "specific type stays on the format step");
  check($$("#builder-host [data-bld-style]").length === 4, "four specific structures offered");
  click($$("#builder-host [data-bld-style]").find(b => b.dataset.bldStyle === "dropset"));
  check(E("builderState.style") === "dropset" && E("builderState.step") === 2, "choosing a structure advances");

  section("Local generation follows the requested format");
  const regular = localDraft({ format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  check(regular.groups.length > 0, "regular session has groups");
  check(regular.groups.every(g => g.type === "straight"), "regular is all straight sets");
  check(regular.supersets.length === 0, "regular has no supersets");
  check(regular.source === "local", "local draft is labelled local");
  check(/Straight sets/i.test(regular.rationale), "regular rationale explains the straight structure");

  const fun = localDraft({ format: "fun", style: "mix", experience: "intermediate", duration: 45 });
  check(fun.groups.some(g => g.type !== "straight"), "fun includes a playful block");
  check(fun.groups.some(g => g.type === "straight"), "fun also keeps straight work");
  check(Boolean(fun.finisher), "fun adds a finisher for an intermediate lifter");

  const supersets = localDraft({ format: "specific", style: "superset", experience: "intermediate", duration: 45 });
  check(supersets.groups.some(g => g.type === "superset"), "superset style creates paired blocks");
  check(supersets.groups.every(g => g.type === "straight" || g.members.length === 2), "superset blocks hold exactly two movements");
  check(supersets.groups.filter(g => g.type === "superset").every(g => g.members.length === 2), "no single-movement supersets");

  const circuit = localDraft({ format: "specific", style: "circuit", experience: "intermediate", duration: 45 });
  check(circuit.groups.some(g => g.type === "circuit"), "circuit style creates rounds");
  check(circuit.groups.filter(g => g.type === "circuit").every(g => g.members.length >= 2 && g.members.length <= 3), "each round has 2-3 movements");

  const ladder = localDraft({ format: "specific", style: "ladder", experience: "intermediate", duration: 45 });
  check(ladder.groups.every(g => g.type === "straight"), "ladder stays straight");
  const ladderMoves = ladder.exercises.filter(de => Array.isArray(de.setReps) || Array.isArray(de.setTimes));
  const monotonic = arr => arr.every((v, i) => i === 0 || v >= arr[i - 1]) || arr.every((v, i) => i === 0 || v <= arr[i - 1]);
  check(ladderMoves.length > 0 && ladderMoves.every(de => monotonic(de.setReps || de.setTimes)), "ladder reps climb or fall each set");

  const drops = localDraft({ format: "specific", style: "dropset", experience: "intermediate", duration: 45 });
  check(drops.groups.every(g => g.type === "straight"), "drop sets stay straight");
  check(drops.exercises.every(de => de.setTypes[de.targetSets - 1] === "drop"), "every drop-set exercise ends in a drop set");

  const surprise = localDraft({ format: "surprise", style: "surprise", experience: "intermediate", duration: 45 });
  check(kinds(surprise).length >= 2, "surprise combines at least two structures (got " + kinds(surprise).join(", ") + ")");
  check(surprise.groups.some(g => g.type === "straight"), "surprise still keeps some straight work");

  section("Saving preserves the requested structure");
  const before = E("state.days.length");
  E("builderState.draft = generateWorkout(builderState)");
  E("builderSave(false)");
  const after = E("state.days.length");
  check(after === before + 1, "saving adds a routine");
  const saved = E("state.days[state.days.length - 1]");
  check(saved.supersets.length === surprise.supersets.length, "saved supersets match the draft");

  section("No API key falls back to the local maker");
  E("state.profile.apiKey = ''");
  E("openWorkoutBuilder()");
  E("builderState.format = 'fun'");
  const noKey = await E("builderBuild()");
  check(E("builderState.step") === 6, "build jumps to the preview step");
  check(noKey.source === "local", "no-key build is local");
  check(/GroqCloud API key/i.test(E("builderState.aiNote")), "the note explains how to enable AI");

  section("GroqCloud writes a valid session");
  let captured = null;
  const draftEx = E("JSON.stringify(builderPool(builderState, 6).map(e=>({id:e.id,name:e.name,mode:e.mode})))");
  const lib = JSON.parse(draftEx);
  const aiDraft = {
    name: "Groq Straight Engine",
    rationale: "Straight sets keep every rep honest.",
    restSec: 75,
    warmup: ["Arm circles", "Scapular push-ups"],
    cooldown: ["Easy walk"],
    groups: lib.slice(0, 3).map(x => ({
      type: "straight",
      exercises: [{
        exId: x.id,
        sets: 3,
        reps: x.mode === "time" ? undefined : [8, 8, 8],
        time: x.mode === "time" ? [30, 30, 30] : undefined,
        setTypes: ["regular", "regular", "regular"],
        weight: 0,
      }],
    })),
  };
  W.fetch = (url, opts) => {
    captured = { url, opts };
    return Promise.resolve({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(aiDraft) } }] }),
    });
  };
  E("state.profile.apiKey = 'test-key'");
  setBrief({ format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  const ai = await E("builderBuild()");
  check(ai && ai.source === "ai", "valid AI session is used");
  check(ai.name === "Groq Straight Engine", "AI name is kept");
  check(ai.groups.length === 3 && ai.groups.every(g => g.type === "straight"), "AI regular session stays straight");
  check(ai.rest === 75, "AI rest is kept within range");
  check(captured && captured.url === E("GROQ_ENDPOINT"), "GroqCloud endpoint used");
  const body = JSON.parse(captured.opts.body);
  check(body.model === E("AI_MODELS[state.profile.aiModel] ? state.profile.aiModel : GROQ_MODEL"), "selected model is sent");
  check(/Never default to supersets/i.test(body.messages[0].content), "system prompt forbids defaulting to supersets");
  const payload = JSON.parse(body.messages[1].content);
  check(payload.request.format === "regular", "payload carries the regular format");
  check(payload.request.shapeRules.join(" ").indexOf("straight sets only") !== -1, "payload demands straight sets");
  check(Array.isArray(payload.library) && payload.library.length > 0, "payload includes the exercise library");
  check(E("builderState.aiNote") === "", "no fallback note for a valid AI session");

  section("An AI session that ignores the format is rejected");
  const bad = JSON.parse(JSON.stringify(aiDraft));
  bad.groups = [
    { type: "superset", exercises: [
      { exId: lib[0].id, sets: 3, reps: [8, 8, 8], setTypes: ["regular", "regular", "regular"], weight: 0 },
      { exId: lib[1].id, sets: 3, reps: [8, 8, 8], setTypes: ["regular", "regular", "regular"], weight: 0 },
    ] },
  ];
  W.fetch = () => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(bad) } }] }),
  });
  setBrief({ format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  const rejected = await E("builderBuild()");
  check(rejected.source === "local", "invalid shape falls back to local");
  check(rejected.groups.every(g => g.type === "straight"), "fallback still respects the regular format");
  check(/did not match your request/i.test(E("builderState.aiNote")), "the fallback note explains the shape mismatch");

  section("An AI ladder must actually climb or fall");
  const ladderBody = reps => ({
    name: "Groq Ladder",
    rationale: "Ladder reps.",
    restSec: 60,
    groups: lib.slice(0, 2).map(x => ({
      type: "straight",
      exercises: [{ exId: x.id, sets: 3, reps, setTypes: ["regular", "regular", "regular"], weight: 0 }],
    })),
  });
  W.fetch = () => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(ladderBody([8, 12, 6])) } }] }),
  });
  setBrief({ format: "specific", style: "ladder", experience: "intermediate", duration: 45 });
  const badLadder = await E("builderBuild()");
  check(badLadder.source === "local", "a non-monotonic AI ladder is rejected");
  W.fetch = () => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(ladderBody([6, 8, 10])) } }] }),
  });
  setBrief({ format: "specific", style: "ladder", experience: "intermediate", duration: 45 });
  const goodLadder = await E("builderBuild()");
  check(goodLadder.source === "ai", "a climbing AI ladder is accepted");
  check(goodLadder.groups.every(g => g.type === "straight"), "the accepted ladder stays straight");

  section("A GroqCloud failure falls back safely");
  W.fetch = () => Promise.reject(new Error("network down"));
  setBrief({ format: "specific", style: "circuit", experience: "intermediate", duration: 45 });
  const failed = await E("builderBuild()");
  check(failed.source === "local", "network failure uses the local maker");
  check(failed.groups.some(g => g.type === "circuit"), "local fallback keeps the requested circuit");
  check(/unavailable/i.test(E("builderState.aiNote")), "the failure note is shown");

  section("Runtime health");
  check(errors.length === 0, "no page errors (got " + errors.length + (errors.length ? ": " + errors.join("; ") : "") + ")");

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error(err);
  console.log("\nRESULT: " + pass + " passed, " + (fail + 1) + " failed");
  process.exit(1);
});
