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
  section("Approach question in the eight-step flow");
  W.switchView("workouts");
  click($("#view-workouts [data-builder-open]"));
  check($$("#builder-host [data-bld-step]").length === 9, "builder has nine steps");
  check($$("#builder-host [data-bld-step]")[1].textContent.trim().indexOf("Approach") !== -1, "step 2 is Approach");
  check(E("builderState.format") === "regular", "regular is the default format");
  check(E("builderState.approach") === "volume", "hypertrophy defaults to the High Volume approach");
  check($$("#builder-host .bld-stage [data-bld-format]").length === 0, "format choices are not on the goal step");

  click($$("#builder-host [data-bld-goal]")[1]);
  check(E("builderState.step") === 1, "choosing a goal advances to the approach step");
  const approachBtns = $$("#builder-host [data-bld-approach]");
  check(approachBtns.length === 3, "three hypertrophy approaches offered");
  const approachLabels = approachBtns.map(b => b.textContent.replace(/\s+/g, " ").trim());
  check(approachLabels.some(t => /High Volume/i.test(t)), "high volume offered");
  check(approachLabels.some(t => /High Intensity, Low Volume/i.test(t)), "high intensity low volume offered");

  click(approachBtns.find(b => b.dataset.bldApproach === "intensity"));
  check(E("builderState.approach") === "intensity" && E("builderState.step") === 2, "choosing an approach advances to the format step");
  const fmtBtns = $$("#builder-host [data-bld-format]");
  check(fmtBtns.length === 4, "four session formats offered");
  const labels = fmtBtns.map(b => b.textContent.replace(/\s+/g, " ").trim());
  check(labels.some(t => /Regular session/i.test(t)), "regular session offered");
  check(labels.some(t => /More fun/i.test(t)), "fun session offered");
  check(labels.some(t => /Specific type/i.test(t)), "specific workout type offered");
  check(labels.some(t => /Surprise me/i.test(t)), "surprise offered");

  click($$("#builder-host [data-bld-format]").find(b => b.dataset.bldFormat === "regular"));
  check(E("builderState.format") === "regular" && E("builderState.step") === 3, "regular advances to focus");

  E("builderState.step = 2; renderWorkoutBuilder()");
  click($$("#builder-host [data-bld-format]").find(b => b.dataset.bldFormat === "specific"));
  check(E("builderState.step") === 2, "specific type stays on the format step");
  check($$("#builder-host [data-bld-style]").length === 4, "four specific structures offered");
  click($$("#builder-host [data-bld-style]").find(b => b.dataset.bldStyle === "dropset"));
  check(E("builderState.style") === "dropset" && E("builderState.step") === 3, "choosing a structure advances");

  section("The approach fixes sets and failure");
  const lowVol = localDraft({ goal: "hypertrophy", approach: "intensity", format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  check(lowVol.exercises.every(de => de.targetSets === 2), "low-volume hypertrophy uses exactly 2 sets");
  check(lowVol.exercises.every(de => de.setTypes[1] === "failure"), "the second set is planned to failure");
  const highVol = localDraft({ goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  check(highVol.exercises.every(de => de.targetSets === 4), "high-volume hypertrophy uses 4 sets");
  check(highVol.exercises.every(de => de.setTypes.indexOf("failure") === -1), "high-volume work stays short of failure");
  check(lowVol.groups[0].restSec > highVol.groups[0].restSec, "low-volume work gets longer rest");
  const heavy = localDraft({ goal: "strength", approach: "intensity", format: "regular", style: "straight", experience: "advanced", duration: 45 });
  check(heavy.exercises.every(de => de.targetSets === 4), "maximal strength uses 4 sets");
  check(heavy.exercises.every(de => (de.setReps || []).every(r => r >= 3 && r <= 5)), "maximal strength stays in the 3-5 rep zone");
  const volStrength = localDraft({ goal: "strength", approach: "volume", format: "regular", style: "straight", experience: "advanced", duration: 45 });
  check(volStrength.exercises.every(de => de.targetSets === 5), "5x5 strength uses 5 sets");
  check(volStrength.exercises.every(de => (de.setReps || []).every(r => r >= 5 && r <= 6)), "5x5 strength stays in the 5-6 rep zone");
  const cluster = localDraft({ goal: "strength", approach: "cluster", format: "regular", style: "straight", experience: "advanced", duration: 45 });
  check(cluster.exercises.every(de => (de.setReps || []).every(r => r === 3)), "cluster sets use triples");
  const intervals = localDraft({ goal: "endurance", approach: "intervals", format: "regular", style: "straight", experience: "intermediate", duration: 45 });
  check(intervals.exercises.filter(de => de !== intervals.finisher).every(de => de.targetSets === 6), "endurance intervals use 6 sets");
  check(intervals.exercises.every(de => !de.setTimes || de.setTimes.every(t => t >= 20 && t <= 30)), "interval holds stay in the 20-30s window");

  section("Local generation follows the requested format");
  const regular = localDraft({ goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45 });
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

  const drops = localDraft({ goal: "hypertrophy", approach: "volume", format: "specific", style: "dropset", experience: "intermediate", duration: 45 });
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
  check(E("builderState.step") === 8, "build jumps to the preview step");
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
  setBrief({ goal: "hypertrophy", approach: "intensity", format: "regular", style: "straight", experience: "intermediate", duration: 45 });
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
  check(payload.request.approach && payload.request.approach.id === "intensity", "payload carries the chosen approach");
  check(payload.request.approach.failurePolicy === "last" && payload.request.approach.setCount === 2, "payload states set count and failure policy");
  check(/Schoenfeld|ACSM/.test(payload.request.approach.evidence), "payload carries the research evidence");
  check(payload.request.approach.repRange[0] === 6 && payload.request.approach.repRange[1] === 12, "payload carries the approach rep range");
  check(payload.request.repZones.hypertrophy[0] === 6 && payload.request.repZones.hypertrophy[1] === 12, "effective rep zones match the approach");
  check(payload.request.shapeRules.join(" ").indexOf("TRAINING APPROACH") !== -1, "shape rules enforce the approach");
  check(ai.exercises.every(de => de.targetSets === 2), "AI exercises follow the approach set count");
  check(ai.exercises.every(de => de.setTypes[1] === "failure"), "AI exercises finish to failure when the approach asks");
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
  setBrief({ goal: "hypertrophy", approach: "volume", format: "specific", style: "ladder", experience: "intermediate", duration: 45 });
  const badLadder = await E("builderBuild()");
  check(badLadder.source === "local", "a non-monotonic AI ladder is rejected");
  W.fetch = () => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(ladderBody([6, 8, 10])) } }] }),
  });
  setBrief({ goal: "hypertrophy", approach: "volume", format: "specific", style: "ladder", experience: "intermediate", duration: 45 });
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

  section("Full gym gear leans on the machines in a commercial gym");
  setBrief({ goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()"), customEquipment: [] });
  const gymRules = E("workoutShapeRules(builderState).join(' ')");
  check(/machine/i.test(gymRules), "full-gym gear asks the AI to program machines");
  check(/leg press/i.test(gymRules), "the machine rule names kit common in gyms");
  const gymPayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(gymPayload.request.machineBias === true, "the payload flags a machine bias");
  check(gymPayload.request.shapeRules.join(" ") === gymRules, "the payload carries the same machine rules");

  setBrief({ equipment: E("BUILDER_HOME_EQUIP.slice()") });
  const homeRules = E("workoutShapeRules(builderState).join(' ')");
  check(homeRules.indexOf("leg press") === -1, "home gear does not ask for gym machines");
  const homePayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(homePayload.request.machineBias === false, "home gear carries no machine bias");

  setBrief({ equipment: ["bodyweight"] });
  const bodyPayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(bodyPayload.request.machineBias === false, "body-weight-only gear carries no machine bias");

  section("The maker keeps the interface steady while it moves");
  E("openWorkoutBuilder()");
  E("builderState.step = 4; builderState.equipment = BUILDER_HOME_EQUIP.slice(); renderWorkoutBuilder()");
  const stageNode = $("#builder-host .bld-stage");
  const chipNode = $$("#builder-host [data-bld-step]")[0];
  const qNode = $("#builder-host .bld-q");
  check(!!stageNode && !!chipNode && !!qNode, "the gear step is mounted");

  E("builderState.equipment.push('kettlebell'); builderInvalidate(); renderWorkoutBuilder()");
  check($("#builder-host .bld-stage") === stageNode, "toggling gear does not rebuild the stage node");
  check($$("#builder-host [data-bld-step]")[0] === chipNode, "toggling gear does not rebuild the step chips");
  check($("#builder-host .bld-q") === qNode, "the question heading survives an in-step render");

  const dumbTile = $("#builder-host [data-bld-equip='dumbbell']");
  const presetTile = $("#builder-host [data-bld-preset='home']");
  click($("#builder-host [data-bld-equip='dumbbell']"));
  check($("#builder-host [data-bld-equip='dumbbell']") === dumbTile, "the clicked gear tile survives its own click");
  check(!dumbTile.classList.contains("on"), "clicking the tile turns it off in place");
  check($("#builder-host [data-bld-preset='home']") === presetTile, "the preset chips keep their nodes");
  click($("#builder-host [data-bld-equip='dumbbell']"));
  check(dumbTile.classList.contains("on"), "clicking it again turns it back on in place");

  E("renderWorkoutBuilder()");
  check($("#builder-host .bld-q") === qNode, "a render with nothing changed touches nothing");

  E("builderState.step = 6; renderWorkoutBuilder()");
  check($("#builder-host .bld-stage") === stageNode, "the stage node survives a step change");
  check(stageNode.getAttribute("data-bld-dir") === "1", "moving forward is marked as a forward motion");
  check(($$("#builder-host [data-bld-step]")[4].className || "").indexOf("done") !== -1, "the gear chip reads as done after moving on");
  check(/time and effort/i.test($("#builder-host .bld-q").textContent), "the stage now shows the time question");
  E("builderState.step = 4; renderWorkoutBuilder()");
  check(stageNode.getAttribute("data-bld-dir") === "-1", "going back is marked as a backward motion");

  const timeVal = $$("#builder-host .bld-brief-v")[6];
  check(timeVal.textContent === "30 min", "the brief starts at 30 min");
  E("builderState.duration = 45; renderWorkoutBuilder()");
  check($$("#builder-host .bld-brief-v")[6] === timeVal, "the brief value keeps its node");
  check(timeVal.textContent === "45 min", "the brief value updates in place");

  E("closeWorkoutBuilder()");
  E("openWorkoutBuilder()");
  check($("#builder-host .bld-stage") !== stageNode, "reopening the maker starts a fresh shell");

  section("The focus step shows the right artwork");
  E("openWorkoutBuilder()");
  E("builderState.step = 3; renderWorkoutBuilder()");
  const fullCardImg = $("#builder-host [data-bld-focus='full'] img");
  check(!!fullCardImg && fullCardImg.getAttribute("src") === "icon_muscles/full-body.png", "the full-body card uses the muscle map artwork");

  section("The movements question decides who writes the exercises");
  E("openWorkoutBuilder()");
  E("builderState.step = 5; renderWorkoutBuilder()");
  const moveBtns = $$("#builder-host [data-bld-movement]");
  check(moveBtns.length === 3, "three movement sources offered");
  check(E("builderState.movement") === "library", "the library is the default source");
  const moveLabels = moveBtns.map(b => b.textContent.replace(/\s+/g, " ").trim());
  check(moveLabels.some(t => /My library/i.test(t)), "library only offered");
  check(moveLabels.some(t => /AI picks them/i.test(t)), "AI-chosen movements offered");
  check(moveLabels.some(t => /Mix both/i.test(t)), "mix offered");
  click(moveBtns.find(b => b.dataset.bldMovement === "mix"));
  check(E("builderState.movement") === "mix", "clicking a source selects it");
  check(E("builderState.step") === 5, "the movements step waits for Continue");
  check($$("#builder-host .bld-brief-v")[5].textContent === "Mix both", "the brief names the movement source");

  section("The AI can write a movement the library does not have");
  const newMove = {
    newMovement: true,
    name: "Cable Squat Row",
    movementType: "weight",
    instructions: "Sit into a squat, then row the handle to the ribs.",
    canAddLoad: true,
    perSide: false,
    bodyweightLoad: 20,
    equipment: ["machine", "cable", "barbell"],
    bodyParts: ["Back", "Thighs", "Arms"],
    primaryMuscles: ["Latissimus dorsi", "Quadriceps"],
    secondaryMuscles: ["Biceps brachii", "Imaginary muscle"],
    sets: 3,
    reps: [10, 10, 10],
    setTypes: ["regular", "regular", "regular"],
    weight: 25,
  };
  const writtenDraft = {
    name: "Built Beside the Library",
    rationale: "One written movement beside one the athlete already owns.",
    restSec: 90,
    groups: [
      { type: "straight", exercises: [newMove] },
      { type: "straight", exercises: [{ exId: lib[0].id, sets: 3, reps: [8, 8, 8], setTypes: ["regular", "regular", "regular"], weight: 0 }] },
    ],
  };
  W.fetch = () => Promise.resolve({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(writtenDraft) } }] }),
  });
  E("state.profile.apiKey = 'test-key'");
  setBrief({ movement: "mix", goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()") });
  const mixed = await E("builderBuild()");
  check(mixed.source === "ai", "a mixed session with a written movement is accepted");
  check(mixed.newExercises.length === 1, "the written movement is held by the draft");
  const made = mixed.newExercises[0];
  check(made.name === "Cable Squat Row", "the written movement keeps its name");
  check(made.mode === "reps" && made.weightAvailable === true, "a weighted movement takes load and reps");
  check(made.perSide === false, "the per-side flag is read");
  check(made.instructions.indexOf("squat") !== -1, "the instructions are kept");
  check(made.equipment.indexOf("machine") !== -1 && made.equipment.indexOf("barbell") !== -1, "known gear is kept");
  check(made.equipment.indexOf("cable") === -1, "gear with no app tag is dropped");
  check(made.bodyParts.join(",") === "Back,Thighs", "unknown body parts are dropped (" + made.bodyParts.join(",") + ")");
  check(made.primaryMuscles.length === 2, "both primary muscles are kept");
  check(made.secondaryMuscles.join(",") === "Biceps brachii", "unknown muscles are dropped");
  check(made.loadFactor === 0 && made.loadSource === "ai", "a weighted movement carries no body-weight share");
  check(E("!!getEx(builderState.draft.newExercises[0].id)") === false, "nothing is written to the library before saving");
  E("renderWorkoutBuilder()");
  check($$("#builder-host .bld-new").length === 1, "the preview tags the written movement");
  const libBefore = E("state.exercises.length");
  E("builderSave(false)");
  const savedDay = E("state.days[state.days.length - 1]");
  check(E("state.exercises.length") === libBefore + 1, "saving adds the written movement to the library");
  check(savedDay.aiExIds.length === 1 && savedDay.aiExIds[0] === made.id, "the routine remembers the movement it brought in");
  check(savedDay.userEdited === false, "a freshly saved routine counts as untouched");
  const libEx = E("getEx('" + made.id + "')");
  check(!!libEx && libEx.origin === "ai" && libEx.instructions.length > 0, "the library copy keeps its instructions and AI origin");

  section("Library-only never writes a movement");
  E("openWorkoutBuilder()");
  setBrief({ movement: "library", goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()") });
  const libOnly = await E("builderBuild()");
  check(libOnly.newExercises.length === 0, "nothing is written when only the library is allowed");
  check(libOnly.exercises.length > 0, "the library movements are still used");
  check(libOnly.exercises.every(de => de.exId !== made.id), "the written movement is dropped from the session");
  E("closeWorkoutBuilder()");

  section("Deleting an untouched AI routine takes its movements with it");
  const beforeDelete = E("state.exercises.length");
  E("deleteRoutineDay('" + savedDay.id + "')");
  check(E("state.days.some(d=>d.id==='" + savedDay.id + "')") === false, "the routine is gone");
  check(E("state.exercises.length") === beforeDelete - 1, "its AI movement left with it");
  check(E("!!getEx('" + made.id + "')") === false, "the movement is no longer in the library");

  section("Editing the routine once keeps its AI movements");
  E("openWorkoutBuilder()");
  setBrief({ movement: "mix", goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()") });
  const second = await E("builderBuild()");
  check(second.newExercises.length === 1, "the movement is written again for the new session");
  const secondMade = second.newExercises[0];
  E("builderSave(false)");
  const day2 = E("state.days[state.days.length - 1]");
  E("markRoutineEdited('" + day2.id + "')");
  const keptBefore = E("state.exercises.length");
  E("deleteRoutineDay('" + day2.id + "')");
  check(E("state.exercises.length") === keptBefore, "an edited routine leaves its movement in the library");
  check(E("!!getEx('" + secondMade.id + "')") === true, "the movement survives the delete");

  section("The request never tells the AI to stay inside the library when it may write");
  E("openWorkoutBuilder()");
  setBrief({ movement: "library", goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()") });
  const libPayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(/Use only library exIds/.test(libPayload.instruction), "library mode still forbids writing");
  setBrief({ movement: "ai" });
  const aiModePayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(!/Use only library exIds/.test(aiModePayload.instruction), "AI mode does not demand library-only exercises");
  check(/at least one movement of your own/i.test(aiModePayload.request.shapeRules.join(" ")), "AI mode asks for a movement of its own");
  check(!/May write better-fitting/i.test(E("BUILDER_MOVEMENTS.ai.desc")), "the AI card no longer says it merely may write");
  setBrief({ movement: "mix" });
  const mixPayload = JSON.parse(E("JSON.stringify(buildWorkoutPayload(builderState))"));
  check(!/Use only library exIds/.test(mixPayload.instruction), "mix mode does not demand library-only exercises");
  check(!/Never invent an id/.test(E("WORKOUT_SYSTEM_PROMPT")), "the system prompt no longer forbids writing outright");

  section("A movement written in everyday words is kept, not thrown away");
  const everyday = {
    newMovement: true,
    name: "Sandbag Zercher Press",
    movementType: "weight",
    instructions: "Hold the bag in the crook of the elbows and press.",
    canAddLoad: true,
    perSide: false,
    bodyweightLoad: 0,
    equipment: ["cables", "body weight"],
    bodyParts: ["Quads"],
    primaryMuscles: ["Chest"],
    secondaryMuscles: ["Triceps brachii"],
    sets: 3,
    reps: [10, 10, 10],
    setTypes: ["regular", "regular", "regular"],
    weight: 20,
  };
  const em = JSON.parse(E("JSON.stringify(builderAIMadeExercise(" + JSON.stringify(everyday) + ", builderState))"));
  check(!!em, "a body part named as a muscle no longer drops the movement");
  check(!!em && em.primaryMuscles.indexOf("Pectoralis major") !== -1, "the body part expands to real muscles (" + (em ? em.primaryMuscles.join(",") : "") + ")");
  check(!!em && em.bodyParts.indexOf("Thighs") !== -1, "slang body parts resolve (Quads -> Thighs)");
  check(!!em && em.equipment.indexOf("machine") !== -1, "a loose gear word resolves (cables -> machine)");

  section("A library-only AI answer is corrected once");
  const libOnlyDraft = name => ({
    name: name,
    rationale: "Straight sets from the library.",
    restSec: 75,
    groups: lib.slice(0, 3).map(x => ({
      type: "straight",
      exercises: [{ exId: x.id, sets: 3, reps: [8, 8, 8], setTypes: ["regular", "regular", "regular"], weight: 0 }],
    })),
  });
  const retryMove = Object.assign({}, newMove, { name: "Weighted Hollow Rock Press" });
  const retryDraft = {
    name: "Corrected Engine",
    rationale: "One written movement, as the source asked.",
    restSec: 75,
    groups: [
      { type: "straight", exercises: [retryMove] },
      { type: "straight", exercises: [{ exId: lib[0].id, sets: 3, reps: [8, 8, 8], setTypes: ["regular", "regular", "regular"], weight: 0 }] },
    ],
  };
  let calls = 0;
  W.fetch = () => {
    calls++;
    const content = JSON.stringify(calls === 1 ? libOnlyDraft("Library Only") : retryDraft);
    return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
  };
  setBrief({ movement: "ai", goal: "hypertrophy", approach: "volume", format: "regular", style: "straight", experience: "intermediate", duration: 45, equipment: E("ALL_EQUIP.slice()") });
  const corrected = await E("builderBuild()");
  check(calls === 2, "a library-only answer triggers one corrective request");
  check(corrected.newExercises.length === 1, "the corrected answer's written movement is kept");
  check(E("builderState.aiNote") === "", "no note when the correction lands");

  calls = 0;
  W.fetch = () => {
    calls++;
    return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(libOnlyDraft("Never Writes")) } }] }) });
  };
  const stayed = await E("builderBuild()");
  check(calls === 2, "the correction is attempted only once");
  check(stayed.newExercises.length === 0, "a still-library-only answer is used rather than discarded");
  check(/no new movements/i.test(E("builderState.aiNote")), "the note says no movements were written");

  section("Runtime health");
  check(errors.length === 0, "no page errors (got " + errors.length + (errors.length ? ": " + errors.join("; ") : "") + ")");

  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error(err);
  console.log("\nRESULT: " + pass + " passed, " + (fail + 1) + " failed");
  process.exit(1);
});
