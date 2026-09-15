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
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
function $(s){ return W.document.querySelector(s); }
function $$(s){ return Array.from(W.document.querySelectorAll(s)); }

let pass=0, fail=0;
const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

// Go to library view
W.switchView("library");
check(Boolean($("#view-library .exercise-item")), "library rendered");

// Equipment filter chips show capitalized display names (not raw keys)
const fToggle = $("#lib-filter-toggle");
check(Boolean(fToggle), "Filters toggle exists");
fToggle.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check($("#lib-filter-panel").classList.contains("open"), "filter panel opens");const eqLabels = $$("#lib-filter-panel [data-fg='equip']").map(o=>o.textContent);
check(eqLabels[0] === "Body Weight", "filter chips start with 'Body Weight'");
["Body Weight", "Rings", "Pull-up Bar", "Dumbbell", "Barbell", "Kettlebell", "EZ Bar", "Plates", "Machine", "Bands", "Trap Bar", "Suspension"].forEach((l,i)=>{
  check(eqLabels[i] === l, "equipment chip '" + l + "' is capitalized");
});
check($$("#lib-filter-panel [data-fg='equip']").map(o=>o.getAttribute("data-fv")).indexOf("bodyweight") !== -1, "chip values still use raw keys for matching");
check($$("#lib-filter-panel [data-fg='equip'].on").length === 0, "no equipment selected initially");
// Body-part chips offer Biceps/Triceps
const partVals = $$("#lib-filter-panel [data-fg='parts']").map(o=>o.getAttribute("data-fv"));
check(partVals.includes("Biceps") && partVals.includes("Triceps"), "body-part chips offer Biceps/Triceps");
// Toggling a body-part chip narrows the list; toggling off restores it
const total = $$("#view-library .exercise-item").length;
$("#lib-filter-panel [data-fg='parts'][data-fv='Biceps']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
const narrowed = $$("#view-library .exercise-item").length;
check(narrowed < total && narrowed > 0, "Biceps chip narrows results ("+narrowed+" of "+total+")");
check($("#lib-filter-count").textContent === "1", "filter badge counts 1 active filter");
$("#lib-filter-panel [data-fg='parts'][data-fv='Biceps']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check($$("#view-library .exercise-item").length === total, "toggling the chip off restores the full list");
// Combined vs Broad: parts + equipment intersect vs union
$("#lib-filter-panel [data-fg='parts'][data-fv='Biceps']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
$("#lib-filter-panel [data-fg='equip'][data-fv='dumbbell']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
const both = $$("#view-library .exercise-item").length;
check($("#lib-filter-panel [data-fg='mode'][data-fv='or']").textContent === "Broad", "match-mode Broad option present");
$("#lib-filter-panel [data-fg='mode'][data-fv='or']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
const broad = $$("#view-library .exercise-item").length;
check(broad >= both, "Broad mode shows a union ("+broad+") vs Combined ("+both+")");
$("#lib-filter-panel [data-fg='clear']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check($$("#view-library .exercise-item").length === total, "Clear all restores the full list");
// Glass popup dismissals: X button and backdrop click
check(Boolean($("#lib-filter-panel .lib-fcard")), "filters render inside a popup card");
$("#lib-filter-panel [data-fg='close']").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check(!$("#lib-filter-panel").classList.contains("open"), "X button closes the popup");
fToggle.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check($("#lib-filter-panel").classList.contains("open"), "toggle reopens the popup");
$("#lib-filter-panel").dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check(!$("#lib-filter-panel").classList.contains("open"), "backdrop click closes the popup");

// Count exercises before
const before = E("state.exercises.length");

// Click "New exercise" button (real click)
const addBtn = $("#add-exercise");
check(Boolean(addBtn), "New exercise button exists");
addBtn.dispatchEvent(new W.MouseEvent("click", {bubbles:true}));
const editor = $("#ex-editor-host");
check(editor && editor.innerHTML.trim().length > 0, "editor form is shown after clicking + New exercise");

// Fill in a name so we can confirm cancel DOES NOT save it
const nameInput = $("#ex-name");
check(Boolean(nameInput), "name input present in editor");
if (nameInput) nameInput.value = "Should Not Persist";

// Click the real Cancel button
const cancelBtn = $("#ex-cancel");
check(Boolean(cancelBtn), "cancel button present");
if (cancelBtn){
  cancelBtn.dispatchEvent(new W.MouseEvent("click", {bubbles:true}));
  const after = E("state.exercises.length");
  const editorStill = $("#view-library #ex-editor-host");
  check(after === before, "exercise NOT added when cancelled (count before="+before+" after="+after+")");
  check(!editorStill || editorStill.innerHTML.trim().length === 0, "editor dismissed (host empty)");
  check(!E("state.exercises").some(e=>e.name==="Should Not Persist"), "cancelled name did not save");
}

console.log("\n== Re-open loop: open-cancel 3 times ==");
let ok=true;
for (let i=0;i<3;i++){
  W.switchView("library");
  const ab = $("#add-exercise");
  ab.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const ed = $("#view-library #ex-editor-host");
  if (!ed || ed.innerHTML.trim().length===0){ ok=false; console.log("  ✗ open #"+(i+1)+" failed"); break; }
  const cb = $("#ex-cancel");
  if (!cb){ ok=false; console.log("  ✗ no cancel on open #"+(i+1)); break; }
  cb.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const ed2 = $("#view-library #ex-editor-host");
  if (ed2 && ed2.innerHTML.trim().length!==0){ ok=false; console.log("  ✗ cancel #"+(i+1)+" did not dismiss"); break; }
}
check(ok, "open/cancel worked across 3 repeated cycles");

console.log("\n== Edit existing exercise, then cancel ==");
const firstEx = $("#view-library .exercise-item[data-open]");
check(Boolean(firstEx), "exercise item present");
if (firstEx){
  // Card click now opens the visualizer; the pencil button opens the editor.
  const editBtn = firstEx.querySelector("[data-edit]");
  check(Boolean(editBtn), "pencil edit button present on card");
  editBtn.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const nameInput2 = $("#ex-name");
  check(Boolean(nameInput2), "edit form shown");
  const before2 = E("state.exercises.find(e=>e.id==='ex-1').name");
  if (nameInput2){ nameInput2.value = "CHANGED NAME"; }
  const cb2 = $("#ex-cancel");
  cb2.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const after2 = E("state.exercises.find(e=>e.id==='ex-1').name");
  check(after2===before2, "editing existing then cancel: name unchanged ("+after2+")");
}

console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);