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

// The shelf now holds only the user's custom week; the template program is gone.
check(!$("#view-programs [data-prog-saved]"), "no saved programs on a fresh install");
const customCard = $("#view-programs [data-prog-goto='prog-builder']");
check(!!customCard && (customCard.className.match(/span-\d+/) || ["?"])[0] === "span-7", "the working week card keeps its 7-column width (not stretched)");
check(!!$("#view-programs .prog-card.ghost"), "an empty-state card completes the row while nothing is saved");
check((($("#view-programs .prog-card.ghost").className.match(/span-\d+/) || ["?"])[0]) === "span-5", "the empty state takes the 5-column remainder (7 + 5 = 12)");
check(!!customCard.querySelector(".prog-week"), "card dots row has a horizontal wrapper");
check(customCard.querySelectorAll(".prog-week .prog-dot").length === 7, "card shows all 7 day dots");
check(!!$("#view-programs .bento"), "bento grid present (dense via CSS)");
check(!/Upper Upper Minimalist/i.test($("#view-programs").textContent), "Upper Upper Minimalist removed from the shelf");
check(!$("#view-programs [data-prog-open]") && !$("#view-programs .prog-overlay"), "no template detail/enroll entry points remain");

// Seed two saved routines for the draft + spacing checks
E("state.days.push({id:'day-t-a',name:'Routine A',type:'strength',exercises:[{exId:'x',targetSets:2}]});" +
  "state.days.push({id:'day-t-b',name:'Routine B',type:'strength',exercises:[{exId:'y',targetSets:3}]}); renderPrograms();");

const slices = $$("#view-programs [data-prog-day]");
check(slices.length === 7, "accordion has 7 day slices (found " + slices.length + ")");
const sel0 = $("#view-programs [data-prog-slot='0']");
check(!!sel0 && sel0.options.length >= 3, "day select offers Rest + saved routines (" + (sel0 ? sel0.options.length : 0) + " options)");
check($$("#view-programs [data-prog-flow]").length === 7, "pinned flow has 7 steps");
check(!!$("[data-prog-start]"), "action band still starts the working week");
check(!!$("[data-prog-save]") && !!$("[data-prog-name]") && !!$("[data-prog-desc]"), "the builder can save the week with a name and a description");
check(!/Starting is a prototype/.test($("#view-programs").textContent), "prototype note removed from the CTA band");

// interaction: change Tuesday slot to first routine, flow + dots update
const before = $("[data-prog-flow='1']").textContent;
E("document.querySelector('[data-prog-slot=\"1\"]').value = 'day-t-a'; document.querySelector('[data-prog-slot=\"1\"]').dispatchEvent(new Event('change', {bubbles:true}))");
const after = $("[data-prog-flow='1']").textContent;
check(before !== after && after === "Routine A", "slot change updates pinned flow (" + before + " -> " + after + ")");
const liveOn = $$("#view-programs [data-prog-goto] .prog-dot.on").length;
const trained = JSON.parse(E("JSON.stringify(progDraft().slots)")).filter(Boolean).length;
check(liveOn === trained, "custom-week dots update on the spot (" + liveOn + " lit for " + trained + " sessions)");
check(E("progDraft().slots[1]") === "day-t-a", "slot choice persisted to the draft")

// no routine recommendation: a single session suggests nothing
check(!/Second session suggested/.test($("[data-prog-suggest]").textContent), "no second-session routine recommendation");
check(!$("[data-prog-apply]"), "no one-click apply button");
// spacing feedback still works once two sessions exist
E("const dd2=progDraft(); dd2.slots=[null,'day-t-a',null,null,'day-t-b',null,null]; progSaveDraft(dd2); renderPrograms();");
check(/Spacing looks right/.test($("[data-prog-suggest]").textContent), "two sessions 3 apart confirm spacing");

// start button saves the week and lands the user on Home
E("document.querySelector('[data-prog-start]').click()");
check($("#view-home").classList.contains("active"), "Start this week switches to the Home tab");
check(W.document.querySelector("#toast").classList.contains("show"), "start shows a toast");

/* =========================================================================
   Saving programs to the shelf, and re-anchoring them on start.
   ========================================================================= */
const section = (t) => console.log("\n== " + t + " ==");
W.confirm = () => true;
const dowIdx = (slots) => slots.map((x, i) => x ? i : null).filter(x => x !== null);

section("Saving a named program to the shelf");
E("switchView('programs')");
// Tuesday / Thursday / Sunday - exactly the example in the brief
E("const dd=progDraft(); dd.slots=[null,'day-t-a',null,'day-t-b',null,null,'day-t-a']; progSaveDraft(dd); renderPrograms();");
check(E("JSON.stringify(progGaps(progDraft().slots))") === "[1,2,1]", "Tuesday / Thursday / Sunday sit 1, 2, 1 days apart");
check(/3 sessions \u00b7 Tue \/ Thu \/ Sun/.test($("#view-programs").textContent), "the builder names the training days");

E("document.querySelector('[data-prog-save]').click()");
check(E("progSavedList().length") === 0, "saving without a name is refused");
check(/name/i.test($("[data-prog-save-msg]").textContent), "the builder asks for a name: " + JSON.stringify($("[data-prog-save-msg]").textContent));

// a week with no training day cannot be saved, even with a name
E("const dd0=progDraft(); dd0.slots=[null,null,null,null,null,null,null]; progSaveDraft(dd0); renderPrograms();" +
  "document.querySelector('[data-prog-name]').value='Empty week'; document.querySelector('[data-prog-save]').click();");
check(E("progSavedList().length") === 0, "a week with no training day is refused");
check(/routine day/i.test($("[data-prog-save-msg]").textContent), "the builder explains it needs a training day: " + JSON.stringify($("[data-prog-save-msg]").textContent));
E("const dd1=progDraft(); dd1.slots=[null,'day-t-a',null,'day-t-b',null,null,'day-t-a']; progSaveDraft(dd1); renderPrograms();");

E("document.querySelector('[data-prog-name]').value='The 3-day split';" +
  "document.querySelector('[data-prog-desc]').value='Tuesday, Thursday, Sunday';" +
  "document.querySelector('[data-prog-save]').click()");
const savedList = JSON.parse(E("JSON.stringify(progSavedList())"));
check(savedList.length === 1, "one program saved (found " + savedList.length + ")");
check(savedList[0].name === "The 3-day split" && savedList[0].description === "Tuesday, Thursday, Sunday", "name and description are stored");
check(JSON.stringify(dowIdx(savedList[0].slots)) === "[1,3,6]", "the three training days are stored (Tue / Thu / Sun)");
check(savedList[0].slots[1] === "day-t-a" && savedList[0].slots[3] === "day-t-b" && savedList[0].slots[6] === "day-t-a", "each session keeps the routine that was on it");
check(E("JSON.stringify(progGaps(progSavedList()[0].slots))") === "[1,2,1]", "the program remembers its distances");
check(/Saved/.test(W.document.querySelector("#toast").textContent), "saving shows a toast");

section("The saved program shows on the shelf");
check($$("#view-programs [data-prog-saved]").length === 1, "the shelf lists the saved program");
const scard = $("#view-programs [data-prog-saved]");
check(scard.querySelector(".prog-name").textContent === "The 3-day split", "the card shows the program name");
check(/Tuesday, Thursday, Sunday/.test(scard.textContent), "the card shows the description");
check(scard.querySelectorAll(".prog-week .prog-dot").length === 7, "the card shows all seven days");
check(scard.querySelectorAll(".prog-week .prog-dot.on").length === 3, "exactly the three training days are lit");
check(/Distance between sessions: 1 \u00b7 2 \u00b7 1 days/.test(scard.querySelector(".prog-gaps").textContent), "the card states the distances (" + scard.querySelector(".prog-gaps").textContent + ")");
check(!!scard.querySelector("[data-prog-start-saved]") && !!scard.querySelector("[data-prog-remove]"), "the card offers Start and Remove");
check(!$("#view-programs .prog-card.ghost"), "the empty state is replaced once a program is saved");
check((scard.className.match(/span-\d+/) || ["?"])[0] === "span-5", "the first saved program fills the 5-column remainder (7 + 5 = 12)");
check($$("#view-programs [data-prog-goto] .prog-dot").length === 7, "the working week keeps its own dot row");

section("Rotating the shape preserves the distances");
check(E("JSON.stringify(progShiftSlots(progSavedList()[0].slots, progOffsetFor(progSavedList()[0].slots, 0)).map((x,i)=>x?i:null).filter(x=>x!==null))") === "[0,2,5]", "anchoring on Monday moves the sessions to Monday, Wednesday and Saturday");
check(E("JSON.stringify(progGaps(progShiftSlots(progSavedList()[0].slots, progOffsetFor(progSavedList()[0].slots, 0))))") === "[1,2,1]", "the distances are unchanged after the shift");
check(E("JSON.stringify(progShiftSlots(progSavedList()[0].slots, progOffsetFor(progSavedList()[0].slots, 4)).map((x,i)=>x?i:null).filter(x=>x!==null))") === "[2,4,6]", "anchoring on Friday wraps the sessions onto Wed / Fri / Sun");

section("Starting a saved program asks for the first day");
E("document.querySelector('[data-prog-saved] [data-prog-start-saved]').click()");
const host = $("#prog-start-host");
check(!!host.querySelector(".sh-card"), "the start dialog opens");
check(/When do you want your first session to be\?/.test(host.textContent), "the dialog asks when to start");
check(host.querySelectorAll("[data-pstart-day]").length === 7, "all seven weekdays are offered");
check(!!host.querySelector("[data-pstart-preview] .pstart-week"), "the dialog previews the shifted week");
check(host.querySelector("[data-pstart-day='1']").classList.contains("on"), "the dialog opens on the program's own first day (Tuesday)");
check(/First session Tue/.test(host.querySelector("[data-pstart-preview]").textContent), "the preview starts on Tuesday");

host.querySelector("[data-pstart-day='0']").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(/First session Mon/.test(host.querySelector("[data-pstart-preview]").textContent), "choosing Monday previews a Monday start");
const previewDots = Array.from(host.querySelectorAll("[data-pstart-preview] .prog-dot")).map((d, i) => d.classList.contains("on") ? i : null).filter(x => x !== null);
check(JSON.stringify(previewDots) === "[0,2,5]", "the preview shows Monday, Wednesday and Saturday (" + previewDots.join(",") + ")");

section("Starting applies only to the active week");
E("document.querySelector('[data-pstart-go]').click()");
check($("#view-home").classList.contains("active"), "starting lands on Home");
check(E("JSON.stringify(progDraft().slots.map((x,i)=>x?i:null).filter(x=>x!==null))") === "[0,2,5]", "the active week is now Monday, Wednesday and Saturday");
check(E("progDraft().slots[0]") === "day-t-a" && E("progDraft().slots[2]") === "day-t-b" && E("progDraft().slots[5]") === "day-t-a", "each shifted session keeps its routine");
check(E("JSON.stringify(progSavedList()[0].slots.map((x,i)=>x?i:null).filter(x=>x!==null))") === "[1,3,6]", "the saved program is untouched (shift scope: active week only)");
check(/first session Mon/.test(W.document.querySelector("#toast").textContent), "the toast names the chosen first day: " + JSON.stringify(W.document.querySelector("#toast").textContent));

section("The start dialog can be dismissed");
E("switchView('programs')");
E("document.querySelector('[data-prog-saved] [data-prog-start-saved]').click()");
check(!!$("#prog-start-host .sh-card"), "dialog reopened");
E("document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }))");
check(!$("#prog-start-host .sh-card"), "Escape closes the dialog");
E("document.querySelector('[data-prog-saved] [data-prog-start-saved]').click()");
E("document.querySelector('[data-pstart-cancel]').click()");
check(!$("#prog-start-host .sh-card"), "Cancel closes the dialog");

section("Removing a saved program");
E("document.querySelector('[data-prog-remove]').click()");
check(E("progSavedList().length") === 0, "the program is gone from the shelf store");
check(!$("#view-programs [data-prog-saved]"), "its card left the shelf");
check($$("#view-programs .prog-card").length === 2 && !!$("#view-programs .prog-card.ghost"), "the shelf returns to the working week plus its empty-state card");

section("Saved programs persist across a reload");
E("const list=progSavedList(); list.push({id:'id-persist',name:'Reloaded',description:'survives',slots:[null,'day-t-a',null,null,null,null,'day-t-b'],ts:1}); progSaveList(list);");
check(E("JSON.parse(localStorage.getItem('perseus-programs-saved-v1')).length") === 1, "the shelf is written to storage under its own key");
E("switchView('programs')");
check($$("#view-programs [data-prog-saved]").length === 1, "a stored program renders on the shelf after a re-render");
check(/Distance between sessions: 4 \u00b7 1 days/.test($("#view-programs [data-prog-saved] .prog-gaps").textContent), "distances are recomputed from the stored shape (" + $("#view-programs [data-prog-saved] .prog-gaps").textContent + ")");

check(errors.length === 0, "no window errors (" + errors.length + ")");
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
