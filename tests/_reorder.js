/* Dev test for the drag-to-reorder feature in index.html's routine editor
   (jsdom, same harness style as the other _*.js tests). */
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
    window.addEventListener("error", e => errors.push(e && e.message || String(e)));
  },
});
const { window } = dom;

const $ = s => window.document.querySelector(s);
const $$ = s => Array.from(window.document.querySelectorAll(s));
const E = x => window.eval(x); // page-scope expressions (top-level let/const)
const G = n => window.eval(n);

let pass = 0, fail = 0;
function check(c, m) {
  if (c) { pass++; console.log("  ✓ " + m); }
  else { fail++; console.log("  ✗ FAIL: " + m); }
}
function section(t) { console.log("\n== " + t + " =="); }

(async () => {
  section("Editor renders reorderable rows");
  window.switchView("workouts");
  $("#view-workouts [data-edit-day]").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const rows = $$("#view-workouts .ex-row");
  check(rows.length === 4, "editor lists 4 exercise rows (got " + rows.length + ")");
  check(rows.every(r => Boolean(r.querySelector(".grip svg"))), "every row carries a drag grip");
  check(rows[0].getAttribute("title") === "Drag to reorder", "rows advertise the drag affordance");
  const exIds0 = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(exIds0 === "ex-3,ex-5,ex-12,ex-4", "seed order is ex-3,ex-5,ex-12,ex-4 (got " + exIds0 + ")");

  section("Pure reorder + persistence");
  check(G("reorderDayExercises")("day-1", 0, 3) === true, "reorder returns true");
  const order = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(order === "ex-5,ex-12,ex-4,ex-3", "first exercise moved to the end (got " + order + ")");
  const saved = JSON.parse(E("localStorage.getItem('perseus-v1')"));
  check(saved.days.find(d => d.id === "day-1").exercises.map(x => x.exId).join(",") === order,
    "new order persisted to storage");
  check(G("reorderDayExercises")("day-1", 1, 1) === false, "same-index reorder is a no-op");
  check(G("reorderDayExercises")("day-1", 99, 0) === true, "out-of-range index clamps instead of failing");
  const clamped = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(clamped === "ex-3,ex-5,ex-12,ex-4", "last row moved to front after clamp (got " + clamped + ")");

  section("Rendered rows follow the reordered array");
  E("render()");
  const rows2 = $$("#view-workouts .ex-row");
  const want = E("getDay('day-1').exercises.map(x=>getEx(x.exId).name)");
  const got = rows2.map(r => r.querySelector("b").textContent);
  check(rows2.length === 4, "still 4 rows after reorder + render");
  check(want.length === got.length && want.every((n, i) => n === got[i]),
    "DOM row order mirrors the state order after render");

  section("Row controls still work after a reorder");
  const rm = rows2[1].querySelector("[data-rm-ex]");
  const targetId = rm.dataset.rmEx;
  rm.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const left = E("getDay('day-1').exercises.map(x=>x.exId).join(',')");
  check(left.indexOf(targetId) === -1, "removed exercise is gone from the routine");
  check($$("#view-workouts .ex-row").length === 3, "one row removed from the editor");

  section("Runtime errors");
  check(errors.length === 0, "no window errors during flows" + (errors.length ? " -> " + errors.join(" | ") : ""));

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
