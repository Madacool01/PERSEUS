/* Dev test for the phone Programs day-picker (the <=768px replacement for the
   desktop accordion). The picker is CSS-hidden on wide screens but is always in
   the DOM, so its interaction logic is fully testable in jsdom. */
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
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ok " + m); } else { fail++; console.log("  FAIL " + m); } };
const section = t => console.log("\n== " + t + " ==");

window.switchView("programs");
const slots = () => E("JSON.stringify(progDraft().slots)");

section("Mobile picker is present and complete");
check(Boolean($("[data-pm-picker]")), "pm-picker exists");
check($$("[data-pm-picker] [data-pm-row]").length === 7, "seven day cards rendered");
check($$("[data-pm-picker] .pm-head").length === 7, "every day card has a tappable head");
check($$("[data-pm-picker] .pm-day.open").length === 0, "no panel open on first paint");
check($$("[data-pm-picker] .pm-head[aria-expanded='false']").length === 7, "all heads start collapsed for screen readers");
check($("#prog-builder .prog-acc").classList.contains("prog-acc-desktop"), "desktop accordion is wrapped for mobile hiding");

section("Tapping a day reveals its chooser");
const head1 = $("[data-pm-picker] [data-pm-day='1']");
click(head1);
check(head1.closest("[data-pm-row]").classList.contains("open"), "tapped day opens");
check(head1.getAttribute("aria-expanded") === "true", "aria-expanded flips to true");
const opts1 = $$("[data-pm-row='1'] .pm-opt");
check(opts1.length >= 3, "chooser offers Rest + saved routines (" + opts1.length + " options)");
check(Boolean($("[data-pm-row='1'] [data-pm-pick='1'][data-pm-val='']")), "Rest day option present");
check($$("[data-pm-picker] .pm-day.open").length === 1, "only one panel stays open");
const head2 = $("[data-pm-picker] [data-pm-day='2']");
click(head2);
check(!head1.closest("[data-pm-row]").classList.contains("open") && head2.closest("[data-pm-row]").classList.contains("open"),
  "opening another day closes the first");

section("Choosing a routine updates the whole week");
const before = slots();
check(E("progDraft().slots[1]") === null, "Tuesday starts as rest");
click($("[data-pm-pick='1'][data-pm-val='day-2']"));
check(E("progDraft().slots[1]") === "day-2", "draft slot saved");
check(before !== slots(), "draft actually changed");
const row1 = $("[data-pm-row='1']");
check(row1.querySelector("[data-pm-name]").textContent === "Workout B", "day card shows the new routine name");
check(row1.classList.contains("training"), "day card switches to the training state");
check(/sets$/.test(row1.querySelector("[data-pm-sets]").textContent), "day card shows the set count");
check(row1.querySelector("[data-pm-pick='1'][data-pm-val='day-2']").classList.contains("on"), "chosen option marked");
check(row1.querySelector("[data-pm-pick='1'][data-pm-val='day-2']").getAttribute("aria-pressed") === "true", "chosen option pressed for AT");
check(!row1.classList.contains("open"), "panel closes after choosing");
check(E("getDay('day-2')") && $("[data-prog-slot='1']").value === "day-2", "desktop select stays in sync");
check($("[data-prog-day='1'] .prog-pick-name").textContent === "Workout B", "desktop accordion label stays in sync");
check($("[data-prog-flow='1']").textContent === "Workout B", "flow row updates");
const wantSets = E("progRoutineSets('day-2') + ' sets'");
check($("[data-prog-flow-sets='1']").textContent === wantSets, "flow set count updates (" + $("[data-prog-flow-sets='1']").textContent + ")");
check($("[data-prog-flow='1']").closest(".prog-step").classList.contains("on"), "flow step marked as training");
check($$("[data-prog-goto] .prog-dot.on").length === 4, "shelf dots reflect four training days");
check(/4<\/b> training days/.test($("[data-pm-summary]").innerHTML), "summary counts training days (" + $("[data-pm-summary]").textContent + ")");

section("Reverting a day back to rest");
click($("[data-pm-picker] [data-pm-day='1']"));
click($("[data-pm-pick='1'][data-pm-val='']"));
check(E("progDraft().slots[1]") === null, "slot cleared");
check($("[data-pm-row='1'] [data-pm-name]").textContent === "Rest", "card reads Rest again");
check(!$("[data-pm-row='1']").classList.contains("training"), "card leaves the training state");
check($("[data-pm-row='1'] [data-pm-pick='1'][data-pm-val='']").classList.contains("on"), "Rest option marked");
check($("[data-prog-flow-sets='1']").textContent === "recover", "flow shows recovery");
check(!$("[data-prog-flow='1']").closest(".prog-step").classList.contains("on"), "flow step no longer training");
check($$("[data-prog-goto] .prog-dot.on").length === 3, "shelf dots back to three");

section("Runtime errors");
check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
