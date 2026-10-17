/* Folder auto-backup: user picks a folder once, app writes daily JSON when open / after workout. */
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
const { window } = dom;
const E = expr => window.eval(expr);

let pass = 0, fail = 0;
const check = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ FAIL: " + m); } };

(() => {
  console.log("\n== folder auto-backup helpers ==");
  check(typeof E("typeof backupFileName") === "\"function\"" || E("typeof backupFileName") === "'function'" || (()=>{ try { return typeof window.eval("backupFileName") === "function"; } catch(e){ return false; } })(), "backupFileName() exists");
  try {
    const n = window.eval("backupFileName(new Date('2026-03-05T12:00:00Z'))");
    check(n === "perseus-backup-2026-03-05.json", "backupFileName formats date (" + n + ")");
  } catch (e) { check(false, "backupFileName formats date (threw " + e.message + ")"); }
  try {
    const r = window.eval("shouldFolderBackup(null, new Date('2026-03-05T12:00:00Z'))");
    check(r === true, "shouldFolderBackup(null) asks for backup");
  } catch (e) { check(false, "shouldFolderBackup(null) (threw)"); }
  try {
    const same = window.eval("shouldFolderBackup('2026-03-05T08:00:00.000Z', new Date('2026-03-05T20:00:00Z'))");
    check(same === false, "same-day backup skipped");
    const next = window.eval("shouldFolderBackup('2026-03-04T08:00:00.000Z', new Date('2026-03-05T20:00:00Z'))");
    check(next === true, "next-day backup requested");
  } catch (e) { check(false, "shouldFolderBackup day logic (threw " + e.message + ")"); }
  try {
    const s = window.eval("buildBackupJSON()");
    const d = JSON.parse(s);
    check(Boolean(d.profile && d.exercises && d.days && d.sessions), "buildBackupJSON has profile/exercises/days/sessions");
  } catch (e) { check(false, "buildBackupJSON (threw " + e.message + ")"); }

  console.log("\n== settings UI ==");
  window.eval("switchView('settings')");
  const html2 = window.document.querySelector("#view-settings").innerHTML;
  check(html2.includes("set-folder-pick"), "settings has Pick backup folder button");
  check(html2.includes("set-folder-now"), "settings has Backup now button");
  check(html2.includes("set-folder-forget"), "settings can disconnect folder");
  check(html2.includes("set-folder-path"), "settings has Save location path readout");
  const row0 = window.document.querySelector("#set-folder-path");
  check(Boolean(row0) && row0.hidden === true, "path readout hidden while no folder is chosen");
  check(window.eval("backupFolderPathLabel()") === "", "backupFolderPathLabel() empty with no folder");

  window.localStorage.setItem("perseus-backup-meta", JSON.stringify({ folderName: "Perseus Backups", lastBackupISO: "", auto: true }));
  const label = window.eval("backupFolderPathLabel()");
  check(label === "…/Perseus Backups/", "backupFolderPathLabel() builds path (" + label + ")");
  window.eval("renderSettings()");
  const row1 = window.document.querySelector("#set-folder-path");
  const val1 = window.document.querySelector("#set-folder-path-value");
  check(Boolean(row1) && row1.hidden === false, "path readout appears once a folder is chosen");
  check(Boolean(val1) && val1.textContent === "…/Perseus Backups/", "path readout shows chosen path (" + (val1 && val1.textContent) + ")");

  window.localStorage.setItem("perseus-backup-meta", JSON.stringify({ folderName: "", lastBackupISO: "", auto: true }));
  window.eval("renderSettings()");
  const row2 = window.document.querySelector("#set-folder-path");
  check(Boolean(row2) && row2.hidden === true, "path readout hides again after Disconnect");

  console.log("\n===================================");
  console.log("RESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
