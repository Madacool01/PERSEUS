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
    window.localStorage = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} };
    window.scrollTo = () => {};
  },
});
const W = dom.window;
const E = expr => W.eval(expr);
function $(s){ return W.document.querySelector(s); }
function $$(s){ return Array.from(W.document.querySelectorAll(s)); }

let pass=0, fail=0;
const check=(c,m)=>{ if(c){pass++;console.log("  ✓ "+m);}else{fail++;console.log("  ✗ FAIL: "+m);} };
const click = el => el.dispatchEvent(new W.MouseEvent("click",{bubbles:true}));

console.log("== Exercise visualizer ==");
W.switchView("library");
check($$("#view-library .exercise-item").length >= 20, "library rendered with " + $$("#view-library .exercise-item").length + " exercises");

// Every card carries a pencil edit button
const edits = $$("#view-library .exercise-item [data-edit]");
check(edits.length === $$("#view-library .exercise-item").length, "every library card has a pencil edit button");
check(Boolean($("#view-library .ex-edit-btn svg")), "pencil button has an icon");

// Card click (not the pencil) opens the visualizer
const firstCard = $("#view-library .exercise-item");
const firstName = E("getEx('" + firstCard.dataset.open + "').name");
click(firstCard);
const host = $("#ex-vis-host");
check(Boolean(host && host.innerHTML.trim().length), "visualizer host rendered after card click");
check(Boolean($("#ex-vis-host .ex-vis-shell")), "visualizer shell present");
const title = $("#ex-vis-host .ex-vis-top h2");
check(Boolean(title) && title.textContent.indexOf(firstName) === 0, "visualizer title shows the exercise name");

// Sub-tabs + media frame + action pills
check($$("#ex-vis-host .ex-vis-tab").length === 5, "five sub-tabs (About / History / Progress / Records / Leaderboard)");
check(["About","History","Progress","Records","Leaderboard"].every((t,i)=>$$("#ex-vis-host .ex-vis-tab")[i].textContent===t), "tab labels in spec order");
check($$("#ex-vis-host [data-vis-action]").length === 4, "action pill bar has Favorites / YouTube / Share / How to");

// NO anatomy figure: no canvas, no muscle-map overlays inside the visualizer
check($$("#ex-vis-host canvas").length === 0, "no anatomy canvas rendered (no muscle figure)");

// Empty media frame when the exercise has no uploaded photo
check(Boolean($("#ex-vis-host .ex-vis-media-empty")), "media frame is empty when no photo uploaded");
check(!$("#ex-vis-host #ex-vis-img"), "no image element when no photo uploaded");

// Muscle data is shown as plain color-coded tags, not a figure
check($$("#ex-vis-host .vis-mtag.prim").length > 0 || $("#ex-vis-host .vis-mgroup .muted"), "muscle focus block rendered without a figure");

// About tab shows the block structure
check(Boolean($("#ex-vis-host .vis-block")), "about content has info blocks");

// Switch to Progress tab
click($$("#ex-vis-host .ex-vis-tab")[2]);
check($("#ex-vis-host .ex-vis-tab:nth-child(3)").classList.contains("active"), "progress tab becomes active");
check(Boolean($("#ex-vis-host #ex-vis-content .vis-empty")), "progress tab shows its content (empty state without sessions)");

// Close via back arrow
click($("#ex-vis-host [data-vis-back]"));
check(!$("#ex-vis-host") || $("#ex-vis-host").innerHTML.trim().length === 0, "visualizer dismissed via back arrow");

// With an uploaded photo the media frame shows it, paused/play + fullscreen controls appear
E("state.exercises[0].image = 'data:image/jpeg;base64,AAAA'");
click($("#view-library .exercise-item"));
check(Boolean($("#ex-vis-host #ex-vis-img")), "uploaded photo renders in the media frame");
check(!$("#ex-vis-host .ex-vis-media-empty"), "empty placeholder gone when photo present");
check($$("#ex-vis-host [data-vis-oc]").length === 2, "pause/play + fullscreen overlay controls shown with a photo");
click($("#ex-vis-host [data-vis-oc='play']"));
check($("#ex-vis-host #ex-vis-img").classList.contains("play") === false, "play/pause toggle pauses the ken burns loop");
click($("#ex-vis-host [data-vis-back]"));
E("state.exercises[0].image = ''");

// Movement-type nuance: a rep-based movement with weights available still reads as Bodyweight
E("openExVisualizer('ex-3')"); // Ring Dip seed: bodyweight-style movement, weightAvailable=true
const mtRows = $$("#ex-vis-host .vis-kv");
const mtRow = mtRows.find(r => r.querySelector("span") && r.querySelector("span").textContent === "Movement type");
check(Boolean(mtRow), "movement type row present");
check(Boolean(mtRow && mtRow.querySelector("b").textContent === "Bodyweight (weights available)"), "weighted bodyweight reads 'Bodyweight (weights available)', not 'Weight & reps'");
click($("#ex-vis-host [data-vis-back]"));

// Pencil click opens the editor (not the visualizer)
click($("#view-library .exercise-item [data-edit]"));
const editor = $("#ex-editor-host");
check(Boolean(editor && editor.innerHTML.trim().length), "pencil click opens the exercise editor");
check(!$("#ex-vis-host") || $("#ex-vis-host").innerHTML.trim().length === 0, "no visualizer behind the editor");
check(Boolean($("#ex-image-input")), "editor has a photo upload input");
if (editor){ click($("#ex-cancel")); }

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail?1:0);