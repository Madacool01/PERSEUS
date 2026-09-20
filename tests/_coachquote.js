/* Dev test: the Home coach card must not echo stale advice. With no open coach
   calls it shows a rotating line instead of the previous session's summary. */
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

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ok " + m); } else { fail++; console.log("  FAIL " + m); } };
const section = t => console.log("\n== " + t + " ==");
const coach = () => $("#view-home .home-coach");

window.switchView("home");

section("No coach calls: a line, not old feedback");
E("state.pending = []; state.sessions = []; renderHome();");
check(Boolean(coach()), "coach card present");
check(Boolean($("#view-home .home-coach .hc-quote")), "quote block rendered");
check(!$("#view-home .home-coach .summary"), "no session summary shown");
check(/No open calls/.test(coach().textContent), "badge reads 'No open calls'");
check(/Open the coach/.test(coach().textContent), "CTA invites opening the coach");
const q1 = $(".hc-quote blockquote").textContent;
check(q1.trim().length > 20, "quote has real text: " + JSON.stringify(q1.slice(0, 40)));
check(G("HOME_QUOTES").length > 1, "more than one line is available to rotate");

section("Stale summary with no open calls is not echoed");
E("state.sessions = [{ id:'s-stale', dayId: state.days[0].id, dateISO: new Date().toISOString(), type:'strength', completedSets: [], summary: 'Old coach advice about load' }];" +
  "state.pending = [{ suggestions: [{ kept: true }] }]; renderHome();");
check(E("homeOpenCalls()") === 0, "resolved call counts as no open calls");
check(Boolean($("#view-home .home-coach .hc-quote")), "quote shown instead of the stale summary");
check(!/Old coach advice/.test($("#view-home .home-coach").textContent), "previous session summary is not displayed");

section("Open coach calls still surface the advice");
E("state.pending = [{ suggestions: [{ kept: null }, { kept: true }] }]; renderHome();");
check(E("homeOpenCalls()") === 1, "one open call detected");
check(!$("#view-home .home-coach .hc-quote"), "quote replaced by the advice");
check(Boolean($("#view-home .home-coach .summary")), "summary paragraph shown");
check(/Old coach advice about load/.test(coach().textContent), "the session summary is shown when a call is open");
check(/1 open call/.test(coach().textContent), "badge counts open calls");
check(/Review suggestions/.test(coach().textContent), "CTA switches to reviewing suggestions");

section("Summaryless open call still reads sensibly");
E("state.sessions = []; renderHome();");
check(Boolean($("#view-home .home-coach .summary")), "fallback summary paragraph shown");
check(/lined up for your next session/i.test(coach().textContent), "fallback wording is used");

section("Runtime errors");
check(errors.length === 0, "no window errors" + (errors.length ? " -> " + errors.join(" | ") : ""));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
