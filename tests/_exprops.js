/* Focused test for the redesigned exercise editor (type cards, instructions,
   body parts, primary/secondary muscles, weighted toggle). */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const errors = [];

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
  beforeParse(w){
    w.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    w.scrollTo=()=>{ };
    w.addEventListener("error", e=>errors.push(e&&e.message||String(e)));
  },
});
const W = dom.window;
const $ = sel => W.document.querySelector(sel);
const $$ = sel => Array.from(W.document.querySelectorAll(sel));
const E = expr => W.eval(expr);

let pass=0,fail=0;
const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

// Open the new-exercise editor.
W.switchView("library");
E("openExEditor(null)");
const host = $("#ex-editor-host");
check(Boolean(host && host.innerHTML.trim()), "editor rendered");
check(Boolean($("#ex-name")), "name field present");
check(Boolean($("#ex-instructions")), "instructions textarea present");
check(Boolean($("#ex-instructions").placeholder), "instructions has placeholder");
check($$(".ex-type-card").length === 3, "three exercise-type cards shown");
check(Boolean($(".ex-type-card.selected")), "a default type is selected");
check($(".ex-type-card.selected") ? $(".ex-type-card.selected").textContent.indexOf("Bodyweight")===0 : false, "new exercise defaults to Bodyweight");

// Weighted toggle visibility follows the chosen type.
function sel(t){ $$(".ex-type-card").forEach(c=>{ if(c.dataset.type===t) c.dispatchEvent(new W.MouseEvent("click",{bubbles:true})); }); }
sel("duration");
check($("#ex-weightable-row") && $("#ex-weightable-row").style.display !== "none", "Duration shows weighted toggle");
sel("weight");
check($("#ex-weightable-row").style.display === "none", "Weight & reps hides weighted toggle");

// Fill the form and save as a new weight&reps dumbbell exercise.
sel("weight");
$("#ex-name").value = "Dumbbell Bench Press";
$("#ex-instructions").value = "Lie back on the bench, press the dumbbells up, lower to the chest and press.";
["bodyweight","dumbbell"].forEach(v=>{ const c=$$(".eqbox").find(x=>x.value===v); if(c){c.checked=true;c.dispatchEvent(new W.Event("change",{bubbles:true}));} });
// Body parts / muscles are chosen via pop-up pickers: click the summary
// rectangle, tick the checkboxes in the overlay, then press OK.
function pick(field, names){
  $(".ex-pick[data-pick='"+field+"']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const ov = $(".ex-pick-overlay");
  check(Boolean(ov), field+" picker opened");
  Array.from(ov.querySelectorAll("input[type=checkbox]")).forEach(c=>{
    if (names.includes(c.value)){ c.checked=true;c.dispatchEvent(new W.Event("change",{bubbles:true})); }
  });
  ov.querySelector(".ex-pick-ok").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  check(!$(".ex-pick-overlay"), field+" picker closed after OK");
}
pick("bodyParts", ["Chest","Arms"]);
pick("primaryMuscles", ["Pectoralis major","Triceps brachii"]);
pick("secondaryMuscles", ["Biceps brachii","Anterior deltoid"]);
$("#ex-save").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));

const created = E("state.exercises.find(x=>x.name==='Dumbbell Bench Press')");
check(Boolean(created), "new exercise saved");
if (created){
  check(created.type==="weight", "saved type='weight'");
  check(created.mode==="reps", "weight type maps to mode='reps'");
  check(created.weightAvailable===true, "weight type forces weightAvailable");
  check(created.instructions.indexOf("press")!==-1, "instructions persisted");
  check(created.bodyParts.includes("Chest"), "body part Chest persisted");
  check(created.primaryMuscles.includes("Pectoralis major"), "primary muscle persisted");
  check(created.secondaryMuscles.includes("Anterior deltoid"), "secondary muscle persisted");
}

// Editing an existing legacy duration exercise picks up Duration type + weighted.
const plank = E("state.exercises.find(x=>x.name==='Plank')");
if (plank){
  E("openExEditor('"+plank.id+"')");
  check($(".ex-type-card.selected") ? $(".ex-type-card.selected").dataset.type==="duration" : false, "legacy time-mode exercise opens as Duration");
}

// A legacy bodyweight reps exercise that was intentionally weightable opens as Weight.
const weightedBW = { id:"twe", name:"Weighted Pull-Up", mode:"reps", equipment:["pullup"], weightAvailable:true, defaultSets:3, defaultReps:6, defaultTime:30, defaultWeight:0, notes:"" };
E("state.exercises.push("+JSON.stringify(weightedBW)+")");
E("openExEditor('twe')");
check($(".ex-type-card.selected").dataset.type==="weight", "weighted reps exercise opens as Weight & reps");
E("document.querySelector('#ex-close').click()");

check(errors.length===0, "no runtime errors"+(errors.length?" -> "+errors.join(" | "):""));

console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);