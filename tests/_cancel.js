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
  firstEx.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
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