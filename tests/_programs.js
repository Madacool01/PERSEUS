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
const cards = $$("#view-programs .prog-card");
check(cards.length === 1, "one shelf card (found " + cards.length + ")");
check((cards[0].className.match(/span-\d+/) || ["?"])[0] === "span-7", "shelf card spans 7");
check(cards.every(c=>c.querySelector(".prog-week")), "card dots row has a horizontal wrapper");
check(cards.every(c=>c.querySelectorAll(".prog-week .prog-dot").length === 7), "card shows all 7 day dots");
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
check(!!$("[data-prog-start]") && !$("[data-prog-save]"), "action band has Start only (Save removed)");
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

check(errors.length === 0, "no window errors (" + errors.length + ")");
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
