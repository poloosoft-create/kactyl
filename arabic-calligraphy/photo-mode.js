/* Kactyl calligraphy — Photo mode engine (shared by every calligraphy page).
   Loaded on demand by the page's placeholder Photo tab: visitors who never open Photo never download it.
   Every visible string comes from the page's own PHOTO_UI object; the writing direction from the page's
   stage text — nothing in here is language-specific. Source of truth: this file. The pages reference it as
   /arabic-calligraphy/photo-mode.js?v=<md5 prefix>, stamped by tools/build_calligraphy.py. */
/* ── Photo mode: the calligraphy as a layer on the user's own photo ──────────
   Goal-first: after a photo is chosen the user picks WHAT they are making
   (profile, story, card, wall print, original) and gets a finished design —
   crop, placement, Look and export size all set — then adjusts anything.
   The photo never leaves the device. ONE renderer (drawPhotoScene) draws the
   preview, the Look thumbnails and the export: the download is what you see. */
(function(){
const $ = id => document.getElementById(id);
const st = $('preview-stage'), area = st && st.parentElement;
if (!st || !area) return;
const LOOKS = ['clean','color','gold','thread','ink','emboss','neon','plate'];
// aspect = w/h of the frame (null = the photo's own); out = export size in px
const GOALS = {
  profile: {aspect:1,       out:[1080,1080], place:'lower',  size:.13, look:() => 'clean', icon:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18c1.4-2.4 3.3-3.4 5.5-3.4s4.1 1 5.5 3.4"/>'},
  // safe: vertical band the text may sit in — stories lose the top ~14% and bottom ~20% to the app's own buttons
  story:   {aspect:9/16,    out:[1080,1920], safe:[.17,.74], place:'auto',   size:.16, look:L => L ? 'plate' : 'neon', icon:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5h3"/>'},
  card:    {aspect:4/5,     out:[2160,2700], place:'card',   size:.2,  look:() => 'gold', icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6l8.5 6.5L20.5 6"/>'},
  wall:    {aspect:2480/3508, out:[2480,3508], place:'center', size:.18, look:L => L ? 'emboss' : 'gold', icon:'<rect x="5" y="3" width="14" height="18" rx="1"/><rect x="8" y="6" width="8" height="9"/><path d="M8 18h8"/>'},
  keep:    {aspect:null,    out:null,        place:'auto',   size:.12, look:() => 'clean', icon:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'},
};

// ── markup ──
const svgI = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
area.querySelectorAll('.mode-tabs').forEach(t => t.remove());     // the page's placeholder tabs
const DIR0 = getComputedStyle($('stage-text')).direction || 'rtl';   // this page's writing direction
const tabs = document.createElement('div');
tabs.className = 'mode-tabs'; tabs.setAttribute('role','tablist');
tabs.innerHTML = '<button type="button" class="mode-tab active" id="mt-design" role="tab" aria-selected="true"></button>'
  + '<button type="button" class="mode-tab" id="mt-photo" role="tab" aria-selected="false">' + svgI('<rect x="2.5" y="5" width="19" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.8"/><path d="M8.5 5l1.4-2.5h4.2L15.5 5"/>') + '<span></span></button>';
area.insertBefore(tabs, st);
const ps = document.createElement('div');
ps.className = 'photo-stage'; ps.id = 'photo-stage';
ps.innerHTML = '<div class="photo-bar" id="photo-bar">'
  + '<button type="button" class="goal-pill" id="goal-pill"><span></span>' + svgI('<path d="M7 10l5 5 5-5"/>') + '</button>'
  + '<div class="bar-right"><button type="button" class="bar-btn" id="crop-btn">' + svgI('<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>') + '<span></span></button>'
  + '<button type="button" class="bar-ico" id="undo-btn">' + svgI('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>') + '</button>'
  + '<button type="button" class="bar-ico" id="redo-btn">' + svgI('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>') + '</button></div></div>'
  + '<div class="photo-canvas-wrap"><canvas id="photo-cv"></canvas>'
  + '<div class="goal-sheet" id="goal-sheet" role="dialog" aria-modal="false"><b id="goal-title"></b><p id="goal-sub"></p><div class="goal-grid">'
  + Object.entries(GOALS).map(([k,g]) => `<button type="button" class="goal" data-goal="${k}">${svgI(g.icon)}<span></span><small>${g.out ? g.out[0]+'×'+g.out[1] : ''}</small></button>`).join('')
  + '</div></div></div>'
  + '<label class="photo-drop" id="photo-drop"><input type="file" accept="image/*" id="photo-file">'
  + svgI('<rect x="2.5" y="5" width="19" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.8"/><path d="M8.5 5l1.4-2.5h4.2L15.5 5"/>')
  + '<b id="pd-title"></b><span id="pd-sub"></span></label>';
st.after(ps);
const tools = document.createElement('div');
tools.className = 'photo-tools hidden'; tools.id = 'photo-tools';
tools.innerHTML = '<div class="looks-head"><span id="looks-title"></span><div class="looks-actions">'
  + '<button type="button" class="place-btn" id="place-btn">' + svgI('<path d="M12 2.5l1.9 4.6 4.6 1.9-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 2.5z"/>') + '<span></span></button></div></div>'
  + '<div class="looks-row" role="radiogroup">'
  + LOOKS.map(k => `<button type="button" class="look" data-look="${k}" role="radio" aria-checked="false"><canvas width="168" height="120"></canvas><span></span></button>`).join('')
  + '</div><div class="look-panel" id="look-panel"><div class="ctrl-sec-head lp-head" id="lp-head"></div>'
  // Texts: up to 3; tap a chip (or the text on the photo) to edit it
  + '<div class="color-ctl texts-ctl" id="texts-ctl"><div class="tx-row"><span class="lc-lbl" id="tx-lbl"></span><div class="tx-chips" id="tx-chips"></div>'
  + '<button type="button" class="cc-auto tx-add" id="tx-add">+ <span></span></button></div>'
  + '<div class="tx-edit" id="tx-edit"><input type="text" id="tx-input" dir="' + DIR0 + '" maxlength="80"><select id="tx-font"></select></div></div>'
  + '<div class="color-ctl shape-ctl" id="shape-ctl" data-pl="straight"><span class="lc-lbl" id="shape-lbl"></span>'
  + '<div class="cc-seg cc-seg3" role="radiogroup"><button type="button" data-pl="straight" role="radio"></button><button type="button" data-pl="arc" role="radio"></button><button type="button" data-pl="circle" role="radio"></button></div>'
  + '<label class="lc-range sh-arc"><span id="pr-curve-lbl"></span><input type="range" id="pr-curve" min="10" max="100" step="1"></label>'
  + '<div class="cc-seg sh-arc" role="radiogroup"><button type="button" data-ps="top" role="radio"></button><button type="button" data-ps="bottom" role="radio"></button></div></div>'
  + '<div class="color-ctl grad" id="color-ctl">'
  + '<div class="cc-seg" role="radiogroup"><button type="button" data-cm="solid" role="radio"></button><button type="button" data-cm="gradient" role="radio"></button></div>'
  + '<label class="cc-sw cc-a" id="cc-a-sw"><input type="color" id="cc-a"></label><span class="cc-arrow" aria-hidden="true">→</span>'
  + '<label class="cc-sw cc-b" id="cc-b-sw"><input type="color" id="cc-b"></label><span class="cc-bar" id="cc-bar"></span>'
  + '<button type="button" class="cc-auto" id="cc-auto">' + svgI('<path d="M12 2.5l1.9 4.6 4.6 1.9-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 2.5z"/>') + '<span></span></button>'
  + '</div>'
  // Neon: Auto (the colour that pops most against this photo) or a chosen colour
  + '<div class="color-ctl look-ctl" id="neon-ctl"><span class="lc-lbl" id="neon-lbl"></span>'
  + '<button type="button" class="cc-auto" id="neon-auto">' + svgI('<path d="M12 2.5l1.9 4.6 4.6 1.9-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 2.5z"/>') + '<span></span></button>'
  + '<label class="cc-sw" id="neon-sw"><input type="color" id="neon-c"></label></div>'
  // Frosted Plate: Auto tint from the photo or a chosen tint, and how frosted the glass is
  + '<div class="color-ctl look-ctl" id="plate-ctl"><span class="lc-lbl" id="plate-lbl"></span>'
  + '<button type="button" class="cc-auto" id="plate-auto">' + svgI('<path d="M12 2.5l1.9 4.6 4.6 1.9-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 2.5z"/>') + '<span></span></button>'
  + '<label class="cc-sw" id="plate-sw"><input type="color" id="plate-c"></label>'
  + '<label class="lc-range"><span id="frost-lbl"></span><input type="range" id="plate-frost" min="0" max="100" step="1"></label></div>'
  // Background: only while the photo is zoomed out smaller than the frame
  + '<div class="color-ctl back-ctl" id="back-ctl"><span class="lc-lbl" id="back-lbl"></span>'
  + '<div class="cc-seg cc-seg3" role="radiogroup"><button type="button" data-bk="blur" role="radio"></button><button type="button" data-bk="solid" role="radio"></button><button type="button" data-bk="gradient" role="radio"></button></div>'
  + '<label class="cc-sw bk-c" id="back-a-sw"><input type="color" id="back-a"></label><span class="cc-arrow bk-g" aria-hidden="true">→</span>'
  + '<label class="cc-sw bk-g" id="back-b-sw"><input type="color" id="back-b"></label>'
  + '<button type="button" class="cc-auto bk-c" id="back-auto">' + svgI('<path d="M12 2.5l1.9 4.6 4.6 1.9-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 2.5z"/>') + '<span></span></button></div>'
  // Text behind: a switch that says what it does; when on, Person and Tap an object
  + '<div class="color-ctl behind-ctl" id="behind-ctl"><div class="bh-txt"><span class="lc-lbl" id="bh-title"></span><p class="bh-sub" id="bh-sub"></p></div>'
  + '<div class="bh-cards"><button type="button" class="bh-card" id="person-btn" aria-pressed="false">' + svgI('<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c.8-4.2 3.6-6.5 7-6.5s6.2 2.3 7 6.5"/>') + '<i class="spin" aria-hidden="true"></i><b></b><small></small></button>'
  + '<button type="button" class="bh-card" id="obj-btn" aria-pressed="false">' + svgI('<path d="M10 3.5H5.5a2 2 0 00-2 2V10M3.5 14v4.5a2 2 0 002 2H10M14 3.5h4.5a2 2 0 012 2V10" stroke-dasharray="2.6 2.4"/><path d="M13 13l7.5 2.8-3.2 1.3-1.3 3.2z"/>') + '<i class="spin" aria-hidden="true"></i><b></b><small></small></button></div></div></div>'
  + '<div class="photo-row" id="photo-row"><p class="photo-hint" id="photo-hint"></p><button type="button" class="photo-change" id="photo-change"></button></div>';
ps.after(tools);
const U = PHOTO_UI;
$('mt-design').textContent = U.design; $('mt-photo').querySelector('span').textContent = U.photo;
$('pd-title').textContent = U.choose; $('pd-sub').textContent = U.sub;
$('goal-title').textContent = U.goalTitle; $('goal-sub').textContent = U.goalSub;
ps.querySelectorAll('.goal').forEach(b => b.querySelector('span').textContent = U[b.dataset.goal]);
$('crop-btn').querySelector('span').textContent = U.crop;
$('undo-btn').setAttribute('aria-label', U.undo); $('undo-btn').title = U.undo;
$('redo-btn').setAttribute('aria-label', U.redo); $('redo-btn').title = U.redo;
$('looks-title').textContent = U.looks; $('place-btn').querySelector('span').textContent = U.place;
$('bh-title').textContent = U.behindTitle; $('bh-sub').textContent = U.behindSub; $('lp-head').textContent = U.photo;
$('person-btn').querySelector('b').textContent = U.person; $('person-btn').querySelector('small').textContent = U.personSub;
$('obj-btn').querySelector('b').textContent = U.obj; $('obj-btn').querySelector('small').textContent = U.objSub;
tools.querySelectorAll('.look').forEach(b => b.querySelector('span').textContent = U[b.dataset.look]);
$('look-panel').querySelectorAll('[data-cm]').forEach(b => b.textContent = U[b.dataset.cm]);
$('cc-auto').querySelector('span').textContent = U.autoMatch;
$('cc-a-sw').title = U.colorA; $('cc-a').setAttribute('aria-label', U.colorA);
$('cc-b-sw').title = U.colorB; $('cc-b').setAttribute('aria-label', U.colorB);
$('neon-lbl').textContent = U.neonColor; $('plate-lbl').textContent = U.plateTint; $('frost-lbl').textContent = U.frost; $('back-lbl').textContent = U.background;
['neon-auto','plate-auto','back-auto'].forEach(id => $(id).querySelector('span').textContent = U.auto);
$('look-panel').querySelectorAll('[data-bk]').forEach(b => b.textContent = U['bk_' + b.dataset.bk]);
$('photo-hint').textContent = U.hint; $('photo-change').textContent = U.change;
$('shape-lbl').textContent = U.shape; $('pr-curve-lbl').textContent = U.curve;
$('look-panel').querySelectorAll('button[data-pl]').forEach(b => b.textContent = U[b.dataset.pl]);
$('look-panel').querySelectorAll('[data-ps]').forEach(b => b.textContent = U[b.dataset.ps]);
$('tx-lbl').textContent = U.texts; $('tx-add').querySelector('span').textContent = U.addText;
$('tx-input').placeholder = U.textField; $('tx-input').setAttribute('aria-label', U.textField); $('tx-font').setAttribute('aria-label', U.font);
$('tx-font').innerHTML = STYLES.map(st => `<option value="${st.id}">${st.nameEn}</option>`).join('');

// ── state ──
const cv = $('photo-cv'), ctx = cv.getContext('2d');
let env = {light:{x:-.6,y:-.8,z:.78,tint:[255,246,228]}, grain:2, lightBg:false};
let photoGen = 0;
let photo = null, photoMode = false, goal = null, look = 'clean', light = false, markDark = false, avgCol = [128,128,128];
// the Color look: one chosen colour, or a gradient whose second colour is matched automatically
const COL = {mode:'gradient', a:'#e8577e', b:null, auto:true};
// Neon colour and Frosted Plate settings (Auto = chosen from the photo)
const NEON = {auto:true, c:'#ff3dd6'};
const PLATE = {auto:true, tint:'#ffffff', frost:.55};
let crop = {x:0, y:0, w:1, h:1}, cropMode = false, guides = {v:false, h:false};
let behind = false, seg = null;          // "Behind me": the person cut-out drawn over the calligraphy
let picking = false;                     // tap-to-add-object mode
const T = {cx:.5, cy:.5, size:.13, rot:0, wrap:null};            // centre (share of frame), font size (share of frame width), radians
window.isPhotoMode = () => photoMode && !!photo;
// Texts: layer 0 is the main text (the text box + font on the left); up to 2 more have their own words/font.
// The editor works on ONE layer at a time — T, look, COL, NEON, PLATE and the read-outs (light, avgCol,
// env) always hold the selected layer; the others are stored in `layers` and swapped in to draw or hit-test.
const MAX_TEXTS = 3;
// each text's shape: Straight, or bent onto an Arc / Circle by the same engine as Design mode (roundGeometryFor)
const PR0 = {layout:'straight', curve:.7, side:'top', repeat:0, centre:''}, PR = {...PR0};
let layers = [], cur = 0, curText = null, curFont = null, sceneNight = false;
const textNow = () => (curText != null ? curText : ($('stage-text').textContent || '')).trim();
const DIR = getComputedStyle($('stage-text')).direction || 'rtl';
const fontNow = () => (curFont || STYLES[currentStyle].font).replace(/'/g,'').split(',')[0].trim();
function stateNow(){
  return {text: curText, font: curFont, T: {...T}, look, col: {...COL}, neon: {...NEON}, plate: {...PLATE}, pr: {...PR},
          light, avgCol: [...avgCol], env: JSON.parse(JSON.stringify(env))};
}
function applyState(L){
  curText = L.text; curFont = L.font; Object.assign(T, L.T); look = L.look; Object.assign(PR, L.pr || PR0);
  Object.assign(COL, L.col); Object.assign(NEON, L.neon); Object.assign(PLATE, L.plate);
  light = L.light; avgCol = [...L.avgCol]; env = JSON.parse(JSON.stringify(L.env));
}
const saveCur = () => { if (layers.length) layers[cur] = stateNow(); };
// run fn with layer i loaded into the editor state, then put the selected layer back
function withLayer(i, fn){
  if (i === cur) return fn();
  saveCur(); const keep = layers[cur]; applyState(layers[i]);
  try { return fn(); } finally { applyState(keep); }
}
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const aspect = () => crop.w / crop.h;

// ── the cropped photo ──
// The frame shows the photo through `crop` (photo pixels). The photo can be zoomed out smaller
// than the frame (crop larger than the photo): it is then drawn where it lands and the empty
// space gets the chosen Background. photoRect = where the whole photo lands in a W×H frame.
function photoRect(W, H){ const s = W / crop.w; return {x: -crop.x*s, y: -crop.y*s, w: photo.width*s, h: photo.height*s}; }
function drawPhoto(c, W, H){ const r = photoRect(W, H); c.drawImage(photo, r.x, r.y, r.w, r.h); }
const covers = () => crop.x >= -.5 && crop.y >= -.5 && crop.x + crop.w <= photo.width + .5 && crop.y + crop.h <= photo.height + .5;
// Background behind a zoomed-out photo: Blur (the photo itself, soft, filling the frame) or a colour/gradient
const BACK = {mode:'blur', a:null, b:null, auto:true};
function backColors(){
  const a = BACK.auto || !BACK.a ? autoBackColor() : BACK.a;
  return [a, BACK.auto || !BACK.b ? kMatchColor(a, .5) : BACK.b];
}
// the photo's most vivid colour, deepened so the photo stands out (an average of all colours is mud)
function autoBackColor(){
  const pc = photoColors();
  if (pc.vivid < .04){ const [h, sat, l] = kHex2hsl(rgbHex(pc.avg)); return kHsl2hex(h, Math.min(.12, sat), Math.min(.22, Math.max(.1, l*.5))); }
  return kHsl2hex(pc.hue, .45, .17);
}
// soft blur in any browser (canvas `filter` is missing in older Safari): render at 4× the target small size,
// shrink in halves (each step averages pixels — one big shrink just samples them, which looks blotchy),
// blur the small image for real, then enlarge in 2× steps (one big jump looks blocky)
const softCache = new Map();
function softDraw(c, W, H, div, draw, key){
  if (key){ key += '|' + W + 'x' + H + '|' + div;
    const hit = softCache.get(key); if (hit){ c.save(); c.drawImage(hit, 0, 0); c.restore(); return; } }
  const tw = Math.max(4, Math.round(W / div)), th = Math.max(2, Math.round(tw * H / W));
  let w = tw*4, h = th*4, cur = document.createElement('canvas'); cur.width = w; cur.height = h; draw(cur.getContext('2d'), w, h);
  const step = (nw, nh) => { const nx = document.createElement('canvas'); nx.width = nw; nx.height = nh;
    const nc = nx.getContext('2d'); nc.imageSmoothingQuality = 'high'; nc.drawImage(cur, 0, 0, nw, nh); cur = nx; w = nw; h = nh; };
  step(tw*2, th*2); step(tw, th);
  const cc = cur.getContext('2d'), id = cc.getImageData(0, 0, w, h), d = id.data, ch = new Float32Array(w*h);
  for (let k = 0; k < 3; k++){
    for (let i = 0; i < w*h; i++) ch[i] = d[i*4+k];
    const bl = boxBlur(ch, w, h, 2); for (let i = 0; i < w*h; i++) d[i*4+k] = bl[i];
  }
  cc.putImageData(id, 0, 0);
  while (w*2 < W) step(w*2, h*2);
  if (key){ step(W, H); softCache.set(key, cur); if (softCache.size > 6) softCache.delete(softCache.keys().next().value); }
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(cur, 0, 0, W, H); c.restore();
}
// what the frame behind the text looks like, as a cache key (photo, framing, Background)
const frameKey = () => photoGen + '|' + JSON.stringify(crop) + '|' + JSON.stringify(BACK);
const rgbHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
// the photo's own colours (never the frame, which may include the Background): average + most vivid hue
let photoStats = null;
function photoColors(){
  if (photoStats && photoStats.photo === photo) return photoStats;
  const n = 48, t = document.createElement('canvas'); t.width = n; t.height = Math.max(2, Math.round(n * photo.height / photo.width));
  const tc = t.getContext('2d', {willReadFrequently:true}); tc.drawImage(photo, 0, 0, t.width, t.height);
  const d = tc.getImageData(0, 0, t.width, t.height).data; let r = 0, g = 0, b = 0, k = 0, hx = 0, hy = 0, hw = 0;
  for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i+1]; b += d[i+2]; k++;
    const [h, sa, l] = kHex2hsl(rgbHex([d[i], d[i+1], d[i+2]])), w = sa * (1 - Math.abs(2*l - 1));   // vivid pixels count most
    hx += Math.cos(h*Math.PI/180) * w; hy += Math.sin(h*Math.PI/180) * w; hw += w; }
  photoStats = {photo, avg: [r/k, g/k, b/k], hue: (Math.atan2(hy, hx)*180/Math.PI + 360) % 360, vivid: hw / k};
  return photoStats;
}
function drawBackdrop(c, W, H){
  if (covers()) return;
  if (BACK.mode === 'blur'){
    softDraw(c, W, H, 28, (tc, w, h) => { const sc = Math.max(w / photo.width, h / photo.height);   // the photo covering the frame
      tc.drawImage(photo, (w - photo.width*sc)/2, (h - photo.height*sc)/2, photo.width*sc, photo.height*sc); }, 'bk' + photoGen);
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, 0, W, H);
  } else {
    const [a, b] = backColors();
    if (BACK.mode === 'solid') c.fillStyle = a;
    else { const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; }
    c.fillRect(0, 0, W, H);
  }
}
function drawBase(c, W, H){ drawBackdrop(c, W, H); drawPhoto(c, W, H); }
function frameSmall(n){ const s = document.createElement('canvas'); s.width = n; s.height = Math.max(2, Math.round(n / aspect()));
  drawBase(s.getContext('2d', {willReadFrequently:true}), s.width, s.height); return s; }   // read-only analysis copy
// a crop of the given aspect, as large as the photo allows, centred on (fx,fy) in photo pixels
function cropAt(a, fx, fy){
  const PW = photo.width, PH = photo.height;
  let w = PW, h = w / a; if (h > PH){ h = PH; w = h * a; }
  return clampCrop({x: fx - w/2, y: fy - h/2, w, h});
}
// per axis: frame smaller than the photo → no empty edge; frame larger (zoomed out) → the photo stays whole inside
function clampCrop(c){
  const ax = (pos, size, full) => size <= full ? Math.min(full - size, Math.max(0, pos)) : Math.min(0, Math.max(full - size, pos));
  c.x = ax(c.x, c.w, photo.width); c.y = ax(c.y, c.h, photo.height); return c;
}
// smart crop: keep the busiest part of the photo (the subject) in frame — detail-weighted centre
function interest(){
  const n = 64, s = document.createElement('canvas'); s.width = n; s.height = Math.max(2, Math.round(n * photo.height / photo.width));
  const sc = s.getContext('2d', {willReadFrequently:true}); sc.drawImage(photo, 0, 0, s.width, s.height);
  const d = sc.getImageData(0, 0, s.width, s.height).data, W = s.width, H = s.height;
  const L = (x,y) => { const i = (y*W + x)*4; return .2126*d[i] + .7152*d[i+1] + .0722*d[i+2]; };
  let sx = 0, sy = 0, sw = 0;
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++){
    const g = Math.abs(L(x+1,y) - L(x-1,y)) + Math.abs(L(x,y+1) - L(x,y-1)), w = g*g;
    sx += x*w; sy += y*w; sw += w; }
  return sw ? [sx/sw / W * photo.width, sy/sw / H * photo.height] : [photo.width/2, photo.height/2];
}

// ── measurements: words flow into centred lines inside the text box ──
// T.wrap = box width as a share of the frame (null = one line). Line height comes from the
// font's own metrics, so Nastaliq gets the extra room it needs and Naskh stays compact.
const _rpx = new Map();
const styleIdNow = () => (STYLES.find(x => x.font === (curFont || STYLES[currentStyle].font)) || STYLES[currentStyle]).id;
function roundNow(){
  if (PR.layout === 'straight') return null;
  const t = textNow(); if (!t) return null;
  const id = styleIdNow(), key = [t, id, PR.layout, PR.curve, PR.side, PR.repeat].join('|'), hit = _rpx.get(key);
  if (hit) return hit.g ? hit : null;
  _rpx.set(key, {}); if (_rpx.size > 40) _rpx.delete(_rpx.keys().next().value);
  roundGeometryFor(t, id, PR.layout, PR).then(g => { _rpx.set(key, {g, p: new Path2D(g.text), key}); fit(); redraw(true); })
    .catch(e => { console.error(e); _rpx.delete(key); });
  return null;
}
// the bent outline in canvas px, centred on the text's origin (cached per size)
function roundPathPx(b){
  const R = b.round.R, k = b.round.k;
  if (R.pk !== k){ R.px = new Path2D(); R.px.addPath(R.p, new DOMMatrix().scaleSelf(k, k).translateSelf(-b.round.gcx, -b.round.gcy)); R.pk = k; }
  return R.px;
}
function textBox(c, W){
  const RG = roundNow();
  if (RG){                                            // bent text: its box is the bent artwork's box
    const fs = T.size * W, k = fs / 200, g = RG.g.box, w = (g.x2 - g.x1) * k, h = (g.y2 - g.y1) * k;
    return {fs, w, h, top: -h/2, bot: h/2, lines: [{t: textNow(), w, y: 0}], lh: h, longestWord: w, asc: h/2, desc: h/2, base: 0,
            round: {R: RG, k, gcx: (g.x1 + g.x2)/2, gcy: (g.y1 + g.y2)/2}};
  }
  const fs = T.size * W, t = textNow();
  c.font = `700 ${fs}px "${fontNow()}", serif`; c.direction = DIR;
  const words = t.split(/\s+/).filter(Boolean), max = T.wrap ? T.wrap * W : Infinity, rows = [];
  let cur = '';
  for (const w of words){ const tryLine = cur ? cur + ' ' + w : w;
    if (cur && c.measureText(tryLine).width > max){ rows.push(cur); cur = w; } else cur = tryLine; }
  if (cur || !rows.length) rows.push(cur);
  const ms = rows.map(r => c.measureText(r)), m0 = c.measureText(t || 'H');
  const lh = ((m0.fontBoundingBoxAscent || fs*.9) + (m0.fontBoundingBoxDescent || fs*.35)) * .9;
  const asc = ms[0].actualBoundingBoxAscent || fs*.7, desc = ms[ms.length-1].actualBoundingBoxDescent || fs*.25;
  const h = asc + desc + lh * (rows.length - 1), top = -h/2;
  const lines = rows.map((r, i) => ({t: r, w: ms[i].width, y: top + asc + i*lh}));
  const longestWord = Math.max(0, ...words.map(w => c.measureText(w).width));
  return {fs, w: Math.max(0, ...lines.map(l => l.w)), h, top, bot: top + h, lines, lh, longestWord,
          asc, desc, base: lines[0] ? lines[0].y : 0};
}

// ── Color look: the second gradient colour, matched to the first (same rule as Design mode: kMatchColor) ──
const colB = () => COL.auto || !COL.b ? kMatchColor(COL.a) : COL.b;

// ── the text as a separate layer, painted in the chosen Look ──
// The styled text is painted once into a box around it and cached by everything that changes its pixels
// (words, font, size, angle, Look, colours) but NOT its position: dragging just moves the finished layer.
// Neon's three wide glows cost ~120 ms a frame on a Retina screen when repainted on every move.
const layerCache = new Map();
function drawTextLayer(c, W, H, b){
  const fs = b.fs, cs = Math.abs(Math.cos(T.rot)), sn = Math.abs(Math.sin(T.rot)), m = fs * (look === 'neon' ? 1.6 : .6);
  const hw = Math.ceil((b.w*cs + b.h*sn)/2 + m), hh = Math.ceil((b.w*sn + b.h*cs)/2 + m);
  const key = [look, b.round ? b.round.R.key : b.lines.map(l => l.t).join('\n'), fontNow(), fs.toFixed(2), T.rot.toFixed(4), light, avgCol.map(Math.round),
    look === 'neon' ? neonColor() : '', look === 'plate' ? plateInk() : '', look === 'color' ? JSON.stringify(COL) + colB() : ''].join('|');
  let Lc = layerCache.get(key);
  if (!Lc){ Lc = textLayer(hw*2, hh*2, b); layerCache.set(key, Lc); if (layerCache.size > 24) layerCache.delete(layerCache.keys().next().value); }
  c.drawImage(Lc, Math.round(T.cx*W - hw), Math.round(T.cy*H - hh));
}
function textLayer(w, h, b){
  const Lc = document.createElement('canvas'); Lc.width = w; Lc.height = h;
  const c = Lc.getContext('2d');
  c.translate(w/2, h/2); c.rotate(T.rot);
  c.font = `700 ${b.fs}px "${fontNow()}", serif`; c.direction = DIR;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const top = b.top, bot = b.bot, fs = b.fs;
  const F = b.round ? (dx, dy) => { c.save(); c.translate(dx, dy); c.fill(roundPathPx(b)); c.restore(); }
                    : (dx, dy) => b.lines.forEach(l => c.fillText(l.t, dx, l.y + dy));   // every line, offset
  if (look === 'clean'){
    c.shadowColor = light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'; c.shadowBlur = fs*.12; c.shadowOffsetY = fs*.03;
    c.fillStyle = light ? '#141414' : '#ffffff'; F(0, 0);
  } else if (look === 'gold'){
    // rim = a darker copy just below (an outline would trace every overlap inside the letters)
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = fs*.09; c.shadowOffsetY = fs*.035;
    c.fillStyle = '#5a3606'; F(0, Math.max(1, fs*.018));
    c.shadowColor = 'transparent';
    const g = c.createLinearGradient(0, top, 0, bot);
    [[0,'#7a4a0c'],[.22,'#f8e39a'],[.45,'#c99327'],[.62,'#fff1bf'],[.82,'#a8701b'],[1,'#e9c46a']].forEach(s => g.addColorStop(...s));
    c.fillStyle = g; F(0, 0);
    c.globalCompositeOperation = 'source-atop';
    const s = c.createLinearGradient(-b.w/2, top, b.w/2, bot);
    s.addColorStop(.35,'rgba(255,255,255,0)'); s.addColorStop(.5,'rgba(255,255,255,.55)'); s.addColorStop(.65,'rgba(255,255,255,0)');
    c.fillStyle = s; c.fillRect(-b.w, top - fs, b.w*2, bot - top + fs*2);
  } else if (look === 'ink'){
    c.fillStyle = light ? 'rgba(18,14,10,.9)' : 'rgba(250,244,232,.92)'; F(0, 0);
  } else if (look === 'emboss'){
    // carved from the photo's own colour: light from top-left, shade bottom-right
    const d = Math.max(1, fs*.016), [r,g,bl] = avgCol, k = v => Math.min(255, Math.round(v*1.08 + 6));
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = fs*.05; c.shadowOffsetX = d; c.shadowOffsetY = d*1.4;
    c.fillStyle = 'rgba(0,0,0,.55)'; F(d*.6, d*.6);
    c.shadowColor = 'transparent'; c.shadowOffsetX = c.shadowOffsetY = 0;
    c.fillStyle = 'rgba(255,255,255,.38)'; F(-d*.6, -d*.6);
    c.fillStyle = `rgb(${k(r)},${k(g)},${k(bl)})`; F(0, 0);
  } else if (look === 'neon'){
    const glow = neonColor();
    c.fillStyle = glow;
    [[.7,.5],[.35,.8],[.12,1]].forEach(([bl, a]) => { c.shadowColor = glow; c.shadowBlur = fs*bl; c.globalAlpha = a; F(0, 0); });
    c.globalAlpha = 1; c.shadowBlur = fs*.05; c.shadowColor = '#fff'; c.fillStyle = '#fff6fd'; F(0, 0);
  } else if (look === 'plate'){
    c.fillStyle = plateInk(); F(0, 0);                    // dark or white: whichever reads on this plate
  } else if (look === 'color'){
    // soft shadow keeps any colour readable on a busy photo
    c.shadowColor = 'rgba(0,0,0,.42)'; c.shadowBlur = fs*.1; c.shadowOffsetY = fs*.03;
    if (COL.mode === 'solid') c.fillStyle = COL.a;
    else { const g = c.createLinearGradient(-b.w/2, top, b.w/2, bot); g.addColorStop(0, COL.a); g.addColorStop(1, colB()); c.fillStyle = g; }
    F(0, 0);
  }
  return Lc;
}
// Neon Auto: the photo's most vivid hue turned to its opposite on the colour wheel — the colour that
// pops most against this photo (green park → pink, warm sunset → cyan). Dull photos get classic pink.
function neonColor(){
  if (!NEON.auto) return NEON.c;
  const pc = photoColors(); if (pc.vivid < .04) return '#ff3dd6';
  return kHsl2hex((pc.hue + 180) % 360, 1, .62);
}
// Plate Auto: a frosted white with a breath of the photo's own colour, so the plate belongs to the picture
function plateTint(){
  if (!PLATE.auto) return PLATE.tint;
  const [h, sa] = kHex2hsl(rgbHex(photoColors().avg)); return kHsl2hex(h, Math.min(.35, sa), .95);
}
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// what the plate really looks like = the blurred photo seen through the tint; the ink reads against that
function plateInk(){
  const t = hexRgb(plateTint()), a = .2 + .55*PLATE.frost, avg = photoColors().avg;
  const mix = t.map((v, i) => v*a + avg[i]*(1 - a)), L = (.2126*mix[0] + .7152*mix[1] + .0722*mix[2]) / 255;
  return L > .5 ? '#141210' : '#ffffff';
}
// Frosted Plate: a rounded pane of glass behind the text — the photo blurred through it, tinted, with a
// glossy top sheen. Frost 0 = clear glossy glass, 1 = milky frost. Blur = downscale + smooth upscale.
function drawPlate(c, W, H, b){
  const fr = PLATE.frost, [tr, tg, tb] = hexRgb(plateTint());
  c.save(); platePath(c, W, H, b);
  c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = b.fs*.35; c.shadowOffsetY = b.fs*.08;
  c.fillStyle = `rgba(${tr},${tg},${tb},.35)`; c.fill(); c.restore();
  c.save(); platePath(c, W, H, b); c.clip(); c.setTransform(1, 0, 0, 1, 0, 0);
  softDraw(c, W, H, Math.round(6 + fr*30), (sc, w, h) => drawBase(sc, w, h), 'pl' + frameKey());   // more frost = softer
  c.fillStyle = `rgba(${tr},${tg},${tb},${.2 + .55*fr})`; c.fillRect(0, 0, W, H); c.restore();
  // gloss: a soft light band across the top of the glass, stronger on clear glass
  c.save(); platePath(c, W, H, b); c.clip();
  const pad = b.fs*.45, top = b.top - pad*.7, gl = c.createLinearGradient(0, top, 0, top + (b.h + pad*1.4)*.55);
  gl.addColorStop(0, `rgba(255,255,255,${.38 - fr*.22})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.fillRect(-W, top, W*2, b.h + pad*2); c.restore();
  c.save(); platePath(c, W, H, b); c.lineWidth = Math.max(1, b.fs*.02); c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke(); c.restore();
}
function platePath(c, W, H, b){
  const pad = b.fs*.45, w = b.w + pad*2, h = b.h + pad*1.4, r = Math.min(h/2, b.fs*.35);
  c.translate(T.cx * W, T.cy * H); c.rotate(T.rot);
  c.beginPath(); c.roundRect(-w/2, b.top - pad*.7, w, h, r);
}

// ── premium materials: real light on real shapes ────────────────────────────
// Every material is lit, not painted: the letter mask is blurred into a height
// map, normals come from its slope, and a light whose direction and colour are
// read from the user's photo shades it. The photo's own grain is added on top,
// so the calligraphy sits IN the photo instead of on it. All deterministic
// (seeded noise), so preview, thumbnails and export match.
function hash2(x, y){ let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t*t*(3-2*t);
  const a = hash2(xi,yi), b = hash2(xi+1,yi), c = hash2(xi,yi+1), d = hash2(xi+1,yi+1);
  return a + (b-a)*s(xf) + (c-a)*s(yf) + (a-b-c+d)*s(xf)*s(yf); }
function boxBlur(src, w, h, r){                      // separable box blur, run twice ≈ gaussian
  r = Math.max(1, Math.round(r));
  const a = Float32Array.from(src), t = new Float32Array(w*h), n = 2*r + 1;
  for (let pass = 0; pass < 2; pass++){
    for (let y = 0; y < h; y++){ const o = y*w; let acc = 0;                 // horizontal: a -> t
      for (let x = -r; x <= r; x++) acc += a[o + Math.min(w-1, Math.max(0, x))];
      for (let x = 0; x < w; x++){ t[o+x] = acc / n; acc += a[o + Math.min(w-1, x+r+1)] - a[o + Math.max(0, x-r)]; } }
    for (let x = 0; x < w; x++){ let acc = 0;                               // vertical: t -> a
      for (let y = -r; y <= r; y++) acc += t[Math.min(h-1, Math.max(0, y))*w + x];
      for (let y = 0; y < h; y++){ a[y*w+x] = acc / n; acc += t[Math.min(h-1, y+r+1)*w + x] - t[Math.max(0, y-r)*w + x]; } }
  }
  return a;
}
// light: from the text toward the brightest part of the photo (default: top-left sky light)
function readLight(frame, cx, cy){
  const s = frame, c = s.getContext('2d'), d = c.getImageData(0, 0, s.width, s.height).data, n = s.width*s.height;
  const L = new Float32Array(n); let mn = 1, mx = 0;
  for (let i = 0; i < n; i++){ L[i] = (.2126*d[i*4] + .7152*d[i*4+1] + .0722*d[i*4+2]) / 255; mn = Math.min(mn, L[i]); mx = Math.max(mx, L[i]); }
  let lx = -.6, ly = -.8, tint = [255, 246, 228];
  if (mx - mn > .25){
    const th = mx - (mx - mn)*.12; let sx = 0, sy = 0, k = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) if (L[i] >= th){ sx += i % s.width; sy += (i / s.width) | 0; k++; r += d[i*4]; g += d[i*4+1]; b += d[i*4+2]; }
    const dx = sx/k/s.width - cx, dy = sy/k/s.height - cy, m = Math.hypot(dx, dy);
    if (m > .05){ lx = dx/m; ly = dy/m; }
    tint = [r/k, g/k, b/k].map(v => Math.min(255, v*.35 + 255*.65));       // a touch of the light's colour
  }
  const z = .78, m = Math.hypot(lx, ly, z); return {x: lx/m, y: ly/m, z: z/m, tint};
}
// photo grain: how noisy is this photo? (keeps letters from looking sharper/cleaner than the photo)
function readGrain(frame){
  const c = frame.getContext('2d'), w = frame.width, h = frame.height, d = c.getImageData(0, 0, w, h).data;
  let acc = 0, k = 0;
  for (let y = 1; y < h-1; y += 2) for (let x = 1; x < w-1; x += 2){ const i = (y*w+x)*4;
    const v = d[i+1], nb = (d[i+1-4] + d[i+1+4] + d[i+1-w*4] + d[i+1+w*4]) / 4; acc += Math.abs(v - nb); k++; }
  return Math.min(7, Math.max(1.2, acc/k * .6));
}

// Gold Thread: satin-stitch embroidery, each stitch a lit cylinder, shaded by the light read from the photo
const threadCache = new Map();
function renderThread(c, W, H, b, env){
  const fs = b.fs, ox = T.cx*W, oy = T.cy*H, cs = Math.cos(T.rot), sn = Math.sin(T.rot);
  // region = rotated block + room for the shadow
  const ext = fs*.9, hw = Math.ceil((Math.abs(b.w*cs) + Math.abs(b.h*sn))/2 + ext), hh = Math.ceil((Math.abs(b.w*sn) + Math.abs(b.h*cs))/2 + ext);
  const w = hw*2, h = hh*2;
  if (w < 4 || h < 4) return;
  const key = [b.round ? b.round.R.key : b.lines.map(l => l.t).join('\n'), fontNow(), fs.toFixed(2), T.rot.toFixed(4), JSON.stringify(env.light), env.grain].join('|');
  let L = threadCache.get(key);
  if (!L){
    const mk = document.createElement('canvas'); mk.width = w; mk.height = h;
    const mc = mk.getContext('2d'); mc.fillStyle = '#fff';
    mc.save(); mc.translate(hw, hh); mc.rotate(T.rot);
    mc.font = `700 ${fs}px "${fontNow()}", serif`; mc.direction = DIR; mc.textAlign = 'center'; mc.textBaseline = 'alphabetic';
    if (b.round) mc.fill(roundPathPx(b)); else b.lines.forEach(l => mc.fillText(l.t, 0, l.y)); mc.restore();
    const md = mc.getImageData(0, 0, w, h).data, A = new Float32Array(w*h);
    for (let i = 0; i < w*h; i++) A[i] = md[i*4+3] / 255;
    const Lt = env.light, out = new ImageData(w, h), P = out.data;
    const blurR = Math.max(1.5, fs*.035), Hm = boxBlur(A, w, h, blurR), relief = blurR * 1.6;   // relief in px: same look at any resolution
    const Hx = Lt.x, Hy = Lt.y, Hz = Lt.z + 1, hn = Math.hypot(Hx, Hy, Hz);   // half vector (viewer straight ahead)
    const g = env.grain;
    for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++){
      const i = y*w + x, a = A[i];
      if (a < .01) continue;
      let nx = -(Hm[i+1] - Hm[i-1]) / 2 * relief, ny = -(Hm[i+w] - Hm[i-w]) / 2 * relief, nz = 1;
      const nm = Math.hypot(nx, ny, nz); nx /= nm; ny /= nm; nz /= nm;
      const diff = Math.max(0, nx*Lt.x + ny*Lt.y + nz*Lt.z), sp = Math.max(0, (nx*Hx + ny*Hy + nz*Hz) / hn);
      const p = i*4, gx = x - hw, gy = y - hh, nse = (hash2(gx, gy) - .5) * 2 * g;   // stitches follow the text, not the frame
      // fine satin stitches, hand-irregular: each thread wavers a little and catches light on its own
      const per = Math.max(2, fs*.026), wob = (vnoise(gx/(fs*.18), gy/(fs*.18)) - .5) * per * .9;
      const u = (gx*.8 + gy*.6 + wob) / per, si = Math.floor(u), f = u - si;
      const cyl = Math.sin(f*Math.PI), gap = f < .07 ? .72 : 1, tone = .88 + hash2(si, 3)*.2;
      const shd = (.38 + .68*diff) * (.6 + .4*cyl) * gap * tone, s2 = Math.pow(sp, 14) * cyl * (.6 + hash2(si, 9)*.6);
      P[p] = 214*shd + 255*s2 + nse; P[p+1] = 168*shd + 230*s2 + nse; P[p+2] = 74*shd + 170*s2 + nse; P[p+3] = a*255;
    }
    const st = document.createElement('canvas'); st.width = w; st.height = h; st.getContext('2d').putImageData(out, 0, 0);
    // soft cast shadow, opposite the light (drawn through an offscreen offset so only the shadow lands), then the stitches
    const tc = document.createElement('canvas'); tc.width = w; tc.height = h; const k = tc.getContext('2d');
    k.save(); k.shadowColor = 'rgba(0,0,0,.45)'; k.shadowBlur = fs*.1;
    k.shadowOffsetX = -Lt.x*fs*.05 + 20000; k.shadowOffsetY = -Lt.y*fs*.05; k.drawImage(mk, -20000, 0); k.restore();
    k.drawImage(st, 0, 0);
    L = {tc}; threadCache.set(key, L); if (threadCache.size > 8) threadCache.delete(threadCache.keys().next().value);
  }
  c.drawImage(L.tc, Math.round(ox - hw), Math.round(oy - hh));
}

// ── "Behind me": calligraphy passes behind the person ─────────────────────────
// On-device segmentation (MediaPipe Image Segmenter, loaded only on first use — the photo
// never leaves the device). The model's mask is coarse, so it is refined against the photo
// itself with a guided filter: edges follow real hair and shoulder contours at full size.
const SEG_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
// pinned versions: /1/ is byte-identical to /latest/ (checked 2026-10-26) but can never change under us
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite';
// The engine (~13 MB, 3.8 MB compressed) and the models (16 + 6 MB) download ONCE: they are kept in the
// browser's Cache Storage — Google serves the models with a 1-hour cache, so without this a returning
// visitor downloads 16 MB again. The person model stays the big multiclass one: the small selfie + hair
// models (1 MB) were measured on real portraits and cut headscarves off and pulled in the background.
const AI_CACHE = 'kactyl-ai-v1';
const AI_SIZE = {engine: 13.2e6};                       // decompressed bytes, for the % shown while downloading
const aiGot = {}, aiWatch = new Set(), aiInflight = new Map();
const aiProgress = (key, n) => { aiGot[key] = n; aiWatch.forEach(f => f()); };
const aiPct = keys => Math.min(100, Math.round(100 * keys.reduce((a, k) => a + (aiGot[k] || 0), 0) / keys.reduce((a, k) => a + AI_SIZE[k], 0)));
async function aiFetch(url, key){
  const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + r.status);
  if (!r.body){ const b = new Uint8Array(await r.arrayBuffer()); aiProgress(key, b.byteLength); return b; }
  const rd = r.body.getReader(), parts = []; let n = 0;
  for (;;){ const {done, value} = await rd.read(); if (done) break; parts.push(value); n += value.length; aiProgress(key, n); }
  const out = new Uint8Array(n); let o = 0; for (const q of parts){ out.set(q, o); o += q.length; } return out;
}
// bytes of a model/engine file: from the device if saved before, else downloaded (counted) and saved
function aiBytes(url, key){
  key = key || url;
  if (!aiInflight.has(key)) aiInflight.set(key, (async () => {
    let cache = null;
    try { cache = await caches.open(AI_CACHE); const hit = await cache.match(url);
      if (hit){ const b = new Uint8Array(await hit.arrayBuffer()); aiProgress(key, AI_SIZE[key] || b.byteLength); return b; } } catch(e){}
    const b = await aiFetch(url, key);
    try { if (cache) await cache.put(url, new Response(b)); } catch(e){}
    return b;
  })().catch(e => { aiInflight.delete(key); throw e; }));
  return aiInflight.get(key);
}
// the engine, handed to MediaPipe from our saved copy (a blob URL) so it never downloads twice
let visionP = null;
function vision(){
  if (!visionP) visionP = (async () => {
    const v = await import(SEG_LIB + '/vision_bundle.mjs');
    const files = await v.FilesetResolver.forVisionTasks(SEG_LIB + '/wasm');
    const wasm = await aiBytes(files.wasmBinaryPath, 'engine');
    files.wasmBinaryPath = URL.createObjectURL(new Blob([wasm], {type: 'application/wasm'}));
    return {v, files};
  })().catch(e => { visionP = null; throw e; });
  return visionP;
}
// on Wi-Fi / fast connections only (never mobile data or data-saver): fetch everything in the background
// once a photo is chosen, so "Person" is usually ready before it is tapped
function fastNet(){
  const c = navigator.connection;
  if (c){ if (c.saveData || c.type === 'cellular' || /(^|-)(2g|3g)$/.test(c.effectiveType || '')) return false; return true; }
  return window.matchMedia('(pointer: fine)').matches;        // no connection info (Safari, Firefox): desktops only
}
let aiPrefetched = false;
function prefetchAI(){
  if (aiPrefetched || !fastNet()) return; aiPrefetched = true;
  const go = () => vision().then(() => aiBytes(SEG_MODEL)).then(() => aiBytes(INTER_MODEL)).catch(() => { aiPrefetched = false; });
  'requestIdleCallback' in window ? requestIdleCallback(go, {timeout: 4000}) : setTimeout(go, 1500);
}
// a card shows the download while it runs: "Downloading once · 45%"
function aiShow(btn, keys, idle){
  const small = btn.querySelector('small'), f = () => { const p = aiPct(keys); small.textContent = p < 100 ? `${U.dlOnce} · ${p}%` : U.finding; };
  aiWatch.add(f); f();
  return () => { aiWatch.delete(f); small.textContent = idle(); };
}
let segmenterP = null;
function getSegmenter(){
  if (!segmenterP) segmenterP = (async () => {
    const [{v, files}, model] = await Promise.all([vision(), aiBytes(SEG_MODEL)]);
    const make = delegate => v.ImageSegmenter.createFromOptions(files, {baseOptions:{modelAssetBuffer:model, delegate},
      runningMode:'IMAGE', outputCategoryMask:false, outputConfidenceMasks:true});
    // CPU: the model input is only 256×256, and a GPU mask must be read back to the CPU anyway —
    // that readback, not the model, was the slow part (25–60 s on software GL vs ~0.1 s inference)
    return await make('CPU');
  })().catch(e => { segmenterP = null; throw e; });
  return segmenterP;
}
// guided filter (He et al.): refines the coarse alpha p using the photo's luminance I as guide
function guidedFilter(I, p, w, h, r, eps){
  const n = w*h, II = new Float32Array(n), Ip = new Float32Array(n);
  for (let i = 0; i < n; i++){ II[i] = I[i]*I[i]; Ip[i] = I[i]*p[i]; }
  const mI = boxBlur(I, w, h, r), mp = boxBlur(p, w, h, r), mII = boxBlur(II, w, h, r), mIp = boxBlur(Ip, w, h, r);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++){ const vI = mII[i] - mI[i]*mI[i], cIp = mIp[i] - mI[i]*mp[i];
    a[i] = cIp / (vI + eps); b[i] = mp[i] - a[i]*mI[i]; }
  const ma = boxBlur(a, w, h, r), mb = boxBlur(b, w, h, r), q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = ma[i]*I[i] + mb[i];
  return q;
}
// Fast guided filter (He & Sun 2015): the coefficients a, b are smooth by construction, so they are
// computed on a 4× smaller grid and enlarged; only q = a·I + b runs at full size, against the full-size
// photo — the edges keep the full-resolution detail. ~10× faster than the plain filter (4.6 s → <0.5 s).
function fastGuidedFilter(I, p, w, h, r, eps){
  const s = 4, sw = Math.max(2, Math.ceil(w / s)), sh = Math.max(2, Math.ceil(h / s)), n = sw*sh;
  const Is = new Float32Array(n), ps = new Float32Array(n), cnt = new Float32Array(n);
  for (let y = 0; y < h; y++){ const yy = Math.min(sh-1, (y / s) | 0);
    for (let x = 0; x < w; x++){ const j = yy*sw + Math.min(sw-1, (x / s) | 0), i = y*w + x; Is[j] += I[i]; ps[j] += p[i]; cnt[j]++; } }
  for (let j = 0; j < n; j++){ Is[j] /= cnt[j] || 1; ps[j] /= cnt[j] || 1; }
  const rs = Math.max(1, Math.round(r / s)), II = new Float32Array(n), Ip = new Float32Array(n);
  for (let j = 0; j < n; j++){ II[j] = Is[j]*Is[j]; Ip[j] = Is[j]*ps[j]; }
  const mI = boxBlur(Is, sw, sh, rs), mp = boxBlur(ps, sw, sh, rs), mII = boxBlur(II, sw, sh, rs), mIp = boxBlur(Ip, sw, sh, rs);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let j = 0; j < n; j++){ const vI = mII[j] - mI[j]*mI[j], cIp = mIp[j] - mI[j]*mp[j];
    a[j] = cIp / (vI + eps); b[j] = mp[j] - a[j]*mI[j]; }
  const ma = boxBlur(a, sw, sh, rs), mb = boxBlur(b, sw, sh, rs), q = new Float32Array(w*h);
  // bilinear enlarge of a, b, then q at full resolution
  for (let y = 0; y < h; y++){ const fy = Math.min(sh - 1.001, Math.max(0, (y + .5) / s - .5)), y0 = fy | 0, ty = fy - y0;
    for (let x = 0; x < w; x++){ const fx = Math.min(sw - 1.001, Math.max(0, (x + .5) / s - .5)), x0 = fx | 0, tx = fx - x0;
      const j = y0*sw + x0, i = y*w + x;
      const A = (ma[j]*(1-tx) + ma[j+1]*tx)*(1-ty) + (ma[j+sw]*(1-tx) + ma[j+sw+1]*tx)*ty;
      const Bv = (mb[j]*(1-tx) + mb[j+1]*tx)*(1-ty) + (mb[j+sw]*(1-tx) + mb[j+sw+1]*tx)*ty;
      q[i] = A*I[i] + Bv; } }
  return q;
}
// The subject = the person (found automatically) + any objects the user taps. Each part is a
// refined alpha map at the working size; they are united into one canvas drawn over the text.
const INTER_MODEL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite';
AI_SIZE[SEG_MODEL] = 16.37e6; AI_SIZE[INTER_MODEL] = 6.23e6;
let interP = null;
function getInteractive(){
  if (!interP) interP = (async () => {
    const [{v, files}, model] = await Promise.all([vision(), aiBytes(INTER_MODEL)]);
    // tasks-vision 1.1 moved InteractiveSegmenter to an unpublished .task bundle; the Legacy class
    // still runs the public magic_touch.tflite model (the library's own error message says to use it)
    const IS = v.InteractiveSegmenterLegacy || v.InteractiveSegmenter;
    return IS.createFromOptions(files, {baseOptions:{modelAssetBuffer:model, delegate:'CPU'},
      outputCategoryMask:false, outputConfidenceMasks:true});
  })().catch(e => { interP = null; throw e; });
  return interP;
}
function segBase(){
  const MAXS = 1024, k = Math.min(1, MAXS / Math.max(photo.width, photo.height));   // mask working size: sharp enough for a 2480 px export, ~1 s to refine
  const w = Math.max(2, Math.round(photo.width*k)), h = Math.max(2, Math.round(photo.height*k));
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sc = src.getContext('2d', {willReadFrequently:true}); sc.drawImage(photo, 0, 0, w, h);
  // the models work at 256 px: give them a 512 px copy; the full-size photo is used to refine the edges
  const kk = Math.min(1, 512 / Math.max(w, h)), small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(w*kk)); small.height = Math.max(2, Math.round(h*kk));
  small.getContext('2d').drawImage(src, 0, 0, small.width, small.height);
  const pd = sc.getImageData(0, 0, w, h).data, I = new Float32Array(w*h);
  for (let i = 0; i < I.length; i++) I[i] = (.2126*pd[i*4] + .7152*pd[i*4+1] + .0722*pd[i*4+2]) / 255;
  return {photo, k, w, h, small, I, person: null, objs: [], canvas: null, cover: 0, box: null};
}
// a model's coarse mask (mw×mh floats) → a refined alpha map at the working size
function refine(S, P0, mw, mh){
  const {w, h} = S; let p = P0;
  if (mw !== w || mh !== h){                                   // bilinear resize via a canvas
    const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh;
    const id = mc.getContext('2d').createImageData(mw, mh);
    for (let i = 0; i < P0.length; i++) id.data[i*4+3] = Math.round(P0[i]*255);
    mc.getContext('2d').putImageData(id, 0, 0);
    const rc = document.createElement('canvas'); rc.width = w; rc.height = h; const rcc = rc.getContext('2d', {willReadFrequently:true});
    rcc.imageSmoothingQuality = 'high'; rcc.drawImage(mc, 0, 0, w, h);
    const d = rcc.getImageData(0, 0, w, h).data; p = new Float32Array(w*h);
    for (let i = 0; i < p.length; i++) p[i] = d[i*4+3] / 255;
  }
  const q = fastGuidedFilter(S.I, p, w, h, Math.max(4, Math.round(Math.max(w, h) / 180)), 1e-4);
  for (let i = 0; i < q.length; i++) q[i] = Math.min(1, Math.max(0, (q[i] - .06) / .88));
  return q;
}
// unite the parts into the canvas drawn over the text; box = the person (or everything) for placement
function rebuildSeg(S){
  const usedP = S.usePerson !== false ? S.person : null;
  const {w, h} = S, parts = [usedP, ...S.objs.map(o => o.a)].filter(Boolean);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const od = out.getContext('2d').createImageData(w, h), boxOf = usedP || null;
  let cover = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y*w + x; let a = 0; for (const m of parts) if (m[i] > a) a = m[i];
    od.data[i*4+3] = Math.round(a*255); cover += a;
    const bA = boxOf ? boxOf[i] : a;
    if (bA > .5){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  out.getContext('2d').putImageData(od, 0, 0);
  const k = S.k; S.canvas = out; S.cover = cover / (w*h);
  S.box = x1 > x0 ? {x0: x0/k, y0: y0/k, x1: x1/k, y1: y1/k} : null;
  return S;
}
async function detectPerson(S){
  const segm = await getSegmenter(), res = segm.segment(S.small), ms = res.confidenceMasks;
  // multiclass model: mask 0 = background confidence; a single-class model: mask 0 = person
  const m0 = ms[0], mw = m0.width, mh = m0.height, raw = m0.getAsFloat32Array(), P0 = new Float32Array(mw*mh);
  for (let i = 0; i < P0.length; i++) P0[i] = ms.length > 1 ? 1 - raw[i] : raw[i];
  // a person shows a face (class 3). Without one, the "not background" shape is a pet, an object or
  // a colourless old photo (the model reads all of them as "clothes", measured) — tapping picks those
  // precisely, and a half-guessed automatic cut-out would only confuse
  let face = 1, fg = 0;
  if (ms.length >= 4){ const b3 = ms[3].getAsFloat32Array(); let f = 0;
    for (let i = 0; i < P0.length; i++){ if (P0[i] > .5) fg++; if (b3[i] > .5) f++; } face = fg ? f / fg : 0; }
  ms.forEach(m => m.close && m.close()); if (res.close) res.close();
  const person = refine(S, P0, mw, mh);
  let c = 0; for (let i = 0; i < person.length; i++) c += person[i];
  if (c / person.length >= .01 && face >= .0005) S.person = person;   // big enough, with a face (cat 0 · small street figure .0015)
  S.personChecked = true;
  return rebuildSeg(S);
}
// the subject for the current photo (built on first use; objects alone need no person model)
const subject = () => (seg && seg.photo === photo) ? seg : (seg = rebuildSeg(segBase()));
// tap → the object under that point (photo pixels), refined like the person
async function objectAt(S, px, py){
  const inter = await getInteractive();
  const res = inter.segment(S.small, {keypoint: {x: px / photo.width, y: py / photo.height}}), ms = res.confidenceMasks;
  const m = ms[ms.length - 1], mw = m.width, mh = m.height, raw = m.getAsFloat32Array(), P0 = new Float32Array(mw*mh);
  // whichever polarity this model uses, the tapped point is the object
  const at = raw[Math.min(mh-1, Math.round(py / photo.height * mh)) * mw + Math.min(mw-1, Math.round(px / photo.width * mw))];
  for (let i = 0; i < P0.length; i++) P0[i] = at >= .5 ? raw[i] : 1 - raw[i];
  ms.forEach(x => x.close && x.close()); if (res.close) res.close();
  const a = refine(S, P0, mw, mh); let c = 0; for (let i = 0; i < a.length; i++) c += a[i];
  return c / a.length > .0005 ? {a, px, py} : null;
}
// the person, cut from the same (cropped) photo, drawn over the calligraphy
let personCv = null;
function drawPerson(c, W, H){
  if (!personCv) personCv = document.createElement('canvas');
  if (personCv.width !== W || personCv.height !== H){ personCv.width = W; personCv.height = H; }
  const pc = personCv.getContext('2d');
  pc.globalCompositeOperation = 'source-over'; pc.clearRect(0, 0, W, H);
  drawPhoto(pc, W, H);
  if (sceneNight){ pc.fillStyle = 'rgba(8,4,20,.35)'; pc.fillRect(0, 0, W, H); }   // same night as the photo
  pc.globalCompositeOperation = 'destination-in'; pc.imageSmoothingQuality = 'high';
  const r = photoRect(W, H); pc.drawImage(seg.canvas, r.x, r.y, r.w, r.h);
  pc.globalCompositeOperation = 'source-over';
  c.drawImage(personCv, 0, 0);
}
const segReady = () => behind && seg && seg.photo === photo;
// first time on: find where the text is MOSTLY visible but partly passes behind the person
// (≈ a third hidden — the "behind the head" look). Measured on the mask, not guessed.
// Returns false when the person fills the frame and no such spot exists.
function placeBehind(){
  const n = 72, gh = Math.max(2, Math.round(n / aspect())), g = document.createElement('canvas'); g.width = n; g.height = gh;
  const gc = g.getContext('2d', {willReadFrequently:true}), gr = photoRect(n, gh); gc.drawImage(seg.canvas, gr.x, gr.y, gr.w, gr.h);
  const A = gc.getImageData(0, 0, n, gh).data, al = (x, y) => A[(y*n + x)*4 + 3] / 255;
  T.rot = 0; T.size = Math.max(T.size, .16);
  const W = cv.width || 1000, H = W / aspect(), b = textBox(ctx, W);
  const bw = Math.min(.95, b.w / W), bh = Math.min(.9, b.h / H);
  const bx = c => Math.max(1, Math.round(bw*n)), by = Math.max(1, Math.round(bh*gh));
  const box = seg.box, pcx = box ? ((box.x0 + box.x1)/2 - crop.x) / crop.w : .5;
  let best = null;
  for (const cx of [pcx, .5, .35, .65]){
    if (cx - bw/2 < .02 || cx + bw/2 > .98) continue;
    for (let cy = bh/2 + .08; cy <= .8 - bh/2; cy += .02){
      const x0 = Math.round((cx - bw/2)*n), y0 = Math.round((cy - bh/2)*gh), w = bx(), h = by;
      let s = 0; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s += al(Math.min(n-1, x), Math.min(gh-1, y));
      const occ = s / (w*h), score = Math.abs(occ - .3) + cy*.12 + Math.abs(cx - pcx)*.1;
      if (!best || score < best.score) best = {score, cx, cy, occ};
    }
  }
  if (!best || best.occ > .7 || best.occ < .04) return false;
  T.cx = best.cx; T.cy = best.cy; return true;
}
function setPicking(on){
  picking = on; ps.classList.toggle('picking', on);
  if (on) subject();
  $('obj-btn').setAttribute('aria-pressed', on || !!(seg && seg.photo === photo && seg.objs.length));
  $('obj-btn').querySelector('b').textContent = on ? U.objDone : U.obj;
  $('obj-btn').querySelector('small').textContent = on ? U.objDoneSub : U.objSub;
  $('photo-hint').textContent = on ? U.pickHint : U.hint;
}
// "behind" is on whenever something is in front of the text: the person (if kept) or tapped objects
function syncBehindUI(){
  const S = seg && seg.photo === photo ? seg : null, personOn = !!(S && S.person && S.usePerson !== false);
  behind = personOn || !!(S && S.objs.length);
  $('person-btn').setAttribute('aria-pressed', personOn);
  $('obj-btn').setAttribute('aria-pressed', picking || !!(S && S.objs.length));
}
// Person card: find the person (first time) and put the text behind them; tap again to take them out
async function togglePerson(){
  const btn = $('person-btn'); if (btn.classList.contains('busy')) return;
  const S = subject();
  if (!S.personChecked){
    btn.classList.add('busy'); $('bh-sub').textContent = U.behindLoading;
    const stop = aiShow(btn, ['engine', SEG_MODEL], () => U.personSub);
    try { await detectPerson(S); } catch(e){ console.error(e); showToast(U.behindFail); }
    stop(); btn.classList.remove('busy'); $('bh-sub').textContent = U.behindSub;
    if (!S.personChecked) return;                          // the model could not load
    if (!S.person){ showToast(U.pickStart); setPicking(true); syncBehindUI(); redraw(true); return; }   // no person: tap the object instead
    S.usePerson = false;                                   // so the toggle below turns it on
  }
  if (!S.person){ showToast(U.behindNone); return; }
  const turningOn = S.usePerson === false;
  S.usePerson = turningOn; rebuildSeg(S);
  if (turningOn && !S.placed){
    if (!placeBehind()){                                   // no spot where the text stays readable
      const whole = crop.w >= photo.width*.98 && crop.h >= photo.height*.98;   // nothing left to zoom out to
      showToast(whole ? U.behindTightPhoto : U.behindTight); S.usePerson = false; rebuildSeg(S); syncBehindUI(); return; }
    S.placed = true;
  }
  syncBehindUI(); analyse(); commit(); redraw(true);
}
// a tap in picking mode: on an already chosen object → remove it; elsewhere → find and add the object there
async function pickAt(p){
  const W = cv.width, H = cv.height, r = photoRect(W, H);
  const px = (p[0] - r.x) / r.w * photo.width, py = (p[1] - r.y) / r.h * photo.height;
  if (px < 0 || py < 0 || px >= photo.width || py >= photo.height) return;          // tapped the Background, not the photo
  const ix = Math.min(seg.w-1, Math.round(px*seg.k)), iy = Math.min(seg.h-1, Math.round(py*seg.k)), i = iy*seg.w + ix;
  const hit = seg.objs.findIndex(o => o.a[i] > .5);
  if (hit >= 0){ seg.objs.splice(hit, 1); rebuildSeg(seg); syncBehindUI(); analyse(); commit(); redraw(true); return; }
  const ob = $('obj-btn'); ob.classList.add('busy');
  const stop = aiShow(ob, ['engine', INTER_MODEL], () => picking ? U.objDoneSub : U.objSub);
  try { const o = await objectAt(seg, px, py); if (o){ seg.objs.push(o); rebuildSeg(seg); syncBehindUI(); analyse(); commit(); } else showToast(U.pickNone); }
  catch(e){ console.error(e); showToast(U.behindFail); }
  stop(); ob.classList.remove('busy'); redraw(true);
}
$('obj-btn').addEventListener('click', () => { if (!$('obj-btn').classList.contains('busy')){ setPicking(!picking); syncBehindUI(); } });
$('person-btn').addEventListener('click', togglePerson);

// ── the one renderer: preview, thumbnails and export ──
function drawPhotoScene(c, W, H, forExport, useLook){
  if (!W || !H) return;
  const prev = look;
  c.clearRect(0,0,W,H);
  drawBase(c, W, H);
  // night down the photo when any text is Neon (or the thumbnail being drawn is)
  sceneNight = useLook === 'neon' || look === 'neon' || layers.some((L, i) => i !== cur && L.look === 'neon');
  if (sceneNight){ c.fillStyle = 'rgba(8,4,20,.35)'; c.fillRect(0,0,W,H); }
  if (!(cropMode && !forExport)){
    saveCur();
    const n = Math.max(1, layers.length);
    for (let i = 0; i < n; i++) withLayer(i, () => {
      if (i === cur && useLook) look = useLook;            // a Look thumbnail previews the selected text only
      const t = textNow(); if (!t) return;
      const b = textBox(c, W);
      if (look === 'plate') drawPlate(c, W, H, b);
      if (look === 'thread') renderThread(c, W, H, b, env);
      else drawTextLayer(c, W, H, b);
    });
    if (segReady()) drawPerson(c, W, H);                     // Text behind: the person/objects back on top of every text
    if (!forExport && textNow()){ const b = textBox(c, W); drawHandles(c, W, H, b); }
  }
  if (!forExport) drawGuides(c, W, H);
  if (cropMode && !forExport) drawThirds(c, W, H);
  if (showMark && forExport !== 'thumb'){
    const ms = Math.max(12, W * .016);
    c.save(); c.font = `500 ${ms}px Inter, sans-serif`; c.direction = 'ltr';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = markDark ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.75)';
    c.shadowColor = markDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)'; c.shadowBlur = ms*.4;
    c.fillText('kactyl.com', W/2, H - ms*1.6);
    c.restore();
  }
  look = prev;
}

// ── handles, snap guides, crop grid (preview only) ──
const HANDLE = 11;
function corners(W, H, b){
  const pad = b.fs * .12, hw = (T.wrap ? Math.max(b.w, T.wrap * W) : b.w)/2 + pad, top = b.top - pad, bot = b.bot + pad;
  const cs = Math.cos(T.rot), sn = Math.sin(T.rot), ox = T.cx*W, oy = T.cy*H;
  const P = (x,y) => [ox + x*cs - y*sn, oy + x*sn + y*cs];
  return {hw, top, bot, P, resize: P(hw, bot), rotate: P(0, top - 26*dpr()), side: P(hw, (top + bot)/2), sideL: P(-hw, (top + bot)/2)};
}
function drawHandles(c, W, H, b){
  const k = corners(W, H, b);
  c.save(); c.lineWidth = 1.5*dpr(); c.setLineDash([6*dpr(), 5*dpr()]); c.strokeStyle = 'rgba(255,255,255,.9)';
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 3*dpr();
  c.beginPath(); [[-k.hw,k.top],[k.hw,k.top],[k.hw,k.bot],[-k.hw,k.bot]].forEach((p,i)=>{const q=k.P(...p); i?c.lineTo(...q):c.moveTo(...q);}); c.closePath(); c.stroke();
  c.setLineDash([]); c.beginPath(); c.moveTo(...k.P(0,k.top)); c.lineTo(...k.rotate); c.stroke();
  [k.resize, k.rotate].forEach(p => { c.beginPath(); c.arc(p[0], p[1], HANDLE*dpr(), 0, Math.PI*2); c.fillStyle = '#fff'; c.fill();
    c.lineWidth = 2*dpr(); c.strokeStyle = 'rgba(109,40,217,.95)'; c.stroke(); });
  // side pills = text-box width: narrower box, more lines
  [k.side, k.sideL].forEach(p => { c.save(); c.translate(p[0], p[1]); c.rotate(T.rot); c.beginPath();
    c.roundRect(-4*dpr(), -12*dpr(), 8*dpr(), 24*dpr(), 4*dpr()); c.fillStyle = '#fff'; c.fill();
    c.lineWidth = 2*dpr(); c.strokeStyle = 'rgba(109,40,217,.95)'; c.stroke(); c.restore(); });
  c.restore();
}
function drawGuides(c, W, H){
  if (!guides.v && !guides.h) return;
  c.save(); c.strokeStyle = '#ff2d87'; c.lineWidth = 1.5*dpr();
  if (guides.v){ c.beginPath(); c.moveTo(W/2, 0); c.lineTo(W/2, H); c.stroke(); }
  if (guides.h){ c.beginPath(); c.moveTo(0, guides.h * H); c.lineTo(W, guides.h * H); c.stroke(); }
  c.restore();
}
function drawThirds(c, W, H){
  c.save(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1*dpr(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 2*dpr();
  for (const f of [1/3, 2/3]){ c.beginPath(); c.moveTo(f*W, 0); c.lineTo(f*W, H); c.moveTo(0, f*H); c.lineTo(W, f*H); c.stroke(); }
  c.lineWidth = 3*dpr(); c.strokeRect(1.5*dpr(), 1.5*dpr(), W - 3*dpr(), H - 3*dpr()); c.restore();
}

// ── reading the frame: brightness under the text / the mark, average colour, calm area ──
// skip = a same-size canvas whose alpha marks pixels to ignore (the person, when the text sits behind them):
// the text is read against what is really behind it, not against the person's hair or clothes
function region(s, x0, y0, w, h, skip){
  const c = s.getContext('2d'), x = Math.max(0, Math.round(x0*s.width)), y = Math.max(0, Math.round(y0*s.height));
  const rw = Math.max(1, Math.min(s.width - x, Math.round(w*s.width))), rh = Math.max(1, Math.min(s.height - y, Math.round(h*s.height)));
  const d = c.getImageData(x, y, rw, rh).data, m = skip ? skip.getContext('2d').getImageData(x, y, rw, rh).data : null;
  let L = 0, r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4){ const wt = m ? 1 - m[i+3]/255 : 1;
    L += wt * (.2126*d[i] + .7152*d[i+1] + .0722*d[i+2]) / 255; r += wt*d[i]; g += wt*d[i+1]; b += wt*d[i+2]; n += wt; }
  if (n < 1) return region(s, x0, y0, w, h);                       // text fully over the person: fall back
  return {L: L/n, rgb: [r/n|0, g/n|0, b/n|0]};
}
// the subject mask at the size of a frameSmall() canvas
function subjectSmall(s){
  const m = document.createElement('canvas'); m.width = s.width; m.height = s.height;
  const r = photoRect(s.width, s.height); m.getContext('2d', {willReadFrequently:true}).drawImage(seg.canvas, r.x, r.y, r.w, r.h);
  return m;
}
function analyse(){
  if (!photo) return;
  const s = frameSmall(96), bw = Math.min(1, textBox(ctx, cv.width || 1000).w / (cv.width || 1000));
  const under = region(s, T.cx - bw/2, T.cy - .08, Math.max(.05, bw), .16, segReady() ? subjectSmall(s) : null);
  // dark text from mid-tones up: by WCAG contrast, near-black beats white once luma passes ~.48
  light = under.L > .5; avgCol = under.rgb;
  env = {light: readLight(frameSmall(64), T.cx, T.cy), grain: readGrain(frameSmall(200)), lightBg: light};
  markDark = region(s, .3, .92, .4, .08).L > .6;
}
// Auto-place: the calmest stretch of the frame, judged WITH its surroundings (a flat sun or
// face is calm inside but ringed by edges), kept off the photo's subject, nudged to the thirds.
// centreBias > 1 pulls toward the vertical centre line (cards).
function autoPlace(silent, centreBias){
  const s = frameSmall(96), W = s.width, H = s.height, d = s.getContext('2d').getImageData(0,0,W,H).data;
  const lum = (x,y) => { const i = (y*W + x)*4; return .2126*d[i] + .7152*d[i+1] + .0722*d[i+2]; };
  const grad = new Float32Array(W*H);
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++)
    grad[y*W+x] = Math.abs(lum(x+1,y) - lum(x-1,y)) + Math.abs(lum(x,y+1) - lum(x,y-1));
  // summed-area table: any window's total edge energy in O(1)
  const S = new Float64Array((W+1)*(H+1));
  for (let y = 0; y < H; y++){ let row = 0; for (let x = 0; x < W; x++){ row += grad[y*W+x]; S[(y+1)*(W+1)+x+1] = S[y*(W+1)+x+1] + row; } }
  const box = (x0,y0,x1,y1) => { x0 = Math.max(0,x0|0); y0 = Math.max(0,y0|0); x1 = Math.min(W,x1|0); y1 = Math.min(H,y1|0);
    if (x1 <= x0 || y1 <= y0) return 0; return (S[y1*(W+1)+x1] - S[y0*(W+1)+x1] - S[y1*(W+1)+x0] + S[y0*(W+1)+x0]) / ((x1-x0)*(y1-y0)); };
  const [ix, iy] = interest(), sx = (ix - crop.x) / crop.w, sy = (iy - crop.y) / crop.h;   // subject, as share of frame
  const bw = Math.min(.9, textBox(ctx, cv.width).w / cv.width), bwW = Math.max(3, Math.round(bw*W)), bhH = Math.max(3, Math.round(textBox(ctx, cv.width).h / cv.width * W * 1.15));
  const cb = centreBias || 1, g = goal && GOALS[goal], [s0, s1] = (g && g.safe) || [.1, .84];   // .84: clear of the kactyl.com mark
  let best = null;
  // a block wider than 60% of the frame has no real horizontal choice: centre it
  const xs = []; if (bw > .6) xs.push(Math.round((W - bwW)/2)); else for (let x = 2; x + bwW < W - 2; x += 2) xs.push(x);
  for (let y = 2; y + bhH < H - 2; y += 2) for (const x of xs){
    const inner = box(x, y, x + bwW, y + bhH), ring = box(x - bwW*.35, y - bhH*.6, x + bwW*1.35, y + bhH*1.6);
    const cx = (x + bwW/2)/W, cy = (y + bhH/2)/H;
    if (y/H < s0 || (y + bhH)/H > s1) continue;
    const subj = Math.max(0, .28 - Math.hypot((cx - sx)*1.2, cy - sy)) * 6;          // keep off the subject
    const thirds = Math.min(Math.abs(cy - 1/3), Math.abs(cy - 2/3), Math.abs(cy - .5)) + Math.abs(cx - .5)*.6*cb;
    const score = (inner + ring*.8 + 1) * (1 + thirds*1.5) * (1 + subj);
    if (!best || score < best.score) best = {score, cx, cy};
  }
  if (best){ T.cx = best.cx; T.cy = best.cy; T.rot = 0; }
  analyse();
  if (!silent){ commit(); redraw(true); }
}

// ── goals: one tap = finished design ──
function applyGoal(k){
  goal = k; const g = GOALS[k];
  const a = g.aspect || photo.width / photo.height, [fx, fy] = interest();
  crop = cropAt(a, fx, fy);
  T.size = g.size; T.rot = 0; T.cx = .5; T.wrap = null;
  layout(true);
  fit();
  if (g.place === 'lower') T.cy = .74;
  else if (g.place === 'card') autoPlace(true, 3);
  else if (g.place === 'center') T.cy = .5;
  else autoPlace(true);
  analyse();
  setLook(g.look(light), true);
  $('goal-pill').querySelector('span').textContent = U[k];
  ps.classList.remove('choosing');
  updateSize(); commit(); redraw(true);
}
ps.querySelectorAll('.goal').forEach(b => b.addEventListener('click', () => applyGoal(b.dataset.goal)));
$('goal-pill').addEventListener('click', () => { if (cropMode) toggleCrop(); ps.classList.add('choosing'); });
function exportSize(){
  const g = goal && GOALS[goal];
  if (g && g.out) return g.out;
  const k = Math.min(1, 4096 / Math.max(crop.w, crop.h)); return [Math.round(crop.w*k), Math.round(crop.h*k)];
}
// the Download button tells the user what they will get (numbers only: language-neutral)
function updateSize(){
  const btn = $('dl-btn'); if (!btn) return;
  let tag = btn.querySelector('.dl-size');
  if (!tag){ tag = document.createElement('span'); tag.className = 'dl-size'; btn.insertBefore(tag, btn.querySelector('.btn-caret')); }
  const [w, h] = exportSize(); tag.textContent = window.isPhotoMode() && goal ? `${w}×${h}` : '';
}

// ── crop mode ──
function toggleCrop(){
  cropMode = !cropMode; ps.classList.toggle('cropping', cropMode);
  $('crop-btn').querySelector('span').textContent = cropMode ? U.done : U.crop;
  $('photo-hint').textContent = cropMode ? U.cropHint : U.hint;
  if (!cropMode){ analyse(); commit(); }
  redraw(!cropMode);
}
$('crop-btn').addEventListener('click', toggleCrop);
function zoomCrop(f, px, py){            // f > 1 zooms in; (px,py) = anchor as share of the frame
  const a = aspect(), PW = photo.width, PH = photo.height, coverW = Math.min(PW, PH * a);
  let w = Math.min(coverW * 3, Math.max(PW * .12, crop.w / f)), h = w / a;     // zoom out to a third of the frame
  const ax = crop.x + px*crop.w, ay = crop.y + py*crop.h;
  crop = clampCrop({x: ax - px*w, y: ay - py*h, w, h}); redraw(false);
}
// trackpad pinch arrives as ctrl+wheel: it scales the photo (or the text when over it) instead of zooming the page.
// A plain wheel only zooms while cropping, so the page still scrolls normally over the photo.
let wheelT = 0;
cv.addEventListener('wheel', e => {
  if (!photo || (!cropMode && !e.ctrlKey) || ps.classList.contains('choosing')) return;
  e.preventDefault();
  const r = cv.getBoundingClientRect(), f = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015));
  // pinch over ANY text scales that text (selecting it first), not only the selected one
  const q = toCanvas(e); let onText = !cropMode && hitText(q) !== 'photo';
  if (!cropMode && !onText) for (let i = layers.length - 1; i >= 0; i--){ if (i === cur) continue;
    if (withLayer(i, () => hitText(q)) === 'text'){ selectLayer(i); onText = true; break; } }
  if (onText){ T.size = Math.min(.6, Math.max(.03, T.size * f)); redraw(false); }
  else zoomCrop(f, (e.clientX - r.left)/r.width, (e.clientY - r.top)/r.height);
  clearTimeout(wheelT); wheelT = setTimeout(() => { if (!cropMode){ analyse(); commit(); } redraw(true); }, 250);
}, {passive:false});

// ── undo / redo (state snapshots) ──
let hist = [], hi = -1;
const snap = () => { saveCur(); return JSON.stringify({layers, cur, crop, goal, back:BACK}); };
// switching which text is selected is not an edit: snapshots that differ only in `cur` count as the same
const sameEdit = (a, b) => !!a && a.replace(/"cur":\d+,/, '') === b.replace(/"cur":\d+,/, '');
function commit(){ const s = snap(); if (sameEdit(hist[hi], s)){ hist[hi] = s; return; } hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 60) hist.shift(); hi = hist.length - 1; syncHist(); }
function restore(s){ const o = JSON.parse(s); crop = o.crop; goal = o.goal; if (o.back) Object.assign(BACK, o.back);
  layers = o.layers; cur = Math.min(o.cur, layers.length - 1); applyState(layers[cur]);
  syncColor(); setLook(look, true); syncTexts();
  syncBehindUI();
  if (goal) $('goal-pill').querySelector('span').textContent = U[goal]; layout(false); analyse(); updateSize(); redraw(true); }
function syncHist(){ $('undo-btn').disabled = hi <= 0; $('redo-btn').disabled = hi >= hist.length - 1; }
function undo(){ if (hi > 0){ hi--; restore(hist[hi]); syncHist(); } }
function redo(){ if (hi < hist.length - 1){ hi++; restore(hist[hi]); syncHist(); } }
$('undo-btn').addEventListener('click', undo); $('redo-btn').addEventListener('click', redo);
document.addEventListener('keydown', e => {
  if (!window.isPhotoMode() || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  if (/input|textarea/i.test(document.activeElement.tagName)) return;
  e.preventDefault(); e.shiftKey ? redo() : undo();
});

// ── layout + redraw ──
function layout(draw){
  if (!photo) return;
  const maxW = ps.clientWidth || area.clientWidth || 600, maxH = Math.min(window.innerHeight * .68, 720);
  let w = maxW, h = w / aspect();
  if (h > maxH){ h = maxH; w = h * aspect(); }
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(w * dpr()); cv.height = Math.round(h * dpr());
  if (draw !== false) redraw(true);
}
// never let the calligraphy run off the frame (only while nobody is resizing it)
function fit(){
  if (start || !cv.width) return;
  let b = textBox(ctx, cv.width); const lim = cv.width * .9;
  // long text wraps into lines first; it only shrinks when a single word is too wide
  if (!b.round && b.w > lim && !T.wrap && b.lines.length === 1 && /\s/.test(textNow())){ T.wrap = .82; b = textBox(ctx, cv.width); }
  if (T.wrap && !b.round){ const minWrap = b.longestWord / cv.width; if (T.wrap < minWrap) T.wrap = Math.min(.92, minWrap); b = textBox(ctx, cv.width); }
  if (b.w > lim){ T.size *= lim / b.w; b = textBox(ctx, cv.width); }
  // keep the whole block inside the frame with a margin (rotation-aware bounding box)
  const W = cv.width, H = cv.height, cs = Math.abs(Math.cos(T.rot)), sn = Math.abs(Math.sin(T.rot));
  const hw = (b.w*cs + b.h*sn) / 2 / W, hh = (b.w*sn + b.h*cs) / 2 / H, m = .03;
  T.cx = Math.min(1 - m - hw, Math.max(m + hw, T.cx)); if (hw*2 > 1 - 2*m) T.cx = .5;
  T.cy = Math.min(1 - m - hh, Math.max(m + hh, T.cy)); if (hh*2 > 1 - 2*m) T.cy = .5;
}
let raf = 0, thumbsT = 0;
function redraw(withThumbs){
  if (!photo || !photoMode || !cv.width || !cv.height) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => document.fonts.load(`700 40px "${fontNow()}"`).then(() => {
    fit(); drawPhotoScene(ctx, cv.width, cv.height, false);
    $('look-panel').classList.toggle('zoomed-out', !covers());
    if (withThumbs){ clearTimeout(thumbsT); thumbsT = setTimeout(thumbs, 250); }
  }));
}
// live Look thumbnails: the user's own frame + text, cropped around the text
let thumbsSig = '';
function thumbs(){
  if (!photo || cropMode || !textNow()) return;
  const sig = snap() + textNow() + fontNow() + segReady() + (seg && seg.objs ? seg.objs.length : 0) + cv.width;
  if (sig === thumbsSig) return; thumbsSig = sig;
  const RW = 640, RH = Math.round(RW / aspect()), r = document.createElement('canvas');
  r.width = RW; r.height = RH; const rc = r.getContext('2d');
  const b = textBox(rc, RW), cw = Math.min(RW, Math.max(b.w * 1.35, b.fs * 3)), ch = Math.min(RH, cw * 120/168);
  if (!(cw > 0 && ch > 0)) return;
  const x = Math.min(RW - cw, Math.max(0, T.cx*RW - cw/2)), y = Math.min(RH - ch, Math.max(0, T.cy*RH - ch/2));
  tools.querySelectorAll('.look').forEach(btn => {
    drawPhotoScene(rc, RW, RH, 'thumb', btn.dataset.look);
    const tc = btn.querySelector('canvas').getContext('2d');
    tc.clearRect(0,0,168,120); tc.drawImage(r, x, y, cw, ch, 0, 0, 168, 120);
  });
}

// ── modes ──
function setMode(on){
  photoMode = on;
  $('mt-design').classList.toggle('active', !on); $('mt-design').setAttribute('aria-selected', !on);
  $('mt-photo').classList.toggle('active', on); $('mt-photo').setAttribute('aria-selected', on);
  // hide/show via the PARENT: theme code rewrites the stage's className and would wipe a flag on it
  area.classList.toggle('photo-on', on); tools.classList.toggle('hidden', !on || !photo);
  $('look-panel').classList.toggle('ready', on && !!photo); placePanel();
  document.body.classList.toggle('photo-tab', on);
  ps.classList.toggle('has-photo', !!photo);
  updateSize();
  if (on && photo) layout();
}
const deskMQ = window.matchMedia('(min-width: 821px)');
function placePanel(){
  const lp = $('look-panel'), side = document.querySelector('.studio-controls');
  if (deskMQ.matches && side){ if (lp.parentElement !== side) side.appendChild(lp); }
  else if (lp.parentElement !== tools) $('photo-row') ? tools.insertBefore(lp, $('photo-row')) : tools.appendChild(lp);
}
deskMQ.addEventListener('change', placePanel);
$('mt-design').addEventListener('click', () => setMode(false));
$('mt-photo').addEventListener('click', () => setMode(true));

// ── loading a photo (stays on the device) → ask what they are making ──
async function loadPhoto(file){
  if (!file || !/^image\//.test(file.type)) return;
  try { photo = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch(e){ photo = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }); }
  photoGen++; softCache.clear(); threadCache.clear(); layerCache.clear();
  crop = {x:0, y:0, w:photo.width, h:photo.height}; goal = null; hist = []; hi = -1; cropMode = false; ps.classList.remove('cropping');
  behind = false; seg = null; syncBehindUI(); setPicking(false);
  Object.assign(BACK, {mode:'blur', a:null, b:null, auto:true});
  Object.assign(T, {cx:.5, cy:.5, size:.12, rot:0, wrap:null});
  layers = []; cur = 0; curText = null; curFont = null; Object.assign(PR, PR0);
  setMode(true);
  await document.fonts.load(`700 40px "${fontNow()}"`);
  ps.classList.add('choosing');
  fit(); analyse(); layers = [stateNow()]; syncTexts(); redraw(true);
  prefetchAI();
}
$('photo-file').addEventListener('change', e => { loadPhoto(e.target.files[0]); e.target.value = ''; });
$('photo-change').addEventListener('click', () => $('photo-file').click());
ps.addEventListener('dragover', e => { e.preventDefault(); ps.classList.add('dov'); });
ps.addEventListener('dragleave', () => ps.classList.remove('dov'));
ps.addEventListener('drop', e => { e.preventDefault(); ps.classList.remove('dov'); loadPhoto(e.dataTransfer.files[0]); });

// ── Looks + Auto-place ──
function setLook(k, quiet){
  look = LOOKS.includes(k) ? k : 'clean';
  tools.querySelectorAll('.look').forEach(x => { const on = x.dataset.look === look; x.classList.toggle('active', on); x.setAttribute('aria-checked', on); });
  const lp = $('look-panel');
  lp.classList.toggle('look-color', look === 'color');
  lp.classList.toggle('look-neon', look === 'neon'); lp.classList.toggle('look-plate', look === 'plate');
  if (typeof syncLookCtl === 'function') syncLookCtl();
  if (!quiet){ commit(); redraw(false); }
}
tools.querySelectorAll('.look').forEach(btn => btn.addEventListener('click', () => setLook(btn.dataset.look)));

// ── Texts: chips to switch, Add text (max 3), × to remove; texts 2–3 have their own words + font ──
function syncTexts(){
  saveCur(); syncShape();
  const box = $('tx-chips'); box.textContent = '';
  layers.forEach((L, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tx-chip' + (i === cur ? ' on' : '');
    const w = document.createElement('b'); w.textContent = (i === cur ? textNow() : withLayer(i, textNow)) || '…'; b.appendChild(w);
    if (i > 0){ const x = document.createElement('i'); x.textContent = '×'; x.title = U.removeText; x.setAttribute('aria-label', U.removeText);
      x.addEventListener('click', e => { e.stopPropagation(); removeText(i); }); b.appendChild(x); }
    b.addEventListener('click', () => selectLayer(i)); box.appendChild(b);
  });
  box.style.display = layers.length > 1 ? '' : 'none';
  $('tx-add').disabled = layers.length >= MAX_TEXTS;
  $('texts-ctl').classList.toggle('extra', cur > 0);
  if (cur > 0){
    if (document.activeElement !== $('tx-input')) $('tx-input').value = curText || '';
    const st = STYLES.find(x => x.font === curFont); $('tx-font').value = st ? st.id : STYLES[currentStyle].id;
  }
}
function selectLayer(i){
  if (i === cur || !layers[i]) return;
  saveCur(); cur = i; applyState(layers[i]);
  setLook(look, true); syncColor(); syncLookCtl(); syncTexts(); redraw(true);
}
function addText(){
  if (!photo || layers.length >= MAX_TEXTS) return;
  saveCur();
  const W = cv.width, H = cv.height, prev = textBox(ctx, W), py = T.cy, ph = prev.h / H;
  layers.push(stateNow()); cur = layers.length - 1;
  curText = U.newText; curFont = curFont || STYLES[currentStyle].font; Object.assign(PR, PR0);
  Object.assign(T, {size: layers[0].T.size * .5, rot: 0, wrap: null});   // half the main text, never shrinking further
  const nh = textBox(ctx, W).h / H, gap = .045;   // room for the rotate handle
  // under the previous text; above it when there is no room below
  T.cy = py + ph/2 + gap + nh/2 <= .9 ? py + ph/2 + gap + nh/2 : Math.max(.1, py - ph/2 - gap - nh/2);
  fit(); analyse(); syncTexts(); commit(); redraw(true);
  if (!('ontouchstart' in window)) $('tx-input').focus();
}
function removeText(i){
  if (i <= 0 || !layers[i]) return;
  saveCur(); layers.splice(i, 1);
  cur = cur === i ? i - 1 : cur > i ? cur - 1 : cur;
  applyState(layers[cur]); setLook(look, true); syncColor(); syncLookCtl(); syncTexts(); commit(); redraw(true);
}
$('tx-add').addEventListener('click', addText);
function syncShape(){
  $('shape-ctl').dataset.pl = PR.layout;
  $('look-panel').querySelectorAll('button[data-pl]').forEach(x => { const on = x.dataset.pl === PR.layout; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
  $('look-panel').querySelectorAll('[data-ps]').forEach(x => { const on = x.dataset.ps === PR.side; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
  $('pr-curve').value = Math.round(PR.curve * 100);
}
$('look-panel').querySelectorAll('button[data-pl]').forEach(x => x.addEventListener('click', () => {
  PR.layout = x.dataset.pl; T.wrap = null; syncShape(); commit(); redraw(true); }));
$('look-panel').querySelectorAll('[data-ps]').forEach(x => x.addEventListener('click', () => { PR.side = x.dataset.ps; syncShape(); commit(); redraw(true); }));
$('pr-curve').addEventListener('input', e => { PR.curve = e.target.value / 100; redraw(false); });
$('pr-curve').addEventListener('change', () => { analyse(); commit(); redraw(true); });
// the starter word is a placeholder to replace: one tap selects all of it
$('tx-input').addEventListener('focus', e => { if (e.target.value === U.newText) setTimeout(() => e.target.select(), 0); });
// double-tap a text on the photo = edit its words (text 1 lives in the main text box)
function editText(){
  const f = cur > 0 ? $('tx-input') : $('arabic-input'); if (!f) return;
  f.focus({preventScroll:true}); f.select();
  const r = f.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) f.scrollIntoView({block:'center', behavior:'smooth'});
}
$('tx-input').addEventListener('input', e => { if (cur > 0){ curText = e.target.value; syncTexts(); redraw(false); } });
$('tx-input').addEventListener('change', () => { if (cur > 0){ fit(); analyse(); commit(); redraw(true); } });
$('tx-font').addEventListener('change', e => {
  const st = STYLES.find(x => x.id === e.target.value); if (!st || cur === 0) return;
  curFont = st.font; saveCur(); commit(); redraw(true);
});

// ── Color look controls: Solid / Gradient, main colour, auto-matched second colour ──
function syncColor(){
  const b = colB();
  $('color-ctl').classList.toggle('grad', COL.mode === 'gradient');
  $('look-panel').querySelectorAll('[data-cm]').forEach(x => { const on = x.dataset.cm === COL.mode; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
  $('cc-a').value = COL.a; $('cc-a-sw').style.background = COL.a;
  $('cc-b').value = b; $('cc-b-sw').style.background = b;
  $('cc-bar').style.background = `linear-gradient(90deg, ${COL.a}, ${b})`;
  $('cc-auto').classList.toggle('on', COL.auto); $('cc-auto').setAttribute('aria-pressed', COL.auto);
}
function colorChanged(final){ syncColor(); if (look !== 'color') setLook('color', true); if (final) commit(); redraw(!!final); }
$('look-panel').querySelectorAll('[data-cm]').forEach(x => x.addEventListener('click', () => { COL.mode = x.dataset.cm; colorChanged(true); }));
$('cc-a').addEventListener('input', e => { COL.a = e.target.value; colorChanged(false); });
$('cc-a').addEventListener('change', () => colorChanged(true));
$('cc-b').addEventListener('input', e => { COL.b = e.target.value; COL.auto = false; colorChanged(false); });
$('cc-b').addEventListener('change', () => colorChanged(true));
$('cc-auto').addEventListener('click', () => { COL.auto = true; COL.b = null; colorChanged(true); });
syncColor();

// ── Neon / Frosted Plate / Background controls ──
function syncLookCtl(){
  const n = neonColor(), t = plateTint();
  $('neon-auto').classList.toggle('on', NEON.auto); $('neon-c').value = n; $('neon-sw').style.background = n;
  $('plate-auto').classList.toggle('on', PLATE.auto); $('plate-c').value = t; $('plate-sw').style.background = t;
  $('plate-frost').value = Math.round(PLATE.frost * 100);
  const bc = $('back-ctl'), [a, b] = photo ? backColors() : ['#222222', '#333333'];
  bc.classList.toggle('is-color', BACK.mode !== 'blur'); bc.classList.toggle('is-grad', BACK.mode === 'gradient');
  $('look-panel').querySelectorAll('[data-bk]').forEach(x => { const on = x.dataset.bk === BACK.mode; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
  $('back-a').value = a; $('back-a-sw').style.background = a; $('back-b').value = b; $('back-b-sw').style.background = b;
  $('back-auto').classList.toggle('on', BACK.auto);
}
const lookChanged = final => { syncLookCtl(); if (final) commit(); redraw(!!final); };
$('neon-auto').addEventListener('click', () => { NEON.auto = true; lookChanged(true); });
$('neon-c').addEventListener('input', e => { NEON.auto = false; NEON.c = e.target.value; lookChanged(false); });
$('neon-c').addEventListener('change', () => lookChanged(true));
$('plate-auto').addEventListener('click', () => { PLATE.auto = true; lookChanged(true); });
$('plate-c').addEventListener('input', e => { PLATE.auto = false; PLATE.tint = e.target.value; lookChanged(false); });
$('plate-c').addEventListener('change', () => lookChanged(true));
$('plate-frost').addEventListener('input', e => { PLATE.frost = e.target.value / 100; lookChanged(false); });
$('plate-frost').addEventListener('change', () => lookChanged(true));
$('look-panel').querySelectorAll('[data-bk]').forEach(x => x.addEventListener('click', () => { BACK.mode = x.dataset.bk; lookChanged(true); }));
$('back-a').addEventListener('input', e => { BACK.auto = false; BACK.a = e.target.value; BACK.b = null; lookChanged(false); });
$('back-a').addEventListener('change', () => lookChanged(true));
$('back-b').addEventListener('input', e => { BACK.auto = false; BACK.b = e.target.value; if (!BACK.a) BACK.a = backColors()[0]; lookChanged(false); });
$('back-b').addEventListener('change', () => lookChanged(true));
$('back-auto').addEventListener('click', () => { BACK.auto = true; BACK.a = BACK.b = null; lookChanged(true); });
$('place-btn').addEventListener('click', () => autoPlace(false));

// ── direct manipulation ──
// text: drag (snap guides) · handles · two-finger pinch/rotate.  crop mode: drag reframes, pinch zooms.
const ptrs = new Map(); let start = null, lastTap = null;
const toCanvas = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
cv.addEventListener('pointerdown', e => {
  if (!photo || ps.classList.contains('choosing')) return;
  if (picking && !cropMode){ if (!$('obj-btn').classList.contains('busy')) pickAt(toCanvas(e)); return; }
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, toCanvas(e));
  const W = cv.width, H = cv.height, p = toCanvas(e);
  // two fingers: on the photo (or while cropping) they zoom the photo; on the text they scale + rotate it
  if (ptrs.size === 2){ const [a, c] = [...ptrs.values()], onPhoto = cropMode || (start && start.mode === 'pan');
    start = {mode: onPhoto ? 'cpinch' : 'pinch', d: Math.hypot(c[0]-a[0], c[1]-a[1]), ang: Math.atan2(c[1]-a[1], c[0]-a[0]), size:T.size, rot:T.rot, crop:{...crop}}; return; }
  if (cropMode){ start = {mode:'pan', p, crop:{...crop}}; return; }
  let hit = hitText(p);
  if (hit === 'photo'){                                     // not the selected text: another text on top?
    for (let i = layers.length - 1; i >= 0; i--){ if (i === cur) continue;
      if (withLayer(i, () => hitText(p)) === 'text'){ selectLayer(i); hit = 'text'; break; } }
  }
  if (hit === 'text'){ const now = performance.now();           // second tap on the same text = edit it
    if (lastTap && now - lastTap.t < 400 && lastTap.i === cur){ lastTap = null; e.preventDefault(); editText(); return; }   // no default: it would pull focus back off the field
    lastTap = {t: now, i: cur}; } else lastTap = null;
  if (hit === 'photo') start = {mode:'pan', p, crop:{...crop}};       // drag the photo itself to reframe it
  else if (hit === 'width') start = {mode:'width'};
  else if (hit === 'rotate') start = {mode:'rotate'};
  else if (hit === 'resize') start = {mode:'resize', d: Math.hypot(p[0]-T.cx*W, p[1]-T.cy*H), size:T.size};
  else start = {mode:'move', p, cx:T.cx, cy:T.cy};
});
// what is under the pointer: a text handle, the text block, or the photo
function hitText(p){
  if (!textNow()) return 'photo';
  const W = cv.width, H = cv.height, b = textBox(ctx, W), k = corners(W, H, b), reach = HANDLE*dpr()*2;
  // the nearest handle wins: on a short word the corner and side handles overlap, and resize must not lose to width
  const dx = p[0] - T.cx*W, dy = p[1] - T.cy*H, cs = Math.cos(T.rot), sn = Math.sin(T.rot);
  const lx = dx*cs + dy*sn, ly = -dx*sn + dy*cs, m = 8*dpr();          // pointer in the text's own (rotated) frame
  // on the letters themselves it is the text (a short word sits inside the handles' reach); there only a
  // direct hit on a handle counts — around the text, the handles keep their generous reach
  const inside = Math.abs(lx) < k.hw - HANDLE*dpr() && ly > k.top && ly < k.bot, r0 = inside ? HANDLE*dpr() : reach;
  let best = null, bd = r0;
  [['resize', k.resize], ['rotate', k.rotate], ['width', k.side], ['width', k.sideL]].forEach(([n, q]) => {
    const d = Math.hypot(p[0]-q[0], p[1]-q[1]); if (d < bd){ bd = d; best = n; } });
  if (best) return best;
  return Math.abs(lx) <= k.hw + m && ly >= k.top - m && ly <= k.bot + m ? 'text' : 'photo';
}
// cursor tells what a drag will do
cv.addEventListener('pointermove', e => {
  if (start || !photo || cropMode || ps.classList.contains('choosing')) return;
  if (picking){ cv.style.cursor = 'crosshair'; return; }
  const q = toCanvas(e); let h = hitText(q);
  if (h === 'photo' && layers.some((L, i) => i !== cur && withLayer(i, () => hitText(q)) === 'text')) h = 'text';
  cv.style.cursor = h === 'photo' ? 'grab' : h === 'text' ? 'move' : h === 'rotate' ? 'alias' : h === 'width' ? 'ew-resize' : 'nwse-resize';
});
cv.addEventListener('pointermove', e => {
  if (!start || !ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, toCanvas(e));
  const W = cv.width, H = cv.height, p = toCanvas(e);
  if (start.mode === 'cpinch' && ptrs.size === 2){ const [a, c] = [...ptrs.values()];
    crop = {...start.crop}; zoomCrop(Math.hypot(c[0]-a[0], c[1]-a[1]) / start.d, (a[0]+c[0])/2/W, (a[1]+c[1])/2/H); return; }
  if (start.mode === 'pan'){ const s = start.crop;
    crop = clampCrop({x: s.x - (p[0]-start.p[0]) * s.w / W, y: s.y - (p[1]-start.p[1]) * s.h / H, w: s.w, h: s.h}); redraw(false); return; }
  if (start.mode === 'pinch' && ptrs.size === 2){ const [a, c] = [...ptrs.values()];
    T.size = Math.min(.6, Math.max(.03, start.size * Math.hypot(c[0]-a[0], c[1]-a[1]) / start.d));
    T.rot = start.rot + Math.atan2(c[1]-a[1], c[0]-a[0]) - start.ang;
    T.cx = (a[0]+c[0]) / 2 / W; T.cy = (a[1]+c[1]) / 2 / H; }
  else if (start.mode === 'move'){
    let cx = Math.min(1, Math.max(0, start.cx + (p[0]-start.p[0]) / W)), cy = Math.min(1, Math.max(0, start.cy + (p[1]-start.p[1]) / H));
    const sn = 8*dpr();                                      // snap to centre + thirds, like a design tool
    guides.v = Math.abs(cx - .5) * W < sn; if (guides.v) cx = .5;
    guides.h = false; for (const g of [1/3, .5, 2/3]) if (Math.abs(cy - g) * H < sn){ cy = g; guides.h = g; }
    T.cx = cx; T.cy = cy; }
  else if (start.mode === 'resize'){ const perUnit = textBox(ctx, W).w / T.size, maxS = Math.min(.6, W * .98 / Math.max(1, perUnit));
    T.size = Math.min(maxS, Math.max(.03, start.size * Math.hypot(p[0]-T.cx*W, p[1]-T.cy*H) / start.d)); }
  else if (start.mode === 'width'){
    const dx = p[0] - T.cx*W, dy = p[1] - T.cy*H, local = Math.abs(dx*Math.cos(T.rot) + dy*Math.sin(T.rot));
    const minW = textBox(ctx, W).longestWord / W;
    T.wrap = Math.min(.98, Math.max(minW, (local - T.size*W*.12) * 2 / W)); }
  else if (start.mode === 'rotate'){ let r = Math.atan2(p[1]-T.cy*H, p[0]-T.cx*W) + Math.PI/2;
    const sn = Math.round(r / (Math.PI/12)) * (Math.PI/12); if (Math.abs(r - sn) < .05) r = sn; T.rot = r; }
  redraw(false);
});
const end = e => { ptrs.delete(e.pointerId);
  if (ptrs.size === 0 && start){ const was = start.mode; start = null; guides = {v:false, h:false};
    // reframing inside crop mode is committed on Done; reframing directly is committed now
    if ((was !== 'pan' && was !== 'cpinch') || !cropMode){ analyse(); commit(); redraw(true); } else redraw(false); } };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

// ── keep in sync with the rest of the studio (text, font, colours, mark) ──
new MutationObserver(() => redraw(true)).observe($('stage-text'), {childList:true, characterData:true, subtree:true, attributes:true});
new MutationObserver(() => redraw(false)).observe(st, {attributes:true, attributeFilter:['class','style']});
window.addEventListener('resize', () => { if (photoMode) layout(); });
const _tm = window.toggleMark; window.toggleMark = function(){ const r = _tm.apply(this, arguments); redraw(false); return r; };

// ── export: the goal's size (or the cropped photo, longest side ≤ 4096), JPG ──
function exportPhoto(mode){
  const [W, H] = exportSize(), c = document.createElement('canvas'); c.width = W; c.height = H;
  const was = cropMode; cropMode = false;
  document.fonts.load(`700 40px "${fontNow()}"`).then(() => {
    drawPhotoScene(c.getContext('2d'), W, H, true); cropMode = was;
    c.toBlob(async blob => {
      const prefix = location.pathname.split('/').filter(Boolean).join('-') || 'calligraphy';
      const name = `${prefix}-${(textNow().substring(0,20).replace(/\s+/g,'-') || 'photo')}.jpg`;
      const file = new File([blob], name, {type:'image/jpeg'});
      if (mode === 'share' && navigator.canShare && navigator.canShare({files:[file]})){
        try { await navigator.share({files:[file], title:(document.querySelector('meta[property="og:title"]')||{}).content||document.title, text:(document.querySelector('link[rel=canonical]')||{}).href||location.href}); } catch(e) {}
        return;
      }
      const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u);
    }, 'image/jpeg', .92);
  });
}
const _dl = window.dlPick; window.dlPick = function(kind){
  if (!window.isPhotoMode()) return _dl.apply(this, arguments);
  _closeDownloadMenu(); if (kind !== 'png') showToast(U.jpg); exportPhoto('download');
};
const _sh = window.shareImage; window.shareImage = function(){ return window.isPhotoMode() ? exportPhoto('share') : _sh.apply(this, arguments); };
syncHist();
window._photoOpen = () => setMode(true);           // the page's placeholder Photo tab calls this once loaded
window._photoFont = st => { if (!photoMode || !photo || cur === 0) return false;
  curFont = st.font; saveCur(); syncTexts(); commit(); redraw(true); return true; };
window._photo = {ai: {vision, getSegmenter, aiBytes, SEG_MODEL}, refine, segBase, rebuildSeg, detectPerson, hitText, addText, selectLayer, removeText, get layers(){ return layers; }, get cur(){ return cur; }, drawPhotoScene, autoPlace, applyGoal, toggleCrop, undo, redo, T, get crop(){ return crop; }, setLook: k => setLook(k), exportSize,
  togglePerson, get seg(){ return seg; }, get behind(){ return behind; }};   // for tests
})();
