/* Dev test: routines and exercises must not share a name (case-insensitive).
   Same jsdom harness style as the other _*.js tests. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const errors = [];

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "http://localhost/",
  beforeParse(window) {
    window.scrollTo = () => {};
    window.addEventListener("error", e => errors.push((e && e.message) || String(e)));
  },
});
const { window } = dom;
const $ = s => window.document.querySelector(s);
const $$ = s => Array.from(window.document.querySelectorAll(s));
const E = x => window.eval(x);
const G = n => window.eval(n);
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const change = el => el.dispatchEvent(new window.Event("change", { bubbles: true }));

let pass = 0, fail = 0;
function check(c, m) {
  if (c) { pass++; console.log("  ok " + m); }
  else { fail++; console.log("  FAIL " + m); }
}
function section(t) { console.log("\n== " + t + " =="); }
const toastText = () => $("#toast").textContent;

/* ---- exercises: the library editor blocks duplicate names ---- */
section("Exercise names are unique");
window.switchView("library");
const beforeCount = E("state.exercises.length");
const firstName = E("state.exercises[0].name");

click($("#add-exercise"));
let nameInput = $("#ex-name");
check(Boolean(nameInput), "new-exercise editor open");
nameInput.value = firstName;
click($("#ex-save"));
check(E("state.exercises.length") === beforeCount, "duplicate exercise not added (count unchanged)");
check(/already exists/i.test(toastText()), "toast explains the duplicate name: " + JSON.stringify(toastText()));

nameInput = $("#ex-name");
nameInput.value = firstName.toLowerCase();
click($("#ex-save"));
check(E("state.exercises.length") === beforeCount, "case-insensitive duplicate also blocked");

nameInput = $("#ex-name");
nameInput.value = firstName + " (Unique Copy)";
click($("#ex-save"));
check(E("state.exercises.length") === beforeCount + 1, "a genuinely new name still saves");

section("Editing keeps its own name");
window.switchView("library");
const exId = E("state.exercises[0].id");
E("openExEditor('" + exId + "')");
nameInput = $("#ex-name");
nameInput.value = E("getEx('" + exId + "').name");
click($("#ex-save"));
check(E("state.exercises.length") === beforeCount + 1, "re-saving the unchanged name is allowed");
check(E("getEx('" + exId + "').name") === firstName, "existing name preserved");

/* ---- routines: rename rejects duplicates, creation avoids collisions ---- */
section("Routine names are unique");
window.switchView("workouts");
click($("#view-workouts [data-edit-day]"));
const dayId = E("planEditId");
const otherName = E("state.days.find(d=>d.id!=='" + dayId + "').name");
const nameField = $("input[data-dayname]");
check(Boolean(nameField), "routine name field rendered");
nameField.value = otherName;
change(nameField);
check(E("getDay('" + dayId + "').name") !== otherName, "duplicate routine name rejected");
check(/already exists/i.test(toastText()), "routine duplicate toast shown: " + JSON.stringify(toastText()));
check(nameField.value === E("getDay('" + dayId + "').name"), "field reverts to the real name");

nameField.value = "Push Day Alpha";
change(nameField);
check(E("getDay('" + dayId + "').name") === "Push Day Alpha", "a unique routine name saves");

section("New routine naming never collides");
const nextName = G("nextRoutineName")();
check(E("state.days.every(d=>normName(d.name)!==normName('" + nextName + "'))"),
  "nextRoutineName never returns a name already in use (got " + nextName + ")");
click($("#plan-back"));
check(Boolean($("#add-day")), "back on the routine list");
const beforeDays = E("state.days.length");
click($("#add-day"));
const newDayName = E("state.days[state.days.length-1].name");
check(E("state.days.length") === beforeDays + 1, "new routine created");
check(E("state.days.filter(d=>normName(d.name)===normName('" + newDayName + "')).length") === 1,
  "created routine name is unique (got " + newDayName + ")");

section("Runtime errors");
check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
