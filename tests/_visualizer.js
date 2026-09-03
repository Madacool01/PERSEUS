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

// Similar movements = exercises working the same primary muscles
E("state.exercises.find(e=>e.id==='ex-1').primaryMuscles=['Pectoralis major']");
E("state.exercises.find(e=>e.id==='ex-2').primaryMuscles=['Pectoralis major','Triceps brachii']");
E("state.exercises.find(e=>e.id==='ex-16').primaryMuscles=['Quadriceps']"); // same equipment, different muscle
E("openExVisualizer('ex-1')");
const altNames = $$("#ex-vis-host .alt-card .alt-name").map(n=>n.textContent);
check(altNames.length === 1 && altNames[0] === "Diamond Push-Up", "similar movements share primary muscles (got: " + (altNames.join(", ") || "none") + ")");
check(!altNames.includes("Squat (Bodyweight)"), "same-equipment different-muscle exercise excluded from similar movements");
// No uploaded photo → thumbnail is a curated nature image, never unrelated stock
const thumbBg = el => (el.style.backgroundImage.match(/url\(["']?(.+?)["']?\)/) || [])[1] || "";
const thumbs = $$("#ex-vis-host .alt-card .alt-thumb");
check(thumbs.length === 1 && /^https:\/\/images\.unsplash\.com\/photo-/.test(thumbBg(thumbs[0])), "no-photo thumbnail falls back to a nature image (got: " + (thumbBg(thumbs[0]) || "none") + ")");
// Uploaded photo takes precedence over the nature fallback
E("state.exercises.find(e=>e.id==='ex-2').image='data:image/jpeg;base64,AAAA'");
E("openExVisualizer('ex-1')");
const thumbWithPhoto = $(".alt-card .alt-thumb");
check(Boolean(thumbWithPhoto) && thumbBg(thumbWithPhoto).indexOf("data:image/jpeg") === 0, "uploaded exercise photo shown for similar movements when present");
E("state.exercises.find(e=>e.id==='ex-2').image=''");
// Every similar movement gets its own distinct nature image (no duplicates)
E("state.exercises.find(e=>e.id==='ex-3').primaryMuscles=['Pectoralis major']");
E("openExVisualizer('ex-1')");
const multiThumbs = $$("#ex-vis-host .alt-card .alt-thumb").map(thumbBg);
check(multiThumbs.length === 2, "two similar movements listed (got: " + multiThumbs.length + ")");
check(multiThumbs.every(u=>/^https:\/\/images\.unsplash\.com\/photo-/.test(u)), "all similar-movement thumbnails are nature images");
check(new Set(multiThumbs).size === multiThumbs.length, "no two similar movements share the same picture");
E("state.exercises.find(e=>e.id==='ex-3').primaryMuscles=[]");
click($("#ex-vis-host [data-vis-back]"));

// Pencil click opens the editor (not the visualizer)
click($("#view-library .exercise-item [data-edit]"));
const editor = $("#ex-editor-host");
check(Boolean(editor && editor.innerHTML.trim().length), "pencil click opens the exercise editor");
check(!$("#ex-vis-host") || $("#ex-vis-host").innerHTML.trim().length === 0, "no visualizer behind the editor");
check(Boolean($("#ex-image-input")), "editor has a photo upload input");
if (editor){ click($("#ex-cancel")); }

// Records board: best single set vs real volume peak (tonnage formula)
E("state.profile.bodyWeight = 50");
E(`state.sessions = [
  { id:"r1", dayId:"day-1", dateISO: new Date(Date.now() - 9*86400000).toISOString(), completedSets:[
      { exId:"ex-1", setIndex:0, reps:10, weight:0, rating:2, hit:true } ]},
  { id:"r2", dayId:"day-1", dateISO: new Date(Date.now() - 2*86400000).toISOString(), completedSets:[
      { exId:"ex-1", setIndex:0, reps:8, weight:0, rating:2, hit:true },
      { exId:"ex-1", setIndex:1, reps:8, weight:0, rating:2, hit:true },
      { exId:"ex-1", setIndex:2, reps:8, weight:0, rating:2, hit:true } ]}
];`);
E("openExVisualizer('ex-1')");
click($$("#ex-vis-host .ex-vis-tab")[3]); // Records
const recRow = lbl => $$("#ex-vis-host .vis-rec").find(r => r.querySelector("span") && r.querySelector("span").textContent === lbl);
const recLabels = $$("#ex-vis-host .vis-rec").map(r => r.querySelector("span").textContent);
check(recLabels.join(",") === "Sessions,Best set,Volume peak,On target", "records grid shows Sessions / Best set / Volume peak / On target");
check(!recLabels.includes("Top session"), "redundant Top session row removed (best set already names the strongest effort)");
check(Boolean(recRow("Best set")) && recRow("Best set").querySelector("b").textContent === "10 reps", "best set stays the single strongest set (10 reps)");
check(Boolean(recRow("Volume peak")) && recRow("Volume peak").querySelector("b").textContent === "804 kg", "volume peak = tonnage formula: 3 sets × 8 reps × (0 + 50 kg × 0.67) = 804 kg");
click($("#ex-vis-host [data-vis-back]"));

console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
process.exit(fail?1:0);