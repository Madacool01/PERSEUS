/* New-exercise editor: clicking the blurred backdrop must not discard the form. */
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
    window.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    };
    window.scrollTo = () => {};
  },
});
const W = dom.window;
const $ = s => W.document.querySelector(s);
const E = expr => W.eval(expr);
let pass = 0, fail = 0;
const check = (cond, msg) => {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
};

W.switchView("library");

// Create mode: backdrop clicks keep the editor open.
W.openExEditor(null);
check(Boolean($("#ex-editor-host #ex-name")), "new-exercise editor opened");
$("#ex-name").value = "Draft movement";
$("#ex-editor-host").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(Boolean($("#ex-editor-host #ex-name")), "backdrop click keeps the new-exercise editor open");
check($("#ex-name") && $("#ex-name").value === "Draft movement", "backdrop click preserves the draft");
if ($("#ex-cancel")) $("#ex-cancel").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));

// Edit mode keeps the existing backdrop-to-dismiss behavior.
W.openExEditor("ex-1");
check(Boolean($("#ex-editor-host #ex-name")), "edit-exercise editor opened");
$("#ex-editor-host").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!$("#ex-editor-host") || $("#ex-editor-host").innerHTML.trim() === "", "backdrop click still dismisses the edit-exercise editor");

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
