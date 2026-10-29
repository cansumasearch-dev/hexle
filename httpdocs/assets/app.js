/* HEXLE — client. Vanilla JS, no build step. */
(() => {
'use strict';

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('hexle:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hexle:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const fmtTime = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
const fmtClock = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const icon = (n, c) => window.iconSvg(n, c);

const UI = {
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.2a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.4M12 17.6h.01"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V12M10 20V5M15 20v-9M20 20V8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#ffb23f" stroke="#7a3d00" stroke-width="1"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 5v14l9-7zM15 5h3v14h-3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  kick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 8l5 5M22 8l-5 5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1"/></svg>',
};

// ---------------------------------------------------------------- prefs
const prefs = Object.assign({ hard: false, contrast: false, calm: false, seenHelp: false }, store.get('prefs', {}));
const savePrefs = () => { store.set('prefs', prefs); applyPrefs(); };
function applyPrefs() {
  document.documentElement.classList.toggle('contrast', prefs.contrast);
  document.documentElement.classList.toggle('calm', prefs.calm);
}
applyPrefs();

// ---------------------------------------------------------------- toast & modal
function toast(msg, ms = 1400, cls = '') {
  const t = h(`<div class="toast ${cls}"></div>`); t.textContent = msg;
  $('#toasts').prepend(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
}
let openModals = 0;
const modalClosers = new Set();
function modal(content, { wide = false, onClose } = {}) {
  const back = h(`<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><button class="icon-btn x" aria-label="Close">${UI.x}</button></div></div>`);
  const box = $('.modal', back);
  if (typeof content === 'string') box.insertAdjacentHTML('beforeend', content); else box.append(content);
  let closed = false;
  const close = () => { if (closed) return; closed = true; openModals--; modalClosers.delete(close); back.remove(); document.removeEventListener('keydown', onKey, true); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  $('.x', back).onclick = close;
  document.addEventListener('keydown', onKey, true);
  document.body.append(back); openModals++; modalClosers.add(close);
  return { el: box, close };
}

// ---------------------------------------------------------------- words
const Words = {
  cache: {},
  async list(kind, n) {
    const k = kind + n;
    if (!this.cache[k]) this.cache[k] = fetch(`words/${kind}-${n}.txt`).then(r => r.ok ? r.text() : '').then(t => t.split('\n').map(w => w.trim()).filter(Boolean)).catch(() => []);
    return this.cache[k];
  },
  async validSet(n) { const k = 'set' + n; if (!this.cache[k]) this.cache[k] = this.list('valid', n).then(l => new Set(l)); return this.cache[k]; },
};
const cleanWords = text => [...new Set(String(text || '').toLowerCase().split(/[\s,;]+/).filter(w => /^[a-z]{3,10}$/.test(w)))];

function marks(guess, answer) {
  const n = answer.length, m = Array(n).fill('a'), left = {};
  for (let i = 0; i < n; i++) { if (guess[i] === answer[i]) m[i] = 'c'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
  for (let i = 0; i < n; i++) { if (m[i] === 'c') continue; if (left[guess[i]] > 0) { m[i] = 'p'; left[guess[i]]--; } }
  return m.join('');
}
const ordinal = i => i + (i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th');
function hardViolation(guess, rows) {
  for (const r of rows) {
    const need = {};
    for (let i = 0; i < r.w.length; i++) {
      if (r.m[i] === 'c' && guess[i] !== r.w[i]) return `${ordinal(i + 1)} letter must be ${r.w[i].toUpperCase()}`;
      if (r.m[i] !== 'a') need[r.w[i]] = (need[r.w[i]] || 0) + 1;
    }
    for (const [ch, cnt] of Object.entries(need)) if (guess.split(ch).length - 1 < cnt) return `Guess must contain ${ch.toUpperCase()}`;
  }
  return null;
}
const WIN_LINES = ['Possessed!', 'Wicked!', 'Bewitching!', 'Spellbound', 'Hauntingly good', 'Phew… you survived', 'Barely escaped', 'Narrow escape', 'Clawed back', 'Last breath'];

// ---------------------------------------------------------------- board
let activeBoard = null;
const KB = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];

class Board {
  constructor({ len, rows, onEnter, maxTile = 62 }) {
    this.len = len; this.maxRows = rows; this.onEnter = onEnter; this.maxTile = maxTile;
    this.rows = []; this.cur = ''; this.busy = false; this.locked = false;
    this.el = h(`<div class="board-area" style="display:contents"><div class="board-wrap"><div class="board"></div></div><div class="keyboard"></div></div>`);
    this.wrap = $('.board-wrap', this.el); this.boardEl = $('.board', this.el); this.kbEl = $('.keyboard', this.el);
    this.build();
    this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(this.wrap);
    activeBoard = this;
  }
  destroy() { this.ro.disconnect(); if (activeBoard === this) activeBoard = null; }
  build() {
    this.boardEl.innerHTML = '';
    for (let r = 0; r < this.maxRows; r++) {
      const row = h('<div class="row"></div>');
      for (let i = 0; i < this.len; i++) row.append(h('<div class="tile"></div>'));
      this.boardEl.append(row);
    }
    this.kbEl.innerHTML = KB.map(r => `<div class="krow">${[...r].map(k => k === '>' ? `<button class="key wide" data-k="Enter">Enter</button>`
      : k === '<' ? `<button class="key wide" data-k="Backspace" aria-label="Backspace">${UI.backspace}</button>` : `<button class="key" data-k="${k}">${k}</button>`).join('')}</div>`).join('');
    this.kbEl.onclick = e => { const b = e.target.closest('[data-k]'); if (b) { this.key(b.dataset.k); b.blur(); } };
    this.fit();
  }
  fit() {
    const w = this.wrap.clientWidth || 340, hgt = Math.min(this.wrap.clientHeight || 9999, Math.max(220, window.innerHeight - 320));
    const t = Math.floor(Math.min(this.maxTile, (w - (this.len - 1) * 6 - 8) / this.len, (hgt - (this.maxRows - 1) * 6) / this.maxRows));
    this.boardEl.style.setProperty('--tile', Math.max(26, t) + 'px');
  }
  rowEl(i) { return this.boardEl.children[i]; }
  key(k) {
    if (this.locked || this.busy) return;
    if (k === 'Enter') return this.submit();
    if (k === 'Backspace') { if (this.cur) { this.cur = this.cur.slice(0, -1); this.paint(); } return; }
    if (/^[a-z]$/i.test(k) && this.cur.length < this.len && this.rows.length < this.maxRows) { this.cur += k.toLowerCase(); this.paint(true); }
  }
  paint(popLast = false) {
    const row = this.rowEl(this.rows.length); if (!row) return;
    [...row.children].forEach((t, i) => {
      const ch = this.cur[i] || '';
      if (t.textContent !== ch) { t.textContent = ch; t.classList.toggle('filled', !!ch); if (ch && popLast && i === this.cur.length - 1) { t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; } }
    });
  }
  shake() { const r = this.rowEl(this.rows.length); if (!r) return; r.classList.remove('shake'); void r.offsetWidth; r.classList.add('shake'); setTimeout(() => r.classList.remove('shake'), 650); }
  async submit() {
    if (this.cur.length < this.len) { this.shake(); toast('Not enough letters'); return; }
    this.busy = true;
    const row = this.rowEl(this.rows.length);
    const slow = setTimeout(() => row.classList.add('pending'), 150);
    let res;
    try { res = await this.onEnter(this.cur, this.rows); } catch (e) { res = { error: e.message || 'Something went wrong' }; }
    clearTimeout(slow); row.classList.remove('pending');
    if (!res || res.error) { this.busy = false; this.shake(); if (res?.error) toast(res.error); return; }
    const w = this.cur; this.cur = '';
    await this.reveal(w, res.marks);
    this.busy = false;
    res.after?.(this.rows.length - 1);
  }
  async reveal(w, m) {
    const idx = this.rows.length; this.rows.push({ w, m });
    const tiles = [...this.rowEl(idx).children];
    const fast = prefs.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = fast ? 0 : 300;
    tiles.forEach((t, i) => setTimeout(() => {
      t.textContent = w[i];
      if (fast) { t.className = `tile revealed ${m[i]}`; return; }
      t.classList.add('flip');
      setTimeout(() => { t.className = `tile revealed ${m[i]} flip2`; }, 250);
    }, i * step));
    await sleep(fast ? 30 : (tiles.length - 1) * step + 520);
    this.paintKeys();
  }
  restore(rows) {
    this.rows = []; this.cur = ''; this.build();
    rows.forEach((r, idx) => { this.rows.push(r); [...this.rowEl(idx).children].forEach((t, i) => { t.textContent = r.w[i]; t.className = `tile revealed ${r.m[i]}`; }); });
    this.paintKeys();
  }
  paintKeys() {
    const best = {}; const rank = { c: 3, p: 2, a: 1 };
    for (const r of this.rows) for (let i = 0; i < r.w.length; i++) if (!best[r.w[i]] || rank[r.m[i]] > rank[best[r.w[i]]]) best[r.w[i]] = r.m[i];
    $$('.key[data-k]', this.kbEl).forEach(k => { const s = best[k.dataset.k]; k.classList.remove('c', 'p', 'a'); if (s) k.classList.add(s); });
  }
  bounce(idx) {
    if (prefs.calm) return;
    [...this.rowEl(idx).children].forEach((t, i) => setTimeout(() => { t.classList.remove('flip2'); t.classList.add('bounce'); }, i * 100));
  }
}

document.addEventListener('keydown', e => {
  if (!activeBoard || openModals || e.ctrlKey || e.metaKey || e.altKey) return;
  const tg = e.target;
  if (tg.closest?.('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'Enter' && tg.closest?.('button') && !tg.closest('.keyboard')) return;
  if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); activeBoard.key(e.key.length === 1 ? e.key.toLowerCase() : e.key); }
});

// ---------------------------------------------------------------- identity, api
function hex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); }
let ident = store.get('ident', null);
if (!ident) { ident = { pid: hex(16), token: hex(24) }; store.set('ident', ident); }
let profile = Object.assign({ name: '', color: '#ff2e5b', icon: ['pumpkin', 'ghost', 'bat', 'skull', 'cat', 'devil'][Math.floor(Math.random() * 6)], av: 0 }, store.get('profile', {}));
let serverOffset = 0;
// Where api.php lives. Empty = same origin; set in assets/config.js when the page is hosted elsewhere (GitHub Pages).
const API = window.HEXLE_API || '';
const serverNow = () => Date.now() + serverOffset;

async function api(action, body = {}, retry = true) {
  let res;
  try {
    res = await fetch(API + 'api.php?a=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pid': ident.pid, 'X-Token': ident.token }, body: JSON.stringify(body) });
  } catch { throw new Error('Cannot reach the server'); }
  let data = null;
  try { data = await res.json(); } catch { throw new Error('Server error (' + res.status + ')'); }
  if (data?.now) { const off = data.now - Date.now(); serverOffset = Math.abs(off - serverOffset) > 1500 ? off : serverOffset * .7 + off * .3; }
  if (res.status === 403 && data?.error === 'identity taken' && retry) { ident = { pid: hex(16), token: hex(24) }; store.set('ident', ident); return api(action, body, false); }
  if (!res.ok || data?.error) { const e = new Error(data?.error || 'Request failed'); e.status = res.status; throw e; }
  return data;
}
let helloP = null;
function hello() {
  if (!helloP) helloP = api('hello').then(async d => {
    if (!profile.name) profile.name = d.me.name === 'Ghost' ? 'Ghost' + Math.floor(Math.random() * 900 + 100) : d.me.name;
    if (d.me.name !== profile.name || d.me.color !== profile.color || d.me.icon !== profile.icon) {
      const r = await api('profile', { name: profile.name, color: profile.color, icon: profile.icon });
      Object.assign(profile, r.me);
    } else profile.av = d.me.av;
    store.set('profile', profile); renderMe();
    return d;
  }).catch(e => { helloP = null; throw e; });
  return helloP;
}

// ---------------------------------------------------------------- avatars
function avatar(p, size = 36, extra = '') {
  const pc = /^#[0-9a-f]{6}$/i.test(p?.color || '') ? p.color : '#ff2e5b';
  const inner = p?.av > 0 ? `<img src="${API}api.php?a=avatar&id=${encodeURIComponent(p.id)}&v=${p.av}" alt="" loading="lazy">` : icon(p?.icon || 'ghost');
  return `<span class="av ${extra}" style="--s:${size}px;--pc:${pc}">${inner}</span>`;
}
const nameSpan = p => `<span style="color:${/^#[0-9a-f]{6}$/i.test(p?.color || '') ? p.color : '#ff2e5b'}">${esc(p?.name || 'Someone')}</span>`;

// ---------------------------------------------------------------- shell
const view = $('#view');
let teardown = [];
function onTeardown(fn) { teardown.push(fn); }
function setTop({ left = '', right = '', tag = '' } = {}) {
  $('#brand').innerHTML = `${icon('heart')}<span class="logo-word">HEXLE</span>${tag ? `<span class="mode-tag">${esc(tag)}</span>` : ''}`;
  $('#tb-left').innerHTML = left;
  $('#tb-right').innerHTML = right + `<button class="me-chip" id="me-chip" aria-label="Edit profile"></button>`;
  $('#me-chip').onclick = () => profileModal();
  renderMe();
}
function renderMe() {
  const c = $('#me-chip'); if (!c) return;
  c.innerHTML = avatar({ ...profile, id: ident.pid }, 30) + `<span class="nm">${esc(profile.name || 'Set name')}</span>`;
}
const backBtn = (href = '#/') => `<a class="icon-btn" href="${href}" aria-label="Back">${UI.back}</a>`;

// ---------------------------------------------------------------- atmosphere
$('#spider').innerHTML = icon('spider');
function spawnBat() {
  if (!prefs.calm && !document.hidden) {
    const b = h(`<div class="bat-fly">${icon('bat')}</div>`);
    b.style.top = (8 + Math.random() * 45) + '%';
    b.style.setProperty('--dy', (Math.random() * 160 - 100) + 'px');
    const s = 22 + Math.random() * 26; b.style.width = b.style.height = s + 'px';
    b.style.animationDuration = (7 + Math.random() * 6) + 's';
    b.addEventListener('animationend', () => b.remove());
    $('.sky').append(b);
  }
  setTimeout(spawnBat, 9000 + Math.random() * 14000);
}
function spawnEmber() {
  if (!prefs.calm && !document.hidden) {
    const e = h('<i class="ember"></i>');
    e.style.left = Math.random() * 100 + 'vw';
    e.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
    e.style.animationDuration = (6 + Math.random() * 6) + 's';
    e.addEventListener('animationend', () => e.remove());
    $('.sky').append(e);
  }
  setTimeout(spawnEmber, 1400 + Math.random() * 2600);
}
setTimeout(spawnBat, 2500); setTimeout(spawnEmber, 800);
function confetti(n = 60) {
  if (prefs.calm) return;
  const pool = ['bat', 'pumpkin', 'candy', 'heart', 'ghost', 'bow', 'skull'];
  for (let i = 0; i < n; i++) {
    const c = h(`<div class="confetti">${icon(pool[i % pool.length])}</div>`);
    c.style.left = Math.random() * 100 + 'vw';
    c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
    c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    c.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
    c.style.animationDelay = Math.random() * 1.2 + 's';
    c.addEventListener('animationend', () => c.remove());
    document.body.append(c);
  }
}

// ---------------------------------------------------------------- shared modals
function helpModal(len = 5, rows = 6) {
  const ex = (w, i, m) => `<div class="example">${[...w].map((c, j) => `<div class="tile ${j === i ? 'revealed ' + m : 'filled'}">${c}</div>`).join('')}</div>`;
  modal(`<h2>How to play</h2>
    <p>Guess the hidden word in <b>${rows} tries</b>. Each guess must be a valid ${len}-letter word. The tiles change colour to show how close you were.</p>
    ${ex('crypt', 0, 'c')}<p><b>C</b> is in the word and in the correct spot.</p>
    ${ex('witch', 1, 'p')}<p><b>I</b> is in the word but in the wrong spot.</p>
    ${ex('ghoul', 3, 'a')}<p><b>U</b> is not in the word in any spot.</p>
    <h3>Modes</h3>
    <p><b>Daily Hex</b> — one word per day for everyone, with streaks. <b>Endless Night</b> — play as many as you like, any length, your own word lists. <b>The Coven</b> — multiplayer rooms: fewest guesses wins the round.</p>
    <p style="color:var(--muted);font-size:14px">Hard mode: any revealed hints must be used in later guesses.</p>`);
}
function settingsModal({ lockHard = false } = {}) {
  const sw = (k, t, d, dis = false) => `<div class="row-set"><div><div class="t">${t}</div><div class="d">${d}</div></div><label class="switch"><input type="checkbox" data-p="${k}" ${prefs[k] ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i></label></div>`;
  const m = modal(`<h2>Settings</h2>
    ${sw('hard', 'Hard mode', lockHard ? 'Can only be changed before your first guess' : 'Any revealed hints must be used in subsequent guesses', lockHard)}
    ${sw('contrast', 'High contrast', 'Orange / blue tiles for colour-vision friendliness')}
    ${sw('calm', 'Calm mode', 'Turn off bats, embers, confetti and tile animations')}`);
  m.el.addEventListener('change', e => { const k = e.target.dataset.p; if (k) { prefs[k] = e.target.checked; savePrefs(); } });
}

// Profile editor: name, colour, icon or uploaded picture.
const SWATCHES = ['#ff2e5b', '#c4122f', '#ff8fb0', '#ff7a1a', '#ffb23f', '#9b3dd6', '#5b8cff', '#2ec4b6', '#4fd13e', '#f6edf2', '#8a5a72', '#3b1235'];
function profileModal() {
  const draft = { ...profile, avatar: undefined };
  const m = modal(`<h2>Your ghoul</h2>
    <div class="prof-head"><div id="pv"></div><label class="field" style="flex:1"><span>Display name</span><input class="input" id="pn" maxlength="20" placeholder="Your name"></label></div>
    <h3>Colour</h3><div class="swatches" id="psw"></div>
    <h3>Avatar</h3><div class="icon-grid" id="pic"></div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <label class="btn ghost small" style="cursor:pointer">${UI.upload}Upload image<input type="file" accept="image/*" id="pf" hidden></label>
      <button class="btn ghost small" id="prm" ${profile.av > 0 ? '' : 'hidden'}>${UI.trash}Remove image</button>
    </div>
    <div style="margin-top:22px"><button class="btn primary block" id="psave">Save</button></div>`);
  const el = m.el;
  $('#pn', el).value = draft.name;
  const render = () => {
    const prevSrc = draft.avatar ? `<span class="av" style="--s:72px;--pc:${draft.color}"><img src="${draft.avatar}" alt=""></span>`
      : avatar({ ...draft, id: ident.pid, av: draft.avatar === null ? 0 : draft.av }, 72);
    $('#pv', el).innerHTML = prevSrc;
    $('#psw', el).innerHTML = SWATCHES.map(c => `<button style="background:${c}" data-c="${c}" class="${draft.color === c ? 'on' : ''}" aria-label="${c}"></button>`).join('') + `<label title="Custom colour"><input type="color" value="${draft.color}"></label>`;
    $('#pic', el).innerHTML = window.ICON_NAMES.map(n => `<button data-i="${n}" class="${draft.icon === n && !(draft.av > 0 && draft.avatar !== null) && !draft.avatar ? 'on' : ''}" aria-label="${n}" style="background:radial-gradient(circle at 30% 25%, ${draft.color}55, transparent 70%), var(--ink-1)">${icon(n)}</button>`).join('');
    $('#prm', el).hidden = !(draft.avatar || (draft.av > 0 && draft.avatar !== null));
  };
  render();
  $('#psw', el).addEventListener('click', e => { const c = e.target.closest('[data-c]')?.dataset.c; if (c) { draft.color = c; render(); } });
  $('#psw', el).addEventListener('input', e => { if (e.target.type === 'color') { draft.color = e.target.value; $('#pv .av', el)?.style.setProperty('--pc', draft.color); } });
  $('#psw', el).addEventListener('change', e => { if (e.target.type === 'color') render(); });
  $('#pic', el).addEventListener('click', e => { const i = e.target.closest('[data-i]')?.dataset.i; if (i) { draft.icon = i; if (draft.av > 0 || draft.avatar) draft.avatar = null; render(); } });
  $('#prm', el).onclick = () => { draft.avatar = null; render(); };
  $('#pf', el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { draft.avatar = await resizeImage(f, 160); render(); } catch { toast('Could not read that image'); }
  };
  $('#psave', el).onclick = async () => {
    draft.name = $('#pn', el).value.trim() || 'Ghost';
    const body = { name: draft.name, color: draft.color, icon: draft.icon };
    if (draft.avatar !== undefined) body.avatar = draft.avatar;
    const btn = $('#psave', el); btn.disabled = true;
    try {
      await hello().catch(() => null);
      const r = await api('profile', body);
      Object.assign(profile, r.me);
    } catch (err) {
      if (draft.avatar) { toast(err.message); btn.disabled = false; return; }
      Object.assign(profile, { name: draft.name, color: draft.color, icon: draft.icon });   // offline: keep locally
    }
    store.set('profile', profile); renderMe(); m.close(); toast('Profile saved', 1200, 'dark');
    window.dispatchEvent(new Event('hexle:profile'));
  };
}
function resizeImage(file, size) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      let d = c.toDataURL('image/webp', .86);
      if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', .86);
      res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

// Word list editor. value = { source: builtin|mixed|custom, text }
function wordListModal(value, { editable = true, onSave }) {
  const saved = store.get('lists', {});
  const m = modal(`<h2>Word list</h2>
    <div class="wl-mode">
      <label><input type="radio" name="src" value="builtin"><div><b>Built-in words</b><small>Common English words, ~1–2k per length.</small></div></label>
      <label><input type="radio" name="src" value="mixed"><div><b>Built-in + my words</b><small>Your words are added to the pool and always count as valid guesses.</small></div></label>
      <label><input type="radio" name="src" value="custom"><div><b>Only my words</b><small>Every answer comes from your list. Any length 3–10.</small></div></label>
    </div>
    <h3>My words</h3>
    <textarea class="input" id="wl-t" placeholder="spooky, crypt, wraith, lantern…  (spaces, commas or new lines)"></textarea>
    <div class="wl-stats" id="wl-s"></div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <label class="btn ghost small" style="cursor:pointer">${UI.upload}Import .txt<input type="file" accept=".txt,text/plain" id="wl-f" hidden></label>
      <button class="btn ghost small" id="wl-clear">${UI.trash}Clear</button>
    </div>
    <h3>Saved lists</h3>
    <div class="wl-saved" id="wl-saved"></div>
    <div style="display:flex;gap:8px;margin-top:10px"><input class="input" id="wl-n" placeholder="Save current list as…" maxlength="30"><button class="btn ghost" id="wl-sv">Save</button></div>
    <div style="margin-top:22px"><button class="btn primary block" id="wl-ok">${editable ? 'Use this list' : 'Close'}</button></div>`, { wide: true });
  const el = m.el, ta = $('#wl-t', el);
  ta.value = value.text || '';
  $(`input[value=${value.source || 'builtin'}]`, el).checked = true;
  if (!editable) $$('input, textarea, button:not(.x):not(#wl-ok)', el).forEach(x => x.disabled = true);
  const stats = () => {
    const w = cleanWords(ta.value); const by = {};
    w.forEach(x => by[x.length] = (by[x.length] || 0) + 1);
    const bad = String(ta.value).split(/[\s,;]+/).filter(x => x && !/^[a-z]{3,10}$/i.test(x)).length;
    $('#wl-s', el).innerHTML = `<span><b>${w.length}</b> words</span>` + Object.keys(by).sort((a, b) => a - b).map(n => `<span>${n} letters: <b>${by[n]}</b></span>`).join('') + (bad ? `<span style="color:var(--amber)">${bad} ignored (letters a–z, 3–10 long)</span>` : '');
  };
  const renderSaved = () => {
    const names = Object.keys(saved);
    $('#wl-saved', el).innerHTML = names.length ? names.map(n => `<span class="chip"><button class="load" data-l="${esc(n)}">${esc(n)} <small style="color:var(--muted)">(${cleanWords(saved[n]).length})</small></button><button data-d="${esc(n)}" aria-label="Delete">${UI.x}</button></span>`).join('') : '<span style="color:var(--muted);font-size:13px">No saved lists yet.</span>';
  };
  stats(); renderSaved();
  ta.oninput = stats;
  $('#wl-f', el).onchange = async e => { const f = e.target.files[0]; if (f) { ta.value = (ta.value ? ta.value + '\n' : '') + await f.text(); stats(); } };
  $('#wl-clear', el).onclick = () => { ta.value = ''; stats(); };
  $('#wl-sv', el).onclick = () => { const n = $('#wl-n', el).value.trim(); if (!n) return toast('Give the list a name'); saved[n] = cleanWords(ta.value).join(' '); store.set('lists', saved); $('#wl-n', el).value = ''; renderSaved(); toast('List saved'); };
  $('#wl-saved', el).onclick = e => {
    const l = e.target.closest('[data-l]')?.dataset.l, d = e.target.closest('[data-d]')?.dataset.d;
    if (l != null && editable) { ta.value = saved[l]; stats(); }
    if (d != null && editable) { delete saved[d]; store.set('lists', saved); renderSaved(); }
  };
  $('#wl-ok', el).onclick = () => {
    if (!editable) return m.close();
    const source = $('input[name=src]:checked', el).value; const words = cleanWords(ta.value);
    if (source !== 'builtin' && !words.length) return toast('Add some words first');
    onSave({ source, text: words.join(' ') }); m.close();
  };
}

// ---------------------------------------------------------------- daily
const EPOCH = Date.UTC(2026, 0, 1);
function berlinParts() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - EPOCH) / 864e5), secs: +p.hour * 3600 + +p.minute * 60 + +p.second };
}
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
async function dailyWord(day) {
  const list = [...await Words.list('answers', 5)];
  const rnd = mulberry32(0x4E5E1); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list[((day % list.length) + list.length) % list.length];
}
const blankStats = rows => ({ played: 0, wins: 0, cur: 0, max: 0, dist: Array(rows).fill(0), lastWin: null, last: null });

function statsModal({ title = 'Statistics', st, rows, now, answer, daily, onShare, onNext, curRow }) {
  const winPct = st.played ? Math.round(st.wins / st.played * 100) : 0;
  const maxD = Math.max(1, ...st.dist);
  const m = modal(`${answer ? `<div class="reveal-word"><div class="lbl">The word was</div><div class="w">${[...answer].map(c => `<div class="tile revealed c">${c}</div>`).join('')}</div></div>` : ''}
    <h2>${title}</h2>
    <div class="stats-grid"><div><b>${st.played}</b><span>Played</span></div><div><b>${winPct}</b><span>Win %</span></div><div><b>${st.cur}</b><span>Current streak</span></div><div><b>${st.max}</b><span>Max streak</span></div></div>
    <h3>Guess distribution</h3>
    <div class="dist">${st.dist.slice(0, rows).map((n, i) => `<div class="d"><span style="width:14px">${i + 1}</span><div class="bar ${curRow === i ? 'now' : ''}" style="width:${Math.max(7, n / maxD * 100)}%">${n}</div></div>`).join('')}</div>
    ${now ? `<div class="after">${daily ? `<div class="next"><span>Next hex</span><b id="cd">--:--:--</b></div>` : ''}<div class="acts">${onNext ? `<button class="btn primary" id="st-next">${UI.refresh}Next word</button>` : ''}${onShare ? `<button class="btn ${onNext ? 'ghost' : 'primary'}" id="st-share">${UI.share}Share</button>` : ''}</div></div>` : ''}`);
  if (daily) {
    const upd = () => { const c = $('#cd', m.el); if (!c) return clearInterval(iv); const s = 86400 - berlinParts().secs; c.textContent = [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60].map(x => String(x).padStart(2, '0')).join(':'); };
    const iv = setInterval(upd, 1000); upd();
  }
  if (onShare) $('#st-share', m.el).onclick = onShare;
  if (onNext) $('#st-next', m.el).onclick = () => { m.close(); onNext(); };
  return m;
}
function shareGrid(head, rows) {
  const map = prefs.contrast ? { c: '🟧', p: '🟦', a: '⬛' } : { c: '🟥', p: '🟧', a: '⬛' };
  const text = head + '\n\n' + rows.map(r => [...r.m].map(x => map[x]).join('')).join('\n') + '\n' + location.origin + location.pathname;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText(text).then(() => toast('Copied results to clipboard')).catch(() => toast('Could not copy'));
}

async function viewDaily() {
  const { day } = berlinParts();
  const ROWS = 6;
  setTop({ left: backBtn() + `<button class="icon-btn" id="b-help" aria-label="Help">${UI.help}</button>`, right: `<button class="icon-btn" id="b-stats" aria-label="Statistics">${UI.stats}</button><button class="icon-btn" id="b-set" aria-label="Settings">${UI.gear}</button>`, tag: `Daily #${day + 1}` });
  view.innerHTML = '<section class="play solo"></section>';
  const play = $('.play', view);
  const answer = await dailyWord(day);
  const valid = await Words.validSet(5);
  const answers = new Set(await Words.list('answers', 5));
  let st = Object.assign(blankStats(ROWS), store.get('dstats', {}));
  if (st.lastWin != null && st.lastWin < day - 1 && st.cur) { st.cur = 0; store.set('dstats', st); }
  let g = store.get('daily', null);
  if (!g || g.day !== day) g = { day, rows: [], status: 'playing', hard: prefs.hard };
  const save = () => store.set('daily', g);
  const showStats = (now = true) => statsModal({ st, rows: ROWS, now: now && g.status !== 'playing', daily: true, curRow: g.status === 'won' ? g.rows.length - 1 : null,
    answer: g.status === 'lost' ? answer : null,
    onShare: g.status !== 'playing' ? () => shareGrid(`HEXLE #${day + 1} ${g.status === 'won' ? g.rows.length : 'X'}/${ROWS}${g.hard ? '*' : ''}`, g.rows) : null });
  $('#b-help').onclick = () => helpModal(5, ROWS);
  $('#b-stats').onclick = () => showStats();
  $('#b-set').onclick = () => settingsModal({ lockHard: g.rows.length > 0 && g.status === 'playing' });

  const board = new Board({
    len: 5, rows: ROWS,
    onEnter: async (w, rows) => {
      if (!valid.has(w) && !answers.has(w)) return { error: 'Not in word list' };
      if (g.rows.length === 0) g.hard = prefs.hard;
      if (g.hard) { const v = hardViolation(w, rows); if (v) return { error: v }; }
      const m = marks(w, answer);
      g.rows.push({ w, m });
      const won = m === 'c'.repeat(5), lost = !won && g.rows.length >= ROWS;
      if (won || lost) {
        g.status = won ? 'won' : 'lost';
        st.played++;
        if (won) { st.wins++; st.cur = st.lastWin === day - 1 ? st.cur + 1 : 1; st.max = Math.max(st.max, st.cur); st.dist[g.rows.length - 1]++; st.lastWin = day; }
        else st.cur = 0;
        st.last = day; store.set('dstats', st);
        board.locked = true;
      }
      save();
      return { marks: m, after: idx => {
        if (won) { toast(WIN_LINES[idx] || 'Phew', 1800, 'dark'); board.bounce(idx); confetti(30); setTimeout(() => showStats(), 2000); }
        else if (lost) { toast(answer.toUpperCase(), 3000); setTimeout(() => showStats(), 2200); }
      } };
    },
  });
  onTeardown(() => board.destroy());
  play.append(board.el);
  board.restore(g.rows);
  if (g.status !== 'playing') { board.locked = true; setTimeout(() => showStats(), 400); }
  if (!prefs.seenHelp) { prefs.seenHelp = true; savePrefs(); helpModal(5, ROWS); }
}

// ---------------------------------------------------------------- endless
async function viewEndless() {
  setTop({ left: backBtn() + `<button class="icon-btn" id="b-help" aria-label="Help">${UI.help}</button>`, right: `<button class="icon-btn" id="b-stats" aria-label="Statistics">${UI.stats}</button><button class="icon-btn" id="b-set" aria-label="Settings">${UI.gear}</button>`, tag: 'Endless' });
  view.innerHTML = `<section class="play solo">
    <div class="toolbar"><div class="seg" id="e-len"></div><button class="btn ghost small" id="e-words">${UI.list}<span id="e-wl"></span></button><button class="btn ghost small" id="e-give">${UI.flag}Give up</button></div>
    <div id="e-area" style="display:contents"></div></section>`;
  let wl = store.get('wordlist', { source: 'builtin', text: '' });
  let g = store.get('endless', null);
  let board = null;
  const lens = () => wl.source === 'custom' ? ['any', 3, 4, 5, 6, 7, 8, 9, 10] : [4, 5, 6, 7, 8, 'any'];
  let len = g?.lenSel ?? 5;
  const statsKey = () => 'estats-' + (g?.answer?.length || 5);
  const getStats = rows => Object.assign(blankStats(rows), store.get(statsKey(), {}));
  const custom = () => cleanWords(wl.text);

  const renderTools = () => {
    if (!lens().includes(len)) len = wl.source === 'custom' ? 'any' : 5;
    $('#e-len').innerHTML = lens().map(n => `<button data-n="${n}" class="${n === len ? 'on' : ''}">${n === 'any' ? 'Mix' : n}</button>`).join('');
    $('#e-wl').textContent = { builtin: 'Built-in words', mixed: `Built-in + ${custom().length}`, custom: `My ${custom().length} words` }[wl.source];
  };
  const pickAnswer = async () => {
    const want = len === 'any' ? null : len; let pool = [];
    if (wl.source !== 'custom') {
      const ns = want ? [want] : [4, 5, 6, 7, 8];
      for (const n of ns) if (n >= 4 && n <= 8) pool = pool.concat(await Words.list('answers', n));
    }
    if (wl.source !== 'builtin') pool = pool.concat(custom().filter(w => !want || w.length === want));
    pool = [...new Set(pool)];
    if (!pool.length) return null;
    const recent = new Set(store.get('erecent', []));
    const fresh = pool.filter(w => !recent.has(w));
    const w = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length ? fresh : pool).length)];
    store.set('erecent', [...recent, w].slice(-300));
    return w;
  };
  const newGame = async () => {
    const answer = await pickAnswer();
    if (!answer) { toast('No words of that length in your list', 2200); return; }
    g = { answer, rows: [], status: 'playing', hard: prefs.hard, lenSel: len }; store.set('endless', g);
    mount();
  };
  const finish = (won) => {
    const rows = g.answer.length + 1;
    const st = getStats(rows);
    st.played++;
    if (won) { st.wins++; st.cur++; st.max = Math.max(st.max, st.cur); st.dist[g.rows.length - 1] = (st.dist[g.rows.length - 1] || 0) + 1; } else st.cur = 0;
    store.set(statsKey(), st);
  };
  const showStats = (now = true) => {
    const rows = (g?.answer?.length || 5) + 1;
    statsModal({ title: `${g?.answer?.length || 5}-letter stats`, st: getStats(rows), rows, now: now && g?.status !== 'playing', curRow: g?.status === 'won' ? g.rows.length - 1 : null,
      answer: g?.status === 'lost' ? g.answer : null, onNext: newGame,
      onShare: g?.status !== 'playing' ? () => shareGrid(`HEXLE Endless ${g.status === 'won' ? g.rows.length : 'X'}/${rows}`, g.rows) : null });
  };
  const mount = async () => {
    board?.destroy();
    const area = $('#e-area'); area.innerHTML = '';
    const n = g.answer.length, ROWS = n + 1;
    const valid = n >= 4 && n <= 8 ? await Words.validSet(n) : new Set();
    const extra = new Set(custom());
    board = new Board({
      len: n, rows: ROWS,
      onEnter: async (w, rows) => {
        if (w !== g.answer && !valid.has(w) && !extra.has(w)) return { error: 'Not in word list' };
        if (g.rows.length === 0) g.hard = prefs.hard;
        if (g.hard) { const v = hardViolation(w, rows); if (v) return { error: v }; }
        const m = marks(w, g.answer);
        g.rows.push({ w, m });
        const won = m === 'c'.repeat(n), lost = !won && g.rows.length >= ROWS;
        if (won || lost) { g.status = won ? 'won' : 'lost'; finish(won); board.locked = true; }
        store.set('endless', g);
        return { marks: m, after: idx => {
          if (won) { toast(WIN_LINES[idx] || 'Phew', 1800, 'dark'); board.bounce(idx); confetti(24); setTimeout(() => showStats(), 1800); }
          else if (lost) { toast(g.answer.toUpperCase(), 3000); setTimeout(() => showStats(), 2000); }
          $('#e-give').hidden = g.status !== 'playing';
        } };
      },
    });
    area.append(board.el);
    board.restore(g.rows);
    if (g.status !== 'playing') board.locked = true;
    $('#e-give').hidden = g.status !== 'playing';
  };
  onTeardown(() => board?.destroy());
  // "Enter" after a finished game → next word
  const onKey = e => { if (e.key === 'Enter' && g?.status !== 'playing' && !openModals && !e.target.closest('input,textarea')) { e.preventDefault(); newGame(); } };
  document.addEventListener('keydown', onKey); onTeardown(() => document.removeEventListener('keydown', onKey));

  $('#e-len').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; len = b.dataset.n === 'any' ? 'any' : +b.dataset.n; renderTools(); if (!g || g.status !== 'playing' || g.rows.length === 0) newGame(); else toast('New length applies to your next word'); };
  $('#e-words').onclick = () => wordListModal(wl, { onSave: v => { wl = v; store.set('wordlist', wl); renderTools(); if (!g || g.rows.length === 0 || g.status !== 'playing') newGame(); else toast('Word list applies to your next word', 1800); } });
  $('#e-give').onclick = () => { if (!g || g.status !== 'playing') return; g.status = 'lost'; finish(false); store.set('endless', g); board.locked = true; $('#e-give').hidden = true; toast(g.answer.toUpperCase(), 3000); setTimeout(() => showStats(), 900); };
  $('#b-help').onclick = () => helpModal(g?.answer?.length || 5, (g?.answer?.length || 5) + 1);
  $('#b-stats').onclick = () => showStats();
  $('#b-set').onclick = () => settingsModal({ lockHard: g?.rows.length > 0 && g?.status === 'playing' });
  renderTools();
  if (g?.answer) mount(); else await newGame();
}

// ---------------------------------------------------------------- home
function viewHome() {
  setTop({ right: `<button class="icon-btn" id="b-help" aria-label="Help">${UI.help}</button><button class="icon-btn" id="b-set" aria-label="Settings">${UI.gear}</button>` });
  const { day } = berlinParts();
  const st = store.get('dstats', {}); const dg = store.get('daily', {});
  const doneToday = dg.day === day && dg.status !== 'playing';
  const streak = st.lastWin != null && st.lastWin >= day - 1 ? st.cur : 0;
  view.innerHTML = `<section class="home">
    <div class="hero">
      <div class="tiles">${[...'hexle'].map((c, i) => `<div class="tile revealed ${'cpcac'[i]}" style="animation-delay:${i * .12}s">${c}</div>`).join('')}</div>
      <h1 class="big">HEXLE</h1>
      <p>Six tries. One cursed word. Crack it before the candles burn out — alone, forever, or against your whole coven.</p>
    </div>
    <div class="modes">
      <a class="mode-card" href="#/daily" style="--accent:linear-gradient(160deg,rgba(255,46,91,.22),transparent 60%)">
        <span class="art">${icon('moon')}</span><span class="kicker">Once per day</span><h3>Daily Hex</h3>
        <p>Everyone gets the same five-letter word. Keep your streak alive.</p>
        <span class="meta"><span class="pill ${doneToday ? '' : 'hot'}">${doneToday ? 'Done for today' : `Hex #${day + 1} is ready`}</span><span class="pill">${icon('candle')}Streak ${streak}</span></span>
      </a>
      <a class="mode-card" href="#/endless" style="--accent:linear-gradient(160deg,rgba(255,122,26,.2),transparent 60%)">
        <span class="art">${icon('pumpkin')}</span><span class="kicker">Infinite</span><h3>Endless Night</h3>
        <p>Solve one, summon the next. 3–10 letters, or bring your own word list.</p>
        <span class="meta"><span class="pill">${icon('cauldron')}Custom words</span><span class="pill">${icon('skull')}4–8 letters</span></span>
      </a>
      <a class="mode-card" href="#/mp" style="--accent:linear-gradient(160deg,rgba(155,61,214,.24),transparent 60%)">
        <span class="art">${icon('ghost')}</span><span class="kicker">Multiplayer</span><h3>The Coven</h3>
        <p>Rooms, invite links, timers, rounds and live chat. Fewest guesses takes the point.</p>
        <span class="meta"><span class="pill hot">${icon('bat')}Live</span><span class="pill">${icon('heart')}Up to 16</span></span>
      </a>
    </div>
    <div class="foot">Happy Halloween ${icon('pumpkin')} &nbsp;·&nbsp; new daily hex at midnight (Berlin)</div>
  </section>`;
  $('#b-help').onclick = () => helpModal();
  $('#b-set').onclick = () => settingsModal();
}

// ---------------------------------------------------------------- emoji picker
const EMOJI = {
  spooky: '🎃 👻 💀 ☠️ 🦇 🕷️ 🕸️ 🧛 🧟 🧙 🧌 👹 👺 😈 👿 🔮 🕯️ 🪦 ⚰️ 🌕 🌑 🐈‍⬛ 🍬 🍭 🍫 🧹 🩸 🔪 🗡️ 🧪 🌙 ⭐'.split(' '),
  faces: '😂 🤣 😭 😅 😊 😍 🥰 😘 😎 🤓 🤔 🤨 😐 🙄 😏 😬 😳 🥺 😤 😡 🤯 😱 😴 🤤 🤡 🥳 🫠 🫡 😶 🤫 🤭 😇'.split(' '),
  hands: '👍 👎 👏 🙌 🙏 🤝 💪 👀 🫶 ✌️ 🤞 🤘 👌 🤌 👋 ✋ 🖤 ❤️ 🩷 💜 🧡 💔 💯 🔥 ✨ 💥 💫 ⚡ 🎉 🏆 🥇 👑'.split(' '),
};
const QUICK = [':heart:', '💀', '😂', '🔥'];
let pickerEl = null;
function closePicker() { pickerEl?.remove(); pickerEl = null; document.removeEventListener('mousedown', pickerAway, true); }
function pickerAway(e) { if (pickerEl && !pickerEl.contains(e.target)) closePicker(); }
function openPicker(anchor, onPick) {
  closePicker();
  const tabs = [['hexle', icon('pumpkin')], ['spooky', '🦇'], ['faces', '😈'], ['hands', '🖤']];
  pickerEl = h(`<div class="picker"><div class="ptabs">${tabs.map(([k, l], i) => `<button data-t="${k}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div><div class="pgrid"></div><div class="plabel">&nbsp;</div></div>`);
  const grid = $('.pgrid', pickerEl), label = $('.plabel', pickerEl);
  const show = t => {
    $$('.ptabs button', pickerEl).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    grid.innerHTML = t === 'hexle' ? window.ICON_NAMES.map(n => `<button data-v=":${n}:" title=":${n}:">${icon(n)}</button>`).join('')
      : EMOJI[t].map(e => `<button data-v="${e}">${e}</button>`).join('');
  };
  show('hexle');
  $('.ptabs', pickerEl).onclick = e => { const t = e.target.closest('[data-t]'); if (t) show(t.dataset.t); };
  grid.onmouseover = e => { const v = e.target.closest('[data-v]')?.dataset.v; label.textContent = v?.startsWith(':') ? v : ' '; };
  grid.onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v) { onPick(v); if (!e.shiftKey) closePicker(); } };
  document.body.append(pickerEl);
  const r = anchor.getBoundingClientRect(), pw = pickerEl.offsetWidth, ph = pickerEl.offsetHeight;
  pickerEl.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
  pickerEl.style.top = (r.top - ph - 8 > 8 ? r.top - ph - 8 : Math.min(window.innerHeight - ph - 8, r.bottom + 8)) + 'px';
  setTimeout(() => document.addEventListener('mousedown', pickerAway, true));
}
const reactHtml = v => v.startsWith(':') ? icon(v.slice(1, -1)) : esc(v);

// ---------------------------------------------------------------- chat
class Chat {
  constructor(code, { onAction } = {}) {
    this.code = code; this.onAction = onAction; this.people = {}; this.nodes = new Map(); this.reply = null; this.lastTyping = 0; this.unread = 0; this.lastId = 0;
    this.el = h(`<div class="chat">
      <div class="msgs" aria-live="polite"></div>
      <button class="btn small primary jump" hidden>New messages ↓</button>
      <div class="typing"></div>
      <div class="composer">
        <div class="replying" hidden><span></span><button class="icon-btn" style="width:26px;height:26px" aria-label="Cancel reply">${UI.x}</button></div>
        <div class="compose-row" style="position:relative">
          <textarea rows="1" maxlength="500" placeholder="Say something spooky…"></textarea>
          <button class="icon-btn emo" aria-label="Emotes">${UI.smile}</button>
          <button class="icon-btn snd" aria-label="Send">${UI.send}</button>
        </div>
      </div></div>`);
    this.list = $('.msgs', this.el); this.ta = $('textarea', this.el); this.jump = $('.jump', this.el);
    this.ta.addEventListener('keydown', e => this.onKey(e));
    this.ta.addEventListener('input', () => { this.autosize(); this.mentionPop(); if (Date.now() - this.lastTyping > 2500 && this.ta.value.trim()) { this.lastTyping = Date.now(); api('typing', { code: this.code }).catch(() => {}); } });
    $('.snd', this.el).onclick = () => this.send();
    $('.emo', this.el).onclick = e => openPicker(e.currentTarget, v => this.insert(v + ' '));
    $('.replying button', this.el).onclick = () => this.setReply(null);
    this.list.addEventListener('scroll', () => { if (this.atBottom()) { this.jump.hidden = true; } });
    this.jump.onclick = () => this.scrollDown(true);
    this.list.addEventListener('click', e => this.onClick(e));
  }
  atBottom() { return this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 60; }
  scrollDown(smooth) { this.list.scrollTo({ top: this.list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); this.jump.hidden = true; }
  autosize() { this.ta.style.height = 'auto'; this.ta.style.height = Math.min(120, this.ta.scrollHeight) + 'px'; }
  insert(t) { const s = this.ta.selectionStart ?? this.ta.value.length; this.ta.value = this.ta.value.slice(0, s) + t + this.ta.value.slice(this.ta.selectionEnd ?? s); this.ta.focus(); this.ta.selectionStart = this.ta.selectionEnd = s + t.length; this.autosize(); }
  who(pid) { return this.people[pid] || { id: pid, name: 'Someone', color: '#8a5a72', icon: 'ghost' }; }
  setReply(m) {
    this.reply = m; const bar = $('.replying', this.el);
    bar.hidden = !m;
    if (m) { $('span', bar).innerHTML = `Replying to <b>${esc(this.who(m.pid).name)}</b> — ${this.render(m.text, true)}`; this.ta.focus(); }
  }
  render(text, plain = false) {
    let s = esc(text);
    s = s.replace(/:([a-z]+):/g, (all, n) => window.ICONS[n] ? icon(n) : all);
    if (!plain) {
      const names = Object.values(this.people).map(p => p.name).filter(Boolean).sort((a, b) => b.length - a.length);
      for (const n of names) { const en = esc(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); s = s.replace(new RegExp('@' + en + '(?![\\w])', 'gi'), m => `<span class="at">${m}</span>`); }
    }
    return s;
  }
  onKey(e) {
    const pop = $('.mention-pop', this.el);
    if (pop && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      const items = $$('button', pop); let i = items.findIndex(b => b.classList.contains('on'));
      e.preventDefault();
      if (e.key === 'Escape') return pop.remove();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { items[i]?.classList.remove('on'); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[i].classList.add('on'); return; }
      return items[i]?.click();
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    if (e.key === 'Escape' && this.reply) this.setReply(null);
  }
  mentionPop() {
    $('.mention-pop', this.el)?.remove();
    const v = this.ta.value.slice(0, this.ta.selectionStart); const m = v.match(/@([^\s@]{0,20})$/);
    if (!m) return;
    const q = m[1].toLowerCase();
    const list = Object.values(this.people).filter(p => p.id !== ident.pid && p.name.toLowerCase().startsWith(q)).slice(0, 6);
    if (!list.length) return;
    const pop = h(`<div class="mention-pop">${list.map((p, i) => `<button data-n="${esc(p.name)}" class="${i ? '' : 'on'}">${avatar(p, 24)}${esc(p.name)}</button>`).join('')}</div>`);
    pop.onmousedown = e => e.preventDefault();
    pop.onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; const s = this.ta.selectionStart; const start = s - m[0].length; this.ta.value = this.ta.value.slice(0, start) + '@' + b.dataset.n + ' ' + this.ta.value.slice(s); this.ta.selectionStart = this.ta.selectionEnd = start + b.dataset.n.length + 2; pop.remove(); this.ta.focus(); };
    $('.compose-row', this.el).append(pop);
  }
  async send() {
    const text = this.ta.value.trim(); if (!text) return;
    const reply = this.reply?.id;
    this.ta.value = ''; this.autosize(); this.setReply(null); $('.mention-pop', this.el)?.remove();
    try { await api('chat', { code: this.code, text, reply }); this.stick = true; this.onAction?.(); }
    catch (e) { toast(e.message); this.ta.value = text; }
  }
  async react(id, emoji) { try { await api('react', { code: this.code, msg: id, emoji }); this.onAction?.(); } catch (e) { toast(e.message); } }
  onClick(e) {
    const msgEl = e.target.closest('.msg'); if (!msgEl) return;
    const id = +msgEl.dataset.id; const m = this.byId?.get(id);
    const t = e.target.closest('[data-act]');
    if (t) {
      const act = t.dataset.act;
      if (act === 'reply') this.setReply(m);
      else if (act === 'del') api('delmsg', { code: this.code, msg: id }).then(() => this.onAction?.()).catch(err => toast(err.message));
      else if (act === 'pick') { msgEl.classList.add('tools-open'); openPicker(t, v => { msgEl.classList.remove('tools-open'); this.react(id, v); }); const done = () => msgEl.classList.remove('tools-open'); setTimeout(() => document.addEventListener('mousedown', done, { once: true }), 0); }
      else if (act === 'q') this.react(id, t.dataset.v);
      else if (act === 'r') this.react(id, t.dataset.v);
      return;
    }
    const q = e.target.closest('.quote');
    if (q) { const target = this.nodes.get(+q.dataset.to); if (target) { target.node.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.node.classList.remove('flash'); void target.node.offsetWidth; target.node.classList.add('flash'); } }
  }
  update(messages, people, { canModerate = false, visible = true } = {}) {
    this.people = people; this.canModerate = canModerate;
    this.byId = new Map(messages.map(m => [m.id, m]));
    const stick = this.stick || this.atBottom() || !this.nodes.size; this.stick = false;
    let ref = this.list.firstChild, prev = null, added = 0;
    const seen = new Set();
    for (const m of messages) {
      const cont = prev && prev.kind === 'user' && m.kind === 'user' && prev.pid === m.pid && m.at - prev.at < 180000 && !m.reply;
      const p = this.who(m.pid);
      const sig = JSON.stringify([m.text, m.del, m.re, cont, p.name, p.color, p.icon, p.av, canModerate, m.reply?.text]);
      let rec = this.nodes.get(m.id);
      if (!rec || rec.sig !== sig) {
        const node = this.msgNode(m, cont);
        if (rec) rec.node.replaceWith(node); else added++;
        if (rec && ref === rec.node) ref = node;
        rec = { node, sig }; this.nodes.set(m.id, rec);
      }
      if (rec.node !== ref) this.list.insertBefore(rec.node, ref); else ref = ref.nextSibling;
      seen.add(m.id); prev = m;
    }
    for (const [id, rec] of this.nodes) if (!seen.has(id)) { rec.node.remove(); this.nodes.delete(id); }
    const newest = messages.length ? messages[messages.length - 1].id : 0;
    if (this.lastId && newest > this.lastId && !visible) this.unread += messages.filter(m => m.id > this.lastId && m.pid !== ident.pid).length;
    this.lastId = newest;
    if (stick) this.scrollDown(false); else if (added) this.jump.hidden = false;
    if (!messages.length) this.list.innerHTML = `<div class="empty">${icon('web')}<div>No messages yet. Break the silence.</div></div>`, this.nodes.clear();
    else $('.empty', this.list)?.remove();
    const typers = Object.values(people).filter(p => p.typing && p.id !== ident.pid).map(p => p.name);
    $('.typing', this.el).innerHTML = typers.length ? `<span class="dots"><i></i><i></i><i></i></span> ${esc(typers.slice(0, 3).join(', '))} ${typers.length > 1 ? 'are' : 'is'} typing…` : '';
  }
  msgNode(m, cont) {
    if (m.kind === 'system') return h(`<div class="msg sys" data-id="${m.id}"><div class="tx">${this.render(m.text, true)}</div></div>`);
    const p = this.who(m.pid);
    const mine = m.pid === ident.pid;
    const mention = !mine && profile.name && new RegExp('@' + profile.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])', 'i').test(m.text);
    const onlyEmotes = !m.del && /^(\s*:[a-z]+:\s*){1,3}$/.test(m.text) && [...m.text.matchAll(/:([a-z]+):/g)].every(x => window.ICONS[x[1]]);
    const re = Object.entries(m.re || {});
    const quote = m.reply ? `<div class="quote" data-to="${m.reply.id}"><b>${esc(this.who(m.reply.pid).name)}</b> ${m.reply.text ? this.render(m.reply.text, true) : '<i>deleted message</i>'}</div>` : '';
    return h(`<div class="msg ${cont ? 'cont' : ''} ${mention ? 'mention' : ''}" data-id="${m.id}">
      ${avatar(p, 36)}
      <div style="min-width:0">
        ${quote}
        <div class="mh"><span class="who">${nameSpan(p)}</span><span class="when">${fmtClock(new Date(m.at))}</span></div>
        <div class="tx ${m.del ? 'deleted' : ''} ${onlyEmotes ? 'jumbo' : ''}">${m.del ? 'message deleted' : this.render(m.text)}</div>
        ${re.length ? `<div class="reacts">${re.map(([e, ids]) => `<button class="react ${ids.includes(ident.pid) ? 'mine' : ''}" data-act="r" data-v="${esc(e)}" title="${esc(ids.map(i => this.who(i).name).join(', '))}">${reactHtml(e)}<small>${ids.length}</small></button>`).join('')}</div>` : ''}
      </div>
      ${m.del ? '' : `<div class="tools">${QUICK.map(q => `<button data-act="q" data-v="${q}" title="React">${reactHtml(q)}</button>`).join('')}<button data-act="pick" title="Add reaction">${UI.smile}</button><button data-act="reply" title="Reply">${UI.reply}</button>${mine || this.canModerate ? `<button data-act="del" title="Delete">${UI.trash}</button>` : ''}</div>`}
    </div>`);
  }
}

// ---------------------------------------------------------------- polling helper
function poller(fn, base) {
  let stopped = false, t = null, now = false;
  const loop = async () => {
    if (stopped) return;
    try { await fn(); } catch (e) { /* surfaced by fn */ }
    if (stopped) return;
    t = setTimeout(loop, now ? 0 : document.hidden ? base * 3 : base); now = false;
  };
  loop();
  return { stop() { stopped = true; clearTimeout(t); }, kick() { clearTimeout(t); now = false; t = setTimeout(loop, 60); } };
}

// ---------------------------------------------------------------- settings form (rooms)
const DEFAULT_ROOM = { len: 5, maxPlayers: 8, rounds: 5, guesses: 6, timer: 0, intermission: 8, hard: false, scoring: 'winner', tiebreak: true, source: 'builtin', custom: [], anyGuess: false, public: true };
function settingsForm(s, { editable, onChange }) {
  s = { ...DEFAULT_ROOM, ...s };
  const el = h('<div class="settings-grid"></div>');
  const seg = (key, opts, label) => `<div class="field"><span>${label}</span><div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}</div></div>`;
  const sw = (key, t, d) => `<div class="row-set"><div><div class="t">${t}</div><div class="d">${d}</div></div><label class="switch"><input type="checkbox" data-sw="${key}" ${s[key] ? 'checked' : ''} ${editable ? '' : 'disabled'}><i></i></label></div>`;
  const timers = [[0, '∞'], [30, '30s'], [60, '1m'], [90, '90s'], [120, '2m'], [180, '3m'], [300, '5m']];
  const customTimer = s.timer && !timers.some(([v]) => v === s.timer);
  const lenOpts = s.source === 'custom' ? [3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, n]).concat([['any', 'Mix']]) : [4, 5, 6, 7, 8].map(n => [n, n]).concat([['any', 'Mix']]);
  const count = s.customCount ?? s.custom?.length ?? 0;
  el.innerHTML = `
    ${seg('len', lenOpts, 'Word length')}
    ${seg('rounds', [1, 3, 5, 7, 10, 15].map(n => [n, n]), 'Rounds')}
    ${seg('guesses', [4, 5, 6, 7, 8, 10].map(n => [n, n]), 'Guesses per round')}
    ${seg('maxPlayers', [2, 4, 6, 8, 12, 16].map(n => [n, n]), 'Max players')}
    <div class="field"><span>Round timer</span><div class="seg" data-k="timer">${timers.map(([v, l]) => `<button data-v="${v}" class="${!customTimer && s.timer === v ? 'on' : ''}" ${editable ? '' : 'disabled'}>${l}</button>`).join('')}<button data-v="custom" class="${customTimer ? 'on' : ''}" ${editable ? '' : 'disabled'}>Custom</button></div>
      <div class="timer-input" ${customTimer ? '' : 'hidden'}><input class="input" type="number" min="10" max="3600" value="${s.timer || 150}" ${editable ? '' : 'disabled'}><span style="color:var(--muted);font-size:14px">seconds</span></div></div>
    ${seg('intermission', [[5, '5s'], [8, '8s'], [12, '12s'], [20, '20s'], [30, '30s']], 'Break between rounds')}
    ${seg('scoring', [['winner', 'Fewest guesses: 1 pt'], ['ranked', 'Top 3: 3 · 2 · 1']], 'Scoring')}
    <div class="field"><span>Words</span><button class="btn ghost" data-words style="justify-content:flex-start">${UI.list}${{ builtin: 'Built-in words', mixed: `Built-in + ${count} custom`, custom: `Custom list · ${count} words` }[s.source]}</button></div>
    <div class="full">
      ${sw('tiebreak', 'Speed breaks ties', 'Same number of guesses? The faster solver takes the point')}
      ${sw('hard', 'Hard mode', 'Revealed hints must be used in later guesses')}
      ${sw('anyGuess', 'Allow any guess', 'Skip the dictionary check (good for names / made-up custom words)')}
      ${sw('public', 'Public room', 'Show this room on the Coven dashboard. Private rooms are invite-link only')}
    </div>`;
  if (!editable) return el;
  const emit = () => onChange({ ...s });
  el.addEventListener('click', e => {
    const b = e.target.closest('.seg button'); if (b) {
      const k = b.closest('.seg').dataset.k; let v = b.dataset.v;
      if (k === 'timer' && v === 'custom') { $$('.seg[data-k=timer] button', el).forEach(x => x.classList.toggle('on', x === b)); $('.timer-input', el).hidden = false; $('.timer-input input', el).focus(); s.timer = +$('.timer-input input', el).value || 150; return emit(); }
      s[k] = v === 'any' ? 'any' : isNaN(+v) ? v : +v;
      $$('button', b.closest('.seg')).forEach(x => x.classList.toggle('on', x === b));
      if (k === 'timer') $('.timer-input', el).hidden = true;
      return emit();
    }
    if (e.target.closest('[data-words]')) {
      wordListModal({ source: s.source, text: (s.custom || []).join(' ') }, { onSave: v => {
        s.source = v.source; s.custom = cleanWords(v.text); s.customCount = s.custom.length;
        if (s.source !== 'custom' && (s.len === 'any' ? false : s.len < 4 || s.len > 8)) s.len = 5;
        el.replaceWith(settingsForm(s, { editable, onChange })); onChange({ ...s });
      } });
    }
  });
  el.addEventListener('change', e => {
    if (e.target.dataset.sw) { s[e.target.dataset.sw] = e.target.checked; emit(); }
    if (e.target.closest('.timer-input')) { s.timer = Math.max(10, Math.min(3600, +e.target.value || 60)); e.target.value = s.timer; emit(); }
  });
  return el;
}
const settingsSummary = s => [s.len === 'any' ? 'Mixed length' : `${s.len} letters`, `${s.rounds} rounds`, s.timer ? fmtTime(s.timer * 1000) : '∞ time', s.hard ? 'Hard' : null, s.source !== 'builtin' ? 'Custom words' : null].filter(Boolean);

// ---------------------------------------------------------------- dashboard
function viewDashboard() {
  setTop({ left: backBtn(), tag: 'The Coven' });
  view.innerHTML = `<section class="dash">
    <div style="min-width:0;display:flex;flex-direction:column">
      <div class="panel dash-top">
        <div><h1>The Coven</h1><p>Summon a room, share the invite link, and race your friends to the cursed word.</p>
          <div class="join-row"><button class="btn primary" id="d-new">${UI.plus}Create room</button><input class="input" id="d-code" maxlength="5" placeholder="CODE" aria-label="Room code"><button class="btn ghost" id="d-join">Join</button></div></div>
      </div>
      <div class="panel" style="flex:1">
        <div class="panel-h"><h2>${icon('candle')}Open rooms</h2><span class="pill" id="d-online">… online</span></div>
        <div class="panel-b"><div class="rooms" id="d-rooms"><div class="empty">${icon('cauldron')}<div>Brewing…</div></div></div></div>
      </div>
    </div>
    <div class="panel" style="display:flex;flex-direction:column;min-height:520px;max-height:calc(100dvh - var(--header-h) - 48px)">
      <div class="panel-h"><h2>${icon('grave')}Graveyard chat</h2></div>
      <div id="d-chat" style="flex:1;display:flex;min-height:0"></div>
    </div>
  </section>`;
  const chat = new Chat('*', { onAction: () => p.kick() });
  $('#d-chat').append(chat.el);
  let etag = '';
  const p = poller(async () => {
    let d;
    try { await hello(); d = await api('lobby', { etag }); } catch (e) { $('#d-rooms').innerHTML = `<div class="empty">${icon('skull')}<div>${esc(e.message)}</div><div style="font-size:13px">Multiplayer needs the PHP server (api.php).</div></div>`; return; }
    if (d.same) return;
    etag = d.etag;
    const people = {};
    for (const g of d.ghosts) people[g.id] = { ...g, av: +g.av };
    for (const o of d.online) people[o.id] = o;
    people[ident.pid] = { ...people[ident.pid], ...profile, id: ident.pid };
    $('#d-online').textContent = `${d.online.length} online`;
    $('#d-rooms').innerHTML = d.rooms.length ? d.rooms.map(r => `<button class="room-card" data-code="${esc(r.code)}">
        <div class="top">${r.host ? avatar(r.host, 34) : ''}<div style="min-width:0;flex:1"><div class="nm">${esc(r.name)}</div><div class="by">${r.host ? 'by ' + esc(r.host.name) : ''}</div></div><span class="status ${r.state}">${{ lobby: 'Waiting', playing: `Round ${r.round}`, intermission: `Round ${r.round}`, podium: 'Finished' }[r.state]}</span></div>
        <div class="tags"><span class="pill">${icon('ghost')}${r.players}/${r.max}</span>${settingsSummary({ ...r }).map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>
      </button>`).join('') : `<div class="empty" style="grid-column:1/-1">${icon('ghost')}<div>No open rooms right now.</div><div style="font-size:13px">Create one and invite your coven.</div></div>`;
    chat.update(d.chat, people);
  }, 2500);
  onTeardown(() => p.stop());
  $('#d-rooms').onclick = e => { const c = e.target.closest('[data-code]')?.dataset.code; if (c) location.hash = '#/r/' + c; };
  const join = () => { const c = $('#d-code').value.trim().toUpperCase(); if (c.length >= 4) location.hash = '#/r/' + c; else toast('Enter a room code'); };
  $('#d-join').onclick = join;
  $('#d-code').onkeydown = e => { if (e.key === 'Enter') join(); };
  $('#d-new').onclick = () => createRoomModal();
}
function createRoomModal() {
  let s = { ...DEFAULT_ROOM, ...store.get('roomSettings', {}) };
  const body = h(`<div><h2>Summon a room</h2><label class="field" style="margin-bottom:18px"><span>Room name</span><input class="input" id="c-name" maxlength="32" placeholder="${esc((profile.name || 'Ghost') + "'s crypt")}"></label><div id="c-form"></div><div style="margin-top:22px"><button class="btn primary block" id="c-go">${UI.play}Create room</button></div></div>`);
  $('#c-form', body).append(settingsForm(s, { editable: true, onChange: v => { s = v; } }));
  const m = modal(body, { wide: true });
  $('#c-go', body).onclick = async e => {
    e.currentTarget.disabled = true;
    try {
      await hello();
      store.set('roomSettings', s);
      const r = await api('create', { name: $('#c-name', body).value, settings: s });
      m.close(); location.hash = '#/r/' + r.code;
    } catch (err) { toast(err.message); e.currentTarget.disabled = false; }
  };
}

// ---------------------------------------------------------------- room
async function viewRoom(code) {
  code = code.toUpperCase();
  setTop({ left: `<button class="icon-btn" id="r-leave" aria-label="Leave room" title="Leave room">${UI.door}</button>`, right: `<button class="icon-btn" id="b-help" aria-label="Help">${UI.help}</button><button class="icon-btn" id="b-set" aria-label="Settings">${UI.gear}</button>`, tag: code });
  $('#b-help').onclick = () => helpModal();
  $('#b-set').onclick = () => settingsModal({ lockHard: true });
  view.innerHTML = `<div class="empty" style="margin-top:80px">${icon('cauldron')}<div>Entering the crypt…</div></div>`;
  try { await hello(); await api('join', { code }); }
  catch (e) {
    view.innerHTML = `<div class="empty" style="margin-top:80px">${icon('grave')}<h2 style="margin:0">${esc(e.message)}</h2><a class="btn primary" href="#/mp">Back to the Coven</a></div>`;
    return;
  }
  $('#r-leave').onclick = async () => { try { await api('leave', { code }); } catch { /* already gone */ } location.hash = '#/mp'; };

  view.innerHTML = `<section class="room" data-tab="game">
    <div class="mtabs"><button data-t="game" class="on">Game</button><button data-t="players">Players</button><button data-t="chat">Chat<span class="badge" hidden></span></button></div>
    <div class="panel players-col"><div class="panel-h"><h2>${icon('ghost')}Players</h2><span class="pill" id="r-count"></span></div><div class="plist" id="r-players"></div></div>
    <div class="panel center"><div class="stage" id="r-stage"></div></div>
    <div class="panel chat-col"><div class="panel-h"><h2>${icon('bat')}Chat</h2></div><div id="r-chat" style="flex:1;display:flex;min-height:0"></div></div>
  </section>`;
  const roomEl = $('.room', view);
  let tab = 'game';
  $('.mtabs', view).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; roomEl.dataset.tab = tab; $$('.mtabs button', view).forEach(x => x.classList.toggle('on', x === b)); if (tab === 'chat') { chat.unread = 0; badge(); chat.scrollDown(); } board?.fit(); };
  const badge = () => { const b = $('.mtabs .badge', view); b.hidden = !chat.unread; b.textContent = chat.unread; };

  let snap = null, etag = '', stageKey = '', board = null, people = {}, lastState = null, kicked = false;
  const chat = new Chat(code, { onAction: () => p.kick() });
  $('#r-chat').append(chat.el);
  const isHost = () => snap?.room.host === ident.pid;
  const act = async (a, body = {}) => { try { await api(a, { code, ...body }); p.kick(); } catch (e) { toast(e.message); } };

  const p = poller(async () => {
    let d;
    try { d = await api('poll', { code, etag }); }
    catch (e) {
      if (e.status === 403 || e.status === 404) {
        if (kicked) return; kicked = true; p.stop();
        view.innerHTML = `<div class="empty" style="margin-top:80px">${icon('grave')}<h2 style="margin:0">${esc(e.message === 'You are not in this room' ? 'You are no longer in this room' : e.message)}</h2><div style="display:flex;gap:8px"><a class="btn ghost" href="#/r/${esc(code)}" onclick="setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')))">Rejoin</a><a class="btn primary" href="#/mp">Back to the Coven</a></div></div>`;
      }
      return;
    }
    if (d.same) { tickClock(); return; }
    etag = d.etag; snap = d;
    people = {};
    for (const g of d.ghosts || []) people[g.id] = { ...g, av: +g.av, gone: true };
    for (const pl of d.players) people[pl.id] = pl;
    render();
  }, 1000);
  onTeardown(() => { p.stop(); board?.destroy(); clearInterval(clockIv); });
  const clockIv = setInterval(() => tickClock(), 250);
  const onProfile = () => { etag = ''; p.kick(); };
  window.addEventListener('hexle:profile', onProfile); onTeardown(() => window.removeEventListener('hexle:profile', onProfile));

  function render() {
    const r = snap.room;
    renderPlayers();
    chat.update(snap.chat, people, { canModerate: isHost(), visible: tab === 'chat' || innerWidth > 760 });
    badge();
    const key = r.state === 'playing' ? `play:${r.game}:${r.round}` : r.state === 'lobby' ? `lobby:${isHost()}` : `${r.state}:${r.game}:${r.round}`;
    if (key !== stageKey) {
      stageKey = key; board?.destroy(); board = null;
      if (r.state === 'lobby') renderLobby();
      if (r.state === 'playing') renderPlaying();
      if (r.state === 'intermission') renderIntermission();
      if (r.state === 'podium') renderPodium();
    } else if (r.state === 'lobby' && !isHost()) renderLobby();
    else if (r.state === 'playing') updatePlaying();
    if (lastState !== r.state && r.state === 'podium') confetti(80);
    lastState = r.state;
    tickClock();
  }

  function sortedPlayers() {
    const r = snap.room, list = snap.players.slice();
    if (r.state !== 'lobby') list.sort((a, b) => (r.scores[b.id] || 0) - (r.scores[a.id] || 0));
    return list;
  }
  function renderPlayers() {
    const r = snap.room, st = snap.board?.status || {}, others = snap.board?.others || {};
    $('#r-count').textContent = `${snap.players.length}/${r.settings.maxPlayers}`;
    $('#r-players').innerHTML = sortedPlayers().map(pl => {
      const s = st[pl.id];
      const inGame = r.state !== 'lobby';
      const sub = !pl.online ? 'offline' : pl.typing ? 'typing…' : r.state === 'playing' && s ? (s.solved ? `solved in ${s.n}` : s.done ? 'out of guesses' : `${s.n}/${r.settings.guesses} guesses`) : r.state === 'playing' ? 'spectating' : 'ready';
      const mini = r.state !== 'lobby' && others[pl.id] ? `<div class="mini">${others[pl.id].map(m => `<div class="mr">${[...m.split(':')[0]].map(x => `<i class="${x}"></i>`).join('')}</div>`).join('')}</div>` : '';
      const hostActs = isHost() && pl.id !== ident.pid ? `<div class="acts"><button data-promote="${pl.id}" title="Make host">${UI.crown}</button><button data-kick="${pl.id}" title="Kick">${UI.kick}</button></div>` : '';
      return `<div class="pl ${pl.id === ident.pid ? 'me' : ''}">
        ${avatar(pl, 40, pl.online ? '' : 'off')}
        <div style="min-width:0"><div class="nm">${nameSpan(pl)}${pl.id === r.host ? `<span title="Host" style="width:16px;height:16px;display:inline-grid">${UI.crown}</span>` : ''}${s?.solved && r.state === 'playing' ? '<span class="done-badge">✓</span>' : s?.done && r.state === 'playing' ? '<span class="done-badge fail">✗</span>' : ''}</div><div class="sub">${sub}</div></div>
        ${hostActs || (inGame ? `<div class="pts">${r.scores[pl.id] || 0}<small>pt</small></div>` : '<div></div>')}
        ${mini}
      </div>`;
    }).join('');
    $('#r-players').onclick = e => {
      const k = e.target.closest('[data-kick]')?.dataset.kick, pr = e.target.closest('[data-promote]')?.dataset.promote;
      if (k && confirm(`Kick ${people[k]?.name}?`)) act('kick', { pid: k });
      if (pr && confirm(`Make ${people[pr]?.name} the host?`)) act('promote', { pid: pr });
    };
  }

  const inviteUrl = () => location.origin + location.pathname + '#/r/' + code;
  function renderLobby() {
    const r = snap.room, host = isHost();
    const stage = $('#r-stage');
    const focusedInside = stage.contains(document.activeElement) && !host;
    if (focusedInside) return;
    stage.innerHTML = `<div class="stage-head"><h2 id="r-name">${esc(r.name)}</h2>${host ? `<button class="btn ghost small" id="r-rename">${UI.edit}Rename</button>` : ''}</div>
      <div class="invite">${UI.link.replace('<svg', '<svg width="18" height="18" style="color:var(--muted)"')}<code>${esc(inviteUrl())}</code><span class="code-big">${esc(code)}</span><button class="btn primary small" id="r-copy">${UI.copy}Copy invite</button></div>
      <div id="r-form" style="width:100%"></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;margin-top:6px">
        ${host ? `<button class="btn primary" id="r-start" style="min-width:220px;height:52px;font-size:17px">${UI.play}Start game</button>` : `<div class="waiting">${icon('candle')} Waiting for ${esc(people[r.host]?.name || 'the host')} to start…</div>`}
      </div>`;
    let pending = null, sendT = null;
    $('#r-form').append(settingsForm(r.settings, { editable: host, onChange: v => {
      pending = v; clearTimeout(sendT);
      sendT = setTimeout(async () => { try { await api('settings', { code, settings: pending }); store.set('roomSettings', pending); p.kick(); } catch (e) { toast(e.message); } }, 350);
    } }));
    $('#r-copy').onclick = () => navigator.clipboard.writeText(inviteUrl()).then(() => toast('Invite link copied', 1400, 'dark')).catch(() => toast(inviteUrl(), 4000));
    if (host) {
      $('#r-start').onclick = async e => { e.currentTarget.disabled = true; if (pending) { clearTimeout(sendT); await api('settings', { code, settings: pending }).catch(() => {}); } act('start'); };
      $('#r-rename').onclick = async () => { const n = prompt('Room name', r.name); if (n && n.trim()) act('settings', { settings: pending || r.settings, name: n.trim() }); };
    }
  }

  function renderPlaying() {
    const r = snap.room, s = r.settings;
    const stage = $('#r-stage');
    const playing = r.participants.includes(ident.pid);
    stage.innerHTML = `<div class="hud"><div class="round">Round <b>${r.round}</b> / ${s.rounds} · ${r.len} letters${s.hard ? ' · hard' : ''}</div><div class="clock" id="r-clock"></div>${isHost() ? `<button class="btn ghost small" id="r-skip">${UI.skip}End round</button>` : ''}</div>
      ${r.ends ? '<div class="timebar"><i id="r-bar"></i></div>' : ''}
      <div id="r-note" class="waiting"></div>
      <div class="play" id="r-play" style="padding:0;max-width:540px;flex:1;min-height:360px"></div>`;
    if (isHost()) $('#r-skip').onclick = () => { if (confirm('End this round for everyone now?')) act('skip'); };
    if (!playing) { $('#r-note').innerHTML = `${icon('eye')} You joined mid-round — watching. You'll play from the next round.`; return; }
    board = new Board({
      len: r.len, rows: s.guesses, maxTile: 58,
      onEnter: async w => {
        try {
          const res = await api('guess', { code, word: w });
          return { marks: res.marks, after: idx => {
            if (res.solved) { toast(WIN_LINES[idx] || 'Solved!', 1600, 'dark'); board.bounce(idx); board.locked = true; }
            else if (res.done) { board.locked = true; toast('Out of guesses', 1600); }
            p.kick(); updatePlaying();
          } };
        } catch (e) { return { error: e.message }; }
      },
    });
    $('#r-play').append(board.el);
    board.restore(snap.board.mine);
    updatePlaying();
  }
  function updatePlaying() {
    const r = snap.room, me = snap.board?.status?.[ident.pid];
    if (board && !board.busy && snap.board.mine.length > board.rows.length) board.restore(snap.board.mine);
    if (board && me?.done) board.locked = true;
    const note = $('#r-note'); if (!note || !board) return;
    const left = Object.entries(snap.board.status).filter(([pid, s]) => !s.done && people[pid]?.online).length;
    note.innerHTML = me?.done ? (me.solved ? `Solved in <b>${me.n}</b>! ` : 'Out of guesses. ') + (left ? `Waiting for ${left} more…` : '') : '';
  }

  function resultRows(h) {
    const ids = Object.keys(h.results);
    ids.sort((a, b) => { const x = h.results[a], y = h.results[b]; return (y.solved - x.solved) || (x.n - y.n) || ((x.ms ?? 1e12) - (y.ms ?? 1e12)); });
    return ids.map((pid, i) => {
      const x = h.results[pid], pl = people[pid] || { name: 'Gone', icon: 'ghost' };
      const win = h.winners.includes(pid), pts = h.points[pid] || 0;
      return `<div class="res ${win ? 'win' : ''}"><span class="place">${win ? UI.crown.replace('<svg', '<svg width="20" height="20"') : i + 1}</span>${avatar({ ...pl, id: pid }, 32)}<span class="nm">${nameSpan(pl)}</span><span class="g">${x.solved ? `${x.n} guess${x.n > 1 ? 'es' : ''} · ${(x.ms / 1000).toFixed(1)}s` : 'X'}</span><span class="plus">${pts ? '+' + pts : ''}</span></div>`;
    }).join('');
  }
  function renderIntermission() {
    const r = snap.room, h = snap.history[snap.history.length - 1];
    $('#r-stage').innerHTML = `<div class="hud"><div class="round">Round <b>${r.round}</b> / ${r.settings.rounds} complete</div>${isHost() ? `<button class="btn primary small" id="r-skip">${UI.skip}Next round now</button>` : ''}</div>
      <div class="reveal-word"><div class="lbl">The word was</div></div>
      <div class="big-word">${[...h.word].map((c, i) => `<div class="tile revealed c" style="animation:heroFlip .6s ${i * .08}s both">${c}</div>`).join('')}</div>
      <div class="result-list">${resultRows(h)}</div>
      <div class="next-in" id="r-next"></div>`;
    if (isHost()) $('#r-skip').onclick = () => act('skip');
  }
  function standings() {
    const r = snap.room;
    const ids = Object.keys(r.scores);
    const totals = {};
    for (const pid of ids) { totals[pid] = { pts: r.scores[pid] || 0, g: 0, ms: 0, solved: 0 }; }
    for (const h of snap.history) for (const [pid, x] of Object.entries(h.results)) { if (!totals[pid]) continue; if (x.solved) { totals[pid].solved++; totals[pid].g += x.n; totals[pid].ms += x.ms; } }
    ids.sort((a, b) => (totals[b].pts - totals[a].pts) || (totals[b].solved - totals[a].solved) || (totals[a].g - totals[b].g) || (totals[a].ms - totals[b].ms));
    return ids.map(id => ({ id, ...totals[id] }));
  }
  function renderPodium() {
    const r = snap.room, host = isHost();
    const st = standings();
    const top = [st[1], st[0], st[2]];
    const pod = (x, place) => x ? `<div class="pod p${place}">${place === 1 ? `<span class="crown-ico">${icon('devil')}</span>` : ''}${avatar({ ...people[x.id], id: x.id }, place === 1 ? 84 : 64)}<div class="nm">${nameSpan(people[x.id])}</div><div class="score">${x.pts} pt · ${x.solved} solved</div><div class="block">${place}</div></div>` : '<div class="pod" style="visibility:hidden"></div>';
    $('#r-stage').innerHTML = `<div class="stage-head"><h2>${icon('heart')} Final results</h2></div>
      <div class="podium">${pod(top[0], 2)}${pod(top[1], 1)}${pod(top[2], 3)}</div>
      <div class="result-list final-table">${st.map((x, i) => { const pl = people[x.id] || { name: 'Gone' }; return `<div class="res ${i === 0 ? 'win' : ''}"><span class="place">${i + 1}</span>${avatar({ ...pl, id: x.id }, 32)}<span class="nm">${nameSpan(pl)}${pl.gone ? ' <small style="color:var(--faint)">(left)</small>' : ''}</span><span class="g">${x.pts} pt · ${x.solved}/${snap.history.length} solved${x.solved ? ' · ⌀ ' + (x.g / x.solved).toFixed(1) : ''}</span></div>`; }).join('')}</div>
      <div class="rounds-sum">${snap.history.map(h => `<span title="Round ${h.round}">${esc(h.word)}</span>`).join('')}</div>
      <div class="end-acts">
        ${host ? `<button class="btn primary" id="r-again">${UI.refresh}Play again</button><button class="btn ghost" id="r-lobby">${UI.gear}Change settings</button>` : `<div class="waiting">${icon('candle')} The host can start a rematch…</div>`}
        <a class="btn ghost" href="#/mp" id="r-dash">${UI.door}Back to the Coven</a>
      </div>`;
    if (host) { $('#r-again').onclick = () => act('start'); $('#r-lobby').onclick = () => act('tolobby'); }
    $('#r-dash').onclick = async e => { e.preventDefault(); await api('leave', { code }).catch(() => {}); location.hash = '#/mp'; };
  }

  function tickClock() {
    if (!snap) return;
    const r = snap.room, now = serverNow();
    const c = $('#r-clock');
    if (c) {
      if (r.ends) { const left = r.ends - now; c.innerHTML = UI.clock + fmtTime(left); c.classList.toggle('low', left < 10000); const bar = $('#r-bar'); if (bar) bar.style.width = Math.max(0, Math.min(100, left / (r.settings.timer * 1000) * 100)) + '%'; if (left < -1500) p.kick(); }
      else c.innerHTML = UI.clock + '∞';
    }
    const n = $('#r-next');
    if (n && r.interEnds) { const left = r.interEnds - now; n.textContent = left > 0 ? `Next round in ${Math.ceil(left / 1000)}…` : 'Summoning next round…'; if (left < -1500) p.kick(); }
  }
}

// ---------------------------------------------------------------- router
function route() {
  teardown.forEach(f => { try { f(); } catch { /* ignore */ } }); teardown = [];
  closePicker(); activeBoard = null; [...modalClosers].forEach(c => c());
  window.scrollTo(0, 0);
  const hsh = location.hash.replace(/^#\/?/, '');
  const [a, b] = hsh.split('/');
  if (a === 'daily') return viewDaily();
  if (a === 'endless') return viewEndless();
  if (a === 'mp') return viewDashboard();
  if (a === 'r' && b) return viewRoom(b);
  return viewHome();
}
window.addEventListener('hashchange', route);
route();
hello().catch(() => { /* offline: solo modes still work */ });
})();
