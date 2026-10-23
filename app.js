/* Proven Portal — interfaz. Todo el texto de usuarios se inserta como texto (nunca HTML). */
(function () {
  'use strict';
  const API = window.API;
  const root = document.getElementById('app');

  /* ---------- utilidades DOM ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const late = [];
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') late.push([k, v]);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(el, arguments[i]);
    late.forEach(([k, v]) => { el[k] = v; });
    return el;
  }
  /* replaceChildren crudo convierte null en el texto "null"; esto lo filtra. */
  function fill(el, ...kids) { while (el.firstChild) el.removeChild(el.firstChild); kids.forEach((k) => add(el, k)); return el; }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach((x) => add(el, x)); return; }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  const ICONS = {
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    edit: '<path d="M4 20h4l11-11-4-4L4 16z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  };
  function ico(n, s) {
    const e = h('span', { class: 'ico', 'aria-hidden': 'true' });
    e.innerHTML = '<svg viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
    return e;
  }
  const spin = () => h('div', { class: 'spin', role: 'status', 'aria-label': 'loading' });
  const ini = (n) => (String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('') || '?').toUpperCase();
  const safeUrl = (u) => (/^(https?:|data:image\/|blob:)/.test(u) ? u : '#');

  /* ---------- estado ---------- */
  function getLang() {
    try { const v = localStorage.getItem('pp_lang'); if (v === 'es' || v === 'en') return v; } catch (e) { /* ok */ }
    return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
  }
  const S = { lang: getLang(), user: null, me: null, tab: null, projectId: null, ptab: 'feed', authTab: 'in', recovery: false, timers: [], ts: { mode: 'week', anchor: new Date(), person: '', project: '' }, rc: { anchor: new Date(), project: '' } };
  const t = (k, v) => window.t(S.lang, k, v);
  const setLang = (l) => { S.lang = l; try { localStorage.setItem('pp_lang', l); } catch (e) { /* ok */ } render(); };
  const clearTimers = () => { S.timers.forEach(clearInterval); S.timers = []; };
  const isStaff = () => !!S.me && (S.me.is_admin || S.me.is_office);
  const isAdmin = () => !!S.me && S.me.is_admin;
  const isFinance = () => !!S.me && (S.me.is_admin || S.me.is_finance);
  const isViewer = () => !!S.me && (S.me.is_admin || S.me.is_office || S.me.is_finance);

  /* ---------- formato ---------- */
  const loc = () => (S.lang === 'es' ? 'es-US' : 'en-US');
  const fDate = (d, o) => new Intl.DateTimeFormat(loc(), o || { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(d));
  const fTime = (d) => new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(new Date(d));
  const fDT = (d) => fDate(d) + ' · ' + fTime(d);
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
  const hm = (min) => { const m = Math.max(0, Math.round(min)); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const toLocalInput = (iso) => { if (!iso) return ''; const x = new Date(iso); return dkey(x) + 'T' + pad(x.getHours()) + ':' + pad(x.getMinutes()); };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const weekStart = (d) => { const x = startOfDay(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mapsUrl = (a) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);

  function entryMin(e, nowMs) {
    const now = nowMs || Date.now(); const end = e.clock_out ? +new Date(e.clock_out) : now;
    let m = (end - +new Date(e.clock_in)) / 60000;
    (e.breaks || []).forEach((b) => { m -= ((b.end_at ? +new Date(b.end_at) : end) - +new Date(b.start_at)) / 60000; });
    return Math.max(0, m);
  }
  function breakMin(e, nowMs) {
    const now = nowMs || Date.now(); const end = e.clock_out ? +new Date(e.clock_out) : now;
    return (e.breaks || []).reduce((s, b) => s + ((b.end_at ? +new Date(b.end_at) : end) - +new Date(b.start_at)) / 60000, 0);
  }
  function download(name, text) {
    const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';

  /* ---------- toast / modal / confirm ---------- */
  function toast(msg, bad) {
    const el = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
    document.body.append(el); setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
  }
  function errText(e) {
    const m = String((e && e.message) || e || '');
    const map = { 'Invalid login credentials': 'err_login', 'User already registered': 'err_exists', already_clocked_in: 'err_clocked', not_member: 'err_member', full: 'err_full', closed: 'err_closed', no_access: 'err_access' };
    for (const k of Object.keys(map)) if (m.indexOf(k) >= 0) return t(map[k]);
    if (/at least \d+ char/i.test(m)) return t('err_pw');
    if (/rate limit/i.test(m)) return t('err_rate');
    return m || t('err_generic');
  }
  function modal(title, content, opts) {
    const prevFocus = document.activeElement;
    const ov = h('div', { class: 'ovl' });
    const box = h('div', { class: 'modal' + (opts && opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    box.append(h('div', { class: 'mh' }, h('h3', null, title), h('button', { class: 'ib', type: 'button', 'aria-label': t('close'), onclick: close }, ico('x'))), content);
    ov.append(box); ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey); document.body.append(ov);
    const f = box.querySelector('input,select,textarea'); if (f) f.focus();
    return { close, box };
  }
  function askConfirm(msg, okLabel) {
    return new Promise((res) => {
      let m;
      const done = (v) => { m.close(); res(v); };
      m = modal(t('confirm'), h('div', { class: 'mb' }, h('p', null, msg), h('div', { class: 'acts' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => done(false) }, t('cancel')),
        h('button', { class: 'btn danger', type: 'button', onclick: () => done(true) }, okLabel || t('delete')))));
    });
  }
  /* Texto bilingüe guardado en la base: usa la columna _en cuando el portal
     está en inglés y hay traducción; si no, cae al español. */
  const L = (row, f) => {
    if (!row) return '';
    if (S.lang === 'en') { const v = row[f + '_en']; if (v && String(v).trim()) return v; }
    return row[f] == null ? '' : row[f];
  };
  const field = (label, input, hint) => h('label', { class: 'fld' }, h('span', null, label), input, hint ? h('small', null, hint) : null);
  function busy(btn, on) { if (!btn) return; btn.disabled = !!on; btn.classList.toggle('busy', !!on); }
  async function run(btn, fn) {
    busy(btn, true);
    try { await fn(); } catch (e) { console.warn(e); toast(errText(e), true); } finally { busy(btn, false); }
  }
  const chip = (txt, cls) => h('span', { class: 'chip ' + (cls || '') }, txt);
  const statusChip = (s) => chip(t('st_' + s), s === 'active' || s === 'approved' || s === 'open' ? 'ok' : s === 'paused' || s === 'submitted' || s === 'pending' ? 'warn' : s === 'rejected' || s === 'disabled' ? 'bad' : 'mut');
  const empty = (txt, sub) => h('div', { class: 'empty' }, h('p', null, txt), sub ? h('small', null, sub) : null);
  const switchEl = (checked, onchange, label) => h('label', { class: 'sw', title: label || '' }, h('input', { type: 'checkbox', checked: !!checked, 'aria-label': label || '', onchange: (e) => onchange(e.target.checked, e.target) }), h('span'));

  /* ---------- render raíz ---------- */
  function render() {
    clearTimers(); fill(root);
    document.documentElement.lang = S.lang;
    document.title = t('title');
    if (!API.live) root.append(demoBar());
    if (S.recovery) { root.append(recoveryView()); return; }
    if (!S.me) { root.append(authView()); return; }
    if (S.me.status !== 'approved') { root.append(gateView()); return; }
    root.append(shell());
  }
  function demoBar() {
    return h('div', { class: 'demo' }, h('b', null, t('demo_title')), ' ', t('demo_text'),
      h('button', { class: 'lnk', type: 'button', onclick: async () => { if (await askConfirm(t('demo_reset_q'), t('demo_reset'))) { API._reset(); S.me = null; S.user = null; S.tab = null; S.projectId = null; render(); } } }, t('demo_reset')));
  }
  function langToggle() {
    return h('div', { class: 'lang', role: 'group', 'aria-label': 'Language' },
      ['es', 'en'].map((l) => h('button', { type: 'button', class: S.lang === l ? 'on' : '', 'aria-pressed': S.lang === l ? 'true' : 'false', onclick: () => setLang(l) }, l.toUpperCase())));
  }

  /* ---------- autenticación ---------- */
  function authView() {
    const err = h('p', { class: 'err', role: 'alert' });
    const wrap = h('div', { class: 'auth' });
    const brand = h('div', { class: 'brand' }, h('img', { src: 'logo-blanco.png', alt: 'Proven Solutions', class: 'logo' }),
      h('h1', null, t('brand_h')), h('p', null, t('brand_p')),
      h('ul', null, h('li', null, ico('pin', 16), t('b1')), h('li', null, ico('receipt', 16), t('b2')), h('li', null, ico('clock', 16), t('b3'))));
    const card = h('div', { class: 'acard' });
    const top = h('div', { class: 'atop' }, langToggle());
    card.append(top);
    if (S.authTab === 'sent') {
      card.append(h('div', { class: 'sent' }, h('div', { class: 'okc' }, ico('check', 26)), h('h2', null, t('sent_h')), h('p', null, t('sent_p')),
        h('button', { class: 'btn', type: 'button', onclick: () => { S.authTab = 'in'; render(); } }, t('back_login'))));
    } else {
      card.append(h('div', { class: 'tabs2', role: 'tablist' },
        ['in', 'up'].map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': S.authTab === k ? 'true' : 'false', class: S.authTab === k ? 'on' : '', onclick: () => { S.authTab = k; render(); } }, t(k === 'in' ? 'tab_in' : 'tab_up')))));
      if (S.authTab === 'in') {
        const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'name@email.com' });
        const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
        const btn = h('button', { class: 'btn', type: 'submit' }, t('login'));
        card.append(h('form', { class: 'frm', onsubmit: async (e) => {
          e.preventDefault(); err.textContent = ''; busy(btn, true);
          try { await API.signIn(email.value.trim(), pw.value); S.user = await API.session(); S.me = await API.myProfile(); S.tab = null; S.projectId = null; render(); }
          catch (x) { err.textContent = errText(x); busy(btn, false); }
        } }, field(t('email'), email), field(t('password'), pw), err, btn,
        h('button', { class: 'lnk', type: 'button', onclick: async () => {
          if (!email.value.trim()) { err.textContent = t('reset_need'); return; }
          try { await API.reset(email.value.trim()); toast(t('reset_sent')); } catch (x) { err.textContent = errText(x); }
        } }, t('forgot'))));
        if (!API.live) card.append(h('p', { class: 'hint' }, t('demo_creds')));
      } else {
        const f = { name: h('input', { required: true, autocomplete: 'name' }), phone: h('input', { type: 'tel', required: true, autocomplete: 'tel', placeholder: '(555) 555-5555' }),
          email: h('input', { type: 'email', required: true, autocomplete: 'email' }), pw: h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }) };
        let grp = 'gigs';
        const radios = ['gigs', 'crew'].map((g) => h('label', { class: 'rad' }, h('input', { type: 'radio', name: 'grp', value: g, checked: g === grp, onchange: () => { grp = g; } }), h('span', null, t('grp_' + g))));
        const btn = h('button', { class: 'btn', type: 'submit' }, t('send_req'));
        card.append(h('form', { class: 'frm', onsubmit: async (e) => {
          e.preventDefault(); err.textContent = ''; busy(btn, true);
          try { await API.signUp({ email: f.email.value.trim(), password: f.pw.value, full_name: f.name.value.trim(), phone: f.phone.value.trim(), grp, lang: S.lang }); S.authTab = 'sent'; render(); }
          catch (x) { err.textContent = errText(x); busy(btn, false); }
        } }, field(t('full_name'), f.name), field(t('phone'), f.phone), field(t('email'), f.email), field(t('password'), f.pw, t('pw_hint')),
        h('fieldset', { class: 'grp' }, h('legend', null, t('i_am')), radios), err, btn, h('p', { class: 'hint' }, t('approval_note'))));
      }
    }
    wrap.append(brand, card); return wrap;
  }
  function gateView() {
    const st = S.me.status;
    return h('div', { class: 'auth' }, h('div', { class: 'brand' }, h('img', { src: 'logo-blanco.png', alt: 'Proven Solutions', class: 'logo' })),
      h('div', { class: 'acard' }, h('div', { class: 'atop' }, langToggle()), h('div', { class: 'sent' },
        h('div', { class: 'okc ' + (st === 'pending' ? 'wait' : 'no') }, ico(st === 'pending' ? 'clock' : 'x', 26)),
        h('h2', null, t('gate_' + st + '_h')), h('p', null, t('gate_' + st + '_p')),
        h('div', { class: 'acts' }, st === 'pending' ? h('button', { class: 'btn ghost', type: 'button', onclick: async (e) => run(e.currentTarget, async () => { S.me = await API.myProfile(); render(); }) }, t('check_again')) : null,
          h('button', { class: 'btn', type: 'button', onclick: signOut }, t('logout'))))));
  }
  function recoveryView() {
    const pw = h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }); const err = h('p', { class: 'err' });
    return h('div', { class: 'auth' }, h('div', { class: 'brand' }, h('img', { src: 'logo-blanco.png', alt: 'Proven Solutions', class: 'logo' })),
      h('div', { class: 'acard' }, h('form', { class: 'frm', onsubmit: async (e) => { e.preventDefault(); try { await API.setPassword(pw.value); S.recovery = false; S.user = await API.session(); S.me = await API.myProfile(); toast(t('pw_updated')); render(); } catch (x) { err.textContent = errText(x); } } },
        h('h2', null, t('new_pw')), field(t('password'), pw, t('pw_hint')), err, h('button', { class: 'btn', type: 'submit' }, t('save')))));
  }
  async function signOut() { try { await API.signOut(); } catch (e) { /* ok */ } S.me = null; S.user = null; S.tab = null; S.projectId = null; S.authTab = 'in'; render(); }

  /* ---------- estructura principal ---------- */
  function tabsFor() {
    if (isAdmin()) return ['cmd', 'projects', 'attendance', 'finance', 'crm', 'content', 'receipts', 'shifts', 'docs', 'pay'];
    /* Contenido es su propio interruptor, no viene pegado a Oficina ni a
       Finanzas: quien publica no tiene por que ver los numeros. */
    const can = S.me.perms || {};
    const cont = can.content ? ['content'] : [];
    if (S.me.is_office) return ['projects', 'attendance'].concat(cont, ['receipts', 'finance', 'shifts', 'docs']);
    if (S.me.is_finance) return ['finance', 'receipts', 'projects', 'attendance'].concat(cont);
    return ['projects', 'clock', 'shifts', 'docs', 'pay'].filter((k) => can[k]).concat(cont);
  }
  function shell() {
    const tabs = tabsFor();
    if (!S.tab || tabs.indexOf(S.tab) < 0) S.tab = tabs[0] || null;
    const main = h('main', { id: 'main', tabindex: '-1' });
    const nav = h('nav', { class: 'nav', 'aria-label': 'Main' }, tabs.map((k) => h('button', { type: 'button', class: S.tab === k ? 'on' : '', 'aria-current': S.tab === k ? 'page' : null, onclick: () => { S.tab = k; S.projectId = null; S.ptab = 'feed'; render(); } }, t('tab_' + k))));
    const head = h('header', { class: 'top' }, h('div', { class: 'topin' }, h('img', { src: 'logo-blanco.png', alt: 'Proven Solutions', class: 'logo' }),
      h('div', { class: 'who' }, langToggle(), h('span', { class: 'me' }, h('span', { class: 'av' }, ini(S.me.full_name)), h('span', { class: 'nm' }, S.me.full_name),
        isAdmin() ? chip('Admin', 'gold') : S.me.is_office ? chip(t('office'), 'gold') : null),
      h('button', { class: 'lnk light', type: 'button', onclick: signOut }, t('logout')))), tabs.length ? nav : null);
    const frag = h('div', { class: 'shell' }, head, main);
    if (!tabs.length) main.append(empty(t('no_modules'), t('no_modules_sub')));
    else showTab(main);
    return frag;
  }
  function showTab(main) {
    fill(main, spin());
    const v = { cmd: viewCmd, projects: viewProjects, attendance: viewAttendance, receipts: viewReceipts, shifts: viewShifts, docs: viewDocs, pay: viewPay, clock: viewClock, finance: viewFinance, crm: viewCrm, content: viewContent }[S.tab];
    Promise.resolve(v(main)).catch((e) => { console.warn(e); fill(main, empty(t('err_generic'), errText(e))); });
  }
  const refresh = () => { const m = document.getElementById('main'); if (m) showTab(m); };
  const secH = (title, right) => h('div', { class: 'sech' }, h('h2', null, title), right || null);

  /* ============================ PROYECTOS ============================ */
  const weekKey = (d) => 'W' + dkey(weekStart(d));
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
  const onceItems = (items) => items.filter((s) => s.cadence === 'once' && (s.kind || 'phase') === 'phase');
  const todoItems = (items) => items.filter((s) => (s.kind || 'phase') === 'todo');

  function scopeStats(items, project) {
    const once = onceItems(items);
    if (!once.length && project && project.pct_manual != null) {
      /* Sin scope cargado: se usa el avance que viene del tracker, y se dice de dónde salió. */
      return { pct: Number(project.pct_manual) || 0, done: 0, total: 0, has: false, manual: true };
    }
    const tot = once.reduce((s, x) => s + Number(x.weight || 1), 0);
    const dn = once.filter((x) => x.status === 'done').reduce((s, x) => s + Number(x.weight || 1), 0);
    return { pct: tot ? Math.round((dn / tot) * 100) : 0, done: once.filter((x) => x.status === 'done').length, total: once.length, has: once.length > 0, manual: false };
  }
  /* Compara lo hecho contra lo gastado: a mitad de obra eso sí dice la verdad. */
  function health(project, pct, spent, hasCosts) {
    /* Sin gastos cargados no se puede decir si vas ganando: decirlo sería mentira. */
    if (!hasCosts) return { key: 'nodata', margin: null, earned: 0, spent: 0 };
    if (!project.contract) return { key: 'none', margin: null, earned: 0, spent };
    const earned = Number(project.contract) * (pct / 100);
    if (earned <= 0) return { key: 'none', margin: null, earned: 0, spent };
    const margin = (earned - spent) / earned;
    const key = margin >= 0.3 ? 'winning' : margin >= 0.15 ? 'profit' : margin >= 0.05 ? 'even' : margin >= 0 ? 'watch' : 'losing';
    return { key, margin, earned, spent };
  }
  const healthChip = (k) => chip(t('fs_' + k), k === 'winning' || k === 'profit' ? 'ok' : k === 'even' ? 'mut' : k === 'watch' ? 'warn' : k === 'losing' ? 'bad' : 'mut');
  const hasCostsFor = (pid, exp, rec) => exp.some((e) => e.project_id === pid) || rec.some((m) => m.project_id === pid);
  function ring(pct, size) {
    const s = size || 52, r = (s - 7) / 2, c = 2 * Math.PI * r;
    const e = h('span', { class: 'ring', 'aria-label': pct + '%' });
    e.innerHTML = '<svg viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '">'
      + '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="#EFEDE6" stroke-width="5"/>'
      + '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="#C9A84C" stroke-width="5" stroke-linecap="round"'
      + ' stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>'
      + '<text x="50%" y="50%" text-anchor="middle" dy="0.35em" font-size="' + (s * 0.3) + '" font-weight="800" fill="#0B1330">' + pct + '</text></svg>';
    return e;
  }

  let projFilter = 'active';
  let projTouched = false;
  async function viewProjects(main) {
    if (S.projectId) return viewProject(main, S.projectId);
    const [list, allScope] = await Promise.all([API.projects(), API.allScope().catch(() => [])]);
    /* Un proyecto terminado NO está cerrado si todavía le deben o se le debe.
       Sin esto, Jersey City desaparecía de la lista con $2,370 por cobrar adentro. */
    let owedIn = {}, owedOut = {};
    if (isViewer()) {
      const [cps, pys] = await Promise.all([API.clientPayments().catch(() => []), API.payables().catch(() => [])]);
      cps.forEach((c) => { if (!c.paid_on) owedIn[c.project_id] = (owedIn[c.project_id] || 0) + Number(c.amount || 0); });
      pys.forEach((y) => { const d = Number(y.amount || 0) - Number(y.paid || 0); if (d > 0) owedOut[y.project_id] = (owedOut[y.project_id] || 0) + d; });
    }
    const openMoney = (p) => (owedIn[p.id] || 0) + (owedOut[p.id] || 0);
    const withMoney = list.filter((p) => openMoney(p) > 0);
    const people = isViewer() ? await API.profiles() : [];
    const pmap = {}; people.forEach((p) => { pmap[p.id] = p; });
    /* El gasto por proyecto solo lo necesita quien ve los números */
    let spentBy = {}, costExp = [], costRec = [];
    if (isViewer()) {
      const [exp, rec] = await Promise.all([API.expenses('2000-01-01', '2100-01-01').catch(() => []), API.receipts().catch(() => [])]);
      costExp = exp; costRec = rec;
      exp.forEach((e) => { if (e.project_id) spentBy[e.project_id] = (spentBy[e.project_id] || 0) + Number(e.amount); });
      rec.forEach((m) => { spentBy[m.project_id] = (spentBy[m.project_id] || 0) + Number(m.amount || 0); });
    }
    /* Al entrar, si hay plata abierta esa es la lista que importa. */
    if (projFilter === 'active' && !projTouched && withMoney.length) projFilter = 'money';
    const filtered = projFilter === 'money' ? withMoney
      : list.filter((p) => projFilter === 'all' || p.status === projFilter);
    const cnt = (k) => k === 'all' ? list.length : k === 'money' ? withMoney.length : list.filter((p) => p.status === k).length;
    const keys = ['active', 'paused', 'done', 'all'];
    if (withMoney.length) keys.unshift('money');
    const chips = keys.map((k) => h('button', { type: 'button', class: 'fchip' + (projFilter === k ? ' on' : '') + (k === 'money' ? ' money' : ''),
      onclick: () => { projFilter = k; projTouched = true; refresh(); } },
      t(k === 'all' ? 'all' : k === 'money' ? 'f_money' : 'st_' + k), ' ', h('span', { class: 'cnt' }, cnt(k))));
    const totIn = withMoney.reduce((a, p) => a + (owedIn[p.id] || 0), 0);
    const totOut = withMoney.reduce((a, p) => a + (owedOut[p.id] || 0), 0);
    fill(main, secH(t('tab_projects'), isStaff() ? h('button', { class: 'btn sm', type: 'button', onclick: () => projectEditor(null, people) }, ico('plus', 16), t('new_project')) : null),
      h('div', { class: 'fchips' }, chips),
      (projFilter === 'money' && withMoney.length) ? h('div', { class: 'moneybar' },
        totIn ? h('div', null, h('small', null, t('f_in')), h('b', null, money(totIn))) : null,
        totOut ? h('div', { class: 'out' }, h('small', null, t('f_out')), h('b', null, money(totOut))) : null) : null,
      filtered.length ? h('div', { class: 'grid' }, filtered.map((p) => {
        const fore = p.members.find((m) => m.role === 'foreman');
        const st = scopeStats(allScope.filter((s) => s.project_id === p.id), p);
        const hl = isViewer() ? health(p, st.pct, spentBy[p.id] || 0, hasCostsFor(p.id, costExp, costRec)) : null;
        return h('button', { class: 'card pcard', type: 'button', onclick: () => { S.projectId = p.id; S.ptab = 'scope'; refresh(); } },
          h('div', { class: 'row between' }, h('h3', null, p.name), statusChip(p.status)),
          p.client ? h('p', { class: 'mut' }, p.client) : null,
          h('div', { class: 'prog' }, ring(st.pct), h('div', null,
            h('b', null, t('pct_done')), st.has ? h('small', null, t('of_scope', { a: st.done, b: st.total }))
              : h('small', null, st.manual ? t('from_tracker') : t('no_scope')))),
          hl && hl.key !== 'none' && hl.key !== 'nodata' ? h('div', { class: 'row gap' }, healthChip(hl.key), h('small', { class: 'mut' }, Math.round(hl.margin * 100) + '%')) : null,
          (owedIn[p.id] || owedOut[p.id]) ? h('div', { class: 'row gap wrap owed' },
            owedIn[p.id] ? chip(t('f_in') + ' ' + money(owedIn[p.id]), 'warn') : null,
            owedOut[p.id] ? chip(t('f_out') + ' ' + money(owedOut[p.id]), 'bad') : null) : null,
          p.address ? h('p', { class: 'addr' }, ico('pin', 14), p.address) : null,
          h('div', { class: 'row gap' }, chip(t('n_people', { n: p.members.length }), 'mut'), fore && pmap[fore.worker_id] ? chip(t('foreman') + ': ' + pmap[fore.worker_id].full_name.split(' ')[0], 'gold') : null));
      })) : empty(t('no_projects'), isStaff() ? t('no_projects_staff') : t('no_projects_worker')));
  }

  function projectEditor(p, people) {
    const approved = people.filter((x) => x.status === 'approved' && !x.is_admin && !x.is_client);
    const cur = {}; ((p && p.members) || []).forEach((m) => { cur[m.worker_id] = m.role; });
    const f = { name: h('input', { required: true, value: p ? p.name : '' }), client: h('input', { value: p ? p.client : '' }), address: h('input', { value: p ? p.address : '', autocomplete: 'off' }),
      status: h('select', { value: p ? p.status : 'active' }, ['active', 'paused', 'done'].map((s) => h('option', { value: s }, t('st_' + s)))),
      starts: h('input', { type: 'date', value: p && p.starts_on ? p.starts_on : '' }),
      ends: h('input', { type: 'date', value: p && p.ends_on ? p.ends_on : '' }),
      contract: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: p && p.contract != null ? p.contract : '' }),
      notes: h('textarea', { rows: 3 }, p ? p.notes : '') };
    f.status.value = p ? p.status : 'active'; f.notes.value = p ? p.notes : '';
    const rows = approved.map((w) => {
      const cb = h('input', { type: 'checkbox', checked: cur[w.id] != null, 'aria-label': w.full_name });
      const sel = h('select', { 'aria-label': t('role') }, h('option', { value: 'member' }, t('member')), h('option', { value: 'foreman' }, t('foreman')));
      sel.value = cur[w.id] || 'member';
      return { w, cb, sel, el: h('div', { class: 'mrow' }, h('label', null, cb, h('span', { class: 'av sm' }, ini(w.full_name)), h('span', null, w.full_name, ' ', chip(t('grp_short_' + w.grp), 'mut'))), sel) };
    });
    const err = h('p', { class: 'err' });
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const body = h('form', { class: 'mb frm', onsubmit: async (e) => {
      e.preventDefault();
      const members = rows.filter((r) => r.cb.checked).map((r) => ({ worker_id: r.w.id, role: r.sel.value }));
      if (members.filter((m) => m.role === 'foreman').length > 1) { err.textContent = t('one_foreman'); return; }
      await run(save, async () => { await API.saveProject({ id: p && p.id, name: f.name.value.trim(), client: f.client.value.trim(), address: f.address.value.trim(), status: f.status.value,
        starts_on: f.starts.value, ends_on: f.ends.value, contract: f.contract.value === '' ? null : Number(f.contract.value), notes: f.notes.value.trim() }, members); m.close(); toast(t('saved')); refresh(); });
    } }, field(t('proj_name'), f.name), h('div', { class: 'two' }, field(t('client'), f.client), field(t('status'), f.status)), field(t('address'), f.address),
    h('div', { class: 'two' }, field(t('start_date'), f.starts), field(t('end_date'), f.ends)),
    field(t('contract_value') + ' ($)', f.contract, t('health_hint')), field(t('notes'), f.notes),
    h('fieldset', { class: 'grp' }, h('legend', null, t('team')), rows.length ? rows.map((r) => r.el) : h('p', { class: 'mut' }, t('no_approved'))), err,
    h('div', { class: 'acts' }, p ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_project_q'))) { await API.deleteProject(p.id); m.close(); S.projectId = null; refresh(); } } }, t('delete')) : null, save));
    const m = modal(p ? t('edit_project') : t('new_project'), body, { wide: true });
  }


  /* ---------- DINERO DEL PROYECTO ----------
     Antes esto solo se podía tocar con SQL, y por eso Barena's siguió apareciendo
     con $1,500 por cobrar un mes después de que lo pagaran. Marcar un pago tiene
     que ser un botón, no un favor que alguien te hace. */
  async function moneyPane(body, p) {
    fill(body, spin());

    function payModal(row) {
      const f = {
        label: h('input', { required: true, value: row.label || '' }),
        amount: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', required: true,
          value: row.amount != null ? row.amount : '' }),
        due_on: h('input', { type: 'date', value: row.due_on || '' }),
        paid_on: h('input', { type: 'date', value: row.paid_on || '' }),
      };
      const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
      const m = modal(row.id ? t('mny_edit_in') : t('mny_add_in'),
        h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
          await API.saveClientPayment({
            id: row.id, project_id: p.id,
            label: f.label.value.trim(),
            amount: Number(f.amount.value),
            due_on: f.due_on.value || null,
            paid_on: f.paid_on.value || null,
            sort: row.sort != null ? row.sort : Date.now() % 100000,
          });
          m.close(); toast(t('saved')); draw();
        }); } },
          field(t('mny_concept'), f.label),
          h('div', { class: 'two' }, field(t('amount') + ' ($)', f.amount), field(t('mny_paid_on'), f.paid_on)),
          field(t('mny_due_on'), f.due_on),
          h('p', { class: 'mut sm' }, t('mny_paid_hint')),
          h('div', { class: 'acts' },
            row.id ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
              if (await askConfirm(t('mny_del_q'))) { await API.deleteClientPayment(row.id); m.close(); draw(); }
            } }, t('delete')) : null,
            save)));
    }

    /* El camino corto: ya me pagaron, con qué y cuándo. Dos campos y listo. */
    function markPaid(row) {
      const f = {
        label: h('input', { required: true, value: row.label || '' }),
        paid_on: h('input', { type: 'date', required: true, value: dkey(new Date()) }),
        how: h('input', { placeholder: t('mny_how_ph') }),
      };
      const save = h('button', { class: 'btn', type: 'submit' }, t('mny_mark'));
      const m = modal(t('mny_mark') + ' · ' + money(row.amount),
        h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
          const how = f.how.value.trim();
          await API.saveClientPayment({
            id: row.id, project_id: p.id,
            label: f.label.value.trim() + (how ? ' · ' + how : ''),
            amount: Number(row.amount), due_on: row.due_on || null,
            paid_on: f.paid_on.value, sort: row.sort,
          });
          m.close(); toast(t('saved')); draw();
        }); } },
          field(t('mny_concept'), f.label),
          h('p', { class: 'mut sm' }, t('mny_concept_hint')),
          h('div', { class: 'two' }, field(t('mny_paid_on'), f.paid_on), field(t('mny_how'), f.how)),
          h('div', { class: 'acts' }, save)));
    }

    function owedModal(row) {
      const f = {
        payee: h('input', { required: true, value: row.payee || '' }),
        amount: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', required: true,
          value: row.amount != null ? row.amount : '' }),
        paid: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal',
          value: row.paid != null ? row.paid : 0 }),
        notes: h('input', { value: row.notes || '' }),
      };
      const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
      const m = modal(row.id ? t('mny_edit_out') : t('mny_add_out'),
        h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
          const amt = Number(f.amount.value), pd = Number(f.paid.value || 0);
          await API.savePayable({
            id: row.id, project_id: p.id, payee: f.payee.value.trim(),
            amount: amt, paid: pd, notes: f.notes.value.trim(),
            settled_on: pd >= amt ? (row.settled_on || dkey(new Date())) : null,
          });
          m.close(); toast(t('saved')); draw();
        }); } },
          field(t('mny_payee'), f.payee),
          h('div', { class: 'two' }, field(t('mny_total') + ' ($)', f.amount), field(t('mny_already') + ' ($)', f.paid)),
          field(t('notes'), f.notes),
          h('div', { class: 'acts' },
            row.id ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
              if (await askConfirm(t('mny_del_q'))) { await API.deletePayable(row.id); m.close(); draw(); }
            } }, t('delete')) : null,
            save)));
    }

    async function draw() {
      let cps, pys;
      try {
        const r = await Promise.all([API.clientPayments(), API.payables()]);
        cps = r[0].filter((x) => x.project_id === p.id).sort((a, b) => (a.sort || 0) - (b.sort || 0));
        pys = r[1].filter((x) => x.project_id === p.id);
      } catch (e) { fill(body, empty(t('err_generic'), errText(e))); return; }

      const paid = cps.filter((x) => x.paid_on).reduce((a, x) => a + Number(x.amount || 0), 0);
      const open = cps.filter((x) => !x.paid_on).reduce((a, x) => a + Number(x.amount || 0), 0);
      const out = pys.reduce((a, x) => a + Math.max(0, Number(x.amount || 0) - Number(x.paid || 0)), 0);

      const inRow = (x) => h('div', { class: 'ckrow sel' + (x.paid_on ? ' set' : '') },
        h('div', { class: 'tx' }, h('b', null, x.label),
          h('small', null, x.paid_on ? t('mny_on', { d: fDate(x.paid_on + 'T12:00:00', { month: 'short', day: 'numeric' }) })
            : x.due_on ? t('mny_by', { d: fDate(x.due_on + 'T12:00:00', { month: 'short', day: 'numeric' }) })
            : t('mny_nodate'))),
        h('b', { class: 'amt' }, money(x.amount)),
        x.paid_on ? chip(t('mny_in_done'), 'ok')
          : h('button', { class: 'btn sm', type: 'button', onclick: () => markPaid(x) }, t('mny_mark')),
        h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => payModal(x) }, ico('edit', 15)));

      const outRow = (x) => {
        const left = Math.max(0, Number(x.amount || 0) - Number(x.paid || 0));
        return h('div', { class: 'ckrow sel' + (left ? '' : ' set') },
          h('div', { class: 'tx' }, h('b', null, x.payee),
            h('small', null, [x.notes, t('mny_of_total', { a: money(x.paid || 0), b: money(x.amount) })].filter(Boolean).join(' · '))),
          h('b', { class: 'amt' }, money(left)),
          left ? chip(t('f_out'), 'bad') : chip(t('mny_out_done'), 'ok'),
          h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => owedModal(x) }, ico('edit', 15)));
      };

      fill(body,
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('span', null, t('mny_collected')), h('b', null, money(paid))),
          h('div', { class: 'stat' + (open ? ' warn' : '') }, h('span', null, t('f_in')), h('b', null, money(open))),
          h('div', { class: 'stat' + (out ? ' bad' : '') }, h('span', null, t('f_out')), h('b', null, money(out)))),

        h('h3', { class: 'sub' }, t('mny_in')),
        cps.length ? h('div', { class: 'cklist' }, cps.map(inRow)) : empty(t('mny_no_in')),
        isStaff() ? h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button',
          onclick: () => payModal({}) }, ico('plus', 16), t('mny_add_in'))) : null,

        h('h3', { class: 'sub' }, t('mny_out')),
        pys.length ? h('div', { class: 'cklist' }, pys.map(outRow)) : empty(t('mny_no_out')),
        isStaff() ? h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button',
          onclick: () => owedModal({}) }, ico('plus', 16), t('mny_add_out'))) : null);
    }

    draw();
  }

  async function viewProject(main, pid) {
    const [list, people] = await Promise.all([API.projects(), API.people(pid)]);
    const p = list.find((x) => x.id === pid);
    if (!p) { S.projectId = null; return refresh(); }
    const myRole = (p.members.find((m) => m.worker_id === S.me.id) || {}).role;
    const canTime = isViewer() || myRole === 'foreman';
    const canPost = isStaff() || !!myRole;
    const profiles = isViewer() ? await API.profiles() : [];
    const names = {}; people.forEach((x) => { names[x.id] = x.full_name; }); profiles.forEach((x) => { names[x.id] = x.full_name; });
    /* Scope primero, chat después. Equipo y horas al final: no son del día a día. */
    /* Selecciones solo para la oficina: es plata del cliente, no algo que Miguel chulee. */
    const panes = ['scope'].concat(isViewer() ? ['selections', 'money'] : [])
      .concat(['feed', 'materials', 'receipts', 'team']).concat(canTime ? ['time'] : []);
    if (panes.indexOf(S.ptab) < 0) S.ptab = 'scope';
    const body = h('div', { class: 'pbody' });
    const tabs = h('div', { class: 'ptabs', role: 'tablist' }, panes.map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': S.ptab === k ? 'true' : 'false', class: S.ptab === k ? 'on' : '', onclick: () => { S.ptab = k; viewProject(main, pid); } }, t('pt_' + k))));
    fill(main, 
      h('button', { class: 'lnk back', type: 'button', onclick: () => { S.projectId = null; refresh(); } }, ico('back', 16), t('tab_projects')),
      h('div', { class: 'phead' }, h('div', null, h('div', { class: 'row gap wrap' }, h('h2', null, p.name), statusChip(p.status)),
        h('p', { class: 'mut' }, [p.client, p.starts_on ? t('since') + ' ' + fDate(p.starts_on + 'T12:00:00', { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')),
        p.address ? h('a', { class: 'addr', href: mapsUrl(p.address), target: '_blank', rel: 'noopener' }, ico('pin', 14), p.address) : null),
        isStaff() ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => projectEditor(p, profiles.length ? profiles : await API.profiles()) }, ico('edit', 16), t('edit')) : null),
      p.notes ? noteBlock(p.notes) : null,
      !isStaff() && S.me.perms.clock ? h('div', { id: 'clockslot' }) : null, tabs, body);
    const slot = document.getElementById('clockslot'); if (slot) clockCard(slot, { projectId: pid, projects: list });
    const go = (tab) => { S.ptab = tab; viewProject(main, pid); };
    if (S.ptab === 'scope') scopePane(body, p, names, myRole, go);
    else if (S.ptab === 'feed') feedPane(body, pid, names, canPost);
    else if (S.ptab === 'selections') selectionsPane(body, p, names);
    else if (S.ptab === 'money') moneyPane(body, p);
    else if (S.ptab === 'materials') materialsPane(body, p, names, canPost);
    else if (S.ptab === 'receipts') receiptsPane(body, pid, names);
    else if (S.ptab === 'team') teamPane(body, p, people, profiles);
    else timesheet(body, { fixedProject: pid, names, canEdit: isStaff(), projects: { [pid]: p }, csvName: 'horas-' + pid });
  }

  /* Las notas largas se leen solo si alguien las abre; si no, estorban. */
  function noteBlock(txt) {
    const first = String(txt).split('\n')[0];
    const rest = String(txt).slice(first.length).trim();
    if (!rest && first.length < 150) return h('div', { class: 'note' }, first);
    const d = h('details', { class: 'note nd' }, h('summary', null, first.length > 120 ? first.slice(0, 118) + '…' : first), h('p', null, txt));
    return d;
  }

  /* ---------- SCOPE: en qué vamos, qué sigue, y los pendientes del día ---------- */
  async function scopePane(box, p, names, myRole, go) {
    fill(box, spin());
    const pid = p.id;
    let items, checks;
    try {
      items = await API.scope(pid);
      checks = await API.checks(items.filter((s) => s.cadence !== 'once').map((s) => s.id)).catch(() => []);
    } catch (e) { console.warn(e); fill(box, empty(t('err_generic'), errText(e))); return; }
    const recur = items.filter((s) => s.cadence !== 'once');
    const once = onceItems(items).slice().sort((a, b) => a.sort - b.sort);
    const st = scopeStats(items, p);
    const canMove = isStaff() || myRole === 'foreman';
    const today = new Date(), tkey = dkey(today), wkey = weekKey(today);
    const hasCheck = (id, per) => checks.some((c) => c.item_id === id && c.period === per);

    /* --- lo que sigue, con los días --- */
    const active = once.find((s) => s.status === 'active') || once.find((s) => s.status !== 'done' && s.status !== 'blocked');
    const banners = [];
    if (active) {
      const nm = active.title.toUpperCase();
      if (active.due_on) {
        const d = daysBetween(today, new Date(active.due_on + 'T12:00:00'));
        if (d > 1) banners.push(['go', t('days_left', { n: d, t: nm })]);
        else if (d === 1) banners.push(['go', t('days_left_one', { t: nm })]);
        else if (d === 0) banners.push(['now', t('due_today_t', { t: nm })]);
        else banners.push(['late', Math.abs(d) === 1 ? t('late_one', { t: nm }) : t('late_n', { n: Math.abs(d), t: nm })]);
      } else banners.push(['go', nm]);
    }
    /* --- ¿ganamos días? la última tarea terminada antes de tiempo, de los últimos 7 días --- */
    const recent = once.filter((s) => s.status === 'done' && s.done_on && s.due_on && daysBetween(new Date(s.done_on + 'T12:00:00'), today) <= 7)
      .sort((a, b) => b.done_on.localeCompare(a.done_on))[0];
    if (recent) {
      const won = daysBetween(new Date(recent.done_on + 'T12:00:00'), new Date(recent.due_on + 'T12:00:00'));
      if (won > 0) banners.unshift(['won', won === 1 ? t('won_one') : t('won_days', { n: won })]);
    }

    const checkRow = (s, per) => {
      const on = hasCheck(s.id, per);
      const who = on ? (checks.find((c) => c.item_id === s.id && c.period === per) || {}).done_by : null;
      return h('div', { class: 'ckrow' + (on ? ' done' : '') },
        h('button', { class: 'tick', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': s.title, onclick: (e) => run(e.currentTarget, async () => {
          if (on) await API.removeCheck(s.id, per); else await API.addCheck(s.id, per); scopePane(box, p, names, myRole, go);
        }) }, ico('check', 15)),
        h('div', { class: 'tx' }, h('b', null, s.title), on && who && names[who] ? h('small', null, t('checked_by', { n: names[who] })) : null));
    };
    const daily = recur.filter((s) => s.cadence === 'daily');
    const weekly = recur.filter((s) => s.cadence === 'weekly');
    const dDone = daily.filter((s) => hasCheck(s.id, tkey)).length;
    const wDone = weekly.filter((s) => hasCheck(s.id, wkey)).length;

    /* Pendientes sueltos: lo que de verdad se chulea hoy. No mueven el porcentaje. */
    const todos = todoItems(items).slice().sort((a, b) => String(a.due_on || '9999').localeCompare(String(b.due_on || '9999')));
    const wEndK = dkey(addDays(weekStart(today), 7));
    const tOpen = todos.filter((s) => s.status !== 'done');
    const tHoy = tOpen.filter((s) => s.due_on && s.due_on <= tkey);
    const tSemana = tOpen.filter((s) => s.due_on && s.due_on > tkey && s.due_on < wEndK);
    const tLuego = tOpen.filter((s) => !s.due_on || s.due_on >= wEndK);
    const tHechos = todos.filter((s) => s.status === 'done');
    const todoRow = (s) => {
      const late = s.due_on && s.due_on < tkey;
      return h('div', { class: 'ckrow' + (s.status === 'done' ? ' done' : '') },
        h('button', { class: 'tick', type: 'button', 'aria-pressed': s.status === 'done' ? 'true' : 'false', 'aria-label': s.title,
          onclick: (e) => run(e.currentTarget, async () => {
            await API.setScopeStatus(s.id, s.status === 'done' ? 'pending' : 'done', s.status === 'done' ? null : tkey);
            scopePane(box, p, names, myRole, go);
          }) }, ico('check', 15)),
        h('div', { class: 'tx' }, h('b', null, s.title),
          h('small', null, s.due_on ? h('span', { class: late ? 'pill late' : '' }, fDate(s.due_on + 'T12:00:00', { weekday: 'short', month: 'short', day: 'numeric' })) : null,
            s.notes ? h('span', null, s.notes) : null)),
        isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'),
          onclick: () => taskEditor(s, pid, () => scopePane(box, p, names, myRole, go)) }, ico('edit', 15)) : null);
    };

    const taskRow = (s) => {
      const late = s.status !== 'done' && s.due_on && daysBetween(today, new Date(s.due_on + 'T12:00:00')) < 0;
      const acts = [];
      if (canMove) {
        if (s.status === 'pending' || s.status === 'blocked') acts.push(['active', t('start_task'), '']);
        if (s.status === 'active') acts.push(['done', t('finish_task'), ''], ['blocked', t('mark_blocked'), 'ghost']);
        if (s.status === 'done') acts.push(['active', t('reopen_task'), 'ghost']);
      }
      let tail = null;
      if (s.status === 'done' && s.done_on && s.due_on) {
        const g = daysBetween(new Date(s.done_on + 'T12:00:00'), new Date(s.due_on + 'T12:00:00'));
        tail = g > 0 ? chip(g === 1 ? t('won_one') : t('won_days', { n: g }), 'ok') : g === 0 ? chip(t('on_time'), 'ok')
          : chip(Math.abs(g) === 1 ? t('lost_one') : t('lost_days', { n: Math.abs(g) }), 'bad');
      }
      return h('div', { class: 'srow s-' + s.status + (late ? ' late' : '') },
        h('span', { class: 'sdot' }),
        h('div', { class: 'sx' }, h('b', null, s.title),
          h('small', null, [s.trade, s.due_on ? fDate(s.due_on + 'T12:00:00', { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')),
          h('div', { class: 'row gap' }, chip(t('si_' + s.status), s.status === 'done' ? 'ok' : s.status === 'active' ? 'gold' : s.status === 'blocked' ? 'bad' : 'mut'), tail)),
        h('div', { class: 'sact' },
          acts.map(([k, lbl, cls]) => h('button', { class: 'btn sm ' + cls, type: 'button', onclick: (e) => run(e.currentTarget, async () => {
            await API.setScopeStatus(s.id, k, k === 'done' ? dkey(new Date()) : null); scopePane(box, p, names, myRole, go);
          }) }, lbl)),
          isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => taskEditor(s, pid, () => scopePane(box, p, names, myRole, go)) }, ico('edit', 15)) : null));
    };

    fill(box, 
      h('div', { class: 'card where' }, ring(st.pct, 72),
        h('div', null, h('h3', null, t('scope_where')), h('p', { class: 'mut' }, st.has ? t('of_scope', { a: st.done, b: st.total }) : st.manual ? t('from_tracker') : t('no_scope')))),
      banners.length ? h('div', { class: 'bans' }, banners.map(([k, txt]) => h('div', { class: 'ban ' + k }, k === 'won' ? ico('check', 20) : ico('clock', 20), h('b', null, txt)))) : null,
      h('div', { class: 'sech', style: 'margin-top:4px' }, h('h3', { class: 'sub', style: 'margin:0' }, t('daily_check'), ' ', chip(String(tHoy.length), tHoy.length ? 'warn' : 'ok')),
        isStaff() ? h('button', { class: 'lnk', type: 'button', onclick: () => taskEditor(null, pid, () => scopePane(box, p, names, myRole, go), 'todo') }, t('add_todo')) : null),
      tHoy.length ? h('div', { class: 'cklist' }, tHoy.map(todoRow)) : h('p', { class: 'mut small' }, t('nothing_today')),
      tSemana.length ? h('h3', { class: 'sub' }, t('weekly_check')) : null,
      tSemana.length ? h('div', { class: 'cklist' }, tSemana.map(todoRow)) : null,
      tLuego.length ? h('h3', { class: 'sub' }, t('later')) : null,
      tLuego.length ? h('div', { class: 'cklist' }, tLuego.map(todoRow)) : null,
      tHechos.length ? h('h3', { class: 'sub' }, t('done_label')) : null,
      tHechos.length ? h('div', { class: 'cklist' }, tHechos.slice(-6).map(todoRow)) : null,
      daily.length ? h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, t('routine')), chip(t('done_today', { a: dDone, b: daily.length }), dDone === daily.length ? 'ok' : 'warn')),
        h('div', { class: 'cklist', style: 'margin-top:10px' }, daily.map((s) => checkRow(s, tkey)))) : null,
      weekly.length ? h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, t('weekly_check')), chip(t('done_week', { a: wDone, b: weekly.length }), wDone === weekly.length ? 'ok' : 'warn')),
        h('div', { class: 'cklist', style: 'margin-top:10px' }, weekly.map((s) => checkRow(s, wkey)))) : null,
      h('div', { class: 'sech', style: 'margin-top:18px' }, h('h3', null, t('whats_next')),
        isStaff() ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => taskEditor(null, pid, () => scopePane(box, p, names, myRole, go)) }, ico('plus', 16), t('add_task')) : null),
      once.length ? h('div', { class: 'slist' }, once.map(taskRow)) : empty(t('no_scope'), isStaff() ? t('no_scope_staff') : ''),
      h('button', { class: 'btn big mats', type: 'button', onclick: () => go('materials') }, ico('receipt', 20), t('materials_needed')),
      isViewer() ? h('div', { id: 'healthslot' }) : null);
    /* La plata solo la ve quien la tiene que ver */
    const hs = box.querySelector('#healthslot');
    if (hs) fillHealth(hs, p, st.pct);
  }
  async function fillHealth(slot, p, pct) {
    if (!p.contract) { fill(slot, isStaff() ? h('p', { class: 'mut small' }, t('set_contract')) : null); return; }
    try {
      const [exp, rec] = await Promise.all([API.expenses('2000-01-01', '2100-01-01'), API.receipts()]);
      const spent = exp.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0)
        + rec.filter((m) => m.project_id === p.id).reduce((s, m) => s + Number(m.amount || 0), 0);
      const hl = health(p, pct, spent, hasCostsFor(p.id, exp, rec));
      if (hl.key === 'nodata') {
        fill(slot, h('div', { class: 'card hcard nodata' }, h('div', { class: 'row between' }, h('h3', null, t('health_h')), chip(t('fs_nodata'), 'mut')),
          h('div', { class: 'hgrid' }, h('div', null, h('span', null, t('contract_value')), h('b', null, money(p.contract)))),
          h('p', { class: 'mut small' }, t('no_costs_yet'))));
        return;
      }
      fill(slot, h('div', { class: 'card hcard ' + hl.key },
        h('div', { class: 'row between' }, h('h3', null, t('health_h')), healthChip(hl.key)),
        h('div', { class: 'hgrid' },
          h('div', null, h('span', null, t('contract_value')), h('b', null, money(p.contract))),
          h('div', null, h('span', null, t('earned')), h('b', null, money(hl.earned))),
          h('div', null, h('span', null, t('spent_so_far')), h('b', null, money(spent))),
          h('div', null, h('span', null, t('margin_now')), h('b', null, hl.margin == null ? '—' : Math.round(hl.margin * 100) + '%'))),
        h('p', { class: 'mut small' }, t('health_hint') + ' ' + t('no_labor'))));
    } catch (e) { fill(slot); }
  }

  function taskEditor(s, pid, done, preKind) {
    const kind = (s && s.kind) || preKind || 'phase';
    const f = { title: h('input', { required: true, value: s ? s.title : '' }), trade: h('input', { value: s ? s.trade : '' }),
      notes: h('textarea', { rows: 2 }),
      cadence: h('select', null, ['once', 'daily', 'weekly'].map((k) => h('option', { value: k }, t('cad_' + k)))),
      due: h('input', { type: 'date', value: s && s.due_on ? s.due_on : '' }),
      weight: h('input', { type: 'number', step: '0.5', min: '0.5', value: s ? s.weight : 1 }),
      sort: h('input', { type: 'number', value: s ? s.sort : 10 }) };
    f.cadence.value = s ? s.cadence : 'once'; f.notes.value = s ? s.notes : '';
    const dueF = field(t('due_date'), f.due); const wF = field(t('weight'), f.weight, t('weight_hint'));
    const upd = () => { const once = f.cadence.value === 'once'; dueF.hidden = !once; wF.hidden = !once || kind === 'todo'; };
    f.cadence.addEventListener('change', upd); upd();
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(s ? t('edit_task') : (kind === 'todo' ? t('add_todo') : t('add_task')), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      await API.saveScopeItem({ id: s && s.id, project_id: pid, title: f.title.value.trim(), trade: f.trade.value.trim(), kind,
        cadence: f.cadence.value, due_on: f.cadence.value === 'once' ? (f.due.value || null) : null,
        weight: kind === 'todo' ? 1 : (f.cadence.value === 'once' ? Number(f.weight.value) || 1 : 1),
        status: s ? s.status : 'pending', done_on: s ? s.done_on : null, notes: f.notes.value.trim(), sort: Number(f.sort.value) || 10 });
      m.close(); toast(t('saved')); done(); }); } },
      field(kind === 'todo' ? t('todo_title') : t('task_title'), f.title),
      kind === 'todo' ? null : h('div', { class: 'two' }, field(t('trade'), f.trade), field(t('cadence'), f.cadence)),
      h('div', { class: 'two' }, dueF, wF), field(t('notes'), f.notes), field('Orden', f.sort),
      h('div', { class: 'acts' }, s ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_task_q'))) { await API.deleteScopeItem(s.id); m.close(); done(); } } }, t('delete')) : null, save)));
  }

  /* ---------- MATERIALES ---------- */
  async function materialsPane(box, p, names, canAdd) {
    fill(box, spin());
    let list;
    try { list = await API.materials(p.id); }
    catch (e) { console.warn(e); fill(box, empty(t('err_generic'), errText(e))); return; }
    const byNeed = (a, b) => String(a.needed_by || '9999').localeCompare(String(b.needed_by || '9999'));
    const pend = list.filter((m) => !m.bought).sort(byNeed), done = list.filter((m) => m.bought);
    const row = (m) => h('div', { class: 'ckrow' + (m.bought ? ' done' : '') },
      h('button', { class: 'tick', type: 'button', 'aria-pressed': m.bought ? 'true' : 'false', 'aria-label': t('mark_bought'), onclick: (e) => run(e.currentTarget, async () => {
        await API.setBought(m.id, !m.bought); materialsPane(box, p, names, canAdd); }) }, ico('check', 15)),
      h('div', { class: 'tx' }, h('b', null, m.title),
        h('small', null, [m.qty, m.vendor, m.est_cost ? money(m.est_cost) : '', m.needed_by ? fDate(m.needed_by + 'T12:00:00', { month: 'short', day: 'numeric' }) : '',
          m.bought && m.bought_by ? t('bought_by_on', { n: names[m.bought_by] || '—', d: fDate(m.bought_on + 'T12:00:00', { month: 'short', day: 'numeric' }) }) : ''].filter(Boolean).join(' · '))),
      isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => materialEditor(m, p.id, () => materialsPane(box, p, names, canAdd)) }, ico('edit', 15)) : null);
    const total = pend.reduce((s, m) => s + Number(m.est_cost || 0), 0);
    fill(box, 
      h('div', { class: 'sech' }, h('h3', null, t('materials_h')),
        canAdd ? h('button', { class: 'btn sm', type: 'button', onclick: () => materialEditor(null, p.id, () => materialsPane(box, p, names, canAdd)) }, ico('plus', 16), t('add_material')) : null),
      h('div', { class: 'stats' }, h('div', { class: 'stat ' + (pend.length ? 'warn' : 'ok') }, h('span', null, t('to_buy')), h('b', null, pend.length), total ? h('small', null, money(total)) : null),
        h('div', { class: 'stat' }, h('span', null, t('bought_label')), h('b', null, done.length))),
      pend.length ? h('div', { class: 'cklist' }, pend.map(row)) : empty(t('no_materials')),
      done.length ? h('h3', { class: 'sub' }, t('bought_label')) : null,
      done.length ? h('div', { class: 'cklist' }, done.map(row)) : null);
  }
  function materialEditor(m, pid, done) {
    const f = { title: h('input', { required: true, value: m ? m.title : '' }), qty: h('input', { value: m ? m.qty : '', placeholder: '2 cajas, 14 láminas…' }),
      vendor: h('input', { value: m ? m.vendor : '', placeholder: t('vendor_ph') }), needed: h('input', { type: 'date', value: m && m.needed_by ? m.needed_by : '' }),
      cost: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: m && m.est_cost != null ? m.est_cost : '' }) };
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const mo = modal(m ? t('edit_material') : t('add_material'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      await API.saveMaterial({ id: m && m.id, project_id: pid, title: f.title.value.trim(), qty: f.qty.value.trim(), vendor: f.vendor.value.trim(),
        needed_by: f.needed.value || null, est_cost: f.cost.value === '' ? null : Number(f.cost.value) });
      mo.close(); toast(t('saved')); done(); }); } },
      field(t('material_title'), f.title), h('div', { class: 'two' }, field(t('qty'), f.qty), field(t('vendor'), f.vendor)),
      h('div', { class: 'two' }, field(t('needed_by'), f.needed), field(t('est_cost') + ' ($)', f.cost)),
      h('div', { class: 'acts' }, m && isStaff() ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_material_q'))) { await API.deleteMaterial(m.id); mo.close(); done(); } } }, t('delete')) : null, save)));
  }

  /* ---------- SELECCIONES DEL CLIENTE ----------
     Lo que el cliente tiene que escoger. La fecha manda: lo que no se escoge a tiempo
     no llega, y el cronograma se corre. Por eso el plazo va arriba de todo.
     allowance = lo que se presupuestó. Costo real = lo que costó lo que escogió.
     La resta entre las dos es exactamente por donde se va la ganancia. */
  async function selectionsPane(box, p, names) {
    fill(box, spin());
    let list;
    try { list = await API.selections(p.id); }
    catch (e) { console.warn(e); fill(box, empty(t('err_generic'), errText(e))); return; }
    const rank = { pending: 0, chosen: 1, ordered: 2 };
    const sorted = list.slice().sort((a, b) => (rank[a.status] - rank[b.status])
      || String(a.due_on || '9999').localeCompare(String(b.due_on || '9999')) || (a.sort - b.sort));
    const pend = list.filter((x) => x.status === 'pending');
    const today = new Date();
    const redo = () => selectionsPane(box, p, names);

    /* el plazo que corre es el más cercano de lo que TODAVÍA no se escoge */
    const nextDue = pend.map((x) => x.due_on).filter(Boolean).sort()[0] || null;
    let dueLine = null;
    if (nextDue) {
      const n = daysBetween(today, new Date(nextDue + 'T12:00:00'));
      const txt = n < 0 ? (n === -1 ? t('sel_late_one') : t('sel_late', { n: -n }))
        : n === 0 ? t('sel_today') : n === 1 ? t('sel_days_one') : t('sel_days_left', { n: n });
      dueLine = h('div', { class: 'seldue' + (n <= 7 ? ' hot' : '') },
        h('b', null, txt),
        h('span', null, fDate(nextDue + 'T12:00:00', { month: 'long', day: 'numeric' }) + ' · ' + t('sel_blocks')));
    }

    /* Plata: solo sumo lo que tiene allowance cargado. Sin eso no invento totales. */
    const withAll = list.filter((x) => x.allowance != null);
    const allTotal = withAll.reduce((a, x) => a + Number(x.allowance), 0);
    const actTotal = withAll.reduce((a, x) => a + Number(x.actual_cost != null ? x.actual_cost : x.allowance), 0);
    const diff = Math.round((actTotal - allTotal) * 100) / 100;
    const diffTxt = diff > 0 ? t('sel_over', { m: money(diff) })
      : diff < 0 ? t('sel_under', { m: money(-diff) }) : t('sel_oncost');

    const row = (x) => {
      const cls = x.status === 'pending' ? 'warn' : x.status === 'ordered' ? 'ok' : 'gold';
      const over = x.allowance != null && x.actual_cost != null && Number(x.actual_cost) > Number(x.allowance);
      const bits = [x.room,
        x.install_on ? t('sel_installs', { d: fDate(x.install_on + 'T12:00:00', { month: 'short', day: 'numeric' }) }) : '',
        x.allowance != null ? (x.actual_cost != null ? money(x.allowance) + ' → ' + money(x.actual_cost) : money(x.allowance)) : '',
        x.choice].filter(Boolean);
      return h('div', { class: 'ckrow sel' + (x.status === 'pending' ? '' : ' set') },
        chip(t('ss_' + x.status), cls),
        h('div', { class: 'tx' }, h('b', null, x.title),
          h('small', null, bits.join(' · '),
            over ? chip(t('sel_over', { m: money(Number(x.actual_cost) - Number(x.allowance)) }), 'bad') : null)),
        isStaff() ? h('button', { class: 'btn ghost sm', type: 'button',
          onclick: () => optionsManager(x, p.id, redo) }, t('opts_btn')) : null,
        isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'),
          onclick: () => selectionEditor(x, p.id, redo) }, ico('edit', 15)) : null);
    };

    fill(box,
      h('div', { class: 'sech' }, h('h3', null, t('sel_h')),
        isStaff() ? h('button', { class: 'btn sm', type: 'button',
          onclick: () => selectionEditor(null, p.id, redo) }, ico('plus', 16), t('add_selection')) : null),
      dueLine,
      h('div', { class: 'stats' },
        h('div', { class: 'stat ' + (pend.length ? 'warn' : 'ok') }, h('span', null, t('sel_pending')), h('b', null, pend.length)),
        withAll.length ? h('div', { class: 'stat' }, h('span', null, t('sel_budget')), h('b', null, money(allTotal))) : null,
        withAll.length ? h('div', { class: 'stat ' + (diff > 0 ? 'bad' : diff < 0 ? 'ok' : '') },
          h('span', null, t('sel_picked')), h('b', null, money(actTotal)), h('small', null, diffTxt)) : null),
      withAll.length ? null : h('p', { class: 'selnote' }, h('b', null, t('sel_no_allow')), ' ', t('sel_no_allow_sub')),
      sorted.length ? h('div', { class: 'cklist' }, sorted.map(row)) : empty(t('sel_empty'), t('sel_empty_sub')));
  }


  /* ---------- las opciones que el cliente va a ver ----------
     Aquí se le arman: foto, link y precio. Sin esto el cliente escribe a ciegas. */
  async function optionsManager(sel, pid, done) {
    const body = h('div', { class: 'mb' }, spin());
    const mo = modal(t('opts_h') + ' · ' + sel.title, body, { wide: true });

    async function draw() {
      let list;
      try { list = await API.options(sel.id); }
      catch (e) { fill(body, empty(t('err_generic'), errText(e))); return; }
      const urls = await resolveUrls(list.map((o) => o.photo_path)).catch(() => ({}));

      const row = (o) => h('div', { class: 'optrow' },
        o.photo_path && urls[o.photo_path]
          ? h('img', { class: 'othumb', src: safeUrl(urls[o.photo_path]), alt: '' })
          : h('div', { class: 'othumb none' }),
        h('div', { class: 'tx' }, h('b', null, o.title),
          h('small', null, [o.title_en, o.extra, o.note, o.price != null ? money(o.price) : '',
            o.link ? t('opts_haslink') : ''].filter(Boolean).join(' · ')),
          o.from_client ? chip(t('opts_fromclient'), 'gold') : null,
          sel.chosen_option_id === o.id ? chip(t('opts_chosen'), 'ok') : null),
        h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'),
          onclick: () => form(o) }, ico('edit', 15)));

      fill(body,
        h('p', { class: 'mut sm' }, t('opts_p')),
        list.length ? h('div', { class: 'optlist' }, list.map(row)) : empty(t('opts_none')),
        h('div', { class: 'acts' }, h('button', { class: 'btn', type: 'button',
          onclick: () => form(null) }, ico('plus', 16), t('opts_add'))));
    }

    function form(o) {
      const f = {
        title: h('input', { required: true, value: o ? o.title : '' }),
        title_en: h('input', { value: o ? o.title_en : '', placeholder: t('opts_en_ph') }),
        note: h('input', { value: o ? o.note : '', placeholder: t('opts_note_ph') }),
        extra: h('input', { value: o ? o.extra : '', placeholder: t('opts_extra_ph') }),
        link: h('input', { type: 'url', value: o ? o.link : '', placeholder: 'https://…' }),
        price: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal',
          value: o && o.price != null ? o.price : '' }),
        photo: h('input', { type: 'file', accept: 'image/*' }),
      };
      const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
      const m2 = modal(o ? t('opts_edit') : t('opts_add'),
        h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
          await API.saveOption({
            id: o && o.id, selection_id: sel.id, project_id: pid,
            title: f.title.value.trim(), title_en: f.title_en.value.trim(),
            note: f.note.value.trim(), link: f.link.value.trim(),
            extra: f.extra.value.trim(),
            price: f.price.value === '' ? null : Number(f.price.value),
            sort: o ? o.sort : Date.now() % 100000,
          }, f.photo.files && f.photo.files[0]);
          m2.close(); toast(t('saved')); draw(); done();
        }); } },
          field(t('opts_title'), f.title),
          field(t('opts_en'), f.title_en),
          h('div', { class: 'two' }, field(t('opts_note'), f.note), field(t('opts_price') + ' ($)', f.price)),
          field(t('opts_extra'), f.extra),
          field(t('opts_link'), f.link),
          field(t('opts_photo'), f.photo),
          h('div', { class: 'acts' },
            o ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
              if (await askConfirm(t('opts_del_q'))) { await API.deleteOption(o.id); m2.close(); draw(); done(); }
            } }, t('delete')) : null,
            save)));
    }

    draw();
  }

  function selectionEditor(x, pid, done) {
    const f = {
      title: h('input', { required: true, value: x ? x.title : '' }),
      room: h('input', { value: x ? x.room : '', placeholder: 'Cocina, Baño, Closets…' }),
      status: h('select', { value: x ? x.status : 'pending' },
        ['pending', 'chosen', 'ordered'].map((k) => h('option', { value: k }, t('ss_' + k)))),
      due: h('input', { type: 'date', value: x && x.due_on ? x.due_on : '' }),
      install: h('input', { type: 'date', value: x && x.install_on ? x.install_on : '' }),
      allow: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: x && x.allowance != null ? x.allowance : '' }),
      actual: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: x && x.actual_cost != null ? x.actual_cost : '' }),
      choice: h('input', { value: x ? x.choice : '', placeholder: t('sel_choice_ph') }),
      notes: h('textarea', { rows: 3 }, x ? x.notes : '') };
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const mo = modal(x ? t('edit_selection') : t('add_selection'),
      h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
        const body = { title: f.title.value.trim(), room: f.room.value.trim(), status: f.status.value,
          due_on: f.due.value || null, install_on: f.install.value || null,
          allowance: f.allow.value === '' ? null : Number(f.allow.value),
          actual_cost: f.actual.value === '' ? null : Number(f.actual.value),
          choice: f.choice.value.trim(), notes: f.notes.value.trim() };
        if (x) await API.setSelection(x.id, body);
        else await API.saveSelection({ ...body, project_id: pid });
        mo.close(); toast(t('saved')); done(); }); } },
        field(t('sel_title'), f.title),
        h('div', { class: 'two' }, field(t('sel_room'), f.room), field(t('sel_status'), f.status)),
        h('div', { class: 'two' }, field(t('sel_due'), f.due), field(t('sel_install'), f.install)),
        h('div', { class: 'two' }, field(t('sel_allowance') + ' ($)', f.allow), field(t('sel_actual') + ' ($)', f.actual)),
        field(t('sel_choice'), f.choice), field(t('sel_notes'), f.notes),
        h('div', { class: 'acts' },
          x && isStaff() ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
            if (await askConfirm(t('del_selection_q'))) { await API.deleteSelection(x.id); mo.close(); done(); } } }, t('delete')) : null,
          save)));
  }

  /* ---------- chat del proyecto ---------- */
  const urlCache = {};
  async function resolveUrls(paths) {
    const need = paths.filter((p) => p && !(urlCache[p] && urlCache[p].exp > Date.now()));
    if (need.length) { const got = await API.urls(need); Object.keys(got).forEach((k) => { urlCache[k] = { url: got[k], exp: Date.now() + 50 * 60000 }; }); }
    const o = {}; paths.forEach((p) => { if (urlCache[p]) o[p] = urlCache[p].url; }); return o;
  }
  function lightbox(url, title) { modal(title || '', h('div', { class: 'mb' }, h('img', { class: 'lbimg', src: safeUrl(url), alt: title || '' })), { wide: true }); }

  function feedPane(box, pid, names, canPost) {
    const list = h('div', { class: 'feed', role: 'log', 'aria-live': 'polite' }, spin());
    let last = '', mode = 'text', file = null;
    const txt = h('textarea', { rows: 1, placeholder: t('msg_ph'), 'aria-label': t('msg_ph') });
    const amount = h('input', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0', placeholder: '0.00', 'aria-label': t('amount') });
    const vendor = h('input', { placeholder: t('vendor_ph'), 'aria-label': t('vendor') });
    const rcFields = h('div', { class: 'rcf', hidden: true }, field(t('amount') + ' ($)', amount), field(t('vendor'), vendor));
    const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-hidden': 'true', onchange: (e) => { file = e.target.files[0] || null; drawChip(); } });
    const chipBox = h('div', { class: 'fchipbox' });
    const sendBtn = h('button', { class: 'btn send', type: 'button', 'aria-label': t('send') }, ico('send', 18));
    const mkMode = (k, icon, label) => h('button', { type: 'button', class: 'mbtn', 'aria-pressed': 'false', onclick: (e) => {
      if (k === 'receipt') { mode = mode === 'receipt' ? 'text' : 'receipt'; rcFields.hidden = mode !== 'receipt'; e.currentTarget.setAttribute('aria-pressed', mode === 'receipt' ? 'true' : 'false'); e.currentTarget.classList.toggle('on', mode === 'receipt'); if (mode === 'receipt' && !file) fileIn.click(); }
      else fileIn.click(); }, title: label }, ico(icon, 20), h('span', null, label));
    function drawChip() { fill(chipBox, file ? h('span', { class: 'fch' }, ico('camera', 14), file.name, h('button', { class: 'ib', type: 'button', 'aria-label': t('remove'), onclick: () => { file = null; fileIn.value = ''; drawChip(); } }, ico('x', 12))) : null); }
    async function load(first) {
      const msgs = await API.messages(pid);
      const sig = msgs.length + ':' + (msgs.length ? msgs[msgs.length - 1].id : '');
      if (!first && sig === last) return; last = sig;
      const urls = await resolveUrls(msgs.map((m) => m.file_path));
      const atBottom = first || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      fill(list);
      if (!msgs.length) list.append(empty(t('feed_empty'), t('feed_empty_sub')));
      let day = '';
      msgs.forEach((m) => {
        const k = dkey(m.created_at);
        if (k !== day) { day = k; list.append(h('div', { class: 'dsep' }, h('span', null, fDate(m.created_at, { weekday: 'long', month: 'short', day: 'numeric' })))); }
        const mine = m.author_id === S.me.id;
        const who = mine ? t('you') : (names[m.author_id] || 'Proven Solutions');
        const bub = h('div', { class: 'bub' + (mine ? ' mine' : '') + (m.kind === 'receipt' ? ' rc' : '') },
          h('div', { class: 'bh' }, h('b', null, who), h('time', null, fTime(m.created_at))));
        if (m.kind === 'receipt') {
          bub.append(h('div', { class: 'rcard' },
            m.file_path && urls[m.file_path] ? h('button', { class: 'thumb', type: 'button', 'aria-label': t('view_receipt'), onclick: () => lightbox(urls[m.file_path], (m.vendor || t('receipt')) + ' · ' + money(m.amount)) }, h('img', { src: safeUrl(urls[m.file_path]), alt: t('receipt'), loading: 'lazy' })) : h('div', { class: 'thumb ph' }, ico('receipt', 26)),
            h('div', { class: 'rinfo' }, h('span', { class: 'rl' }, t('receipt')), h('b', { class: 'amt' }, money(m.amount)), m.vendor ? h('span', null, m.vendor) : null)));
          if (m.body) bub.append(h('p', null, m.body));
        } else {
          if (m.file_path && urls[m.file_path]) bub.append(h('button', { class: 'thumb big', type: 'button', onclick: () => lightbox(urls[m.file_path], who), 'aria-label': t('view_photo') }, h('img', { src: safeUrl(urls[m.file_path]), alt: t('photo'), loading: 'lazy' })));
          if (m.body) bub.append(h('p', null, m.body));
        }
        if (isAdmin()) bub.append(h('button', { class: 'ib del', type: 'button', 'aria-label': t('delete'), onclick: async () => { if (await askConfirm(t('del_msg_q'))) { await API.deleteMessage(m.id); last = ''; load(true); } } }, ico('x', 12)));
        list.append(bub);
      });
      if (atBottom) list.scrollTop = list.scrollHeight;
    }
    sendBtn.addEventListener('click', () => run(sendBtn, async () => {
      const body = txt.value.trim(); const kind = mode === 'receipt' ? 'receipt' : file ? 'photo' : 'text';
      if (kind === 'text' && !body) return;
      let amt = null;
      if (kind === 'receipt') {
        amt = parseFloat(amount.value);
        if (!(amt >= 0) || isNaN(amt)) { toast(t('need_amount'), true); return; }
        if (!file) { toast(t('need_photo'), true); return; }
      }
      await API.postMessage({ project_id: pid, author_id: S.me.id, kind, body, amount: amt, vendor: vendor.value.trim(), file });
      txt.value = ''; amount.value = ''; vendor.value = ''; file = null; fileIn.value = ''; mode = 'text'; rcFields.hidden = true; drawChip();
      box.querySelectorAll('.mbtn').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
      last = ''; await load(true); txt.style.height = '';
    }));
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width:700px)').matches) { e.preventDefault(); sendBtn.click(); } });
    txt.addEventListener('input', () => { txt.style.height = 'auto'; txt.style.height = Math.min(txt.scrollHeight, 120) + 'px'; });
    box.append(h('div', { class: 'chatbox' }, list, canPost === false ? null : h('div', { class: 'comp' }, rcFields, chipBox, h('div', { class: 'crow' }, mkMode('photo', 'camera', t('photo')), mkMode('receipt', 'receipt', t('receipt')), txt, sendBtn), fileIn)));
    load(true).catch((e) => { fill(list, empty(t('err_generic'), errText(e))); });
    S.timers.push(setInterval(() => { load(false).catch(() => {}); }, 8000));
  }

  async function receiptsPane(box, pid, names) {
    box.append(spin());
    let all;
    try { all = (await API.messages(pid)).filter((m) => m.kind === 'receipt').reverse(); }
    catch (e) { console.warn(e); fill(box, empty(t('err_generic'), errText(e))); return; }
    const urls = await resolveUrls(all.map((m) => m.file_path));
    const total = all.reduce((s, m) => s + Number(m.amount || 0), 0);
    fill(box, h('div', { class: 'stat' }, h('span', null, t('total_receipts')), h('b', null, money(total)), h('small', null, t('n_receipts', { n: all.length }))),
      isStaff() ? h('div', { class: 'row end' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => exportReceipts(all, names, { [pid]: { name: pid } }, 'recibos-' + pid) }, ico('down', 16), 'CSV')) : null,
      all.length ? receiptGrid(all, urls, names) : empty(t('no_receipts')));
  }
  function receiptGrid(list, urls, names, projects) {
    return h('div', { class: 'rgrid' }, list.map((m) => h('div', { class: 'card rit' },
      m.file_path && urls[m.file_path] ? h('button', { class: 'thumb', type: 'button', onclick: () => lightbox(urls[m.file_path], (m.vendor || t('receipt')) + ' · ' + money(m.amount)), 'aria-label': t('view_receipt') }, h('img', { src: safeUrl(urls[m.file_path]), alt: t('receipt'), loading: 'lazy' })) : h('div', { class: 'thumb ph' }, ico('receipt', 24)),
      h('div', { class: 'rinfo' }, h('b', { class: 'amt' }, money(m.amount)), h('span', null, m.vendor || '—'), projects && projects[m.project_id] ? h('span', { class: 'mut' }, projects[m.project_id].name) : null,
        h('small', { class: 'mut' }, (names[m.author_id] || 'Proven') + ' · ' + fDT(m.created_at)), m.body ? h('small', null, m.body) : null))));
  }
  function exportReceipts(list, names, projects, file) {
    const rows = [['date', 'project', 'vendor', 'amount', 'note', 'by'].map(csvCell).join(',')];
    list.slice().reverse().forEach((m) => rows.push([dkey(m.created_at), (projects[m.project_id] || {}).name || '', m.vendor, Number(m.amount || 0).toFixed(2), m.body, names[m.author_id] || ''].map(csvCell).join(',')));
    download(file + '.csv', rows.join('\n'));
  }

  function teamPane(box, p, people, profiles) {
    const pm = {}; profiles.forEach((x) => { pm[x.id] = x; });
    box.append(people.length ? h('div', { class: 'grid' }, people.map((x) => h('div', { class: 'card person' }, h('span', { class: 'av' }, ini(x.full_name)),
      h('div', null, h('b', null, x.full_name), h('div', { class: 'row gap' }, chip(t(x.role === 'foreman' ? 'foreman' : 'member'), x.role === 'foreman' ? 'gold' : 'mut'))),
      pm[x.id] && pm[x.id].phone ? h('a', { class: 'lnk', href: 'tel:' + pm[x.id].phone.replace(/[^\d+]/g, '') }, pm[x.id].phone) : null))) : empty(t('no_team')));
  }

  /* ============================ RELOJ ============================ */
  async function clockCard(box, opts) {
    opts = opts || {};
    const card = h('div', { class: 'card clock' }); box.append(card);
    let projects = opts.projects;
    async function draw() {
      const open = await API.myOpen();
      if (!projects) projects = await API.projects();
      const pname = (id) => (projects.find((p) => p.id === id) || {}).name || '—';
      fill(card);
      if (!open) {
        const choices = projects.filter((p) => p.status === 'active');
        const sel = h('select', { 'aria-label': t('project') }, choices.map((p) => h('option', { value: p.id }, p.name)));
        if (opts.projectId) sel.value = opts.projectId;
        const go = h('button', { class: 'btn big', type: 'button' }, ico('clock', 20), t('clock_in'));
        go.addEventListener('click', () => run(go, async () => { await API.clockIn(opts.projectId || sel.value); toast(t('clocked_in_ok')); await draw(); if (opts.onChange) opts.onChange(); }));
        card.append(h('div', { class: 'ck off' }, h('div', null, h('span', { class: 'dot' }), h('b', null, t('not_clocked')), opts.projectId ? h('small', null, pname(opts.projectId)) : null),
          choices.length ? h('div', { class: 'ckact' }, opts.projectId ? null : sel, go) : h('small', null, t('no_active_projects'))));
        return;
      }
      const onBreak = (open.breaks || []).some((b) => !b.end_at);
      const net = h('b', { class: 'big' }); const upd = () => { net.textContent = hm(entryMin(open)); };
      upd(); S.timers.push(setInterval(upd, 20000));
      const brk = h('button', { class: 'btn ghost', type: 'button' }, onBreak ? t('end_break') : t('start_break'));
      brk.addEventListener('click', () => run(brk, async () => { await (onBreak ? API.endBreak() : API.startBreak()); await draw(); }));
      const out = h('button', { class: 'btn danger', type: 'button' }, t('clock_out'));
      out.addEventListener('click', () => run(out, async () => { if (!(await askConfirm(t('clock_out_q'), t('clock_out')))) return; await API.clockOut(); toast(t('clocked_out_ok')); await draw(); if (opts.onChange) opts.onChange(); }));
      card.append(h('div', { class: 'ck on' }, h('div', null, h('span', { class: 'dot live' }), h('b', null, onBreak ? t('on_break') : t('on_site')), h('small', null, pname(open.project_id) + ' · ' + t('since') + ' ' + fTime(open.clock_in))),
        h('div', { class: 'ckt' }, h('small', null, t('worked_today')), net), h('div', { class: 'ckact' }, brk, out)));
      if (opts.projectId && open.project_id !== opts.projectId) card.prepend(h('p', { class: 'warnbar' }, t('other_project', { name: pname(open.project_id) })));
    }
    try { await draw(); } catch (e) { fill(card, h('small', null, errText(e))); }
  }
  async function viewClock(main) {
    const me = S.me; const projects = await API.projects();
    const pm = {}; projects.forEach((p) => { pm[p.id] = p; });
    const slot = h('div'); const tsBox = h('div');
    fill(main, secH(t('tab_clock')), slot, h('h3', { class: 'sub' }, t('my_hours')), tsBox);
    await clockCard(slot, { projects, onChange: () => { fill(tsBox); timesheet(tsBox, { fixedPerson: me.id, names: { [me.id]: me.full_name }, projects: pm, canEdit: false }); } });
    timesheet(tsBox, { fixedPerson: me.id, names: { [me.id]: me.full_name }, projects: pm, canEdit: false });
  }

  /* ---------- hoja de horas (semana / mes) ---------- */
  function timesheet(box, o) {
    const st = S.ts; const bodyBox = h('div'); const ctrl = h('div', { class: 'tsbar' });
    box.append(ctrl, bodyBox);
    const range = () => {
      if (st.mode === 'week') { const a = weekStart(st.anchor); return [a, addDays(a, 7)]; }
      const a = new Date(st.anchor.getFullYear(), st.anchor.getMonth(), 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1)];
    };
    const label = () => { const [a, b] = range(); return st.mode === 'week' ? fDate(a, { month: 'short', day: 'numeric' }) + ' – ' + fDate(addDays(b, -1), { month: 'short', day: 'numeric' }) : fDate(a, { month: 'long', year: 'numeric' }); };
    const shift = (n) => { st.anchor = st.mode === 'week' ? addDays(st.anchor, 7 * n) : new Date(st.anchor.getFullYear(), st.anchor.getMonth() + n, 1); load(); };
    let rowsAll = [];
    async function load() {
      fill(bodyBox, spin()); drawCtrl();
      const [a, b] = range(); let rows = await API.entries(a, b);
      if (o.fixedPerson) rows = rows.filter((e) => e.worker_id === o.fixedPerson);
      if (o.fixedProject) rows = rows.filter((e) => e.project_id === o.fixedProject);
      if (!o.fixedPerson && st.person) rows = rows.filter((e) => e.worker_id === st.person);
      if (!o.fixedProject && st.project) rows = rows.filter((e) => e.project_id === st.project);
      rowsAll = rows; draw(rows, a, b);
    }
    function drawCtrl() {
      const personSel = !o.fixedPerson && o.people ? h('select', { 'aria-label': t('person'), onchange: (e) => { st.person = e.target.value; load(); } }, h('option', { value: '' }, t('everyone')), o.people.map((p) => h('option', { value: p.id }, p.full_name))) : null;
      if (personSel) personSel.value = st.person;
      const projSel = !o.fixedProject && o.projects ? h('select', { 'aria-label': t('project'), onchange: (e) => { st.project = e.target.value; load(); } }, h('option', { value: '' }, t('all_projects')), Object.keys(o.projects).map((k) => h('option', { value: k }, o.projects[k].name))) : null;
      if (projSel) projSel.value = st.project;
      fill(ctrl, h('div', { class: 'seg', role: 'group' }, ['week', 'month'].map((k) => h('button', { type: 'button', class: st.mode === k ? 'on' : '', 'aria-pressed': st.mode === k ? 'true' : 'false', onclick: () => { st.mode = k; load(); } }, t(k)))),
        h('div', { class: 'nav2' }, h('button', { class: 'ib', type: 'button', 'aria-label': t('prev'), onclick: () => shift(-1) }, ico('back', 18)), h('b', null, label()),
          h('button', { class: 'ib flip', type: 'button', 'aria-label': t('next'), onclick: () => shift(1) }, ico('back', 18)),
          h('button', { class: 'lnk', type: 'button', onclick: () => { st.anchor = new Date(); load(); } }, t('today'))),
        personSel, projSel,
        o.canEdit ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => entryEditor(null) }, ico('plus', 16), t('add_entry')) : null,
        o.canEdit || o.csv ? h('button', { class: 'btn ghost sm', type: 'button', onclick: exportCsv }, ico('down', 16), 'CSV') : null);
    }
    function exportCsv() {
      const rows = [['person', 'project', 'date', 'clock_in', 'clock_out', 'break_min', 'net_hours'].map(csvCell).join(',')];
      rowsAll.forEach((e) => rows.push([(o.names[e.worker_id] || ''), (o.projects && o.projects[e.project_id] ? o.projects[e.project_id].name : ''), dkey(e.clock_in), fTime(e.clock_in), e.clock_out ? fTime(e.clock_out) : '', Math.round(breakMin(e)), (entryMin(e) / 60).toFixed(2)].map(csvCell).join(',')));
      download((o.csvName || 'horas') + '-' + dkey(range()[0]) + '.csv', rows.join('\n'));
    }
    function draw(rows, a, b) {
      if (!rows.length) { fill(bodyBox, empty(t('no_hours'))); return; }
      const by = {}; rows.forEach((e) => { (by[e.worker_id] = by[e.worker_id] || []).push(e); });
      const days = []; if (st.mode === 'week') for (let i = 0; i < 7; i++) days.push(addDays(a, i));
      const ids = Object.keys(by).sort((x, y) => (o.names[x] || '').localeCompare(o.names[y] || ''));
      const grand = rows.reduce((s, e) => s + entryMin(e), 0);
      const tbl = h('table', { class: 'tt' });
      tbl.append(h('thead', null, h('tr', null, h('th', { class: 'sticky' }, t('person')),
        st.mode === 'week' ? days.map((d) => h('th', { class: 'num' + (dkey(d) === dkey(new Date()) ? ' today' : '') }, fDate(d, { weekday: 'short' }), h('small', null, d.getDate()))) : [h('th', { class: 'num' }, t('days')), h('th', { class: 'num' }, t('breaks'))],
        h('th', { class: 'num' }, t('total')))));
      const tb = h('tbody');
      ids.forEach((id) => {
        const es = by[id]; const tot = es.reduce((s, e) => s + entryMin(e), 0); let open = false;
        const detail = h('tr', { class: 'det', hidden: true }, h('td', { colspan: st.mode === 'week' ? 9 : 4 }, detailList(es)));
        const row = h('tr', { class: 'prow', tabindex: '0', role: 'button', 'aria-expanded': 'false', onclick: tog, onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } } },
          h('td', { class: 'sticky' }, h('span', { class: 'av sm' }, ini(o.names[id])), ' ', o.names[id] || '—', es.some((e) => !e.clock_out) ? h('span', { class: 'dot live sm', title: t('on_site') }) : null),
          st.mode === 'week' ? days.map((d) => { const m = es.filter((e) => dkey(e.clock_in) === dkey(d)).reduce((s, e) => s + entryMin(e), 0); return h('td', { class: 'num' + (m ? '' : ' z') }, m ? hm(m) : '·'); })
            : [h('td', { class: 'num' }, new Set(es.map((e) => dkey(e.clock_in))).size), h('td', { class: 'num' }, hm(es.reduce((s, e) => s + breakMin(e), 0)))],
          h('td', { class: 'num strong' }, hm(tot)));
        function tog() { open = !open; detail.hidden = !open; row.setAttribute('aria-expanded', open ? 'true' : 'false'); row.classList.toggle('open', open); }
        tb.append(row, detail);
      });
      tb.append(h('tr', { class: 'sum' }, h('td', { class: 'sticky' }, t('total')), st.mode === 'week' ? days.map((d) => h('td', { class: 'num' }, hm(rows.filter((e) => dkey(e.clock_in) === dkey(d)).reduce((s, e) => s + entryMin(e), 0)))) : [h('td'), h('td')], h('td', { class: 'num strong' }, hm(grand))));
      tbl.append(tb); fill(bodyBox, h('div', { class: 'tscroll' }, tbl), h('p', { class: 'mut small' }, t('tap_row')));
    }
    function detailList(es) {
      return h('ul', { class: 'dl' }, es.slice().sort((x, y) => x.clock_in.localeCompare(y.clock_in)).map((e) => h('li', null,
        h('span', { class: 'd1' }, fDate(e.clock_in)), h('span', { class: 'd2' }, (o.projects && o.projects[e.project_id] ? o.projects[e.project_id].name : '')),
        h('span', { class: 'd3' }, fTime(e.clock_in) + ' → ' + (e.clock_out ? fTime(e.clock_out) : t('on_site'))),
        h('span', { class: 'd4' }, t('break_short') + ' ' + hm(breakMin(e))), h('b', { class: 'd5' }, hm(entryMin(e))),
        o.canEdit ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: (ev) => { ev.stopPropagation(); entryEditor(e); } }, ico('edit', 15)) : null)));
    }
    function entryEditor(e) {
      const inn = h('input', { type: 'datetime-local', required: true, value: e ? toLocalInput(e.clock_in) : '' }); const out = h('input', { type: 'datetime-local', value: e ? toLocalInput(e.clock_out) : '' });
      const ws = o.people ? o.people.filter((p) => p.status === 'approved' && !p.is_admin && !p.is_client) : [];
      const wsel = h('select', { required: true }, ws.map((p) => h('option', { value: p.id }, p.full_name))); const psel = h('select', { required: true }, Object.keys(o.projects || {}).map((k) => h('option', { value: k }, o.projects[k].name)));
      if (o.fixedProject) psel.value = o.fixedProject;
      const err = h('p', { class: 'err' }); const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
      const m = modal(e ? t('edit_entry') : t('add_entry'), h('form', { class: 'mb frm', onsubmit: async (ev) => {
        ev.preventDefault(); const ci = fromLocalInput(inn.value), co = fromLocalInput(out.value);
        if (co && co <= ci) { err.textContent = t('out_after_in'); return; }
        await run(save, async () => { await API.saveEntry({ id: e && e.id, clock_in: ci, clock_out: co, worker_id: wsel.value, project_id: psel.value }); m.close(); toast(t('saved')); load(); });
      } }, e ? null : field(t('person'), wsel), e ? null : field(t('project'), psel), field(t('clock_in'), inn), field(t('clock_out'), out, t('leave_open')), err,
      h('div', { class: 'acts' }, e ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_entry_q'))) { await API.deleteEntry(e.id); m.close(); load(); } } }, t('delete')) : null, save)));
    }
    load().catch((er) => fill(bodyBox, empty(t('err_generic'), errText(er))));
  }

  /* ============================ ASISTENCIA (staff) ============================ */
  async function viewAttendance(main) {
    const [people, projects, openList] = await Promise.all([API.profiles(), API.projects(), API.openEntries()]);
    const names = {}; people.forEach((p) => { names[p.id] = p.full_name; });
    const pm = {}; projects.forEach((p) => { pm[p.id] = p; });
    const live = h('div', { class: 'card nowbox' });
    const drawNow = (list) => {
      fill(live, h('div', { class: 'row between' }, h('h3', null, h('span', { class: 'dot live' }), t('on_site_now')), chip(String(list.length), list.length ? 'ok' : 'mut')),
        list.length ? h('div', { class: 'nowlist' }, list.map((e) => { const br = (e.breaks || []).some((b) => !b.end_at);
          return h('div', { class: 'nowit' }, h('span', { class: 'av' }, ini(names[e.worker_id])), h('div', null, h('b', null, names[e.worker_id] || '—'), h('small', null, (pm[e.project_id] ? pm[e.project_id].name : '—') + ' · ' + t('since') + ' ' + fTime(e.clock_in))), br ? chip(t('on_break'), 'warn') : chip(hm(entryMin(e)), 'ok')); }))
          : h('p', { class: 'mut' }, t('nobody_now')));
    };
    drawNow(openList);
    S.timers.push(setInterval(async () => { try { drawNow(await API.openEntries()); } catch (e) { /* ok */ } }, 30000));
    const tsBox = h('div');
    fill(main, secH(t('tab_attendance')), live, h('h3', { class: 'sub' }, t('timesheet')), tsBox);
    timesheet(tsBox, { names, projects: pm, people, canEdit: true, csv: true, csvName: 'asistencia' });
  }

  /* ============================ RECIBOS (staff) ============================ */
  async function viewReceipts(main) {
    const [all, projects, people] = await Promise.all([API.receipts(), API.projects(), API.profiles()]);
    const names = {}; people.forEach((p) => { names[p.id] = p.full_name; });
    const pm = {}; projects.forEach((p) => { pm[p.id] = p; });
    const st = S.rc; const a = new Date(st.anchor.getFullYear(), st.anchor.getMonth(), 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    let list = all.filter((m) => +new Date(m.created_at) >= +a && +new Date(m.created_at) < +b);
    if (st.project) list = list.filter((m) => m.project_id === st.project);
    const urls = await resolveUrls(list.map((m) => m.file_path));
    const total = list.reduce((s, m) => s + Number(m.amount || 0), 0);
    const byP = {}; list.forEach((m) => { byP[m.project_id] = (byP[m.project_id] || 0) + Number(m.amount || 0); });
    const psel = h('select', { 'aria-label': t('project'), onchange: (e) => { st.project = e.target.value; refresh(); } }, h('option', { value: '' }, t('all_projects')), projects.map((p) => h('option', { value: p.id }, p.name))); psel.value = st.project;
    fill(main, secH(t('tab_receipts')),
      h('div', { class: 'tsbar' }, h('div', { class: 'nav2' }, h('button', { class: 'ib', type: 'button', 'aria-label': t('prev'), onclick: () => { st.anchor = new Date(a.getFullYear(), a.getMonth() - 1, 1); refresh(); } }, ico('back', 18)), h('b', null, fDate(a, { month: 'long', year: 'numeric' })),
        h('button', { class: 'ib flip', type: 'button', 'aria-label': t('next'), onclick: () => { st.anchor = new Date(a.getFullYear(), a.getMonth() + 1, 1); refresh(); } }, ico('back', 18))), psel,
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => exportReceipts(list, names, pm, 'recibos-' + dkey(a).slice(0, 7)) }, ico('down', 16), 'CSV')),
      h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('span', null, t('total_receipts')), h('b', null, money(total)), h('small', null, t('n_receipts', { n: list.length }))),
        Object.keys(byP).sort((x, y) => byP[y] - byP[x]).map((k) => h('div', { class: 'stat' }, h('span', null, pm[k] ? pm[k].name : '—'), h('b', null, money(byP[k]))))),
      list.length ? receiptGrid(list, urls, names, pm) : empty(t('no_receipts')));
  }

  /* ============================ TURNOS ============================ */
  async function viewShifts(main) {
    const shifts = await API.shifts();
    if (isStaff()) {
      const [claims, people] = await Promise.all([API.claims(), API.profiles()]);
      const nm = {}; people.forEach((p) => { nm[p.id] = p.full_name; });
      fill(main, secH(t('tab_shifts'), h('button', { class: 'btn sm', type: 'button', onclick: () => shiftEditor(null) }, ico('plus', 16), t('post_shift'))),
        shifts.length ? h('div', { class: 'grid' }, shifts.map((s) => h('div', { class: 'card shift' + (s.status === 'closed' ? ' dim' : '') },
          h('div', { class: 'row between' }, h('h3', null, s.title), statusChip(s.status)),
          h('p', { class: 'mut' }, [s.starts_at ? fDT(s.starts_at) : '', s.hours ? s.hours + ' h' : '', s.rate].filter(Boolean).join(' · ')),
          s.address ? h('p', { class: 'addr' }, ico('pin', 14), s.address) : null, h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, (s.taken / s.spots) * 100) + '%' })),
          h('small', null, t('spots_taken', { a: s.taken, b: s.spots })),
          h('div', { class: 'takers' }, claims.filter((c) => c.shift_id === s.id).map((c) => h('span', { class: 'chip mut' }, nm[c.worker_id] || '—', h('button', { class: 'ib x', type: 'button', 'aria-label': t('remove'), onclick: async () => { await API.removeClaim(s.id, c.worker_id); refresh(); } }, ico('x', 11))))),
          h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await API.saveShift({ id: s.id, status: s.status === 'open' ? 'closed' : 'open' }); refresh(); } }, s.status === 'open' ? t('close_shift') : t('reopen_shift')),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => shiftEditor(s) }, t('edit')),
            h('button', { class: 'btn ghost sm danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_shift_q'))) { await API.deleteShift(s.id); refresh(); } } }, t('delete')))))) : empty(t('no_shifts_staff')));
      return;
    }
    fill(main, secH(t('tab_shifts')), h('p', { class: 'mut' }, t('shifts_intro')),
      shifts.length ? h('div', { class: 'grid' }, shifts.map((s) => {
        const left = s.spots - s.taken; const full = left <= 0 && !s.mine; const closed = s.status === 'closed' && !s.mine;
        const btn = h('button', { class: 'btn' + (s.mine ? ' ghost' : ''), type: 'button', disabled: full || closed }, s.mine ? t('release') : full ? t('full') : closed ? t('st_closed') : t('accept_shift'));
        btn.addEventListener('click', () => run(btn, async () => { if (s.mine) { if (!(await askConfirm(t('release_q'), t('release')))) return; await API.releaseShift(s.id); } else { await API.claimShift(s.id); toast(t('shift_taken_ok')); } refresh(); }));
        return h('div', { class: 'card shift' + (full || closed ? ' dim' : '') }, h('div', { class: 'row between' }, h('h3', null, s.title), s.mine ? chip(t('youre_in'), 'ok') : chip(t('spots_left', { n: Math.max(0, left) }), left > 0 ? 'warn' : 'mut')),
          s.starts_at ? h('p', { class: 'when' }, fDT(s.starts_at)) : null, h('p', { class: 'mut' }, [s.hours ? s.hours + ' h' : '', s.rate].filter(Boolean).join(' · ')),
          s.address ? h('a', { class: 'addr', href: mapsUrl(s.address), target: '_blank', rel: 'noopener' }, ico('pin', 14), s.address) : null, s.notes ? h('p', { class: 'note2' }, s.notes) : null, btn);
      })) : empty(t('no_shifts')));
  }
  function shiftEditor(s) {
    const f = { title: h('input', { required: true, value: s ? s.title : '' }), address: h('input', { value: s ? s.address : '' }), starts: h('input', { type: 'datetime-local', value: s ? toLocalInput(s.starts_at) : '' }),
      hours: h('input', { type: 'number', step: '0.5', min: '0', value: s && s.hours != null ? s.hours : 8 }), rate: h('input', { value: s ? s.rate : '', placeholder: '$150 / día' }), spots: h('input', { type: 'number', min: '1', required: true, value: s ? s.spots : 1 }), notes: h('textarea', { rows: 3 }, s ? s.notes : '') };
    f.notes.value = s ? s.notes : ''; const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(s ? t('edit_shift') : t('post_shift'), h('form', { class: 'mb frm', onsubmit: async (e) => {
      e.preventDefault(); await run(save, async () => { await API.saveShift({ id: s && s.id, title: f.title.value.trim(), address: f.address.value.trim(), starts_at: fromLocalInput(f.starts.value), hours: f.hours.value ? Number(f.hours.value) : null, rate: f.rate.value.trim(), spots: Number(f.spots.value) || 1, notes: f.notes.value.trim(), status: s ? s.status : 'open' }); m.close(); toast(t('saved')); refresh(); });
    } }, field(t('shift_title'), f.title), field(t('address'), f.address), field(t('when'), f.starts), h('div', { class: 'two' }, field(t('hours'), f.hours), field(t('rate'), f.rate)), field(t('spots'), f.spots), field(t('notes'), f.notes), h('div', { class: 'acts' }, save)));
  }

  /* ============================ DOCUMENTOS ============================ */
  async function viewDocs(main) {
    const [reqs, docs] = await Promise.all([API.requirements(), API.docs()]);
    if (isStaff()) return docsStaff(main, reqs, docs);
    const mine = reqs.filter((r) => r.for_grp === 'all' || r.for_grp === S.me.grp);
    const byReq = {}; docs.forEach((d) => { byReq[d.requirement_id] = d; });
    fill(main, secH(t('tab_docs')), mine.length ? h('div', { class: 'grid' }, mine.map((r) => docCard(r, byReq[r.id]))) : empty(t('no_docs')));
  }
  function docCard(r, d) {
    const card = h('div', { class: 'card doc' }, h('div', { class: 'row between' }, h('h3', null, r.title), d ? statusChip(d.status) : chip(t('missing'), 'bad')));
    if (d && d.status === 'rejected' && d.note) card.append(h('p', { class: 'warnbar' }, t('rejected_note') + ' ' + d.note));
    if (d && d.status === 'approved') { card.append(h('p', { class: 'mut' }, r.kind === 'sign' ? t('signed_by', { n: d.signed_name }) : d.file_name)); return card; }
    if (r.kind === 'upload') {
      if (d && d.file_name) card.append(h('p', { class: 'mut' }, ico('file', 14), d.file_name));
      const inp = h('input', { type: 'file', accept: 'image/*,application/pdf', hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) run(btn, async () => { await API.uploadDoc(r.id, f); toast(t('uploaded')); refresh(); }); } });
      const btn = h('button', { class: 'btn' + (d ? ' ghost' : ''), type: 'button', onclick: () => inp.click() }, ico('camera', 16), d ? t('replace_file') : t('upload_file'));
      card.append(btn, inp);
    } else {
      if (d && d.signed_name) card.append(h('p', { class: 'mut' }, t('signed_by', { n: d.signed_name }) + ' · ' + fDate(d.signed_at)));
      const body = h('div', { class: 'agree' }, r.body || '—'); const nm = h('input', { required: true, placeholder: t('type_full_name'), value: S.me.full_name }); const cb = h('input', { type: 'checkbox', required: true });
      const sb = h('button', { class: 'btn', type: 'submit' }, t('sign_now'));
      card.append(h('details', null, h('summary', null, d ? t('sign_again') : t('read_sign')), body, h('form', { class: 'frm', onsubmit: (e) => { e.preventDefault(); run(sb, async () => { await API.signDoc(r.id, nm.value.trim()); toast(t('signed_ok')); refresh(); }); } },
        h('label', { class: 'chk' }, cb, h('span', null, t('agree_text'))), field(t('type_full_name'), nm), sb)));
    }
    return card;
  }
  function docsStaff(main, reqs, docs) {
    return Promise.all([API.profiles()]).then(([people]) => {
      const nm = {}; people.forEach((p) => { nm[p.id] = p; });
      const rq = {}; reqs.forEach((r) => { rq[r.id] = r; });
      const review = docs.filter((d) => d.status === 'submitted');
      const approved = people.filter((p) => p.status === 'approved' && !p.is_admin && !p.is_client && !p.is_office);
      const missing = []; approved.forEach((p) => reqs.filter((r) => r.required && (r.for_grp === 'all' || r.for_grp === p.grp)).forEach((r) => { const d = docs.find((x) => x.worker_id === p.id && x.requirement_id === r.id); if (!d || d.status === 'rejected') missing.push({ p, r, rejected: !!d }); }));
      const openDoc = async (d) => {
        if (d.file_path) { const u = await API.urls([d.file_path], 'worker-docs'); const url = u[d.file_path]; if (!url) { toast(t('err_generic'), true); return; } if (/\.(jpe?g|png|gif|webp)$/i.test(d.file_name || '')) lightbox(url, d.file_name); else window.open(url, '_blank', 'noopener'); }
      };
      fill(main, secH(t('tab_docs')),
        h('h3', { class: 'sub' }, t('to_review'), ' ', chip(String(review.length), review.length ? 'warn' : 'mut')),
        review.length ? h('div', { class: 'list' }, review.map((d) => h('div', { class: 'card lrow' }, h('div', null, h('b', null, (nm[d.worker_id] || {}).full_name || '—'), h('small', null, (rq[d.requirement_id] || {}).title + ' · ' + (d.file_name || t('signed_by', { n: d.signed_name })))),
          h('div', { class: 'acts' }, d.file_path ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => openDoc(d) }, t('view')) : null,
            h('button', { class: 'btn sm', type: 'button', onclick: async () => { await API.setDocStatus(d.id, 'approved'); refresh(); } }, ico('check', 16), t('approve')),
            h('button', { class: 'btn ghost sm danger-t', type: 'button', onclick: () => { const nt = h('input', { placeholder: t('reject_reason') }); const go = h('button', { class: 'btn danger', type: 'submit' }, t('reject')); const m = modal(t('reject'), h('form', { class: 'mb frm', onsubmit: async (e) => { e.preventDefault(); await API.setDocStatus(d.id, 'rejected', nt.value.trim()); m.close(); refresh(); } }, field(t('reject_reason'), nt), go)); } }, t('reject')))))) : empty(t('nothing_review')),
        h('h3', { class: 'sub' }, t('whos_missing'), ' ', chip(String(missing.length), missing.length ? 'bad' : 'ok')),
        missing.length ? h('div', { class: 'list' }, missing.map((x) => h('div', { class: 'card lrow slim' }, h('span', null, h('b', null, x.p.full_name), ' — ', x.r.title), chip(t(x.rejected ? 'st_rejected' : 'missing'), 'bad')))) : empty(t('all_docs_in')),
        secH(t('required_docs'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => reqEditor(null) }, ico('plus', 16), t('add'))),
        h('div', { class: 'list' }, reqs.map((r) => h('div', { class: 'card lrow slim' }, h('span', null, h('b', null, r.title), ' ', chip(t('kind_' + r.kind), 'mut'), ' ', chip(t('for_' + r.for_grp), 'mut')), h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => reqEditor(r) }, ico('edit', 16))))));
    });
  }
  function reqEditor(r) {
    const f = { title: h('input', { required: true, value: r ? r.title : '' }), kind: h('select', null, ['upload', 'sign'].map((k) => h('option', { value: k }, t('kind_' + k)))), grp: h('select', null, ['all', 'crew', 'gigs'].map((k) => h('option', { value: k }, t('for_' + k)))), body: h('textarea', { rows: 8 }, r ? r.body : '') };
    f.kind.value = r ? r.kind : 'upload'; f.grp.value = r ? r.for_grp : 'all'; f.body.value = r ? r.body : '';
    const bodyF = field(t('agreement_text'), f.body, t('agreement_hint')); const upd = () => { bodyF.hidden = f.kind.value !== 'sign'; }; f.kind.addEventListener('change', upd); upd();
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(r ? t('edit') : t('add'), h('form', { class: 'mb frm', onsubmit: async (e) => { e.preventDefault(); await run(save, async () => { await API.saveRequirement({ id: r && r.id, title: f.title.value.trim(), kind: f.kind.value, for_grp: f.grp.value, body: f.kind.value === 'sign' ? f.body.value : '', required: true, sort: r ? r.sort : 99 }); m.close(); refresh(); }); } },
      field(t('doc_title'), f.title), h('div', { class: 'two' }, field(t('type'), f.kind), field(t('applies_to'), f.grp)), bodyF,
      h('div', { class: 'acts' }, r ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_req_q'))) { await API.deleteRequirement(r.id); m.close(); refresh(); } } }, t('delete')) : null, save)), { wide: true });
  }

  /* ============================ PAGOS ============================ */
  async function viewPay(main) {
    const pays = await API.payments();
    if (!isAdmin()) {
      const y = new Date().getFullYear(); const ytd = pays.filter((p) => new Date(p.paid_on + 'T12:00:00').getFullYear() === y).reduce((s, p) => s + Number(p.amount), 0);
      fill(main, secH(t('tab_pay')), h('div', { class: 'stat' }, h('span', null, t('paid_ytd', { y })), h('b', null, money(ytd))),
        pays.length ? h('div', { class: 'list' }, pays.map((p) => h('div', { class: 'card lrow' }, h('div', null, h('b', null, money(p.amount)), h('small', null, [fDate(p.paid_on + 'T12:00:00', { month: 'short', day: 'numeric', year: 'numeric' }), p.method, p.memo].filter(Boolean).join(' · ')))))) : empty(t('no_pay')));
      return;
    }
    const people = (await API.profiles()).filter((p) => p.status === 'approved' && !p.is_admin && !p.is_client); const nm = {}; people.forEach((p) => { nm[p.id] = p.full_name; });
    const sel = h('select', { required: true }, people.map((p) => h('option', { value: p.id }, p.full_name))); const amt = h('input', { type: 'number', step: '0.01', min: '0', required: true, inputmode: 'decimal' });
    const date = h('input', { type: 'date', required: true, value: dkey(new Date()) }); const meth = h('select', null, ['Zelle', 'Cash', 'Check', 'ACH', 'Other'].map((x) => h('option', { value: x }, x))); const memo = h('input', { placeholder: t('pay_memo_ph') });
    const go = h('button', { class: 'btn', type: 'submit' }, t('record_payment'));
    fill(main, secH(t('tab_pay')), h('form', { class: 'card frm payform', onsubmit: (e) => { e.preventDefault(); run(go, async () => { await API.savePayment({ worker_id: sel.value, amount: Number(amt.value), paid_on: date.value, method: meth.value, memo: memo.value.trim() }); toast(t('saved')); refresh(); }); } },
      h('div', { class: 'two' }, field(t('person'), sel), field(t('amount') + ' ($)', amt)), h('div', { class: 'two' }, field(t('date'), date), field(t('method'), meth)), field(t('notes'), memo), go),
      pays.length ? h('div', { class: 'list' }, pays.map((p) => h('div', { class: 'card lrow' }, h('div', null, h('b', null, (nm[p.worker_id] || '—') + ' · ' + money(p.amount)), h('small', null, [fDate(p.paid_on + 'T12:00:00', { month: 'short', day: 'numeric', year: 'numeric' }), p.method, p.memo].filter(Boolean).join(' · '))),
        h('button', { class: 'ib', type: 'button', 'aria-label': t('delete'), onclick: async () => { if (await askConfirm(t('del_pay_q'))) { await API.deletePayment(p.id); refresh(); } } }, ico('x', 16))))) : empty(t('no_pay_admin')));
  }

  /* Las cuentas creadas desde Supabase entran sin nombre: ahí no hay formulario
     que lo pida. Esto deja ponérselo sin tocar la base. */
  function clientNameEditor(c, done) {
    const f = {
      full_name: h('input', { required: true, value: c.full_name || '' }),
      phone: h('input', { type: 'tel', value: c.phone || '' }),
    };
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(c.email, h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      await API.updateProfile(c.id, { full_name: f.full_name.value.trim(), phone: f.phone.value.trim() });
      m.close(); toast(t('saved')); done();
    }); } },
      field(t('full_name'), f.full_name),
      field(t('phone'), f.phone),
      h('div', { class: 'acts' }, save)));
  }

  /* ============================ CENTRO DE MANDO (admin) ============================ */
  const MODS = ['projects', 'clock', 'shifts', 'docs', 'pay', 'content'];
  async function viewCmd(main) {
    const [people, defaults, docs, reqs, open, pcl, projs] = await Promise.all([API.profiles(), API.groupDefaults(), API.docs(), API.requirements(), API.openEntries(), API.projectClients().catch(() => []), API.projects().catch(() => [])]);
    /* Un cliente entró por la puerta del cliente: no es de la cuadrilla, no se le
       asigna obra y no se le paga. Mezclarlo con el personal es como se termina
       mandando a Michele a una obra. */
    const clients = people.filter((p) => p.is_client);
    const pending = people.filter((p) => p.status === 'pending' && !p.is_client);
    const team = people.filter((p) => (p.status === 'approved' || p.status === 'disabled') && !p.is_admin && !p.is_client);
    const toReview = docs.filter((d) => d.status === 'submitted').length;
    const stats = h('div', { class: 'stats' }, [[t('pending_req'), pending.length, pending.length ? 'warn' : ''], [t('active_people'), team.filter((p) => p.status === 'approved').length, ''], [t('on_site_now'), open.length, open.length ? 'ok' : ''], [t('to_review'), toReview, toReview ? 'warn' : '']].map((x) => h('div', { class: 'stat ' + x[2] }, h('span', null, x[0]), h('b', null, x[1]))));
    /* solicitudes */
    const reqBox = h('div', { class: 'list' }, pending.length ? pending.map((p) => {
      let grp = p.grp; const gsel = h('select', { 'aria-label': t('group'), onchange: (e) => { grp = e.target.value; } }, ['crew', 'gigs'].map((g) => h('option', { value: g }, t('grp_short_' + g)))); gsel.value = grp;
      return h('div', { class: 'card lrow req' }, h('div', null, h('b', null, p.full_name), h('small', null, [p.email, p.phone].filter(Boolean).join(' · ')), h('small', { class: 'mut' }, t('requested') + ' ' + fDT(p.created_at))),
        h('div', { class: 'acts' }, gsel, h('button', { class: 'btn sm', type: 'button', onclick: async (e) => run(e.currentTarget, async () => { await API.updateProfile(p.id, { status: 'approved', grp, perms: defaults[grp] || {} }); toast(t('approved_ok', { n: p.full_name })); refresh(); }) }, ico('check', 16), t('approve')),
          h('button', { class: 'btn ghost sm danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('reject_q', { n: p.full_name }), t('reject'))) { await API.updateProfile(p.id, { status: 'rejected' }); refresh(); } } }, t('reject'))));
    }) : empty(t('no_requests')));
    /* matriz de accesos */
    /* El numero de columnas sale de MODS: si manana se agrega otro modulo,
       la tabla se ajusta sola en vez de romperse. */
    const mxc = { style: '--mxc:' + (MODS.length + 3) };
    const head = h('div', Object.assign({ class: 'mx head' }, mxc), h('span', { class: 'c0' }, t('person')), h('span', null, t('active')), MODS.map((k) => h('span', null, t('mod_' + k))), h('span', null, t('office')), h('span', null, t('finance')));
    const rows = team.map((p) => {
      const setPerm = (k, v) => { const perms = Object.assign({}, p.perms); perms[k] = v; p.perms = perms; return API.updateProfile(p.id, { perms }).catch((e) => { toast(errText(e), true); refresh(); }); };
      return h('div', Object.assign({ class: 'mx row' + (p.status === 'disabled' ? ' off' : '') }, mxc),
        h('span', { class: 'c0' }, h('span', { class: 'av sm' }, ini(p.full_name)), h('span', null, h('b', null, p.full_name), h('small', null, t('grp_short_' + p.grp) + (p.phone ? ' · ' + p.phone : '')))),
        h('span', { 'data-l': t('active') }, switchEl(p.status === 'approved', (v) => API.updateProfile(p.id, { status: v ? 'approved' : 'disabled' }).then(refresh).catch((e) => { toast(errText(e), true); refresh(); }), t('active') + ' ' + p.full_name)),
        MODS.map((k) => h('span', { 'data-l': t('mod_' + k) }, switchEl(p.perms && p.perms[k], (v) => setPerm(k, v), t('mod_' + k) + ' ' + p.full_name))),
        h('span', { 'data-l': t('office') }, switchEl(p.is_office, (v) => API.updateProfile(p.id, { is_office: v }).then(refresh).catch((e) => { toast(errText(e), true); refresh(); }), t('office') + ' ' + p.full_name)),
        h('span', { 'data-l': t('finance') }, switchEl(p.is_finance, (v) => API.updateProfile(p.id, { is_finance: v }).then(refresh).catch((e) => { toast(errText(e), true); refresh(); }), t('finance') + ' ' + p.full_name)));
    });
    /* valores por defecto por grupo */
    const defCards = ['crew', 'gigs'].map((g) => {
      const cur = Object.assign({ projects: false, clock: false, shifts: false, docs: false, pay: false }, defaults[g] || {});
      return h('div', { class: 'card defc' }, h('h3', null, t('grp_short_' + g)), h('p', { class: 'mut small' }, t('defaults_hint')),
        h('div', { class: 'dgrid' }, MODS.map((k) => h('label', { class: 'dg' }, switchEl(cur[k], (v) => { cur[k] = v; API.saveDefaults(g, cur).then(() => toast(t('saved'))).catch((e) => toast(errText(e), true)); }, t('mod_' + k)), h('span', null, t('mod_' + k))))),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { if (await askConfirm(t('apply_all_q', { g: t('grp_short_' + g) }), t('apply_all'))) { await Promise.all(team.filter((p) => p.grp === g).map((p) => API.updateProfile(p.id, { perms: Object.assign({}, cur) }))); toast(t('saved')); refresh(); } } }, t('apply_all')));
    });
    /* ---- clientes con acceso al portal ---- */
    const pnames = {}; projs.forEach((x) => { pnames[x.id] = x.name; });
    const seen = {}; pcl.forEach((c) => { (seen[c.client_id] = seen[c.client_id] || []).push(pnames[c.project_id] || '—'); });
    const clientRows = clients.map((c) => h('div', { class: 'mx row' + (c.status === 'approved' ? '' : ' off') },
      h('span', { class: 'c0' }, h('span', { class: 'av sm' }, ini(c.full_name || c.email)),
        h('span', null, h('b', null, c.full_name || h('i', { class: 'mut' }, t('cl_noname'))),
          h('small', null, c.email))),
      h('span', { 'data-l': t('cl_sees') }, (seen[c.id] || []).length
        ? (seen[c.id] || []).map((n) => chip(n, 'gold'))
        : chip(t('cl_noproject'), 'bad')),
      h('span', { 'data-l': t('active') }, switchEl(c.status === 'approved',
        (v) => API.updateProfile(c.id, { status: v ? 'approved' : 'disabled' }).then(refresh)
          .catch((e) => { toast(errText(e), true); refresh(); }), t('active') + ' ' + (c.full_name || c.email))),
      h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => clientNameEditor(c, refresh) }, ico('edit', 15))));

    fill(main, secH(t('tab_cmd')), stats,
      h('h3', { class: 'sub' }, t('requests'), ' ', chip(String(pending.length), pending.length ? 'warn' : 'mut')), reqBox,
      h('h3', { class: 'sub' }, t('access_matrix')), h('p', { class: 'mut small' }, t('matrix_hint')),
      team.length ? h('div', { class: 'card matrix' }, head, rows) : empty(t('no_team_yet')),
      clients.length ? h('h3', { class: 'sub' }, t('cl_h'), ' ', chip(String(clients.length), 'gold')) : null,
      clients.length ? h('p', { class: 'mut small' }, t('cl_hint')) : null,
      clients.length ? h('div', { class: 'card matrix clients' },
        h('div', { class: 'mx head' }, h('span', { class: 'c0' }, t('person')),
          h('span', null, t('cl_sees')), h('span', null, t('active')), h('span', null, '')),
        clientRows) : null,
      h('h3', { class: 'sub' }, t('new_defaults')), h('div', { class: 'grid2' }, defCards));
  }

  /* ============================ FINANZAS ============================ */
  const CATS = ['materials', 'tools', 'labor', 'permits', 'insurance', 'fuel', 'office', 'other'];
  const FST = { mode: 'month', anchor: new Date(), project: '' };
  function fRange() {
    if (FST.mode === 'week') { const a = weekStart(FST.anchor); return [a, addDays(a, 7)]; }
    const a = new Date(FST.anchor.getFullYear(), FST.anchor.getMonth(), 1); return [a, new Date(a.getFullYear(), a.getMonth() + 1, 1)];
  }
  function bars(title, map, total) {
    const keys = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 8);
    if (!keys.length) return null;
    return h('div', { class: 'card' }, h('h3', null, title), h('div', { class: 'fbars' }, keys.map((k) => h('div', { class: 'fbar' },
      h('span', { class: 'nm' }, k), h('span', { class: 'tr' }, h('i', { style: 'width:' + (total ? Math.max(2, (map[k] / total) * 100) : 0) + '%' })), h('b', null, money(map[k]))))));
  }

  /* ---------- LO QUE ENTRA ----------
     Finanzas mostraba solo salidas. Un depósito de $21,249.41 del cliente
     no aparecía por ningún lado, que es medio absurdo en una pantalla
     que se llama Finanzas. */
  async function incomeCard(slot, a, b, pm) {
    let cps;
    try { cps = await API.clientPayments(); } catch (e) { return; }
    const paid = cps.filter((x) => x.paid_on);
    const inR = paid.filter((x) => { const d = +new Date(x.paid_on + 'T12:00:00'); return d >= +a && d < +b; })
      .sort((x, y) => String(y.paid_on).localeCompare(String(x.paid_on)));
    const got = inR.reduce((n, x) => n + Number(x.amount || 0), 0);
    const owed = cps.filter((x) => !x.paid_on).reduce((n, x) => n + Number(x.amount || 0), 0);
    const next = cps.filter((x) => !x.paid_on && x.due_on)
      .sort((x, y) => String(x.due_on).localeCompare(String(y.due_on)))[0];

    fill(slot, h('div', { class: 'card' },
      h('h3', null, t('fin_in_h')),
      h('div', { class: 'stats' },
        h('div', { class: 'stat ok' }, h('span', null, t('fin_in_got')), h('b', null, money(got))),
        h('div', { class: 'stat' + (owed ? ' warn' : '') }, h('span', null, t('f_in')), h('b', null, money(owed))),
        next ? h('div', { class: 'stat' }, h('span', null, t('fin_in_next')), h('b', null, money(next.amount)),
          h('small', null, (pm[next.project_id] ? pm[next.project_id].name + ' · ' : '')
            + fDate(next.due_on + 'T12:00:00', { month: 'short', day: 'numeric' }))) : null),
      inR.length ? h('div', { class: 'list' }, inR.map((x) => h('div', { class: 'card lrow slim' },
        h('div', null, h('b', null, x.label + ' · ' + money(x.amount)),
          h('small', null, [pm[x.project_id] ? pm[x.project_id].name : '',
            fDate(x.paid_on + 'T12:00:00', { month: 'short', day: 'numeric' })].filter(Boolean).join(' · '))))))
        : h('p', { class: 'mut small' }, t('fin_in_none'))));
  }

  /* ---------- DEUDA CON TRABAJADORES ----------
     El punto de partida se guarda aparte: el Excel solo tiene el saldo de hoy,
     y sin saber de dónde se arrancó no hay forma de decir cuánto se ha avanzado. */
  async function debtCard(slot) {
    async function draw() {
      let rows, base;
      try {
        const r = await Promise.all([API.workerDebts(), API.debtBaseline()]);
        rows = r[0]; base = (r[1] || [])[0] || { started: 0, note: '' };
      } catch (e) { return; }

      const nowOwed = rows.reduce((n, x) => n + Number(x.balance || 0), 0);
      const started = Number(base.started || 0);
      const closed = Math.max(0, started - nowOwed);
      const pct = started > 0 ? Math.min(100, Math.round((closed / started) * 100)) : 0;
      const openRows = rows.filter((x) => Number(x.balance) > 0);
      const doneRows = rows.filter((x) => !(Number(x.balance) > 0));

      function editor(x) {
        const f = {
          payee: h('input', { required: true, value: x.payee || '' }),
          balance: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', required: true,
            value: x.balance != null ? x.balance : '' }),
          phone: h('input', { type: 'tel', value: x.phone || '' }),
          notes: h('input', { value: x.notes || '' }),
        };
        const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
        const m = modal(x.id ? t('dbt_edit') : t('dbt_add'),
          h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
            const bal = Number(f.balance.value);
            await API.saveWorkerDebt({ id: x.id, payee: f.payee.value.trim(), balance: bal,
              phone: f.phone.value.trim(), notes: f.notes.value.trim(),
              sort: x.sort != null ? x.sort : 50,
              settled_on: bal === 0 ? (x.settled_on || dkey(new Date())) : null });
            m.close(); toast(t('saved')); draw();
          }); } },
            field(t('dbt_who'), f.payee),
            h('div', { class: 'two' }, field(t('dbt_owed') + ' ($)', f.balance), field(t('phone'), f.phone)),
            field(t('notes'), f.notes),
            h('div', { class: 'acts' },
              x.id ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
                if (await askConfirm(t('dbt_del_q'))) { await API.deleteWorkerDebt(x.id); m.close(); draw(); }
              } }, t('delete')) : null,
              save)));
      }

      /* Abonar sin tener que calcular el saldo nuevo a mano. */
      function payDown(x) {
        const amt = h('input', { type: 'number', step: '0.01', min: '0.01', max: String(x.balance),
          inputmode: 'decimal', required: true, value: x.balance });
        const save = h('button', { class: 'btn', type: 'submit' }, t('dbt_pay'));
        const left = h('p', { class: 'mut sm' }, '');
        const show = () => { const v = Number(amt.value || 0);
          left.textContent = t('dbt_left', { m: money(Math.max(0, Number(x.balance) - v)) }); };
        amt.addEventListener('input', show); show();
        const m = modal(t('dbt_pay') + ' · ' + x.payee,
          h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
            const v = Number(amt.value);
            const bal = Math.max(0, Math.round((Number(x.balance) - v) * 100) / 100);
            await API.saveWorkerDebt({ id: x.id, payee: x.payee, balance: bal,
              phone: x.phone || '', notes: x.notes || '', sort: x.sort,
              settled_on: bal === 0 ? dkey(new Date()) : null });
            m.close(); toast(t('saved')); draw();
          }); } },
            h('p', { class: 'mut sm' }, t('dbt_owes', { m: money(x.balance) })),
            field(t('dbt_amount'), amt), left,
            h('div', { class: 'acts' }, save)));
      }

      function baseEditor() {
        const f = {
          started: h('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', required: true, value: started }),
          note: h('input', { value: base.note || '' }),
        };
        const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
        const m = modal(t('dbt_base'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
          await API.saveDebtBaseline(Number(f.started.value), f.note.value.trim());
          m.close(); toast(t('saved')); draw();
        }); } },
          field(t('dbt_base'), f.started),
          h('p', { class: 'mut sm' }, t('dbt_base_hint')),
          field(t('notes'), f.note),
          h('div', { class: 'acts' }, save)));
      }

      const row = (x) => {
        const open = Number(x.balance) > 0;
        return h('div', { class: 'card lrow slim' + (open ? '' : ' done'), key: x.id },
          h('div', null, h('b', null, x.payee + ' · ' + money(x.balance)),
            h('small', null, [x.phone, x.notes,
              x.settled_on ? t('dbt_settled', { d: fDate(x.settled_on + 'T12:00:00', { month: 'short', day: 'numeric' }) }) : '']
              .filter(Boolean).join(' · '))),
          h('div', { class: 'row' },
            open && isFinance() ? h('button', { class: 'btn sm', type: 'button', onclick: () => payDown(x) }, t('dbt_pay')) : null,
            isFinance() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => editor(x) }, ico('edit', 16)) : null));
      };

      fill(slot, h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h3', null, t('dbt_h')),
          isFinance() ? h('button', { class: 'lnk', type: 'button', onclick: baseEditor }, t('dbt_base_edit')) : null),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('span', null, t('dbt_was')), h('b', null, money(started))),
          h('div', { class: 'stat' + (nowOwed ? ' warn' : ' ok') }, h('span', null, t('dbt_now')), h('b', null, money(nowOwed)),
            h('small', null, t('dbt_people', { n: openRows.length }))),
          h('div', { class: 'stat ok' }, h('span', null, t('dbt_closed')), h('b', null, money(closed)))),
        h('div', { class: 'dbar', role: 'img', 'aria-label': t('dbt_pct', { n: pct }) },
          h('span', { style: 'width:' + pct + '%' })),
        h('p', { class: 'mut small' }, t('dbt_pct', { n: pct })),
        openRows.length ? h('div', { class: 'list' }, openRows.map(row)) : h('p', { class: 'mut small' }, t('dbt_none')),
        doneRows.length ? h('details', { class: 'more' }, h('summary', null, t('dbt_done', { n: doneRows.length })),
          h('div', { class: 'list' }, doneRows.map(row))) : null,
        isFinance() ? h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button',
          onclick: () => editor({}) }, ico('plus', 16), t('dbt_add'))) : null,
        base.note ? h('p', { class: 'mut small' }, base.note) : null));
    }
    draw();
  }

  async function viewFinance(main) {
    const [a, b] = fRange(); const bEnd = addDays(b, -1);
    const [exp, rec, pays, projects] = await Promise.all([
      API.expenses(dkey(a), dkey(bEnd)), API.receipts(), API.payments(), API.projects(),
    ]);
    const pm = {}; projects.forEach((p) => { pm[p.id] = p; });
    const inRange = (d) => +new Date(d) >= +a && +new Date(d) < +b;
    let ex = exp.slice(); const rc = rec.filter((m) => inRange(m.created_at)); const py = pays.filter((p) => inRange(p.paid_on + 'T12:00:00'));
    let rcF = rc, pyF = py;
    if (FST.project) { ex = ex.filter((e) => e.project_id === FST.project); rcF = rc.filter((m) => m.project_id === FST.project); pyF = []; }
    const tEx = ex.reduce((s, e) => s + Number(e.amount), 0);
    const tRc = rcF.reduce((s, m) => s + Number(m.amount || 0), 0);
    const tPy = pyF.reduce((s, p) => s + Number(p.amount), 0);
    const tot = tEx + tRc + tPy;
    const byCat = {}; ex.forEach((e) => { const k = t('cat_' + (CATS.indexOf(e.category) >= 0 ? e.category : 'other')); byCat[k] = (byCat[k] || 0) + Number(e.amount); });
    rcF.forEach((m) => { const k = t('cat_materials'); byCat[k] = (byCat[k] || 0) + Number(m.amount || 0); });
    const byVen = {}; ex.forEach((e) => { const k = e.vendor || '—'; byVen[k] = (byVen[k] || 0) + Number(e.amount); });
    rcF.forEach((m) => { const k = m.vendor || '—'; byVen[k] = (byVen[k] || 0) + Number(m.amount || 0); });
    const byProj = {}; ex.forEach((e) => { if (e.project_id && pm[e.project_id]) { const k = pm[e.project_id].name; byProj[k] = (byProj[k] || 0) + Number(e.amount); } });
    rcF.forEach((m) => { if (pm[m.project_id]) { const k = pm[m.project_id].name; byProj[k] = (byProj[k] || 0) + Number(m.amount || 0); } });

    /* tendencia: 8 semanas o 6 meses hacia atrás */
    const units = []; const n = FST.mode === 'week' ? 8 : 6;
    for (let i = n - 1; i >= 0; i--) {
      const s = FST.mode === 'week' ? addDays(a, -7 * i) : new Date(a.getFullYear(), a.getMonth() - i, 1);
      const e2 = FST.mode === 'week' ? addDays(s, 7) : new Date(s.getFullYear(), s.getMonth() + 1, 1);
      const v = exp.concat([]).length ? 0 : 0;
      units.push({ s, e: e2, v, label: FST.mode === 'week' ? String(s.getDate()) : fDate(s, { month: 'narrow' }) });
    }
    const far = units[0].s;
    const allExp = await API.expenses(dkey(far), dkey(addDays(b, -1)));
    units.forEach((u) => {
      u.v = allExp.filter((e) => { const d = new Date(e.spent_on + 'T12:00:00'); return d >= u.s && d < u.e && (!FST.project || e.project_id === FST.project); }).reduce((s, e) => s + Number(e.amount), 0)
        + rec.filter((m) => { const d = new Date(m.created_at); return d >= u.s && d < u.e && (!FST.project || m.project_id === FST.project); }).reduce((s, m) => s + Number(m.amount || 0), 0)
        + (FST.project ? 0 : pays.filter((p) => { const d = new Date(p.paid_on + 'T12:00:00'); return d >= u.s && d < u.e; }).reduce((s, p) => s + Number(p.amount), 0));
    });
    const peak = Math.max(1, ...units.map((u) => u.v));
    const psel = h('select', { 'aria-label': t('project'), onchange: (e) => { FST.project = e.target.value; refresh(); } }, h('option', { value: '' }, t('all_projects')), projects.map((p) => h('option', { value: p.id }, p.name))); psel.value = FST.project;
    const shift = (k) => { FST.anchor = FST.mode === 'week' ? addDays(FST.anchor, 7 * k) : new Date(FST.anchor.getFullYear(), FST.anchor.getMonth() + k, 1); refresh(); };
    const label = FST.mode === 'week' ? fDate(a, { month: 'short', day: 'numeric' }) + ' – ' + fDate(bEnd, { month: 'short', day: 'numeric' }) : fDate(a, { month: 'long', year: 'numeric' });
    const rows = ex.map((e) => ({ kind: 'e', d: e.spent_on, o: e })).concat(rcF.map((m) => ({ kind: 'r', d: dkey(m.created_at), o: m })), pyF.map((p) => ({ kind: 'p', d: p.paid_on, o: p })))
      .sort((x, y) => y.d.localeCompare(x.d)).slice(0, 80);
    fill(main, 
      secH(t('tab_finance'), h('div', { class: 'acts' },
        isFinance() ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => importer(projects) }, ico('down', 16), t('import_bank')) : null,
        isFinance() ? h('button', { class: 'btn sm', type: 'button', onclick: () => expenseEditor(null, projects) }, ico('plus', 16), t('add_expense')) : null)),
      h('div', { class: 'tsbar' },
        h('div', { class: 'seg', role: 'group' }, ['week', 'month'].map((k) => h('button', { type: 'button', class: FST.mode === k ? 'on' : '', 'aria-pressed': FST.mode === k ? 'true' : 'false', onclick: () => { FST.mode = k; refresh(); } }, t(k)))),
        h('div', { class: 'nav2' }, h('button', { class: 'ib', type: 'button', 'aria-label': t('prev'), onclick: () => shift(-1) }, ico('back', 18)), h('b', null, label),
          h('button', { class: 'ib flip', type: 'button', 'aria-label': t('next'), onclick: () => shift(1) }, ico('back', 18)),
          h('button', { class: 'lnk', type: 'button', onclick: () => { FST.anchor = new Date(); refresh(); } }, t('today'))),
        psel,
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => exportQB(rows, pm) }, ico('down', 16), t('export_qb'))),
      h('div', { id: 'incomeslot' }),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', null, t('fin_total')), h('b', null, money(tot)), h('small', null, t('only_out'))),
        h('div', { class: 'stat' }, h('span', null, t('fin_expenses')), h('b', null, money(tEx))),
        h('div', { class: 'stat' }, h('span', null, t('fin_receipts')), h('b', null, money(tRc))),
        FST.project ? null : h('div', { class: 'stat' }, h('span', null, t('fin_payments')), h('b', null, money(tPy)))),
      h('div', { class: 'card' }, h('h3', null, FST.mode === 'week' ? t('week') : t('month')),
        h('div', { class: 'trend' }, units.map((u, i) => h('span', { class: 'b' + (i === units.length - 1 ? ' hi' : ''), style: 'height:' + Math.max(2, (u.v / peak) * 100) + '%', title: money(u.v) }, h('span', null, u.label)))),
        h('p', { class: 'mut small', style: 'margin-top:22px' }, t('fin_total') + ': ' + money(units[units.length - 1].v))),
      h('div', { class: 'grid2' }, bars(t('fin_by_cat'), byCat, tot), bars(t('fin_by_vendor'), byVen, tot), bars(t('fin_by_project'), byProj, tot)),
      h('div', { id: 'debtslot' }),
      h('div', { id: 'fixedslot' }),
      h('h3', { class: 'sub' }, t('fin_recent')),
      rows.length ? h('div', { class: 'list' }, rows.map((r) => {
        const o = r.o;
        const ttl = r.kind === 'e' ? (o.vendor || t('fin_expenses')) : r.kind === 'r' ? (o.vendor || t('receipt')) : t('fin_payments');
        const sub = [fDate(r.d + (r.kind === 'r' ? '' : 'T12:00:00'), { month: 'short', day: 'numeric' }),
          r.kind === 'e' ? t('cat_' + (CATS.indexOf(o.category) >= 0 ? o.category : 'other')) : r.kind === 'r' ? t('src_receipt') : o.method,
          o.project_id && pm[o.project_id] ? pm[o.project_id].name : '', r.kind === 'e' ? t('src_' + o.source) : '', o.memo || o.body || ''].filter(Boolean).join(' · ');
        return h('div', { class: 'card lrow slim' }, h('div', null, h('b', null, ttl + ' · ' + money(o.amount)), h('small', null, sub)),
          r.kind === 'e' && isFinance() ? h('div', { class: 'row' }, h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => expenseEditor(o, projects) }, ico('edit', 16)),
            h('button', { class: 'ib', type: 'button', 'aria-label': t('delete'), onclick: async () => { if (await askConfirm(t('del_expense_q'))) { await API.deleteExpense(o.id); refresh(); } } }, ico('x', 16))) : null);
      })) : empty(t('no_expenses')));
    const fs = main.querySelector('#fixedslot'); if (fs) fixedCosts(fs, a, exp);
    const inc = main.querySelector('#incomeslot'); if (inc) incomeCard(inc, a, b, pm);
    const dbt = main.querySelector('#debtslot'); if (dbt) debtCard(dbt);
  }

  /* ---------- gastos fijos: lo que se paga pase lo que pase ---------- */
  async function fixedCosts(slot, monthStart, expInRange) {
    let list = [];
    try { list = await API.fixed(); } catch (e) { fill(slot); return; }
    const active = list.filter((f) => f.active);
    const mk = dkey(monthStart).slice(0, 7);
    const paidId = (f) => 'fx:' + f.id + ':' + mk;
    const isPaid = (f) => expInRange.some((e) => e.ext_id === paidId(f));
    const paid = active.filter(isPaid);
    const total = active.reduce((s, f) => s + Number(f.amount), 0);
    const row = (f) => {
      const on = isPaid(f);
      return h('div', { class: 'ckrow' + (on ? ' done' : '') },
        isFinance() ? h('button', { class: 'tick', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': t('mark_paid'), onclick: (e) => run(e.currentTarget, async () => {
          if (on) { const ex = expInRange.find((x) => x.ext_id === paidId(f)); if (ex) await API.deleteExpense(ex.id); }
          else await API.saveExpense({ spent_on: dkey(new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(f.due_day || 1, 28))), amount: Number(f.amount), vendor: f.vendor || f.title, memo: f.title, category: f.category, project_id: null, source: 'manual', ext_id: paidId(f) });
          refresh();
        }) }, ico('check', 15)) : h('span', { class: 'tick' + (on ? ' done' : '') }, on ? ico('check', 15) : null),
        h('div', { class: 'tx' }, h('b', null, f.title + ' · ' + money(f.amount)),
          h('small', null, [f.vendor, f.due_day ? t('due_day') + ' ' + f.due_day : '', f.owner, t('cat_' + (CATS.indexOf(f.category) >= 0 ? f.category : 'other'))].filter(Boolean).join(' · '))),
        isFinance() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => fixedEditor(f) }, ico('edit', 15)) : null);
    };
    fill(slot, 
      h('div', { class: 'sech', style: 'margin-top:22px' }, h('div', null, h('h3', null, t('fixed_h')), h('p', { class: 'mut small' }, t('fixed_sub'))),
        isFinance() ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => fixedEditor(null) }, ico('plus', 16), t('add_fixed')) : null),
      active.length ? h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', null, t('fixed_month')), h('b', null, money(total)), h('small', null, t('fixed_paid', { a: paid.length, b: active.length }))),
        h('div', { class: 'stat ' + (paid.length === active.length ? 'ok' : 'warn') }, h('span', null, t('paid_label')), h('b', null, money(paid.reduce((s, f) => s + Number(f.amount), 0))))) : null,
      active.length ? h('div', { class: 'cklist' }, active.map(row)) : empty(t('no_fixed')),
      active.length && isFinance() ? h('p', { class: 'mut small' }, t('fixed_note')) : null);
  }
  function fixedEditor(f) {
    const x = { title: h('input', { required: true, value: f ? f.title : '' }), vendor: h('input', { value: f ? f.vendor : '' }),
      amount: h('input', { type: 'number', step: '0.01', min: '0', required: true, inputmode: 'decimal', value: f ? f.amount : '' }),
      cadence: h('select', null, [['monthly', 'cad_monthly'], ['weekly', 'cad_week'], ['quarterly', 'cad_quarterly'], ['yearly', 'cad_yearly']].map(([v, k]) => h('option', { value: v }, t(k)))),
      day: h('input', { type: 'number', min: '1', max: '31', value: f && f.due_day != null ? f.due_day : '' }),
      cat: h('select', null, CATS.map((c) => h('option', { value: c }, t('cat_' + c)))),
      owner: h('input', { value: f ? f.owner : '' }), active: h('input', { type: 'checkbox', checked: f ? f.active : true }) };
    x.cadence.value = f ? f.cadence : 'monthly'; x.cat.value = f ? f.category : 'office';
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(f ? t('edit_fixed') : t('add_fixed'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      await API.saveFixed({ id: f && f.id, title: x.title.value.trim(), vendor: x.vendor.value.trim(), amount: Number(x.amount.value),
        cadence: x.cadence.value, due_day: x.day.value === '' ? null : Number(x.day.value), category: x.cat.value, owner: x.owner.value.trim(), active: x.active.checked, notes: f ? f.notes : '' });
      m.close(); toast(t('saved')); refresh(); }); } },
      field(t('fixed_title'), x.title), h('div', { class: 'two' }, field(t('amount') + ' ($)', x.amount), field(t('every'), x.cadence)),
      h('div', { class: 'two' }, field(t('due_day'), x.day), field(t('category'), x.cat)),
      h('div', { class: 'two' }, field(t('vendor'), x.vendor), field(t('owner_who'), x.owner)),
      h('label', { class: 'chk' }, x.active, h('span', null, t('active'))),
      h('div', { class: 'acts' }, f ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_fixed_q'))) { await API.deleteFixed(f.id); m.close(); refresh(); } } }, t('delete')) : null, save)));
  }
  function exportQB(rows, pm) {
    const out = [['Date', 'Description', 'Amount', 'Category', 'Project', 'Source'].map(csvCell).join(',')];
    rows.forEach((r) => {
      const o = r.o;
      out.push([r.d, r.kind === 'p' ? t('fin_payments') + ' ' + (o.memo || '') : (o.vendor || '') + ' ' + (o.memo || o.body || ''),
        (-Math.abs(Number(o.amount || 0))).toFixed(2),
        r.kind === 'e' ? t('cat_' + (CATS.indexOf(o.category) >= 0 ? o.category : 'other')) : r.kind === 'r' ? t('cat_materials') : t('cat_labor'),
        o.project_id && pm[o.project_id] ? pm[o.project_id].name : '', r.kind === 'e' ? t('src_' + o.source) : r.kind === 'r' ? t('src_receipt') : 'portal'].map(csvCell).join(','));
    });
    download('quickbooks-' + dkey(new Date()) + '.csv', out.join('\n'));
    toast(t('qb_hint'));
  }
  function expenseEditor(e, projects) {
    const f = { date: h('input', { type: 'date', required: true, value: e ? e.spent_on : dkey(new Date()) }),
      amount: h('input', { type: 'number', step: '0.01', min: '0', required: true, inputmode: 'decimal', value: e ? Math.abs(e.amount) : '' }),
      vendor: h('input', { value: e ? e.vendor : '', placeholder: t('vendor_ph') }),
      cat: h('select', null, CATS.map((c) => h('option', { value: c }, t('cat_' + c)))),
      proj: h('select', null, h('option', { value: '' }, '—'), projects.map((p) => h('option', { value: p.id }, p.name))),
      memo: h('input', { value: e ? e.memo : '' }) };
    f.cat.value = e ? e.category : 'materials'; f.proj.value = e && e.project_id ? e.project_id : '';
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(e ? t('edit_expense') : t('add_expense'), h('form', { class: 'mb frm', onsubmit: (ev) => { ev.preventDefault(); run(save, async () => {
      await API.saveExpense({ id: e && e.id, spent_on: f.date.value, amount: Number(f.amount.value), vendor: f.vendor.value.trim(), memo: f.memo.value.trim(), category: f.cat.value, project_id: f.proj.value || null });
      m.close(); toast(t('saved')); refresh(); }); } },
      h('div', { class: 'two' }, field(t('date'), f.date), field(t('amount') + ' ($)', f.amount)), field(t('vendor'), f.vendor),
      h('div', { class: 'two' }, field(t('category'), f.cat), field(t('project'), f.proj)), field(t('notes'), f.memo),
      h('div', { class: 'acts' }, save)));
  }

  /* ---------- importar CSV del banco ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (cell !== '' || row.length) { row.push(cell); rows.push(row); row = []; cell = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  }
  const parseMoney = (v) => { const s = String(v || '').replace(/[^0-9.\-()]/g, ''); if (!s) return NaN; const neg = /\(/.test(String(v)); const n = parseFloat(s.replace(/[()]/g, '')); return isNaN(n) ? NaN : (neg ? -n : n); };
  function parseDate(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + pad(m[1]) + '-' + pad(m[2]); }
    const d = new Date(s); return isNaN(+d) ? null : dkey(d);
  }
  function importer(projects) {
    const body = h('div', { class: 'mb' }); const m = modal(t('import_h'), body, { wide: true });
    const fileIn = h('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) read(f); } });
    const drop = h('div', { class: 'drop', tabindex: '0', role: 'button', onclick: () => fileIn.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } },
      ico('file', 30), h('p', null, h('b', null, t('pick_file'))), h('small', { class: 'mut' }, 'CSV'));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) read(f); });
    fill(body, h('p', { class: 'mut' }, t('import_p')), drop, fileIn);
    function read(file) {
      const r = new FileReader();
      r.onload = () => { try { step2(parseCSV(String(r.result))); } catch (e) { console.warn(e); toast(t('import_bad'), true); } };
      r.onerror = () => toast(t('import_bad'), true);
      r.readAsText(file);
    }
    function step2(rows) {
      if (rows.length < 2) { toast(t('import_none'), true); return; }
      const head = rows[0].map((x) => String(x).trim()); const data = rows.slice(1);
      const guess = (re, fb) => { const i = head.findIndex((x) => re.test(x)); return i >= 0 ? i : fb; };
      const mk = (lbl, def) => { const s = h('select', null, head.map((x, i) => h('option', { value: i }, x || ('Col ' + (i + 1))))); s.value = String(def); return { s, el: field(lbl, s) }; };
      const cD = mk(t('col_date'), guess(/date|fecha/i, 0));
      const cA = mk(t('col_amount'), guess(/amount|debit|monto|valor|charge/i, Math.max(0, head.length - 1)));
      const cT = mk(t('col_desc'), guess(/desc|name|payee|memo|concepto|detalle/i, 1));
      const psel = h('select', null, h('option', { value: '' }, '—'), projects.map((p) => h('option', { value: p.id }, p.name)));
      const csel = h('select', null, CATS.map((c) => h('option', { value: c }, t('cat_' + c)))); csel.value = 'materials';
      const out = h('div'); const go = h('button', { class: 'btn', type: 'button' });
      let ready = [];
      async function recompute() {
        const di = +cD.s.value, ai = +cA.s.value, ti = +cT.s.value;
        const parsed = []; let skipped = 0;
        data.forEach((r) => {
          /* Si la fila no trae las mismas columnas que el encabezado, el archivo viene torcido y los
             montos se correrían de columna. Antes que guardar un número equivocado, se omite la fila. */
          if (r.length !== head.length) { skipped++; return; }
          const d = parseDate(r[di]); const amt = parseMoney(r[ai]);
          if (!d || isNaN(amt) || amt === 0) { skipped++; return; }
          if (/credit|deposit|refund|payment received|transfer in/i.test(String(r[ti] || ''))) return;
          parsed.push({ amt, spent_on: d, amount: Math.abs(amt), vendor: String(r[ti] || '').trim().slice(0, 80), memo: '',
            category: csel.value, project_id: psel.value || null, ext_id: 'bk:' + d + ':' + Math.abs(amt).toFixed(2) + ':' + String(r[ti] || '').trim().slice(0, 24) });
        });
        /* Si el archivo trae positivos y negativos, lo positivo es plata que entra: no es gasto. */
        const mixed = parsed.some((x) => x.amt < 0) && parsed.some((x) => x.amt > 0);
        const onlyOut = (mixed ? parsed.filter((x) => x.amt < 0) : parsed).map((x) => { const y = Object.assign({}, x); delete y.amt; return y; });
        const ids = onlyOut.map((x) => x.ext_id);
        let dupes = [];
        try { dupes = await API.existingExtIds(ids); } catch (e) { /* sigue */ }
        ready = onlyOut.filter((x) => dupes.indexOf(x.ext_id) < 0);
        const sum = ready.reduce((s, x) => s + x.amount, 0);
        go.textContent = t('import_go', { n: ready.length }); go.disabled = !ready.length;
        fill(out, h('p', { class: 'mut small' }, t('import_found', { n: onlyOut.length })
          + (dupes.length ? ' ' + t('import_dupes', { n: dupes.length }) : '') + (skipped ? ' ' + t('import_skipped', { n: skipped }) : '')),
          ready.length ? h('div', { class: 'prev' }, h('table', null, h('tbody', null, ready.slice(0, 60).map((x) => h('tr', null, h('td', null, x.spent_on), h('td', null, x.vendor), h('td', null, money(x.amount))))))) : null,
          ready.length ? h('p', { class: 'row between', style: 'margin-top:6px' }, h('b', null, t('fin_total')), h('b', null, money(sum))) : empty(t('import_none')));
      }
      [cD.s, cA.s, cT.s, csel, psel].forEach((s) => s.addEventListener('change', recompute));
      go.addEventListener('click', () => run(go, async () => {
        const rows2 = ready.map((x) => ({ ...x, category: csel.value, project_id: psel.value || null }));
        await API.importExpenses(rows2); m.close(); toast(t('imported_ok', { n: rows2.length })); refresh();
      }));
      fill(body, h('p', { class: 'mut' }, t('import_map')), h('div', { class: 'two' }, cD.el, cA.el), cT.el,
        h('div', { class: 'two' }, field(t('category'), csel), field(t('project'), psel)), out, h('div', { class: 'acts' }, go));
      recompute();
    }
  }

  /* ============================ CRM ============================ */
  const STAGES = ['new', 'contacted', 'visit', 'quoted', 'won', 'lost'];
  const SOURCES = ['instagram', 'tiktok', 'yelp', 'google', 'referral', 'web', 'other'];
  async function viewCrm(main) {
    const leads = await API.leads();
    const open = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');
    const pipe = open.reduce((s, l) => s + Number(l.value || 0), 0);
    const mStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const wonM = leads.filter((l) => l.stage === 'won' && +new Date(l.updated_at) >= +mStart);
    const closed = leads.filter((l) => l.stage === 'won' || l.stage === 'lost');
    const rate = closed.length ? Math.round((leads.filter((l) => l.stage === 'won').length / closed.length) * 100) : 0;
    const today = dkey(new Date());
    const due = open.filter((l) => l.next_on && l.next_on <= today);
    fill(main, secH(t('crm_h'), h('button', { class: 'btn sm', type: 'button', onclick: () => leadEditor(null) }, ico('plus', 16), t('new_lead'))),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('span', null, t('pipeline_value')), h('b', null, money(pipe)), h('small', null, open.length + ' leads')),
        h('div', { class: 'stat ok' }, h('span', null, t('won_month')), h('b', null, money(wonM.reduce((s, l) => s + Number(l.value || 0), 0))), h('small', null, wonM.length + ' ' + t('fs_won').toLowerCase())),
        h('div', { class: 'stat' }, h('span', null, t('conv')), h('b', null, rate + '%')),
        h('div', { class: 'stat ' + (due.length ? 'bad' : '') }, h('span', null, t('overdue')), h('b', null, due.length))),
      leads.length ? h('div', { class: 'kan' }, STAGES.map((st) => {
        const inSt = leads.filter((l) => l.stage === st);
        return h('div', { class: 'kcol' }, h('h3', null, t('fs_' + st), chip(String(inSt.length), inSt.length ? 'mut' : 'mut')),
          inSt.map((l) => {
            const late = l.next_on && l.next_on < today, soon = l.next_on === today;
            return h('button', { class: 'kcard' + (late ? ' late' : soon ? ' soon' : ''), type: 'button', onclick: () => leadEditor(l) },
              h('b', null, l.name), h('div', { class: 'mta' }, l.value ? h('span', { class: 'val' }, money(l.value)) : null, l.borough ? h('span', null, l.borough) : null, h('span', { class: 'pill' }, t('src_' + (SOURCES.indexOf(l.source) >= 0 ? l.source : 'other')))),
              l.next_step ? h('div', { class: 'mta' }, h('span', { class: 'pill' + (late ? ' late' : soon ? ' soon' : '') }, l.next_on ? fDate(l.next_on + 'T12:00:00', { month: 'short', day: 'numeric' }) : t('no_next')), h('span', null, l.next_step)) : null);
          }));
      })) : empty(t('no_leads')));
  }
  function leadEditor(l) {
    const f = { name: h('input', { required: true, value: l ? l.name : '' }), contact: h('input', { value: l ? l.contact : '' }),
      source: h('select', null, SOURCES.map((s) => h('option', { value: s }, t('src_' + s)))),
      borough: h('input', { value: l ? l.borough : '' }), scope: h('textarea', { rows: 2 }),
      value: h('input', { type: 'number', step: '1', min: '0', inputmode: 'decimal', value: l && l.value != null ? l.value : '' }),
      stage: h('select', null, STAGES.map((s) => h('option', { value: s }, t('fs_' + s)))),
      next: h('input', { value: l ? l.next_step : '' }), nexton: h('input', { type: 'date', value: l && l.next_on ? l.next_on : '' }),
      notes: h('textarea', { rows: 3 }) };
    f.source.value = l ? l.source : 'instagram'; f.stage.value = l ? l.stage : 'new'; f.scope.value = l ? l.scope : ''; f.notes.value = l ? l.notes : '';
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(l ? t('edit_lead') : t('new_lead'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      await API.saveLead({ id: l && l.id, name: f.name.value.trim(), contact: f.contact.value.trim(), source: f.source.value, borough: f.borough.value.trim(),
        scope: f.scope.value.trim(), value: f.value.value ? Number(f.value.value) : null, stage: f.stage.value, next_step: f.next.value.trim(), next_on: f.nexton.value || null, notes: f.notes.value.trim() });
      m.close(); toast(t('saved')); refresh(); }); } },
      field(t('lead_name'), f.name), h('div', { class: 'two' }, field(t('contact'), f.contact), field(t('borough'), f.borough)),
      h('div', { class: 'two' }, field(t('source'), f.source), field(t('stage'), f.stage)),
      field(t('scope'), f.scope), field(t('value') + ' ($)', f.value),
      h('div', { class: 'two' }, field(t('next_step'), f.next), field(t('next_when'), f.nexton)), field(t('notes'), f.notes),
      h('div', { class: 'acts' }, l ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_lead_q'))) { await API.deleteLead(l.id); m.close(); refresh(); } } }, t('delete')) : null, save)), { wide: true });
  }

  /* ============================ CONTENIDO ============================ */
  const PSTAT = ['idea', 'filming', 'editing', 'scheduled', 'posted'];
  /* Las redes donde Proven tiene que estar activo */
  const NETS = ['instagram', 'facebook', 'facebook_groups', 'tiktok', 'blog', 'linkedin', 'youtube', 'yelp'];
  const netName = (k) => t('net_' + (NETS.indexOf(k) >= 0 ? k : 'instagram'));
  const FORMATS = ['reel', 'carousel', 'photo', 'story', 'blog', 'email'];

  /* ---------- CRONOPOST ----------
     Un tema por día y los mismos grupos cada semana. El chulo es por
     grupo, por día y por semana: el lunes siguiente la lista aparece
     limpia sola, y lo de la semana pasada queda guardado. */
  let CRW = null;   /* lunes de la semana que se está mirando */
  let CRD = null;   /* día seleccionado, 1 a 5 */
  async function cronopost(slot) {
    if (!CRW) CRW = dkey(weekStart(new Date()));
    if (!CRD) { const n = new Date().getDay(); CRD = (n >= 1 && n <= 5) ? n : 1; }

    async function draw() {
      let themes, groups, posts, copy, angles, plan;
      try {
        const r = await Promise.all([API.postThemes(), API.fbGroups(), API.groupPosts(CRW),
          API.postCopy(CRW), API.postAngles(), API.weekPlan(CRW)]);
        themes = r[0]; groups = r[1].filter((g) => g.active); posts = r[2];
        copy = r[3]; angles = r[4]; plan = (r[5] || [])[0] || null;
      } catch (e) { fill(slot, empty(t('err_generic'), errText(e))); return; }

      const th = themes.find((x) => x.day === CRD) || { title: '', hint: '' };

      /* El ángulo rota solo: semanas transcurridas desde el lunes ancla, módulo
         la cantidad de ángulos. Así nunca se repite seguido sin que nadie lleve
         la cuenta, y si ella quiere otro esa semana lo cambia y queda guardado. */
      const ANCHOR = Date.UTC(2026, 9, 19);   /* lunes 19 de octubre de 2026 */
      function suggestedAngle() {
        if (!angles.length) return null;
        const wks = Math.round((Date.UTC(
          Number(CRW.slice(0, 4)), Number(CRW.slice(5, 7)) - 1, Number(CRW.slice(8, 10))
        ) - ANCHOR) / 604800000);
        const i = ((wks % angles.length) + angles.length) % angles.length;
        return angles[i];
      }
      const ang = (plan && angles.find((a) => a.id === plan.angle_id)) || suggestedAngle();
      const donePairs = {}; posts.forEach((p) => { donePairs[p.group_id + '|' + p.day] = p; });
      const isDone = (g, day) => !!donePairs[g.id + '|' + day];
      const doneToday = groups.filter((g) => isDone(g, CRD)).length;
      const weekDone = posts.length, weekTotal = groups.length * 5;

      /* El texto que le toca a ESE grupo ESE día. Un grupo de contratistas
         no recibe el mismo post que uno de dueños de casa: en varios de esos
         grupos un anuncio para dueños es motivo de expulsión. */
      function audienceOf(g) {
        const a = g.audience || 'both';
        if (a !== 'both') return a;
        return CRD === 5 ? 'contractors' : 'owners';
      }
      function copyFor(g) {
        const aud = audienceOf(g);
        const row = copy.find((c) => c.day === CRD && c.audience === aud);
        /* {hood} se cambia por el barrio del grupo: un solo texto sirve para
           todos los grupos de barrio y cada uno sale hablándole al suyo. */
        let body = row ? row.body : '';
        body = body.replace(/\{hood\}/g, (g.hood || '').trim() || 'New York');
        const pre = (g.prefix || '').trim();
        return { aud: aud, text: (pre ? pre + '\n\n' : '') + body, body: body, hasBody: !!body };
      }

      function postModal(g) {
        const c = copyFor(g);
        const box = h('textarea', { rows: 12, readonly: !isStaff() }, c.text);
        const cp = h('button', { class: 'btn', type: 'button' }, t('cr_copy'));
        cp.onclick = async () => {
          try { await navigator.clipboard.writeText(box.value); toast(t('cr_copied')); }
          catch (e) { box.select(); toast(t('cr_copy_manual'), true); }
        };
        const prev = isStaff() && !c.hasBody
          ? h('button', { class: 'btn ghost', type: 'button' }, t('cr_bring_prev')) : null;
        if (prev) prev.onclick = () => run(prev, async () => {
          const pw = dkey(addDays(new Date(CRW + 'T12:00:00'), -7));
          const old = await API.postCopy(pw);
          const r = old.find((x) => x.day === CRD && x.audience === c.aud);
          if (!r || !r.body) { toast(t('cr_no_prev'), true); return; }
          box.value = ((g.prefix || '').trim() ? (g.prefix || '').trim() + '\n\n' : '') + r.body;
          toast(t('cr_prev_ok'));
        });
        /* La imagen del dia sale del angulo y del dia, asi que el nombre del
           archivo basta: no hay nada que guardar en la base. Si el archivo no
           existe todavia, el bloque se esconde solo. */
        const furl = ang ? 'fondos/a' + ang.id + '-d' + CRD + '.jpg' : '';
        const pic = furl ? h('img', { src: furl, alt: '', loading: 'lazy' }) : null;
        const imgbox = pic ? h('div', { class: 'postimg' }, pic,
          h('a', { class: 'btn ghost sm', href: furl,
            download: 'proven-' + CRW + '-dia' + CRD + '.jpg' }, t('cr_img_dl'))) : null;
        if (pic) pic.onerror = () => { if (imgbox) imgbox.remove(); };
        const save = isStaff() ? h('button', { class: 'btn ghost', type: 'button' }, t('cr_save_copy')) : null;
        if (save) save.onclick = () => run(save, async () => {
          /* El prefijo del grupo no se guarda dentro del texto común: se le
             vuelve a pegar encima cada vez, solo a ese grupo. */
          let v = box.value;
          const pre = (g.prefix || '').trim();
          if (pre && v.indexOf(pre) === 0) v = v.slice(pre.length).replace(/^\s+/, '');
          await API.saveCopy(CRW, CRD, c.aud, v);
          toast(t('saved')); draw();
        });
        modal(g.name, h('div', { class: 'mb' },
          h('p', { class: 'mut sm' }, t('cr_aud_' + c.aud) + ' · ' + L(th, 'title')
            + (ang ? ' · ' + L(ang, 'title') : '')),
          c.hasBody ? null : h('p', { class: 'mut sm' }, t('cr_nocopy')),
          imgbox,
          box,
          g.notes ? h('p', { class: 'mut sm warnline' }, g.notes) : null,
          h('div', { class: 'acts' }, prev, save, cp)), { wide: true });
      }

      function groupEditor(g) {
        const f = {
          name: h('input', { required: true, value: g.name || '' }),
          url: h('input', { type: 'url', required: true, placeholder: 'https://www.facebook.com/groups/…', value: g.url || '' }),
          zone: h('input', { value: g.zone || '', placeholder: t('cr_zone_ph') }),
          notes: h('input', { value: g.notes || '', placeholder: t('cr_rules_ph') }),
          prefix: h('input', { value: g.prefix || '', placeholder: t('cr_prefix_ph') }),
          hood: h('input', { value: g.hood || '', placeholder: t('cr_hood_ph') }),
          audience: h('select', null, ['owners', 'neighborhood', 'contractors', 'both'].map((k) =>
            h('option', { value: k }, t('cr_aud_' + k)))),
        };
        f.audience.value = g.audience || 'both';
        const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
        const m = modal(g.id ? t('cr_edit_g') : t('cr_add_g'),
          h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
            await API.saveFbGroup({ id: g.id, name: f.name.value.trim(), url: f.url.value.trim(),
              zone: f.zone.value.trim(), notes: f.notes.value.trim(), active: true,
              audience: f.audience.value, prefix: f.prefix.value.trim(),
              hood: f.hood.value.trim(),
              sort: g.sort != null ? g.sort : (groups.length + 1) * 10 });
            m.close(); toast(t('saved')); draw();
          }); } },
            field(t('cr_g_name'), f.name),
            field(t('cr_g_url'), f.url),
            h('div', { class: 'two' }, field(t('cr_g_zone'), f.zone), field(t('cr_g_aud'), f.audience)),
            field(t('cr_g_rules'), f.notes),
            h('div', { class: 'two' }, field(t('cr_g_hood'), f.hood), field(t('cr_g_prefix'), f.prefix)),
            h('div', { class: 'acts' },
              g.id ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => {
                if (await askConfirm(t('cr_del_g_q', { n: g.name }))) { await API.deleteFbGroup(g.id); m.close(); draw(); }
              } }, t('delete')) : null,
              save)));
      }

      function themeEditor() {
        const f = {
          title: h('input', { required: true, value: th.title || '' }),
          title_en: h('input', { value: th.title_en || '' }),
          hint: h('textarea', { rows: 3 }, th.hint || ''),
        };
        const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
        const m = modal(t('cr_theme') + ' · ' + t('dow_' + CRD),
          h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
            await API.saveTheme({ day: CRD, title: f.title.value.trim(),
              title_en: f.title_en.value.trim(), hint: f.hint.value.trim() });
            m.close(); toast(t('saved')); draw();
          }); } },
            field(t('cr_theme'), f.title),
            field(t('cr_theme_en'), f.title_en),
            field(t('cr_hint'), f.hint),
            h('div', { class: 'acts' }, save)));
      }

      const chips = [1, 2, 3, 4, 5].map((n) => {
        const tn = themes.find((x) => x.day === n);
        const got = groups.filter((g) => isDone(g, n)).length;
        return h('button', { type: 'button', class: 'fchip' + (CRD === n ? ' on' : '') + (groups.length && got === groups.length ? ' ok' : ''),
          onclick: () => { CRD = n; draw(); } },
          h('b', null, t('dow_' + n)), ' ', (tn ? L(tn, 'title') : ''),
          groups.length ? h('span', { class: 'cnt' }, got + '/' + groups.length) : null);
      });

      const row = (g) => {
        const done = isDone(g, CRD);
        return h('div', { class: 'ckrow' + (done ? ' done' : '') },
          h('button', { class: 'tick', type: 'button', 'aria-label': t('cr_mark', { n: g.name }),
            onclick: async (e) => run(e.currentTarget, async () => {
              await API.markGroupPost(g.id, CRW, CRD, !done); draw();
            }) }, ico('check', 15)),
          h('div', { class: 'tx' },
            h('b', null, g.name),
            h('small', null, [t('cr_aud_' + (g.audience || 'both')), g.zone, g.notes]
              .filter(Boolean).join(' · '))),
          h('button', { class: 'btn sm', type: 'button', onclick: () => postModal(g) }, t('cr_see')),
          g.url ? h('a', { class: 'btn ghost sm', href: g.url, target: '_blank', rel: 'noopener noreferrer' },
            t('cr_open')) : null,
          isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'),
            onclick: () => groupEditor(g) }, ico('edit', 16)) : null);
      };

      const pct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;

      const card = h('div', { class: 'card' },
        h('div', { class: 'row between wrap' },
          h('h3', null, t('cr_h')),
          h('div', { class: 'nav2' },
            h('button', { class: 'ib', type: 'button', 'aria-label': t('prev'),
              onclick: () => { CRW = dkey(addDays(new Date(CRW + 'T12:00:00'), -7)); draw(); } }, ico('back', 18)),
            h('b', null, fDate(CRW + 'T12:00:00', { month: 'short', day: 'numeric' })),
            h('button', { class: 'ib flip', type: 'button', 'aria-label': t('next'),
              onclick: () => { CRW = dkey(addDays(new Date(CRW + 'T12:00:00'), 7)); draw(); } }, ico('back', 18)),
            h('button', { class: 'lnk', type: 'button',
              onclick: () => { CRW = dkey(weekStart(new Date())); draw(); } }, t('this_week')))),

        ang ? h('div', { class: 'angbox' },
          h('span', { class: 'lbl' }, t('cr_angle')),
          h('b', null, L(ang, 'title')),
          isStaff() ? h('select', { 'aria-label': t('cr_angle'),
            onchange: (e) => run(e.target, async () => {
              await API.setWeekAngle(CRW, Number(e.target.value)); draw();
            }) }, angles.map((a) => h('option', { value: a.id }, L(a, 'title')))) : null,
          ang.hint ? h('p', { class: 'mut sm' }, ang.hint) : null) : null,

        h('div', { class: 'fchips' }, chips),

        h('div', { class: 'thbox' },
          h('b', null, L(th, 'title')),
          isStaff() ? h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'),
            onclick: themeEditor }, ico('edit', 15)) : null,
          th.hint ? h('p', { class: 'mut sm' }, th.hint) : null),

        h('div', { class: 'dbar', role: 'img', 'aria-label': t('cr_week_pct', { n: pct }) },
          h('span', { style: 'width:' + pct + '%' })),
        h('p', { class: 'mut small' }, t('cr_today', { a: doneToday, b: groups.length })
          + ' · ' + t('cr_week', { a: weekDone, b: weekTotal })),

        groups.length ? h('div', { class: 'cklist' }, groups.map(row))
          : empty(t('cr_nogroups'), t('cr_nogroups_sub')),

        isStaff() ? h('div', { class: 'acts' }, h('button', { class: 'btn ghost sm', type: 'button',
          onclick: () => groupEditor({}) }, ico('plus', 16), t('cr_add_g'))) : null);
      const sel = card.querySelector('.angbox select');
      if (sel && ang) sel.value = String(ang.id);
      fill(slot, card);
    }
    draw();
  }

  async function viewContent(main) {
    const [posts, targets] = await Promise.all([API.posts(), API.netTargets().catch(() => ({}))]);
    const today = dkey(new Date()); const wStart = dkey(weekStart(new Date())); const wEnd = dkey(addDays(weekStart(new Date()), 7));
    const mStart = dkey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const done = posts.filter((p) => p.status === 'posted');
    const pend = posts.filter((p) => p.status !== 'posted');
    const thisWeek = pend.filter((p) => p.due_on && p.due_on < wEnd);
    const later = pend.filter((p) => !p.due_on || p.due_on >= wEnd);
    const postedM = done.filter((p) => p.posted_on && p.posted_on >= mStart);
    const postedW = done.filter((p) => p.posted_on && p.posted_on >= wStart && p.posted_on < wEnd);
    const reach = postedM.reduce((s, p) => s + (Number(p.views) || 0), 0);
    const leadsGot = postedM.reduce((s, p) => s + (Number(p.leads) || 0), 0);
    const row = (p) => {
      const late = p.due_on && p.due_on < today && p.status !== 'posted';
      return h('div', { class: 'ckrow' + (p.status === 'posted' ? ' done' : '') },
        h('button', { class: 'tick', type: 'button', 'aria-label': t('mark_posted'), onclick: async (e) => run(e.currentTarget, async () => {
          await API.savePost({ id: p.id, status: p.status === 'posted' ? 'scheduled' : 'posted', posted_on: p.status === 'posted' ? null : dkey(new Date()) }); refresh(); }) }, ico('check', 15)),
        h('div', { class: 'tx' }, h('b', null, p.title),
          h('small', null, chip(t('ps_' + p.status), p.status === 'posted' ? 'ok' : p.status === 'idea' ? 'mut' : 'warn'),
            h('span', null, t('fmt_' + (FORMATS.indexOf(p.format) >= 0 ? p.format : 'reel'))), h('span', null, netName(p.platform)),
            p.due_on ? h('span', { class: late ? 'pill late' : '' }, fDate(p.due_on + 'T12:00:00', { month: 'short', day: 'numeric' })) : null,
            p.views ? h('span', null, Number(p.views).toLocaleString(loc()) + ' ' + t('views').toLowerCase()) : null,
            p.leads ? h('span', null, p.leads + ' leads') : null)),
        h('button', { class: 'ib', type: 'button', 'aria-label': t('edit'), onclick: () => postEditor(p) }, ico('edit', 16)));
    };
    fill(main, secH(t('content_h'), h('button', { class: 'btn sm', type: 'button', onclick: () => postEditor(null) }, ico('plus', 16), t('new_post'))),
      h('div', { id: 'cronoslot' }),
      h('div', { class: 'stats' },
        h('div', { class: 'stat ' + (pend.length ? 'warn' : '') }, h('span', null, t('pending_posts')), h('b', null, pend.length)),
        h('div', { class: 'stat' }, h('span', null, t('this_week_label')), h('b', null, postedW.length)),
        h('div', { class: 'stat' }, h('span', null, t('posted_this_month')), h('b', null, postedM.length)),
        h('div', { class: 'stat' }, h('span', null, t('views')), h('b', null, reach.toLocaleString(loc()))),
        h('div', { class: 'stat ok' }, h('span', null, t('leads_got')), h('b', null, leadsGot))),
      h('div', { class: 'sech', style: 'margin-top:20px' }, h('h3', { class: 'sub', style: 'margin:0' }, t('coverage')),
        h('button', { class: 'lnk', type: 'button', onclick: () => targetsEditor(targets) }, t('edit_targets'))),
      (function () {
        const byNet = {}; NETS.forEach((k) => { byNet[k] = { done: 0, plan: 0 }; });
        postedW.forEach((x) => { const k = NETS.indexOf(x.platform) >= 0 ? x.platform : 'instagram'; byNet[k].done++; });
        pend.forEach((x) => { const k = NETS.indexOf(x.platform) >= 0 ? x.platform : 'instagram'; byNet[k].plan++; });
        let short = 0;
        const cards = NETS.filter((k) => (targets[k] || 0) > 0).map((k) => {
          const goal = targets[k] || 0, got = byNet[k].done, pcts = Math.min(100, Math.round((got / goal) * 100));
          if (got < goal) short += goal - got;
          const cls = got >= goal ? 'on' : got > 0 ? 'half' : byNet[k].plan ? 'plan' : 'off';
          return h('button', { type: 'button', class: 'net ' + cls, onclick: () => postEditor(null, k) },
            h('div', { class: 'row between' }, h('b', null, netName(k)), h('b', { class: 'score' }, got + '/' + goal)),
            h('span', { class: 'tr' }, h('i', { style: 'width:' + pcts + '%' })),
            h('small', null, byNet[k].plan ? t('pending_posts') + ': ' + byNet[k].plan : got >= goal ? t('done_label') : t('nothing_this_month')));
        });
        return h('div', null, h('div', { class: 'nets' }, cards),
          h('p', { class: 'mut small' }, short ? t('missing_nets', { n: short }) : t('all_nets_covered')),
          h('p', { class: 'mut small' }, t('yt_note') + ' ' + t('yelp_note')));
      })(),
      h('h3', { class: 'sub' }, t('week_plan'), ' ', chip(String(thisWeek.length), thisWeek.length ? 'warn' : 'mut')),
      thisWeek.length ? h('div', { class: 'cklist' }, thisWeek.map(row)) : empty(t('no_posts')),
      later.length ? h('h3', { class: 'sub' }, t('later')) : null, later.length ? h('div', { class: 'cklist' }, later.map(row)) : null,
      done.length ? h('h3', { class: 'sub' }, t('done_label')) : null, done.length ? h('div', { class: 'cklist' }, done.slice(0, 20).map(row)) : null);
    const cs = main.querySelector('#cronoslot'); if (cs) cronopost(cs);
  }
  function targetsEditor(cur) {
    const ins = {};
    const rows = NETS.map((k) => { ins[k] = h('input', { type: 'number', min: '0', max: '21', value: cur[k] == null ? 0 : cur[k] }); return field(netName(k) + ' — ' + t('per_week'), ins[k]); });
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(t('targets_h'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      for (const k of NETS) { const v = Math.max(0, Number(ins[k].value) || 0); if (v !== cur[k]) await API.saveNetTarget(k, v); }
      m.close(); toast(t('saved')); refresh(); }); } },
      h('p', { class: 'mut small' }, t('targets_hint')), h('div', { class: 'two' }, rows), h('div', { class: 'acts' }, save)), { wide: true });
  }

  function postEditor(p, preNet) {
    const f = { title: h('input', { required: true, value: p ? p.title : '' }),
      platform: h('select', null, NETS.map((x) => h('option', { value: x }, netName(x)))),
      format: h('select', null, FORMATS.map((x) => h('option', { value: x }, t('fmt_' + x)))),
      status: h('select', null, PSTAT.map((x) => h('option', { value: x }, t('ps_' + x)))),
      due: h('input', { type: 'date', value: p && p.due_on ? p.due_on : '' }), link: h('input', { type: 'url', value: p ? p.link : '', placeholder: 'https://' }),
      views: h('input', { type: 'number', min: '0', value: p && p.views != null ? p.views : '' }), saves: h('input', { type: 'number', min: '0', value: p && p.saves != null ? p.saves : '' }),
      leads: h('input', { type: 'number', min: '0', value: p && p.leads != null ? p.leads : '' }), notes: h('textarea', { rows: 2 }) };
    f.platform.value = p ? p.platform : (preNet || 'instagram'); f.format.value = p ? p.format : 'reel'; f.status.value = p ? p.status : 'idea'; f.notes.value = p ? p.notes : '';
    const save = h('button', { class: 'btn', type: 'submit' }, t('save'));
    const m = modal(p ? t('edit_post') : t('new_post'), h('form', { class: 'mb frm', onsubmit: (e) => { e.preventDefault(); run(save, async () => {
      const num = (x) => (x.value === '' ? null : Number(x.value));
      await API.savePost({ id: p && p.id, title: f.title.value.trim(), platform: f.platform.value, format: f.format.value, status: f.status.value,
        due_on: f.due.value || null, posted_on: f.status.value === 'posted' ? ((p && p.posted_on) || dkey(new Date())) : null, link: f.link.value.trim(),
        views: num(f.views), saves: num(f.saves), leads: num(f.leads), notes: f.notes.value.trim(), sort: p ? p.sort : 50 });
      m.close(); toast(t('saved')); refresh(); }); } },
      field(t('content_h'), f.title), h('div', { class: 'two' }, field(t('platform'), f.platform), field(t('format'), f.format)),
      h('div', { class: 'two' }, field(t('status'), f.status), field(t('due'), f.due)), field(t('link'), f.link),
      h('div', { class: 'two' }, field(t('views'), f.views), field(t('saves'), f.saves)), field(t('leads_got'), f.leads), field(t('notes'), f.notes),
      h('div', { class: 'acts' }, p ? h('button', { class: 'btn ghost danger-t', type: 'button', onclick: async () => { if (await askConfirm(t('del_post_q'))) { await API.deletePost(p.id); m.close(); refresh(); } } }, t('delete')) : null, save)), { wide: true });
  }

  /* ---------- arranque ---------- */
  async function boot() {
    fill(root, spin());
    API.onRecovery(() => { S.recovery = true; render(); });
    try { const u = await API.session(); if (u) { S.user = u; S.me = await API.myProfile(); } } catch (e) { console.warn(e); S.me = null; try { await API.signOut(); } catch (x) { /* ok */ } }
    render();
  }
  window.__portal = { S, render };
  boot();
})();
