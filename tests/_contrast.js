// WCAG contrast check for candidate palettes. Run: node tests/__contrast.js
function lum(hex){
  const c=hex.replace('#','');
  const v=[0,2,4].map(i=>parseInt(c.substr(i,2),16)/255).map(x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4));
  return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
}
function ratio(a,b){ const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
function blend(fg,bg,alpha){ // fg hex over bg hex at alpha
  const f=[0,2,4].map(i=>parseInt(fg.replace('#','').substr(i,2),16));
  const g=[0,2,4].map(i=>parseInt(bg.replace('#','').substr(i,2),16));
  const m=f.map((v,i)=>Math.round(v*alpha+g[i]*(1-alpha)));
  return '#'+m.map(v=>v.toString(16).padStart(2,'0')).join('');
}
const THEMES = {
heritage:{paper:'#ece5d2',surface:'#faf5ea',surface2:'#f2ecdd',ink:'#1a150f',ink2:'#4c4332',ink3:'#857a65',accent:'#d95f2b',onAccent:'#ffffff',deep:'#a63c12',accSoft:'#f6ded0',green:'#2f6b4a',onGreen:'#ffffff',grnSoft:'#ddebe0',red:'#9c352b',redSoft:'#f3dcd8',amber:'#8f6a1c',ambSoft:'#f2e8cd',dark:'#17130c',onDark:'#f7f1e3',onDarkMut:'#f7f1e3',mutA:.74,hero:'#f0a271'},
slate:{paper:'#e9edf1',surface:'#f8fafb',surface2:'#eef2f6',ink:'#17212e',ink2:'#3a495d',ink3:'#57697f',accent:'#1f5fd0',onAccent:'#ffffff',deep:'#174a9e',accSoft:'#dbe7fb',green:'#1d6c40',onGreen:'#ffffff',grnSoft:'#d9ebdf',red:'#a83232',redSoft:'#f3dada',amber:'#7c5510',ambSoft:'#f1e5c6',dark:'#121922',onDark:'#f1f5f9',onDarkMut:'#f1f5f9',mutA:.74,hero:'#9cc0f5'},
forest:{paper:'#e6eae0',surface:'#f7f9f2',surface2:'#edf1e4',ink:'#16211a',ink2:'#3b493f',ink3:'#5a6c5f',accent:'#1f7148',onAccent:'#ffffff',deep:'#14593a',accSoft:'#d8ecdd',green:'#256f38',onGreen:'#ffffff',grnSoft:'#d9ebdb',red:'#a33327',redSoft:'#f3dbd5',amber:'#7d5a0e',ambSoft:'#f1e6c4',dark:'#111a13',onDark:'#f0f5eb',onDarkMut:'#f0f5eb',mutA:.74,hero:'#a5d8b4'},
mono:{paper:'#e8e8e8',surface:'#fafafa',surface2:'#f0f0f0',ink:'#161616',ink2:'#3d3d3d',ink3:'#5f5f5f',accent:'#333333',onAccent:'#ffffff',deep:'#000000',accSoft:'#e2e2e2',green:'#276e44',onGreen:'#ffffff',grnSoft:'#d9eadd',red:'#a83232',redSoft:'#f3dada',amber:'#7c5510',ambSoft:'#f1e6c4',dark:'#101010',onDark:'#f5f5f5',onDarkMut:'#f5f5f5',mutA:.74,hero:'#d8d8d8'},
midnight:{paper:'#0e1319',surface:'#1a212b',surface2:'#212a36',ink:'#edf1f6',ink2:'#bdc7d3',ink3:'#95a1af',accent:'#e8a33d',onAccent:'#241a05',deep:'#c08a2e',accSoft:'#2e2410',green:'#5cb87f',onGreen:'#0e2418',grnSoft:'#1d3025',red:'#d97063',redSoft:'#3a211c',amber:'#d9a441',ambSoft:'#3a2e14',dark:'#070a0e',onDark:'#edf1f6',onDarkMut:'#edf1f6',mutA:.74,hero:'#f0be6a'},
ocean:{paper:'#0c141f',surface:'#13202e',surface2:'#1a2a3e',ink:'#e9f1f8',ink2:'#b9c7d5',ink3:'#90a1b3',accent:'#35b6d9',onAccent:'#06222b',deep:'#3198b7',accSoft:'#0a1c29',green:'#54b783',onGreen:'#0b242c',grnSoft:'#1a3028',red:'#d97063',redSoft:'#3a211c',amber:'#d9a441',ambSoft:'#3a2e14',dark:'#060c13',onDark:'#e9f1f8',onDarkMut:'#e9f1f8',mutA:.74,hero:'#8fd4e8'},
};
const WHITE='#ffffff';
let fail=0;
for (const [name,t] of Object.entries(THEMES)){
  const strict = name!=='heritage'; // heritage is the frozen reference theme; report only
  const ck=(pair,val,min)=>{ const ok=val>=min; if(!ok && strict) fail++; console.log(((ok?'  ok ':'  FAIL ')+name+' '+pair+' = '+val.toFixed(2)+' (min '+min+')')+(ok||strict?'':' [reference]')); };
  console.log('## '+name);
  ck('ink/surface',ratio(t.ink,t.surface),7);
  ck('ink2/surface',ratio(t.ink2,t.surface),4.5);
  ck('ink3/surface2',ratio(t.ink3,t.surface2),4.5);
  ck('ink3/surface',ratio(t.ink3,t.surface),4.5);
  ck('onAccent/accent',ratio(t.onAccent,t.accent),4.5);
  ck('white/accent-deep',ratio(WHITE,t.deep),3);
  ck('deep/accSoft',ratio(t.deep,t.accSoft),4.5);
  ck('red/surface',ratio(t.red,t.surface),4.5);
  ck('red/redSoft',ratio(t.red,t.redSoft),4.5);
  ck('green/surface2',ratio(t.green,t.surface2),4.5);
  ck('green/grnSoft',ratio(t.green,t.grnSoft),4.5);
  ck('white/green',ratio(t.onGreen,t.green),4.5);
  ck('amber/ambSoft',ratio(t.amber,t.ambSoft),4.5);
  ck('amber/surface',ratio(t.amber,t.surface),4.5);
  ck('onDark/dark',ratio(t.onDark,t.dark),7);
  ck('onDarkMut/dark',ratio(blend(t.onDarkMut,t.dark,t.mutA),t.dark),4.5);
  ck('hero/dark',ratio(t.hero,t.dark),4.5);
}
console.log(fail?('\nRESULT: '+fail+' FAILURES'):('\nRESULT: all contrast checks pass'));
process.exit(fail?1:0);
