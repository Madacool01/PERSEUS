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
check(cards.length === 2, "bento has 2 cards (found " + cards.length + ")");
const spans = cards.map(c => (c.className.match(/span-\d+/) || ["?"])[0]).join(",");
check(spans === "span-7,span-5", "bento spans interlock 7+5 (found " + spans + ")");
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
check(/2 days per week/.test(sheetTxt), "upper-upper trains 2 days per week");
check(/Intermediate/.test(sheetTxt), "upper-upper level is intermediate");
check(/The week/.test(sheetTxt), "detail lists the workouts of the week");
check($$("#view-programs .prog-dayrow").length === 7, "detail shows all 7 days");
check(E("JSON.stringify(progDraft().slots)") === slotsBefore, "opening detail leaves seven-day draft untouched");
E("document.querySelector('[data-prog-back]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}))");
check(!$("#view-programs .prog-overlay"), "Back closes the detail overlay");
check(E("JSON.stringify(progDraft().slots)") === slotsBefore, "draft still untouched after closing detail");
// use template: creates the two routines in Workouts and drafts Mon + Thu
const daysBefore = E("state.days.length");
E("document.querySelector('[data-prog-open]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}))");
E("document.querySelector('[data-prog-use]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}))");
check(!$("#view-programs .prog-overlay"), "using template closes the detail");
check(E("state.days.length") === daysBefore + 2, "two routines created in Workouts");
const upperA = E("JSON.stringify((state.days.find(d=>d.name==='Upper A')||{}).exercises||[])");
const upperB = E("JSON.stringify((state.days.find(d=>d.name==='Upper B')||{}).exercises||[])");
check(JSON.parse(upperA).length === 3 && JSON.parse(upperB).length === 3, "Upper A and B hold 3 minimalist exercises each");
check(JSON.parse(upperA).every(e=>e.targetSets===2), "low-volume: 2 sets per exercise");
const draftIds = E("JSON.stringify(progDraft().slots)");
check(JSON.parse(draftIds)[0] && JSON.parse(draftIds)[3], "template drafted Mon + Thu");
check(E("JSON.stringify(progDraft().pair)") !== "undefined", "pair tracked for suggestions");
// dynamic suggestion: single Tuesday session suggests Friday
E("progSaveDraft({slots:[null,state.days.find(d=>d.name==='Upper A').id,null,null,null,null,null],pair:progDraft().pair}); renderPrograms();");
const sugTxt = $("[data-prog-suggest]").textContent;
check(/Fri/.test(sugTxt) && /Tue/.test(sugTxt), "single Tuesday session suggests Friday (" + sugTxt.trim().slice(0, 80) + ")");
const applyBtn = $("[data-prog-apply]");
check(!!applyBtn, "suggestion offers one-click apply");
if (applyBtn) applyBtn.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(E("JSON.stringify(progDraft().slots[4])") !== "null", "apply drafts second session on Friday");
check(/Spacing looks right/.test($("[data-prog-suggest]").textContent), "two sessions 3 apart confirm spacing");
// reusing template does not duplicate routines
const daysMid = E("state.days.length");
E("progUseTemplate('upper-upper')");
check(E("state.days.length") === daysMid, "reusing template does not duplicate routines");
// enroll with Tuesday start: preview promises Friday, accept drafts Tue + Fri
E("document.querySelector('[data-prog-open]').dispatchEvent(new window.MouseEvent('click', {bubbles:true}))");
$("[data-prog-first='1']").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(/First: Tue\. Second session: Fri\./.test($("[data-prog-second-preview]").textContent), "day picker previews Fri for Tue start");
$("[data-prog-use]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(E("JSON.stringify(progDraft().active.days)") === "[1,4]", "enrolled Tue + Fri");
check(!!$("[data-prog-active-banner]"), "active banner shown while following");
// diverge from plan: change Friday to rest -> exit confirm, draft untouched until choice
E("document.querySelector('[data-prog-slot=\"4\"]').value=''; document.querySelector('[data-prog-slot=\"4\"]').dispatchEvent(new Event('change', {bubbles:true}))");
check(/Exit this program\?/.test($("#view-programs").textContent), "diverging asks to exit the program");
$("[data-prog-keep]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!$("#view-programs .prog-overlay"), "keep closes the confirm");
check(E("JSON.stringify(progDraft().active.days)") === "[1,4]", "keep restores the planned days");
// diverge again, exit, delete template workouts
E("document.querySelector('[data-prog-slot=\"4\"]').value=''; document.querySelector('[data-prog-slot=\"4\"]').dispatchEvent(new Event('change', {bubbles:true}))");
$("[data-prog-exit2]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(/Keep the workouts\?/.test($("#view-programs").textContent), "exit asks delete or keep");
const daysPreDel = E("state.days.length");
$("[data-prog-delw]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(E("state.days.length") === daysPreDel - 2, "delete removes the two template workouts");
check(E("progDraft().active") === null, "program no longer active after delete");
check(!E("state.days.some(d=>d.name==='Upper A')"), "Upper A gone from Workouts");
// re-enroll, diverge, exit, keep workouts
E("progEnroll('upper-upper', 0)");
E("document.querySelector('[data-prog-slot=\"3\"]').value=''; document.querySelector('[data-prog-slot=\"3\"]').dispatchEvent(new Event('change', {bubbles:true}))");
$("[data-prog-exit2]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
$("[data-prog-keepw]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(E("state.days.some(d=>d.name==='Upper A')"), "keep preserves template workouts");
check(E("progDraft().active") === null, "program inactive, now a custom week");
check(errors.length === 0, "no window errors (" + errors.length + ")");
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
