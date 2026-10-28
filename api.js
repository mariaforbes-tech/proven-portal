/* Capa de datos: Supabase real (si config.js tiene llaves) o MODO DEMO local. */
(function () {
  'use strict';
  const CFG = window.PORTAL_CONFIG || {};
  const CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const LIVE = !!(CONFIGURED && window.supabase);
  /* Si config.js está lleno pero la librería de Supabase no cargó, NO caemos al modo de
     prueba en silencio: eso haría creer que el portal está conectado cuando no lo está. */
  if (CONFIGURED && !window.supabase) {
    document.addEventListener('DOMContentLoaded', function () {
      const box = document.getElementById('app');
      if (box) box.innerHTML = '<div style="max-width:30rem;margin:4rem auto;padding:1.5rem;'
        + 'font:16px/1.5 system-ui,sans-serif;background:#F7E4E3;color:#A3302C;border-radius:14px">'
        + '<b>No cargó la librería de Supabase.</b><br><br>Las llaves están puestas, pero el '
        + 'archivo de Supabase no llegó. Suele ser falta de internet o que el bloqueador de '
        + 'anuncios lo frenó. Recarga la página; si sigue igual, pruébala en otro navegador.</div>';
    });
    console.error('[portal] config.js tiene llaves pero window.supabase no existe: revisa el <script> de supabase-js en index.html');
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const safeName = (n) => String(n || 'file').replace(/[^\w.\-]+/g, '_').slice(-60);
  const ALL = { projects: true, clock: true, shifts: true, docs: true, pay: true };

  /* Reduce fotos del celular antes de subirlas (recibos legibles, archivos livianos) */
  async function shrink(file, max, q) {
    if (!file || !/^image\//.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
      return blob ? new File([blob], safeName(file.name).replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }
  const toDataURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  /* ======================= SUPABASE REAL ======================= */
  function liveAPI() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const q = async (p) => { const { data, error } = await p; if (error) throw error; return data; };
    const meId = async () => (await sb.auth.getUser()).data.user.id;
    return {
      live: true,
      async session() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
      onRecovery(cb) { sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') cb(); }); },
      async signUp(o) {
        const { data, error } = await sb.auth.signUp({ email: o.email, password: o.password,
          options: { data: { full_name: o.full_name, phone: o.phone, grp: o.grp, lang: o.lang } } });
        if (error) throw error;
        if (data.session) await sb.auth.signOut();
      },
      async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
      async signOut() { await sb.auth.signOut(); },
      async reset(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; },
      async setPassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; },
      async myProfile() { return q(sb.from('profiles').select('*').eq('id', await meId()).single()); },
      async updateMe(patch) { return q(sb.from('profiles').update(patch).eq('id', await meId())); },

      /* administración */
      profiles: () => q(sb.from('profiles').select('*').order('created_at', { ascending: false })),
      updateProfile: (id, patch) => q(sb.from('profiles').update(patch).eq('id', id)),
      deleteProfile: (id) => q(sb.from('profiles').delete().eq('id', id)),
      async groupDefaults() { const r = await q(sb.from('group_defaults').select('*')); const o = {}; r.forEach((x) => (o[x.grp] = x.perms)); return o; },
      saveDefaults: (grp, perms) => q(sb.from('group_defaults').upsert({ grp, perms })),

      /* proyectos */
      async projects() {
        const r = await q(sb.from('projects').select('*, project_members(worker_id, role)').order('created_at', { ascending: false }));
        return r.map((p) => ({ ...p, members: p.project_members || [] }));
      },
      async saveProject(p, members) {
        const row = { name: p.name, client: p.client, address: p.address, status: p.status, starts_on: p.starts_on || null,
          ends_on: p.ends_on || null, contract: p.contract == null ? null : p.contract,
          pct_manual: p.pct_manual == null ? null : p.pct_manual, notes: p.notes };
        let id = p.id;
        if (id) await q(sb.from('projects').update(row).eq('id', id));
        else id = (await q(sb.from('projects').insert(row).select('id').single())).id;
        await q(sb.from('project_members').delete().eq('project_id', id));
        if (members.length) await q(sb.from('project_members').insert(members.map((m) => ({ project_id: id, worker_id: m.worker_id, role: m.role }))));
        return id;
      },
      deleteProject: (id) => q(sb.from('projects').delete().eq('id', id)),
      people: (pid) => q(sb.rpc('project_people', { p_project: pid })),

      /* scope */
      scope: (pid) => q(sb.from('scope_items').select('*').eq('project_id', pid).order('sort')),
      allScope: () => q(sb.from('scope_items').select('project_id, status, weight, cadence, due_on, done_on').limit(5000)),
      saveScopeItem: (s) => s.id ? q(sb.from('scope_items').update(s).eq('id', s.id)) : q(sb.from('scope_items').insert(s)),
      deleteScopeItem: (id) => q(sb.from('scope_items').delete().eq('id', id)),
      setScopeStatus: (id, status, done_on) => q(sb.from('scope_items').update({ status, done_on: done_on || null }).eq('id', id)),
      checks: (ids) => ids.length ? q(sb.from('scope_checks').select('*').in('item_id', ids).limit(2000)) : Promise.resolve([]),
      async addCheck(item_id, period) { return q(sb.from('scope_checks').insert({ item_id, period, done_by: await meId() })); },
      removeCheck: (item_id, period) => q(sb.from('scope_checks').delete().eq('item_id', item_id).eq('period', period)),

      /* materiales */
      materials: (pid) => q(sb.from('materials').select('*').eq('project_id', pid).order('created_at', { ascending: false })),
      async saveMaterial(m) {
        if (m.id) return q(sb.from('materials').update(m).eq('id', m.id));
        return q(sb.from('materials').insert({ ...m, added_by: await meId() }));
      },
      async setBought(id, bought) {
        return q(sb.from('materials').update({ bought, bought_on: bought ? new Date().toISOString().slice(0, 10) : null, bought_by: bought ? await meId() : null }).eq('id', id));
      },
      deleteMaterial: (id) => q(sb.from('materials').delete().eq('id', id)),
      /* --- selecciones del cliente --- */
      selections: (pid) => q(sb.from('selections').select('*').eq('project_id', pid).order('due_on', { ascending: true })),
      async saveSelection(x) {
        if (x.id) return q(sb.from('selections').update(x).eq('id', x.id));
        return q(sb.from('selections').insert(x));
      },
      async setSelection(id, patch) {
        const done = patch.status && patch.status !== 'pending';
        return q(sb.from('selections').update({ ...patch,
          decided_on: done ? new Date().toISOString().slice(0, 10) : null,
          decided_by: done ? await meId() : null }).eq('id', id));
      },
      deleteSelection: (id) => q(sb.from('selections').delete().eq('id', id)),
      /* --- plata abierta: lo que deben y lo que se debe --- */
      projectClients: () => q(sb.from('project_clients').select('*')),
      /* --- cronopost: grupos de Facebook --- */
      postThemes: () => q(sb.from('post_themes').select('*').order('day')),
      postAngles: () => q(sb.from('post_angles').select('*').order('id')),
      weekPlan: (wk) => q(sb.from('week_plan').select('*').eq('week_start', wk)),
      setWeekAngle: (wk, angle) => q(sb.from('week_plan')
        .upsert({ week_start: wk, angle_id: angle }, { onConflict: 'week_start' })),
      postCopy: (wk) => q(sb.from('post_copy').select('*').eq('week_start', wk)),
      saveCopy: (wk, day, aud, body) => q(sb.from('post_copy')
        .upsert({ week_start: wk, day: day, audience: aud, body: body },
                { onConflict: 'week_start,day,audience' })),
      fbGroups: () => q(sb.from('fb_groups').select('*').order('sort')),
      groupPosts: (wk) => q(sb.from('group_posts').select('*').eq('week_start', wk)),
      saveFbGroup(g) {
        const row = { ...g };
        if (row.id) { const id = row.id; delete row.id; return q(sb.from('fb_groups').update(row).eq('id', id)); }
        return q(sb.from('fb_groups').insert(row));
      },
      deleteFbGroup: (id) => q(sb.from('fb_groups').delete().eq('id', id)),
      /* El chulo: si se prende se guarda la fila, si se apaga se borra.
         posted_by lo pone la base sola con auth.uid(). */
      markGroupPost(groupId, wk, day, on) {
        if (!on) return q(sb.from('group_posts').delete()
          .eq('group_id', groupId).eq('week_start', wk).eq('day', day));
        return q(sb.from('group_posts').insert({ group_id: groupId, week_start: wk, day: day }));
      },
      saveTheme: (t) => q(sb.from('post_themes').update({ title: t.title, title_en: t.title_en, hint: t.hint }).eq('day', t.day)),
      /* --- deuda con trabajadores --- */
      workerDebts: () => q(sb.from('worker_debts').select('*').order('sort')),
      debtBaseline: () => q(sb.from('debt_baseline').select('*').eq('id', 1)),
      saveWorkerDebt(r) {
        const row = { ...r, updated_at: new Date().toISOString() };
        if (row.id) { const id = row.id; delete row.id; return q(sb.from('worker_debts').update(row).eq('id', id)); }
        return q(sb.from('worker_debts').insert(row));
      },
      deleteWorkerDebt: (id) => q(sb.from('worker_debts').delete().eq('id', id)),
      saveDebtBaseline: (started, note) => q(sb.from('debt_baseline')
        .upsert({ id: 1, started, note: note || '', updated_at: new Date().toISOString() })),
      clientPayments: () => q(sb.from('client_payments').select('*')),
      /* --- marcar y mover plata: cobros al cliente y lo que le debemos a terceros --- */
      saveClientPayment(r) {
        const row = { ...r };
        if (row.id) { const id = row.id; delete row.id; return q(sb.from('client_payments').update(row).eq('id', id)); }
        return q(sb.from('client_payments').insert(row));
      },
      deleteClientPayment: (id) => q(sb.from('client_payments').delete().eq('id', id)),
      savePayable(r) {
        const row = { ...r };
        if (row.id) { const id = row.id; delete row.id; return q(sb.from('payables').update(row).eq('id', id)); }
        return q(sb.from('payables').insert(row));
      },
      deletePayable: (id) => q(sb.from('payables').delete().eq('id', id)),
      payables: () => q(sb.from('payables').select('*')),
      /* --- opciones que el cliente escoge --- */
      options: (selId) => q(sb.from('selection_options').select('*').eq('selection_id', selId).order('sort')),
      async saveOption(o, file) {
        const row = { ...o };
        if (file) {
          const f = await shrink(file, 1400, 0.82);
          const path = o.project_id + '/' + uid();
          const { error } = await sb.storage.from('project-files').upload(path, f, { contentType: f.type });
          if (error) throw error;
          row.photo_path = path;
        }
        delete row.project_id;
        if (row.id) return q(sb.from('selection_options').update(row).eq('id', row.id));
        return q(sb.from('selection_options').insert(row));
      },
      deleteOption: (id) => q(sb.from('selection_options').delete().eq('id', id)),

      /* --- planos y fotos del antes --- */
      planFiles: (pid) => q(sb.from('project_files').select('*').eq('project_id', pid).order('created_at', { ascending: false })),
      async savePlanFile(f) {
        /* Un plano se encoge mucho menos que una foto: si lo apretamos
           como una foto de obra, los numeros de las cotas dejan de leerse. */
        const esPlano = f.kind === 'plan' || f.kind === 'doc';
        const file = /^image\//.test(f.file.type)
          ? await shrink(f.file, esPlano ? 2400 : 1600, esPlano ? 0.92 : 0.82)
          : f.file;
        const path = f.project_id + '/plans/' + uid() + '-' + safeName(file.name || 'archivo');
        const { error } = await sb.storage.from('project-files').upload(path, file, { contentType: file.type });
        if (error) throw error;
        return q(sb.from('project_files').insert({
          project_id: f.project_id, kind: f.kind, title: f.title || '',
          file_path: path, file_name: file.name || '', for_client: !!f.for_client
        }));
      },
      updatePlanFile: (id, patch) => q(sb.from('project_files').update(patch).eq('id', id)),
      deletePlanFile: (id) => q(sb.from('project_files').delete().eq('id', id)),

      /* gastos fijos */
      fixed: () => q(sb.from('fixed_costs').select('*').order('title')),
      saveFixed: (f) => f.id ? q(sb.from('fixed_costs').update(f).eq('id', f.id)) : q(sb.from('fixed_costs').insert(f)),
      deleteFixed: (id) => q(sb.from('fixed_costs').delete().eq('id', id)),

      /* chat y recibos */
      messages: (pid) => q(sb.from('messages').select('*').eq('project_id', pid).order('created_at', { ascending: true }).limit(400)),
      receipts: () => q(sb.from('messages').select('*').eq('kind', 'receipt').order('created_at', { ascending: false }).limit(2000)),
      async postMessage(m) {
        let file_path = null, file_name = null;
        if (m.file) {
          const f = await shrink(m.file, 1600, 0.82);
          file_path = m.project_id + '/' + uid() + '-' + safeName(f.name);
          const { error } = await sb.storage.from('project-files').upload(file_path, f, { contentType: f.type });
          if (error) throw error; file_name = f.name;
        }
        return q(sb.from('messages').insert({ project_id: m.project_id, author_id: m.author_id, kind: m.kind, body: m.body || '',
          amount: m.amount == null ? null : m.amount, vendor: m.vendor || '', file_path, file_name }));
      },
      deleteMessage: (id) => q(sb.from('messages').delete().eq('id', id)),
      async urls(paths, bucket) {
        const out = {}; const list = [...new Set(paths.filter(Boolean))]; if (!list.length) return out;
        const { data, error } = await sb.storage.from(bucket || 'project-files').createSignedUrls(list, 3600);
        if (error) throw error; (data || []).forEach((d) => { if (d.signedUrl) out[d.path] = d.signedUrl; }); return out;
      },

      /* reloj */
      async myOpen() { return q(sb.from('time_entries').select('*, breaks:time_breaks(*)').eq('worker_id', await meId()).is('clock_out', null).maybeSingle()); },
      clockIn: (pid) => q(sb.rpc('clock_in', { p_project: pid })),
      startBreak: () => q(sb.rpc('start_break')),
      endBreak: () => q(sb.rpc('end_break')),
      clockOut: () => q(sb.rpc('clock_out')),
      entries: (from, to) => q(sb.from('time_entries').select('*, breaks:time_breaks(*)').gte('clock_in', from.toISOString()).lt('clock_in', to.toISOString()).order('clock_in', { ascending: true }).limit(5000)),
      openEntries: () => q(sb.from('time_entries').select('*, breaks:time_breaks(*)').is('clock_out', null)),
      async saveEntry(e) {
        const row = { clock_in: e.clock_in, clock_out: e.clock_out || null };
        if (e.id) return q(sb.from('time_entries').update(row).eq('id', e.id));
        return q(sb.from('time_entries').insert({ ...row, worker_id: e.worker_id, project_id: e.project_id }));
      },
      deleteEntry: (id) => q(sb.from('time_entries').delete().eq('id', id)),

      /* turnos */
      shifts: () => q(sb.rpc('list_shifts')),
      claims: () => q(sb.from('shift_claims').select('*')),
      saveShift: (s) => s.id ? q(sb.from('shifts').update(s).eq('id', s.id)) : q(sb.from('shifts').insert(s)),
      deleteShift: (id) => q(sb.from('shifts').delete().eq('id', id)),
      claimShift: (id) => q(sb.rpc('claim_shift', { p_shift: id })),
      releaseShift: (id) => q(sb.rpc('release_shift', { p_shift: id })),
      removeClaim: (sid, wid) => q(sb.from('shift_claims').delete().eq('shift_id', sid).eq('worker_id', wid)),

      /* documentos */
      requirements: () => q(sb.from('doc_requirements').select('*').order('sort')),
      saveRequirement: (r) => r.id ? q(sb.from('doc_requirements').update(r).eq('id', r.id)) : q(sb.from('doc_requirements').insert(r)),
      deleteRequirement: (id) => q(sb.from('doc_requirements').delete().eq('id', id)),
      docs: () => q(sb.from('worker_documents').select('*')),
      async uploadDoc(reqId, file) {
        const me = await meId(); const f = await shrink(file, 2000, 0.85);
        const path = me + '/' + reqId + '-' + Date.now() + '-' + safeName(f.name);
        const { error } = await sb.storage.from('worker-docs').upload(path, f, { contentType: f.type });
        if (error) throw error;
        return q(sb.from('worker_documents').upsert({ worker_id: me, requirement_id: reqId, file_path: path, file_name: f.name, signed_name: null, signed_at: null, status: 'submitted', note: '' }, { onConflict: 'worker_id,requirement_id' }));
      },
      async signDoc(reqId, name) {
        const me = await meId();
        return q(sb.from('worker_documents').upsert({ worker_id: me, requirement_id: reqId, signed_name: name, signed_at: new Date().toISOString(), file_path: null, file_name: null, status: 'submitted', note: '' }, { onConflict: 'worker_id,requirement_id' }));
      },
      setDocStatus: (id, status, note) => q(sb.from('worker_documents').update({ status, note: note || '' }).eq('id', id)),

      /* pagos */
      payments: () => q(sb.from('payments').select('*').order('paid_on', { ascending: false })),
      savePayment: (p) => q(sb.from('payments').insert(p)),
      deletePayment: (id) => q(sb.from('payments').delete().eq('id', id)),

      /* gastos */
      expenses: (from, to) => q(sb.from('expenses').select('*').gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }).limit(5000)),
      async saveExpense(e) {
        const row = { spent_on: e.spent_on, amount: e.amount, vendor: e.vendor || '', memo: e.memo || '', category: e.category || 'other', project_id: e.project_id || null };
        if (e.id) return q(sb.from('expenses').update(row).eq('id', e.id));
        return q(sb.from('expenses').insert({ ...row, source: e.source || 'manual', ext_id: e.ext_id || null, created_by: await meId() }));
      },
      deleteExpense: (id) => q(sb.from('expenses').delete().eq('id', id)),
      async importExpenses(rows) {
        const me = await meId();
        const data = await q(sb.from('expenses').insert(rows.map((r) => ({ ...r, source: 'import', created_by: me }))).select('id'));
        return (data || []).length;
      },
      async existingExtIds(ids) {
        if (!ids.length) return [];
        const r = await q(sb.from('expenses').select('ext_id').in('ext_id', ids));
        return (r || []).map((x) => x.ext_id);
      },

      /* contenido */
      posts: () => q(sb.from('content_posts').select('*').order('due_on', { ascending: true, nullsFirst: false }).limit(500)),
      savePost: (p) => p.id ? q(sb.from('content_posts').update(p).eq('id', p.id)) : q(sb.from('content_posts').insert(p)),
      deletePost: (id) => q(sb.from('content_posts').delete().eq('id', id)),

      /* metas por red */
      async netTargets() { const r = await q(sb.from('net_targets').select('*')); const o = {}; (r || []).forEach((x) => { o[x.network] = x.weekly; }); return o; },
      saveNetTarget: (network, weekly) => q(sb.from('net_targets').upsert({ network, weekly })),

      /* CRM */
      leads: () => q(sb.from('funnel_leads').select('*').order('updated_at', { ascending: false }).limit(1000)),
      saveLead: (l) => l.id ? q(sb.from('funnel_leads').update(l).eq('id', l.id)) : q(sb.from('funnel_leads').insert(l)),
      deleteLead: (id) => q(sb.from('funnel_leads').delete().eq('id', id)),
    };
  }

  /* ======================= MODO DEMO (navegador) ======================= */
  function demoAPI() {
    const KEY = 'pp_demo_v10_sel';
    const day = 864e5, now = () => Date.now();
    const at = (daysAgo, h, m) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m || 0, 0, 0); return d.toISOString(); };
    /* En el paquete publicado el seed va VACIO a proposito.
       Los datos de prueba traian nombres, direcciones y montos de clientes reales,
       y este archivo queda legible para cualquiera que abra el sitio. En vivo el
       portal lee de Supabase; esto solo existe para que el codigo no se rompa si
       config.js queda sin llenar. */
    function seed() {
      const profiles = [], projects = [], members = [], messages = [], entries = [], shifts = [];
      const reqs = [], docs = [], payments = [], expenses = [], posts = [], leads = [];
      const scope = [], checks = [], materials = [], selections = [], fixed = [];
      const targets = { instagram: 4, facebook: 4, facebook_groups: 7, tiktok: 4, blog: 2, linkedin: 2, youtube: 4, yelp: 2 };
      return { session: null, targets, profiles, projects, members, messages, entries, shifts, claims: [],
        reqs, docs, payments, expenses, posts, leads, scope, checks, materials, selections, options: [], cpays: [], pays: [], pclients: [], debts: [], base: null, themes: [], fbg: [], gposts: [], copy: [], angles: [], wplan: [], fixed, files: {},
        defaults: { crew: { projects: true, clock: true, shifts: false, docs: true, pay: true }, gigs: { projects: true, clock: true, shifts: true, docs: true, pay: true } } };
    }
    let DB;
    try { const r = localStorage.getItem(KEY); DB = r ? JSON.parse(r) : null; } catch (e) { DB = null; }
    if (!DB) DB = seed();
    /* Datos guardados por una versión anterior: si les falta alguna tabla, se rehacen. */
    const NEED = ['profiles', 'projects', 'members', 'messages', 'entries', 'shifts', 'claims', 'reqs', 'docs',
      'payments', 'expenses', 'posts', 'leads', 'scope', 'checks', 'materials', 'selections', 'fixed'];
    if (!DB.targets || NEED.some((k) => !Array.isArray(DB[k]))) { const keep = DB.session; DB = seed(); DB.session = keep; }
    if (!DB.files) DB.files = {};
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* sin almacenamiento: sigue en memoria */ } };
    save();
    const meP = () => DB.profiles.find((p) => p.id === DB.session);
    const staff = () => { const p = meP(); return !!p && p.status === 'approved' && (p.is_admin || p.is_office); };
    const admin = () => { const p = meP(); return !!p && p.status === 'approved' && p.is_admin; };
    const finance = () => { const p = meP(); return !!p && p.status === 'approved' && (p.is_admin || p.is_finance); };
    const viewer = () => { const p = meP(); return !!p && p.status === 'approved' && (p.is_admin || p.is_office || p.is_finance); };
    const perm = (k) => { const p = meP(); return !!p && p.status === 'approved' && !!p.perms[k]; };
    const member = (pid) => DB.members.some((m) => m.project_id === pid && m.worker_id === DB.session);
    const foreman = (pid) => DB.members.some((m) => m.project_id === pid && m.worker_id === DB.session && m.role === 'foreman');
    const need = (ok, code) => { if (!ok) throw new Error(code || 'no_access'); };
    const wait = (v) => new Promise((r) => setTimeout(() => r(clone(v)), 25));
    const visibleEntry = (e) => viewer() || (e.worker_id === DB.session && perm('clock')) || foreman(e.project_id);
    return {
      live: false,
      async session() { return DB.session ? { id: DB.session } : null; },
      onRecovery() {},
      async signUp(o) {
        need(!DB.profiles.some((p) => p.email.toLowerCase() === o.email.toLowerCase()), 'User already registered');
        DB.profiles.push({ id: 'u_' + uid(), full_name: o.full_name, email: o.email, phone: o.phone, lang: o.lang, grp: o.grp === 'crew' ? 'crew' : 'gigs', status: 'pending', is_admin: false, is_office: false,
          perms: { projects: false, clock: false, shifts: false, docs: false, pay: false }, created_at: new Date().toISOString(), pw: o.password });
        save(); return wait(null);
      },
      async signIn(email, pw) {
        const p = DB.profiles.find((x) => x.email.toLowerCase() === email.toLowerCase());
        need(p && p.pw === pw, 'Invalid login credentials'); DB.session = p.id; save();
      },
      async signOut() { DB.session = null; save(); },
      async reset() { return null; },
      async setPassword() { return null; },
      async myProfile() { const p = meP(); need(p, 'no_profile'); const c = clone(p); delete c.pw; return c; },
      async updateMe(patch) { Object.assign(meP(), patch); save(); },

      async profiles() { need(viewer()); return wait(DB.profiles.map((p) => { const c = clone(p); delete c.pw; return c; })); },
      async updateProfile(id, patch) { need(admin()); Object.assign(DB.profiles.find((p) => p.id === id), patch); save(); },
      async deleteProfile(id) { need(admin()); DB.profiles = DB.profiles.filter((p) => p.id !== id); save(); },
      async groupDefaults() { need(admin()); return wait(DB.defaults); },
      async saveDefaults(grp, perms) { need(admin()); DB.defaults[grp] = perms; save(); },

      async projects() {
        const list = DB.projects.filter((p) => viewer() || (perm('projects') && member(p.id)));
        return wait(list.map((p) => ({ ...p, members: DB.members.filter((m) => m.project_id === p.id).map((m) => ({ worker_id: m.worker_id, role: m.role })) })));
      },
      async saveProject(p, members) {
        need(staff()); let id = p.id;
        const row = { name: p.name, client: p.client, address: p.address, status: p.status, starts_on: p.starts_on || null, ends_on: p.ends_on || null,
          contract: p.contract == null ? null : p.contract, pct_manual: p.pct_manual == null ? null : p.pct_manual, notes: p.notes };
        if (id) Object.assign(DB.projects.find((x) => x.id === id), row);
        else { id = 'p_' + uid(); DB.projects.unshift({ id, ...row, created_at: new Date().toISOString() }); }
        DB.members = DB.members.filter((m) => m.project_id !== id).concat(members.map((m) => ({ project_id: id, worker_id: m.worker_id, role: m.role })));
        save(); return id;
      },
      async deleteProject(id) {
        need(staff()); DB.projects = DB.projects.filter((p) => p.id !== id); DB.members = DB.members.filter((m) => m.project_id !== id);
        DB.messages = DB.messages.filter((m) => m.project_id !== id); DB.entries = DB.entries.filter((e) => e.project_id !== id);
        DB.scope = DB.scope.filter((s) => s.project_id !== id); DB.materials = DB.materials.filter((m) => m.project_id !== id);
        DB.selections = DB.selections.filter((x) => x.project_id !== id); save();
      },
      async people(pid) {
        need(staff() || member(pid));
        return wait(DB.members.filter((m) => m.project_id === pid).map((m) => ({ id: m.worker_id, full_name: DB.profiles.find((p) => p.id === m.worker_id).full_name, role: m.role })));
      },

      async scope(pid) { need(viewer() || (perm('projects') && member(pid))); return wait(DB.scope.filter((s) => s.project_id === pid).sort((a, b) => a.sort - b.sort)); },
      async allScope() { return wait(DB.scope.filter((s) => viewer() || (perm('projects') && member(s.project_id)))); },
      async saveScopeItem(s) { need(staff()); if (s.id) Object.assign(DB.scope.find((x) => x.id === s.id), s); else DB.scope.push({ ...s, id: uid(), created_at: new Date().toISOString() }); save(); },
      async deleteScopeItem(id) { need(staff()); DB.scope = DB.scope.filter((s) => s.id !== id); DB.checks = DB.checks.filter((c) => c.item_id !== id); save(); },
      async setScopeStatus(id, status, done_on) {
        const it = DB.scope.find((s) => s.id === id); need(it, 'not_found'); need(staff() || foreman(it.project_id));
        it.status = status; it.done_on = done_on || null; save();
      },
      async checks(ids) { return wait(DB.checks.filter((c) => ids.indexOf(c.item_id) >= 0)); },
      async addCheck(item_id, period) {
        const it = DB.scope.find((s) => s.id === item_id); need(it && (staff() || (perm('projects') && member(it.project_id))));
        if (!DB.checks.some((c) => c.item_id === item_id && c.period === period)) DB.checks.push({ id: uid(), item_id, period, done_by: DB.session, done_at: new Date().toISOString() });
        save();
      },
      async removeCheck(item_id, period) { DB.checks = DB.checks.filter((c) => !(c.item_id === item_id && c.period === period && (c.done_by === DB.session || staff()))); save(); },

      async materials(pid) { need(viewer() || (perm('projects') && member(pid))); return wait(DB.materials.filter((m) => m.project_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
      async saveMaterial(m) {
        need(staff() || (perm('projects') && member(m.project_id)));
        if (m.id) Object.assign(DB.materials.find((x) => x.id === m.id), m);
        else DB.materials.push({ ...m, id: uid(), bought: false, bought_on: null, bought_by: null, added_by: DB.session, created_at: new Date().toISOString() });
        save();
      },
      async setBought(id, bought) {
        const m = DB.materials.find((x) => x.id === id); need(m && (staff() || (perm('projects') && member(m.project_id))));
        m.bought = bought; m.bought_on = bought ? new Date().toISOString().slice(0, 10) : null; m.bought_by = bought ? DB.session : null; save();
      },
      async deleteMaterial(id) { need(staff()); DB.materials = DB.materials.filter((m) => m.id !== id); save(); },
      /* --- selecciones: las ve quien ve el proyecto, las cambia solo la oficina --- */
      async selections(pid) { need(viewer() || (perm('projects') && member(pid)));
        return wait(DB.selections.filter((x) => x.project_id === pid)
          .sort((a, b) => String(a.due_on || '9999').localeCompare(String(b.due_on || '9999')) || a.sort - b.sort)); },
      async saveSelection(x) {
        need(staff());
        if (x.id) Object.assign(DB.selections.find((y) => y.id === x.id), x);
        else DB.selections.push({ ...x, id: uid(), status: x.status || 'pending', decided_on: null, decided_by: null,
          sort: DB.selections.length + 1, created_at: new Date().toISOString() });
        save();
      },
      async setSelection(id, patch) {
        need(staff());
        const x = DB.selections.find((y) => y.id === id); need(x);
        const done = patch.status && patch.status !== 'pending';
        Object.assign(x, patch, { decided_on: done ? new Date().toISOString().slice(0, 10) : null,
          decided_by: done ? DB.session : null });
        save();
      },
      async deleteSelection(id) { need(staff()); DB.selections = DB.selections.filter((x) => x.id !== id); save(); },
      /* En modo de prueba no hay saldos cargados: devuelve vacío, no inventa. */
      async projectClients() { need(staff()); return wait(DB.pclients || []); },
      async postThemes() { return wait(DB.themes || []); },
      async postAngles() { return wait(DB.angles || []); },
      async weekPlan(wk) { return wait((DB.wplan || []).filter((x) => x.week_start === wk)); },
      async setWeekAngle(wk, angle) {
        need(staff()); DB.wplan = DB.wplan || [];
        const f = DB.wplan.find((x) => x.week_start === wk);
        if (f) f.angle_id = angle; else DB.wplan.push({ week_start: wk, angle_id: angle });
        save();
      },
      async postCopy(wk) { return wait((DB.copy || []).filter((x) => x.week_start === wk)); },
      async saveCopy(wk, day, aud, body) {
        need(staff()); DB.copy = DB.copy || [];
        const f = DB.copy.find((x) => x.week_start === wk && x.day === day && x.audience === aud);
        if (f) f.body = body; else DB.copy.push({ week_start: wk, day: day, audience: aud, body: body });
        save();
      },
      async fbGroups() { return wait((DB.fbg || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))); },
      async groupPosts(wk) { return wait((DB.gposts || []).filter((x) => x.week_start === wk)); },
      async saveFbGroup(g) {
        need(staff()); DB.fbg = DB.fbg || [];
        if (g.id) Object.assign(DB.fbg.find((x) => x.id === g.id), g);
        else DB.fbg.push({ ...g, id: uid(), created_at: new Date().toISOString() });
        save();
      },
      async deleteFbGroup(id) { need(staff()); DB.fbg = (DB.fbg || []).filter((x) => x.id !== id); save(); },
      async markGroupPost(groupId, wk, day, on) {
        need(staff()); DB.gposts = DB.gposts || [];
        DB.gposts = DB.gposts.filter((x) => !(x.group_id === groupId && x.week_start === wk && x.day === day));
        if (on) DB.gposts.push({ id: uid(), group_id: groupId, week_start: wk, day: day,
          posted_on: new Date().toISOString().slice(0, 10), link: '' });
        save();
      },
      async saveTheme(t) {
        need(staff()); DB.themes = DB.themes || [];
        const f = DB.themes.find((x) => x.day === t.day);
        if (f) Object.assign(f, t); else DB.themes.push({ ...t });
        save();
      },
      async workerDebts() { need(viewer()); return wait(DB.debts || []); },
      async debtBaseline() { need(viewer()); return wait(DB.base ? [DB.base] : []); },
      async saveWorkerDebt(r) {
        need(finance()); DB.debts = DB.debts || [];
        if (r.id) Object.assign(DB.debts.find((x) => x.id === r.id), r);
        else DB.debts.push({ ...r, id: uid(), updated_at: new Date().toISOString() });
        save();
      },
      async deleteWorkerDebt(id) { need(finance()); DB.debts = (DB.debts || []).filter((x) => x.id !== id); save(); },
      async saveDebtBaseline(started, note) { need(finance()); DB.base = { id: 1, started, note: note || '' }; save(); },
      async clientPayments() { need(viewer()); return wait(DB.cpays || []); },
      async payables() { need(viewer()); return wait(DB.pays || []); },
      async saveClientPayment(r) {
        need(staff()); DB.cpays = DB.cpays || [];
        if (r.id) Object.assign(DB.cpays.find((x) => x.id === r.id), r);
        else DB.cpays.push({ ...r, id: uid(), created_at: new Date().toISOString() });
        save();
      },
      async deleteClientPayment(id) { need(staff()); DB.cpays = (DB.cpays || []).filter((x) => x.id !== id); save(); },
      async savePayable(r) {
        need(staff()); DB.pays = DB.pays || [];
        if (r.id) Object.assign(DB.pays.find((x) => x.id === r.id), r);
        else DB.pays.push({ ...r, id: uid(), paid: r.paid || 0, created_at: new Date().toISOString() });
        save();
      },
      async deletePayable(id) { need(staff()); DB.pays = (DB.pays || []).filter((x) => x.id !== id); save(); },
      async options(selId) { need(viewer()); return wait((DB.options || []).filter((o) => o.selection_id === selId).sort((a, b) => (a.sort || 0) - (b.sort || 0))); },
      async saveOption(o, file) {
        need(staff()); DB.options = DB.options || [];
        const row = { ...o }; delete row.project_id;
        if (file) { const f = await shrink(file, 900, 0.6); row.photo_path = 'opt-' + uid(); DB.files[row.photo_path] = await toDataURL(f); }
        if (row.id) Object.assign(DB.options.find((x) => x.id === row.id), row);
        else DB.options.push({ ...row, id: uid(), from_client: false, created_at: new Date().toISOString() });
        save();
      },
      async deleteOption(id) { need(staff()); DB.options = (DB.options || []).filter((o) => o.id !== id); save(); },

      /* planos y fotos, en demo */
      async planFiles(pid) { return wait((DB.pfiles || []).filter((f) => f.project_id === pid)); },
      async savePlanFile(f) {
        need(staff());
        DB.pfiles = DB.pfiles || [];
        DB.pfiles.unshift({ id: uid(), project_id: f.project_id, kind: f.kind, title: f.title || '',
          file_path: '', file_name: (f.file && f.file.name) || '', for_client: !!f.for_client,
          created_at: new Date().toISOString() });
        save();
      },
      async updatePlanFile(id, patch) { need(staff()); const x = (DB.pfiles || []).find((y) => y.id === id); if (x) Object.assign(x, patch); save(); },
      async deletePlanFile(id) { need(staff()); DB.pfiles = (DB.pfiles || []).filter((f) => f.id !== id); save(); },

      async fixed() { need(viewer()); return wait(DB.fixed.slice().sort((a, b) => a.title.localeCompare(b.title))); },
      async saveFixed(f) { need(finance()); if (f.id) Object.assign(DB.fixed.find((x) => x.id === f.id), f); else DB.fixed.push({ ...f, id: uid(), created_at: new Date().toISOString() }); save(); },
      async deleteFixed(id) { need(finance()); DB.fixed = DB.fixed.filter((f) => f.id !== id); save(); },

      async messages(pid) { need(viewer() || (perm('projects') && member(pid))); return wait(DB.messages.filter((m) => m.project_id === pid).sort((a, b) => a.created_at.localeCompare(b.created_at))); },
      async receipts() { need(viewer()); return wait(DB.messages.filter((m) => m.kind === 'receipt').sort((a, b) => b.created_at.localeCompare(a.created_at))); },
      async postMessage(m) {
        need(m.author_id === DB.session && (staff() || (perm('projects') && member(m.project_id))));
        let file_path = null, file_name = null;
        if (m.file) { const f = await shrink(m.file, 900, 0.6); file_path = m.project_id + '/' + uid(); file_name = f.name; DB.files[file_path] = await toDataURL(f); }
        DB.messages.push({ id: uid(), project_id: m.project_id, author_id: m.author_id, kind: m.kind, body: m.body || '', amount: m.amount == null ? null : m.amount, vendor: m.vendor || '', file_path, file_name, created_at: new Date().toISOString() });
        save();
      },
      async deleteMessage(id) { need(admin()); DB.messages = DB.messages.filter((m) => m.id !== id); save(); },
      async urls(paths) { const o = {}; paths.forEach((p) => { if (p && DB.files[p]) o[p] = DB.files[p]; }); return o; },

      async myOpen() { return wait(DB.entries.find((e) => e.worker_id === DB.session && !e.clock_out) || null); },
      async clockIn(pid) {
        need(perm('clock')); need(member(pid), 'not_member'); need(!DB.entries.some((e) => e.worker_id === DB.session && !e.clock_out), 'already_clocked_in');
        DB.entries.push({ id: uid(), worker_id: DB.session, project_id: pid, clock_in: new Date().toISOString(), clock_out: null, created_at: new Date().toISOString(), breaks: [] }); save();
      },
      async startBreak() { const e = DB.entries.find((x) => x.worker_id === DB.session && !x.clock_out); need(e, 'not_clocked_in'); if (!e.breaks.some((b) => !b.end_at)) e.breaks.push({ id: uid(), entry_id: e.id, start_at: new Date().toISOString(), end_at: null }); save(); },
      async endBreak() { const e = DB.entries.find((x) => x.worker_id === DB.session && !x.clock_out); if (e) e.breaks.forEach((b) => { if (!b.end_at) b.end_at = new Date().toISOString(); }); save(); },
      async clockOut() { const e = DB.entries.find((x) => x.worker_id === DB.session && !x.clock_out); if (!e) return; const t = new Date().toISOString(); e.breaks.forEach((b) => { if (!b.end_at) b.end_at = t; }); e.clock_out = t; save(); },
      async entries(from, to) { return wait(DB.entries.filter((e) => visibleEntry(e) && +new Date(e.clock_in) >= +from && +new Date(e.clock_in) < +to).sort((a, b) => a.clock_in.localeCompare(b.clock_in))); },
      async openEntries() { return wait(DB.entries.filter((e) => visibleEntry(e) && !e.clock_out)); },
      async saveEntry(e) {
        need(staff());
        if (e.id) { const x = DB.entries.find((y) => y.id === e.id); x.clock_in = e.clock_in; x.clock_out = e.clock_out || null; if (x.clock_out) x.breaks.forEach((b) => { if (!b.end_at) b.end_at = x.clock_out; }); }
        else DB.entries.push({ id: uid(), worker_id: e.worker_id, project_id: e.project_id, clock_in: e.clock_in, clock_out: e.clock_out || null, created_at: new Date().toISOString(), breaks: [] });
        save();
      },
      async deleteEntry(id) { need(staff()); DB.entries = DB.entries.filter((e) => e.id !== id); save(); },

      async shifts() {
        need(perm('shifts') || staff());
        return wait(DB.shifts.map((s) => ({ ...s, taken: DB.claims.filter((c) => c.shift_id === s.id).length, mine: DB.claims.some((c) => c.shift_id === s.id && c.worker_id === DB.session) })).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))));
      },
      async claims() { need(staff()); return wait(DB.claims); },
      async saveShift(s) { need(staff()); if (s.id) Object.assign(DB.shifts.find((x) => x.id === s.id), s); else DB.shifts.push({ ...s, id: uid(), created_at: new Date().toISOString() }); save(); },
      async deleteShift(id) { need(staff()); DB.shifts = DB.shifts.filter((s) => s.id !== id); DB.claims = DB.claims.filter((c) => c.shift_id !== id); save(); },
      async claimShift(id) {
        need(perm('shifts')); const s = DB.shifts.find((x) => x.id === id); need(s, 'not_found'); need(s.status === 'open', 'closed');
        need(DB.claims.filter((c) => c.shift_id === id).length < s.spots, 'full');
        if (!DB.claims.some((c) => c.shift_id === id && c.worker_id === DB.session)) DB.claims.push({ shift_id: id, worker_id: DB.session, created_at: new Date().toISOString() }); save();
      },
      async releaseShift(id) { DB.claims = DB.claims.filter((c) => !(c.shift_id === id && c.worker_id === DB.session)); save(); },
      async removeClaim(sid, wid) { need(staff()); DB.claims = DB.claims.filter((c) => !(c.shift_id === sid && c.worker_id === wid)); save(); },

      async requirements() { need(perm('docs') || staff()); return wait(DB.reqs.slice().sort((a, b) => a.sort - b.sort)); },
      async saveRequirement(r) { need(staff()); if (r.id) Object.assign(DB.reqs.find((x) => x.id === r.id), r); else DB.reqs.push({ ...r, id: uid() }); save(); },
      async deleteRequirement(id) { need(staff()); DB.reqs = DB.reqs.filter((r) => r.id !== id); DB.docs = DB.docs.filter((d) => d.requirement_id !== id); save(); },
      async docs() { return wait(DB.docs.filter((d) => staff() || (d.worker_id === DB.session && perm('docs')))); },
      async uploadDoc(reqId, file) {
        need(perm('docs')); const f = await shrink(file, 1200, 0.7); const path = DB.session + '/' + uid(); DB.files[path] = await toDataURL(f);
        DB.docs = DB.docs.filter((d) => !(d.worker_id === DB.session && d.requirement_id === reqId));
        DB.docs.push({ id: uid(), worker_id: DB.session, requirement_id: reqId, file_path: path, file_name: f.name, signed_name: null, signed_at: null, status: 'submitted', note: '', created_at: new Date().toISOString() }); save();
      },
      async signDoc(reqId, name) {
        need(perm('docs')); DB.docs = DB.docs.filter((d) => !(d.worker_id === DB.session && d.requirement_id === reqId));
        DB.docs.push({ id: uid(), worker_id: DB.session, requirement_id: reqId, file_path: null, file_name: null, signed_name: name, signed_at: new Date().toISOString(), status: 'submitted', note: '', created_at: new Date().toISOString() }); save();
      },
      async setDocStatus(id, status, note) { need(staff()); Object.assign(DB.docs.find((d) => d.id === id), { status, note: note || '' }); save(); },

      async payments() { return wait(DB.payments.filter((p) => viewer() || (p.worker_id === DB.session && perm('pay'))).sort((a, b) => b.paid_on.localeCompare(a.paid_on))); },
      async savePayment(p) { need(admin()); DB.payments.push({ ...p, id: uid(), created_at: new Date().toISOString() }); save(); },
      async deletePayment(id) { need(admin()); DB.payments = DB.payments.filter((p) => p.id !== id); save(); },

      async expenses(from, to) { need(viewer()); return wait(DB.expenses.filter((e) => e.spent_on >= from && e.spent_on <= to).sort((a, b) => b.spent_on.localeCompare(a.spent_on))); },
      async saveExpense(e) {
        need(finance());
        if (e.id) Object.assign(DB.expenses.find((x) => x.id === e.id), { spent_on: e.spent_on, amount: e.amount, vendor: e.vendor, memo: e.memo, category: e.category, project_id: e.project_id || null });
        else DB.expenses.push({ ...e, id: uid(), source: e.source || 'manual', created_by: DB.session, created_at: new Date().toISOString() });
        save();
      },
      async deleteExpense(id) { need(finance()); DB.expenses = DB.expenses.filter((e) => e.id !== id); save(); },
      async importExpenses(rows) { need(finance()); rows.forEach((r) => DB.expenses.push({ ...r, id: uid(), source: 'import', created_by: DB.session, created_at: new Date().toISOString() })); save(); return rows.length; },
      async existingExtIds(ids) { need(finance()); return DB.expenses.filter((e) => e.ext_id && ids.indexOf(e.ext_id) >= 0).map((e) => e.ext_id); },

      async posts() { need(admin()); return wait(DB.posts.slice().sort((a, b) => String(a.due_on || '9').localeCompare(String(b.due_on || '9')))); },
      async savePost(p) { need(admin()); if (p.id) Object.assign(DB.posts.find((x) => x.id === p.id), p); else DB.posts.push({ ...p, id: uid(), created_at: new Date().toISOString() }); save(); },
      async deletePost(id) { need(admin()); DB.posts = DB.posts.filter((p) => p.id !== id); save(); },

      async netTargets() { need(admin()); return wait(DB.targets); },
      async saveNetTarget(network, weekly) { need(admin()); DB.targets[network] = weekly; save(); },

      async leads() { need(admin()); return wait(DB.leads.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))); },
      async saveLead(l) { need(admin()); if (l.id) Object.assign(DB.leads.find((x) => x.id === l.id), l, { updated_at: new Date().toISOString() }); else DB.leads.push({ ...l, id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); save(); },
      async deleteLead(id) { need(admin()); DB.leads = DB.leads.filter((l) => l.id !== id); save(); },
      _reset() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } DB = seed(); save(); },
    };
  }

  window.API = LIVE ? liveAPI() : demoAPI();
  window.API.shrink = shrink;
  /* El cliente de Supabase vive aquí, no en app.js. Nelly lo necesita
     para sus propias consultas. */
  if (LIVE) { try { window.API.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY); } catch (e) { /* demo */ } }
})();
