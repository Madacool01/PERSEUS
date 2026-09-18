const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ok " + m); } else { fail++; console.log("  FAIL " + m); } };
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, url: "http://localhost/",
  beforeParse(w) { w.scrollTo = () => {}; w.onerror = (m) => errors.push(m); },
});
const W = dom.window;
const E = (x) => W.eval(x);
const $ = (s) => W.document.querySelector(s);
const $$ = (s) => Array.from(W.document.querySelectorAll(s));
console.log("== Programs prototype ==");
E("switchView('programs')");
check($("#view-programs").classList.contains("active"), "programs view activates");
const h1 = $("#view-programs .view-title");
check(!!h1, "hero title exists");
check(h1 && h1.textContent.replace(/\s+/g, " ").trim().split(" ").length <= 9, "hero title short (2-line rule): " + (h1 ? h1.textContent.replace(/\s+/g, " ").trim() : ""));
check(!!$("#view-programs .view-hero-bg"), "hero has full-bleed bg");
check($$("#view-programs .view-hero .hero-cta .btn").length === 2, "exactly two hero CTAs");
check(!!$("#view-programs .btn.primary") && !!$("#view-programs .btn.ghost-dark"), "CTA contrast classes (primary + ghost-dark)");
check(!/SECTION 0|QUESTION 0|ABOUT US/i.test($("#view-programs").innerHTML), "no cheap meta-labels");
const cards = $$("#view-programs .prog-card");
check(cards.length === 4, "bento has 4 cards (found " + cards.length + ")");
const spans = cards.map(c => (c.className.match(/span-\d+/) || ["?"])[0]).join(",");
check(spans === "span-7,span-5,span-5,span-7", "bento spans interlock 7+5 / 5+7 (found " + spans + ")");
check(!!$("#view-programs .bento"), "bento grid present (dense via CSS)");
const slices = $$("#view-programs [data-prog-day]");
check(slices.length === 7, "accordion has 7 day slices (found " + slices.length + ")");
const sel0 = $("#view-programs [data-prog-slot='0']");
check(!!sel0 && sel0.options.length >= 2, "day select offers Rest + saved routines (" + (sel0 ? sel0.options.length : 0) + " options)");
check($$("#view-programs [data-prog-flow]").length === 7, "pinned flow has 7 steps");
check(!!$("[data-prog-save]") && !!$("[data-prog-start]"), "action band has Save + Start");
// interaction: change Tuesday slot to first routine, flow + dots update
const before = $("[data-prog-flow='1']").textContent;
E("document.querySelector('[data-prog-slot=\"1\"]').value = (typeof state!=='undefined' && state.days[0] ? state.days[0].id : ''); document.querySelector('[data-prog-slot=\"1\"]').dispatchEvent(new Event('change', {bubbles:true}))");
const after = $("[data-prog-flow='1']").textContent;
check(before !== after || after !== "Rest", "slot change updates pinned flow (" + before + " -> " + after + ")");
E("document.querySelector('[data-prog-save]').click()");
check(W.document.querySelector("#toast").classList.contains("show"), "save shows toast");
// detail overlay: Open on a template must not touch the seven-day draft
const slotsBefore = E("JSON.stringify(progDraft().slots)");
$("[data-prog-open]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!!$("#view-programs .prog-overlay"), "Open shows program detail overlay");
check(!!$("#view-programs .prog-sheet"), "detail sheet rendered");
const sheetTxt = $("#view-programs .prog-sheet") ? $("#view-programs .prog-sheet").textContent : "";
check(/Good for|Training days|Level/.test(sheetTxt), "detail shows goal, days per week, level");
check(/The week/.test(sheetTxt), "detail lists the workouts of the week");
check($$("#view-programs .prog-dayrow").length === 7, "detail shows all 7 days");
check(E("JSON.stringify(progDraft().slots)") === slotsBefore, "opening detail leaves seven-day draft untouched");
E("document.querySelector('[data-prog-back]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}))");
check(!$("#view-programs .prog-overlay"), "Back closes the detail overlay");
check(E("JSON.stringify(progDraft().slots)") === slotsBefore, "draft still untouched after closing detail");
check(errors.length === 0, "no window errors (" + errors.length + ")");
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
