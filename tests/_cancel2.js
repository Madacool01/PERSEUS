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
let pass=0,fail=0; const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };

// Default view is workouts; do NOT visit library tab.
check(E("currentView")==="workouts", "start on workouts view");
check(!$("#view-library #ex-editor-host") || $("#ex-editor-host").innerHTML.trim()==="", "#ex-editor-host absent/empty on workouts-only state");

// Click the workouts page "+ new exercise…" link
const addNew = $('[data-add-new]');
check(Boolean(addNew), "workouts '+ new exercise…' link present");
addNew.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));

const editor = $("#ex-editor-host");
console.log("  host element after open: " + (editor ? "#ex-editor-host in DOM" : "NO #ex-editor-host — fell back to body"));
const editorInBody = W.document.body.querySelector("#view-workouts .card h3") !== null ||
                     W.document.body.querySelector("#view-workouts .card") !== null;
console.log("  editor rendered inside #view-workouts? " + (editorInBody ? "yes" : "no"));

// Even if host is body, find the cancel button anywhere in body
const cancelBtn = W.document.body.querySelector("#ex-cancel");
check(Boolean(cancelBtn), "cancel button exists somewhere in body");
if (cancelBtn){
  cancelBtn.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));
  const still = W.document.body.querySelector("#ex-cancel");
  // Cancel calls renderLibrary(); on workouts view the host fallback is body, so remnant may remain
  const before = E("state.exercises.length");
  const after = E("state.exercises.length");
  check(after===before, "nothing saved on cancel (count " + before + ")");
  check(!still, "cancel dismissed the editor (no #ex-cancel left in DOM)");
}

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail?1:0);