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

console.log("== Home dashboard ==");
check(E("currentView") === "home", "Home is the default view");
check($("#view-home").classList.contains("active"), "home view activates");
const h1 = $("#view-home .view-title");
check(!!h1, "hero title exists");
check(!!$("#view-home .view-hero-bg"), "hero has full-bleed backdrop");
check($$("#view-home .view-hero .hero-cta .btn").length === 2, "exactly two hero CTAs");
check(!/SECTION 0|QUESTION 0|ABOUT US/i.test($("#view-home").innerHTML), "no cheap meta-labels");
const words = h1 ? h1.textContent.replace(/\s+/g, " ").trim().split(" ").length : 99;
check(words <= 9, "hero title short (2-line rule): " + words + " words");

// Tab order
const tabs = $$("header nav.tabs .tab-btn");
check(tabs.length === 9 && tabs[0].dataset.view === "home", "Home tab is first in the header nav");
const mtabs = $$("#m-tabs .tab-btn");
check(mtabs.length === 9 && mtabs[0].dataset.view === "home", "Home tab is first in the mobile nav");

// Gapless bento composition
const grid = $("#view-home .bento.home-grid");
check(!!grid, "home uses the bento grid");
const spans = $$("#view-home .home-grid > .home-card").map(c => (c.className.match(/span-(\d+)/) || [0, "?"])[1]).join("+");
check(spans === "7+5+4+4+4+5+7", "card spans interlock 7+5 / 4+4+4 / 5+7 (found " + spans + ")");

// Today card + week rail + stats + coach + recent
check(!!$("#view-home .home-today"), "today card present");
check($$("#view-home .home-day").length === 7, "week rail shows all 7 days");
check($$("#view-home .home-stat").length === 3, "three stat cards");
check(!!$("#view-home .home-coach"), "coach card present");
check(!!$("#view-home .home-card .home-recent") || !!$("#view-home .home-empty"), "recent activity card present");
check($$("#view-home .home-today [data-home-start], #view-home .home-today [data-home-goto]").length >= 1, "today card offers an action");

// Force today onto a seeded routine with exercises, then start it from Home.
const dow = E("(new Date().getDay()+6)%7");
E("const dd=progDraft(); dd.slots=[null,null,null,null,null,null,null]; dd.slots[" + dow + "]=state.days[0].id; progSaveDraft(dd); renderHome();");
check(!!$("#view-home .home-today .ht-moves"), "today card lists the planned moves");
const startBtn = $("#view-home .home-today [data-home-start]");
check(Boolean(startBtn), "today card has a start button when a session is due");
startBtn.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(E("currentView") === "log", "start from home switches to the logger");
check(E("!!logCtx && logCtx.dayId === state.days[0].id"), "logger opened on the planned routine");
check(Boolean($("#view-log .log-step")), "logger rendered a step, not the picker");

// Logged-today state flips the card to a recap
E("logCtx=null; state.sessions.push({id:'sess-home', dayId:state.days[0].id, dateISO:new Date().toISOString(), type:'strength', completedSets:[{exId:state.exercises[0].id,setIndex:0,reps:8,time:null,weight:0,rating:2,note:'',hit:true}], recovery:null, finalized:false}); switchView('home');");
check(!!$("#view-home .ht-done"), "logged-today card shows the recap state");
check(/Logged today/.test($("#view-home").textContent), "hero reports the session is logged");

// Rest-day state when today has no routine
E("const dd=progDraft(); dd.slots=[null,null,null,null,null,null,null]; progSaveDraft(dd); localStorage.removeItem('perseus-programs-v1'); state.sessions=[]; renderHome();");
const todayCard = $("#view-home .home-today");
check(/Rest day|Recovery is the work/.test(todayCard.textContent), "rest-day state when nothing is scheduled");

// Streak stat card opens the expanded streak screen (same as the You tab)
const streakCard = $("#view-home [data-home-streak]");
check(Boolean(streakCard), "streak stat card is clickable");
streakCard.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
const modal = $("#you-modal-host");
check(Boolean(modal), "streak card opens the expanded You modal");
check(!!$("#you-modal-host .streak-big") && !!$("#you-modal-host .streak-cal"), "expanded streak calendar renders");
check(/Streak/.test($("#you-modal-host .you-modal-top h2").textContent), "modal titles the streak screen");
E("document.getElementById('you-modal-host') && document.getElementById('you-modal-host').remove()");

// Sessions + volume stat cards open the matching expanded You charts
const sessCard = $("#view-home [data-home-graph='weeks']");
check(Boolean(sessCard), "sessions stat card is clickable");
sessCard.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!!$("#you-modal-host") && $("#you-modal-host h2").textContent === "Workouts", "sessions card opens the Workouts graph from the You tab");
$("#you-modal-host [data-you-back]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!$("#you-modal-host"), "sessions graph closes via back button");
const volCard = $("#view-home [data-home-graph='volume']");
check(Boolean(volCard), "volume stat card is clickable");
volCard.dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!!$("#you-modal-host") && $("#you-modal-host h2").textContent === "Total volume", "volume card opens the Total volume graph from the You tab");
$("#you-modal-host [data-you-back]").dispatchEvent(new W.MouseEvent("click", { bubbles: true }));
check(!$("#you-modal-host"), "volume graph closes via back button");

check(errors.length === 0, "no window errors (" + errors.length + ")");
console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
