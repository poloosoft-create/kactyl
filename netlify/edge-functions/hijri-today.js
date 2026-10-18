// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT BY HAND
// Source:    arabikeyboard/hijri-calendar/index.html  (its own <script> engine)
// Generator: tools/build_hijri_edge.py
//
// Netlify edge function. Fills today's Hijri date into /hijri-calendar/ on every
// request, so the page is correct on days the site was not rebuilt.
//
// The engine below is copied verbatim from the page. That is deliberate: the
// site has exactly one implementation of the Hijri calculation, and this is a
// machine copy of it, not a second hand-written port. Editing this file by hand
// re-creates the drift it exists to prevent — edit the page and re-run the
// generator instead.
//
// Fails safe: any error at all returns the origin response untouched, in which
// case the visitor sees the baked date, exactly as before this existed.
// ─────────────────────────────────────────────────────────────────────────────

const SKIP = new Set(['result-val', 'result-ar', 'from-label', 'to-label', 'swap-dir']);

/** Minimal DOM stand-in. Records text written to elements, absorbs the rest. */
function makeElement(record) {
  const own = Object.create(null);
  const handler = {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => '';
      if (prop === Symbol.iterator) return undefined;
      if (prop === 'length') return 0;
      if (prop === 'nodeType') return 1;
      if (prop in own) return own[prop];
      return new Proxy(function () { return makeElement(null); }, handler);
    },
    set(_t, prop, value) {
      own[prop] = value;
      if (record && (prop === 'textContent' || prop === 'innerText')) record(String(value));
      return true;
    },
    apply() { return makeElement(null); },
    has() { return true; },
  };
  return new Proxy(function () { return makeElement(null); }, handler);
}

/** A Date class pinned to one instant, so `new Date()` means "that day". */
function pinnedDateClass(fixed) {
  return class PinnedDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(fixed); else super(...args);
    }
    static now() { return fixed; }
  };
}

/** Run the page's engine for one day and return { elementId: text }. */
export function valuesFor(now) {
  // Noon UTC: far enough from either boundary that no offset rolls the day.
  const fixed = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0);
  const values = runEngine(pinnedDateClass(fixed));
  for (const id of SKIP) delete values[id];
  return values;
}

/**
 * `Date` is shadowed by the PARAMETER, not by a const in this scope — a const
 * would put the real Date in its own temporal dead zone and throw before the
 * engine ever ran. `document` and `window` are plain locals for the same
 * reason: the verbatim engine below resolves every global to these.
 */
function runEngine(Date) {           // eslint-disable-line no-shadow
  const values = Object.create(null);
  const elements = Object.create(null);
  const document = {
    getElementById(id) {
      if (!elements[id]) elements[id] = makeElement((t) => { values[id] = t; });
      return elements[id];
    },
    querySelector: () => makeElement(null),
    querySelectorAll: () => [],
    createElement: () => makeElement(null),
    createDocumentFragment: () => makeElement(null),
    addEventListener() {},
    body: makeElement(null),
    documentElement: makeElement(null),
    readyState: 'complete',
  };
  const window = {
    addEventListener() {}, removeEventListener() {}, scrollTo() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => new Proxy({}, { get: () => '' }),
    innerWidth: 1280, innerHeight: 900, scrollY: 0, dataLayer: [],
  };
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const navigator = { language: 'en-US', clipboard: { writeText: () => Promise.resolve() } };
  const location = { href: 'https://kactyl.com/hijri-calendar/', search: '', hash: '' };
  const alert = () => {};
  const gtag = () => {};
  const setTimeout = () => 0;
  const setInterval = () => 0;
  const requestAnimationFrame = (fn) => { try { fn(0); } catch (_e) {} return 0; };
  // Referenced so a bundler cannot drop them as unused.
  void [window, localStorage, navigator, location, alert, gtag,
        setTimeout, setInterval, requestAnimationFrame];

  // ── BEGIN verbatim engine from hijri-calendar/index.html ──────────────────

  // ── Hijri conversion algorithm (Kuwaiti / Tabular) ───────────────────────────
  function gToJD(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const Y = y + 4800 - a;
    const M = m + 12 * a - 3;
    return d + Math.floor((153 * M + 2) / 5) + 365 * Y + Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
  }
  function jdToHijri(JD) {
    const l = JD - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const l2 = l - 10631 * n + 354;
    const J = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
    const l3 = l2 - Math.floor((30 - J) / 15) * Math.floor((17719 * J) / 50) - Math.floor(J / 16) * Math.floor((15238 * J) / 43) + 29;
    const hm = Math.floor((24 * l3) / 709);
    const hd = l3 - Math.floor((709 * hm) / 24);
    const hy = 30 * n + J - 30;
    return { day: hd, month: hm, year: hy };
  }
  function hijriToJD(hy, hm, hd) {
    return Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
  }
  function jdToGregorian(JD) {
    let a = JD + 32044;
    let b = Math.floor((4 * a + 3) / 146097);
    let c = a - Math.floor((146097 * b) / 4);
    let d2 = Math.floor((4 * c + 3) / 1461);
    let e = c - Math.floor((1461 * d2) / 4);
    let m2 = Math.floor((5 * e + 2) / 153);
    let day = e - Math.floor((153 * m2 + 2) / 5) + 1;
    let month = m2 + 3 - 12 * Math.floor(m2 / 10);
    let year = 100 * b + d2 - 4800 + Math.floor(m2 / 10);
    return { year, month, day };
  }
  function gregorianToHijri(y, m, d) { return jdToHijri(gToJD(y, m, d)); }
  function hijriToGregorian(hy, hm, hd) { return jdToGregorian(hijriToJD(hy, hm, hd)); }

  // ── Month names ───────────────────────────────────────────────────────────────
  const HIJRI_MONTHS_EN = ['','Muharram','Safar','Rabi al-Awwal','Rabi al-Thani','Jumada al-Awwal','Jumada al-Thani','Rajab','Sha\'ban','Ramadan','Shawwal','Dhu al-Qi\'dah','Dhu al-Hijjah'];
  const HIJRI_MONTHS_AR = ['','محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
  const GREG_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const AR_NUMS = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];

  function toArabicNum(n) { return String(n).split('').map(d => AR_NUMS[parseInt(d)] || d).join(''); }

  // ── Islamic events (fixed Hijri dates, recurring annually) ───────────────────
  const ISLAMIC_EVENTS = [
    { name:"Islamic New Year",    ar:"رأس السنة الهجرية",    hm:1,  hd:1,  icon:"🌙" },
    { name:"Ashura",              ar:"عاشوراء",               hm:1,  hd:10, icon:"📿" },
    { name:"Mawlid al-Nabi",      ar:"المولد النبوي الشريف", hm:3,  hd:12, icon:"⭐" },
    { name:"Isra and Mi\'raj",    ar:"الإسراء والمعراج",      hm:7,  hd:27, icon:"🌠" },
    { name:"Mid-Sha\'ban",        ar:"ليلة النصف من شعبان",  hm:8,  hd:15, icon:"🌕" },
    { name:"Start of Ramadan",    ar:"بداية شهر رمضان",       hm:9,  hd:1,  icon:"☽" },
    { name:"Laylat al-Qadr",      ar:"ليلة القدر",             hm:9,  hd:27, icon:"✨" },
    { name:"Eid al-Fitr",         ar:"عيد الفطر المبارك",     hm:10, hd:1,  icon:"🎉" },
    { name:"Day of Arafah",       ar:"يوم عرفة",               hm:12, hd:9,  icon:"🕌" },
    { name:"Eid al-Adha",         ar:"عيد الأضحى المبارك",    hm:12, hd:10, icon:"🐑" },
  ];

  // ── State ─────────────────────────────────────────────────────────────────────
  const today = new Date();
  let calYear, calMonth; // Hijri
  let convMode = 'g2h'; // or 'h2g'

  // ── Today display ─────────────────────────────────────────────────────────────
  function renderToday() {
    const h = gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate());
    document.getElementById('h-day').textContent = h.day;
    document.getElementById('h-month').textContent = HIJRI_MONTHS_EN[h.month];
    document.getElementById('h-year').textContent = h.year + ' AH';
    // Keep every other on-page mention of the Hijri year in step with the computed
    // one. These were hardcoded (1447) and had already gone stale by 1448 AH.
    const _setY = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    _setY('badge-hyear', h.year);
    _setY('faq-hyear', h.year);
    _setY('events-hrange', h.year + '\u2013' + (h.year + 1) + ' AH');
    document.getElementById('g-date').textContent = today.getDate() + ' ' + GREG_MONTHS[today.getMonth()] + ' ' + today.getFullYear();
    document.getElementById('g-day').textContent = DAYS_EN[today.getDay()];
    document.getElementById('h-arabic').textContent = toArabicNum(h.day) + ' ' + HIJRI_MONTHS_AR[h.month] + ' ' + toArabicNum(h.year) + ' هـ';

    // Moon phase based on day of month (1=new, 15=full)
    const phase = (h.day / 30) * Math.PI;
    const moon = document.getElementById('moon-path');
    if (h.day <= 15) {
      const x = 32 + 22 * Math.cos(phase);
      moon.setAttribute('d', `M32 8 A24 24 0 1 1 32 56 A${Math.max(4,16-h.day)} 24 0 1 0 32 8Z`);
    } else {
      moon.setAttribute('d', `M32 8 A24 24 0 1 1 32 56 A${h.day-16} 24 0 1 1 32 8Z`);
    }

    calYear  = h.year;
    calMonth = h.month;
    return h;
  }

  // ── Next event banner ─────────────────────────────────────────────────────────
  function renderNextEvent() {
    const todayH = gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate());
    const todayJD = gToJD(today.getFullYear(), today.getMonth()+1, today.getDate());

    let best = null, bestDays = Infinity;
    for (const ev of ISLAMIC_EVENTS) {
      // Try current year and next year
      for (const hy of [todayH.year, todayH.year+1]) {
        const jd = hijriToJD(hy, ev.hm, ev.hd);
        const diff = jd - todayJD;
        if (diff >= 0 && diff < bestDays) { bestDays = diff; best = ev; }
      }
    }
    if (best) {
      document.getElementById('ne-name').textContent = best.name;
      document.getElementById('ne-name-ar').textContent = best.ar;
      document.getElementById('ne-days').textContent = bestDays;
      document.querySelector('.ne-icon').textContent = best.icon;
    }
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────────
  function hijriMonthDays(hy, hm) {
    // Odd months = 30 days, even = 29, except leap year month 12 = 30
    const leapYears = [2,5,7,10,13,16,18,21,24,26,29];
    if (hm % 2 === 1) return 30;
    if (hm === 12 && leapYears.includes(((hy - 1) % 30) + 1)) return 30;
    return 29;
  }
  function renderCalendar() {
    const days = hijriMonthDays(calYear, calMonth);
    // Find Gregorian date of 1st of this Hijri month
    const greg1 = hijriToGregorian(calYear, calMonth, 1);
    const jd1 = gToJD(greg1.year, greg1.month, greg1.day);
    // Day of week of 1st (0=Sun)
    const dow1 = ((jd1 + 1) % 7 + 7) % 7;

    const todayH = gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate());
    const isCurrentMonth = todayH.year === calYear && todayH.month === calMonth;

    // Build event set for this month
    const eventDays = new Set();
    for (const ev of ISLAMIC_EVENTS) {
      if (ev.hm === calMonth) eventDays.add(ev.hd);
    }

    document.getElementById('cal-month-h').textContent = HIJRI_MONTHS_EN[calMonth];
    document.getElementById('cal-month-ar').textContent = HIJRI_MONTHS_AR[calMonth];
    document.getElementById('cal-year-h').textContent = calYear + ' AH · ' + days + ' days';

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    // Empty cells before 1st
    for (let i = 0; i < dow1; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell empty';
      grid.appendChild(cell);
    }

    for (let d = 1; d <= days; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (isCurrentMonth && d === todayH.day) cell.classList.add('today');
      else if (eventDays.has(d)) cell.classList.add('event-day');

      const dayEl = document.createElement('div');
      dayEl.className = 'c-day';
      dayEl.textContent = d;
      const dayArEl = document.createElement('div');
      dayArEl.className = 'c-day-ar';
      dayArEl.textContent = toArabicNum(d);
      cell.appendChild(dayEl);
      cell.appendChild(dayArEl);

      if (eventDays.has(d)) {
        const dot = document.createElement('div');
        dot.className = 'event-dot';
        cell.appendChild(dot);
      }

      // Click to show Gregorian equivalent
      const g = hijriToGregorian(calYear, calMonth, d);
      cell.title = `${d} ${HIJRI_MONTHS_EN[calMonth]} ${calYear} AH = ${g.day} ${GREG_MONTHS[g.month-1]} ${g.year}`;
      cell.addEventListener('click', () => {
        showToast(`${g.day} ${GREG_MONTHS[g.month-1]} ${g.year}`);
      });

      grid.appendChild(cell);
    }
  }

  function navMonth(dir) {
    calMonth += dir;
    if (calMonth > 12) { calMonth = 1; calYear++; }
    if (calMonth < 1)  { calMonth = 12; calYear--; }
    renderCalendar();
  }

  // ── Events list ───────────────────────────────────────────────────────────────
  function renderEvents() {
    const todayH = gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate());
    const todayJD = gToJD(today.getFullYear(), today.getMonth()+1, today.getDate());
    const grid = document.getElementById('events-grid');
    grid.innerHTML = '';

    const eventsWithDiff = ISLAMIC_EVENTS.map(ev => {
      let bestDiff = Infinity, bestHY = todayH.year;
      for (const hy of [todayH.year - 1, todayH.year, todayH.year + 1]) {
        const jd = hijriToJD(hy, ev.hm, ev.hd);
        const diff = jd - todayJD;
        if (Math.abs(diff) < Math.abs(bestDiff)) { bestDiff = diff; bestHY = hy; }
      }
      const g = hijriToGregorian(bestHY, ev.hm, ev.hd);
      return { ...ev, diff: bestDiff, hy: bestHY, g };
    });

    // Sort: upcoming first, then past
    eventsWithDiff.sort((a, b) => {
      if (a.diff >= 0 && b.diff >= 0) return a.diff - b.diff;
      if (a.diff < 0 && b.diff < 0) return b.diff - a.diff;
      return a.diff >= 0 ? -1 : 1;
    });

    eventsWithDiff.forEach(ev => {
      const card = document.createElement('div');
      card.className = 'event-card';
      const isPast = ev.diff < 0;
      const pillTxt = isPast ? `${Math.abs(ev.diff)} days ago` : (ev.diff === 0 ? 'Today!' : `in ${ev.diff} days`);
      card.innerHTML = `
        <div class="ev-top">
          <div class="ev-icon">${ev.icon}</div>
          <div class="ev-days-pill ${isPast ? 'past' : ''}">${pillTxt}</div>
        </div>
        <div class="ev-name">${ev.name}</div>
        <div class="ev-name-ar">${ev.ar}</div>
        <div class="ev-hijri-date">${ev.hd} ${HIJRI_MONTHS_EN[ev.hm]} ${ev.hy} · ${ev.g.day} ${GREG_MONTHS[ev.g.month-1]} ${ev.g.year}</div>
      `;
      grid.appendChild(card);
    });
  }

  // ── Converter ─────────────────────────────────────────────────────────────────
  function buildConverterInputs() {
    const fromDay = document.getElementById('from-day');
    const fromMonth = document.getElementById('from-month');
    const fromYear = document.getElementById('from-year');

    fromDay.innerHTML = Array.from({length:31},(_,i)=>`<option>${i+1}</option>`).join('');
    fromMonth.innerHTML = '';

    if (convMode === 'g2h') {
      GREG_MONTHS.forEach((m,i) => {
        const o = document.createElement('option');
        o.value = i+1; o.textContent = m;
        fromMonth.appendChild(o);
      });
      for (let y = 2030; y >= 1900; y--) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        if (y === today.getFullYear()) o.selected = true;
        fromYear.appendChild(o);
      }
      document.getElementById('from-label').textContent = 'Gregorian Date';
      document.getElementById('to-label').textContent = '→ Hijri Date';
      document.getElementById('swap-dir').textContent = '→ Hijri';
    } else {
      HIJRI_MONTHS_EN.slice(1).forEach((m,i) => {
        const o = document.createElement('option');
        o.value = i+1; o.textContent = `${i+1}. ${m}`;
        fromMonth.appendChild(o);
      });
      fromYear.innerHTML = '';
      for (let y = 1470; y >= 1300; y--) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y + ' AH';
        const todayH = gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate());
        if (y === todayH.year) o.selected = true;
        fromYear.appendChild(o);
      }
      document.getElementById('from-label').textContent = 'Hijri Date';
      document.getElementById('to-label').textContent = '→ Gregorian Date';
      document.getElementById('swap-dir').textContent = '→ Gregorian';
    }

    // Set today's day and month
    fromDay.value = convMode === 'g2h' ? today.getDate() : gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate()).day;
    fromMonth.value = convMode === 'g2h' ? today.getMonth()+1 : gregorianToHijri(today.getFullYear(), today.getMonth()+1, today.getDate()).month;
  }

  function swapMode() {
    convMode = convMode === 'g2h' ? 'h2g' : 'g2h';
    document.getElementById('conv-result').classList.remove('show');
    buildConverterInputs();
  }

  function convertDate() {
    const d = parseInt(document.getElementById('from-day').value);
    const m = parseInt(document.getElementById('from-month').value);
    const y = parseInt(document.getElementById('from-year').value);

    if (convMode === 'g2h') {
      const h = gregorianToHijri(y, m, d);
      document.getElementById('result-label').textContent = 'Hijri Date';
      document.getElementById('result-val').textContent = `${h.day} ${HIJRI_MONTHS_EN[h.month]} ${h.year} AH`;
      document.getElementById('result-ar').textContent = `${toArabicNum(h.day)} ${HIJRI_MONTHS_AR[h.month]} ${toArabicNum(h.year)} هـ`;
    } else {
      const g = hijriToGregorian(y, m, d);
      document.getElementById('result-label').textContent = 'Gregorian Date';
      document.getElementById('result-val').textContent = `${g.day} ${GREG_MONTHS[g.month-1]} ${g.year}`;
      document.getElementById('result-ar').textContent = '';
    }
    document.getElementById('conv-result').classList.add('show');
  }

  // ── Copy / Toast ───────────────────────────────────────────────────────────────
  function copyTodayDate() {
    const ar = document.getElementById('h-arabic').textContent;
    const en = document.getElementById('h-day').textContent + ' ' + document.getElementById('h-month').textContent + ' ' + document.getElementById('h-year').textContent;
    navigator.clipboard.writeText(ar + '\n' + en).catch(() => {});
    showToast('Date copied!');
  }
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : '';
    document.getElementById('t-track').className = 't-track' + (dark ? ' on' : '');
    document.getElementById('t-thumb').className = 't-thumb' + (dark ? ' on' : '');
    document.getElementById('t-lbl').textContent = dark ? 'Dark' : 'Light';
    localStorage.setItem('theme', dark ? 'dark' : '');
  }
  function toggleLang() { document.getElementById('lang-menu')?.classList.toggle('show'); }
  function setLang(l) {
    const urls = { en: '/hijri-calendar/', ar: '/ar/hijri-calendar/' };
    if (urls[l] && l !== 'en') window.location.href = urls[l];
    document.getElementById('lang-menu')?.classList.remove('show');
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('.lang-wrap')) document.getElementById('lang-menu')?.classList.remove('show');
    if (!e.target.closest('.tools-wrap')) document.getElementById('tools-wrap').classList.remove('open');
  });

  // ── Header hide on scroll ─────────────────────────────────────────────────────
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    document.getElementById('hdr').classList.toggle('hdr-hidden', y > lastY && y > 80);
    lastY = y;
  }, { passive: true });

  // ── Init ──────────────────────────────────────────────────────────────────────
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    document.getElementById('t-track').classList.add('on');
    document.getElementById('t-thumb').classList.add('on');
    document.getElementById('t-lbl').textContent = 'Dark';
  }
  renderToday();
  renderNextEvent();
  renderCalendar();
  renderEvents();
  buildConverterInputs();
  // ── END verbatim engine ───────────────────────────────────────────────────

  return values;
}

/** Write the values into the HTML, matching whatever is currently inside. */
export function fillHtml(html, values) {
  let out = html;
  for (const [id, text] of Object.entries(values)) {
    if (text === undefined || text === null) continue;
    const re = new RegExp('(<[^>]*id="' + id + '"[^>]*>)[^<]*(</)', 'g');
    out = out.replace(re, (_m, open, close) => open + text + close);
  }
  return out;
}

/** Seconds remaining until the next UTC midnight, when the date changes. */
function secondsUntilUtcMidnight(now) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.floor((next - now.getTime()) / 1000));
}

export default async function handler(request, context) {
  const response = await context.next();
  try {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) return response;

    const now = new Date();
    const values = valuesFor(now);
    if (!values['h-day']) return response;   // engine produced nothing — leave it alone

    const filled = fillHtml(await response.text(), values);
    const headers = new Headers(response.headers);
    // Cache at Netlify's CDN until the date changes, so this runs about once a
    // day per edge node rather than once per visitor. Deploys invalidate it.
    headers.set('Netlify-CDN-Cache-Control',
      `public, s-maxage=${secondsUntilUtcMidnight(now)}, stale-while-revalidate=86400`);
    // The browser must not hold yesterday's answer.
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    headers.delete('content-length');
    return new Response(filled, { status: response.status, headers });
  } catch (_err) {
    // Fail open: the baked date is still in the HTML.
    return response;
  }
}

export const config = {
  // Both forms: the canonical URL carries the trailing slash, but a request for
  // the bare path must not slip past unfilled.
  path: ['/hijri-calendar', '/hijri-calendar/'],
  // Opt in to CDN caching. Without this the response is never cached and the
  // function runs on every single request; with it, the headers set above make
  // it run roughly once a day per edge node.
  cache: 'manual',
};
