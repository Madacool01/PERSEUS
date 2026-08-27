const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const store = {};
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
  beforeParse(w){ w.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}}; w.scrollTo=()=>{}; },
});
const W = dom.window;
const E = expr => W.eval(expr);
function $(s){ return W.document.querySelector(s); }
function $$(s){ return Array.from(W.document.querySelectorAll(s)); }
let pass=0,fail=0; const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

// Default view is workouts; exercise creation is NOT offered inside the routine editor.
check(E("currentView")==="workouts", "start on workouts view");
const rcard = $("[data-edit-day]");
check(Boolean(rcard), "routine card present in list");
rcard.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
check(W.document.querySelectorAll("input[data-dayname]").length === 1, "routine editor open with name input");
check(!$('[data-add-new]'), "routine editor has no '+ new exercise…' option");

// Exercise creation lives only in the Exercise section.
W.switchView("library");
const before = E("state.exercises.length");
const addBtn = $("#add-exercise");
check(Boolean(addBtn), "library '+ New exercise' button exists");
addBtn.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
const editor = $("#ex-editor-host");
check(editor && editor.innerHTML.trim().length > 0, "editor form shown after clicking + New exercise");
const nameInput = $("#ex-name");
check(Boolean(nameInput), "name input present in editor");
if (nameInput) nameInput.value = "Should Not Persist";
const cancelBtn = $("#ex-cancel");
check(Boolean(cancelBtn), "cancel button present");
if (cancelBtn){
  cancelBtn.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const after = E("state.exercises.length");
  check(after===before, "exercise NOT added when cancelled (count before="+before+" after="+after+")");
  check(!$("#ex-editor-host") || $("#ex-editor-host").innerHTML.trim().length===0, "editor dismissed (host empty)");
  check(!E("state.exercises").some(e=>e.name==="Should Not Persist"), "cancelled name did not save");
}

console.log("\nRESULT: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
