'use strict';
/* Sincronização com a conta Claude quando o app é aberto como link (artifact).
   Os dados ficam em data/users/<id>/ — área privada de cada pessoa.
   Fora do claude.ai (arquivo local ou servidor próprio) este módulo fica inativo e vale o LocalStorage. */
const Cloud = {
  state: 'off',        // off | connecting | on | error
  db: null, uid: null, downloads: null,
  last: {},            // chave -> JSON salvo na nuvem
  timer: null, flushing: false, again: false, warned: false,

  available() { return !!(window.claude && typeof window.claude.use === 'function'); },

  /* Divide o estado em documentos (limite de 256 KiB por documento) */
  split(s) {
    const parts = {
      core: { version: s.version, meta: s.meta || {}, settings: s.settings, routine: s.routine, weekly: s.weekly, monthly: s.monthly, missoes: s.missoes || [], diario: s.diario || {}, checklists: s.checklists || [] },
      tasks: { items: s.tasks }, projects: { items: s.projects }, occurrences: { items: s.occurrences }, events: { items: s.events }, feedbacks: { items: s.feedbacks || [] },
    };
    for (const [k, blocks] of Object.entries(s.days)) { const id = 'days-' + k.slice(0, 7); (parts[id] = parts[id] || { days: {} }).days[k] = blocks; }
    for (const c of s.checks || []) { const id = 'ck-' + String(c.date || '0000-00').slice(0, 7); (parts[id] = parts[id] || { items: [] }).items.push(c); }
    for (const r of s.indicators) { const id = 'ind-' + r.date.slice(0, 7); (parts[id] = parts[id] || { items: [] }).items.push(r); }
    return parts;
  },
  join(docs) {
    const core = docs.core || {};
    const s = { version: core.version || 1, meta: core.meta || {}, settings: core.settings, routine: core.routine, weekly: core.weekly, monthly: core.monthly, missoes: core.missoes || [], diario: core.diario || {}, checklists: core.checklists || [], checks: [], days: {}, indicators: [],
      tasks: docs.tasks?.items || [], projects: docs.projects?.items || [], occurrences: docs.occurrences?.items || [], events: docs.events?.items || [], feedbacks: docs.feedbacks?.items || [] };
    for (const [id, d] of Object.entries(docs)) {
      if (id.startsWith('days-')) Object.assign(s.days, d.days || {});
      if (id.startsWith('ind-')) s.indicators.push(...(d.items || []));
      if (id.startsWith('ck-')) s.checks.push(...(d.items || []));
    }
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    return s;
  },

  async init() {
    if (!this.available()) return;
    this.state = 'connecting';
    const timeout = new Promise(res => setTimeout(() => res('timeout'), 12000));
    try {
      const [db, user, downloads] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('downloads')]);
      this.downloads = downloads || null;
      const uid = user ? await user.id() : null;
      if (!db || !uid) { this.state = 'off'; return; }
      this.db = db; this.uid = uid;
      const snap = await Promise.race([db.collection('data/users/' + uid).get(), timeout]);
      if (snap === 'timeout') throw new Error('timeout');
      const docs = {};
      snap.docs.forEach(d => { if (d.exists) docs[d.id] = d.data(); });
      this.state = 'on';
      if (!docs.core) { await this.flush(); return; }          // primeira vez: envia o estado atual
      for (const [id, d] of Object.entries(docs)) this.last[id] = JSON.stringify(d);
      Store.replace(this.join(docs), { fromCloud: true });
    } catch (e) {
      console.warn('Sincronização indisponível', e);
      this.state = 'error';
    }
  },

  /* Ao voltar para a aba, busca a versão mais recente (ex.: editada no celular) */
  async pull() {
    if (this.state !== 'on' || this.timer || this.flushing) return;
    try {
      const snap = await this.db.collection('data/users/' + this.uid).get();
      const docs = {}; snap.docs.forEach(d => { if (d.exists) docs[d.id] = d.data(); });
      if (!docs.core) return;
      const changed = Object.keys(docs).some(id => JSON.stringify(docs[id]) !== this.last[id]) || Object.keys(this.last).some(id => !docs[id]);
      if (!changed) return;
      this.last = {}; for (const [id, d] of Object.entries(docs)) this.last[id] = JSON.stringify(d);
      Store.replace(this.join(docs), { fromCloud: true });
      if (!document.querySelector('.modal-wrap')) App.render();
    } catch (e) { /* mantém os dados atuais */ }
  },

  schedule() {
    if (this.state !== 'on') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 700);
  },

  async flush() {
    if (this.flushing) { this.again = true; return; }
    this.flushing = true;
    try {
      const parts = this.split(S);
      const col = this.db.collection('data/users/' + this.uid);
      for (const [id, body] of Object.entries(parts)) {
        const json = JSON.stringify(body);
        if (this.last[id] === json) continue;
        await this.write(() => col.doc(id).set(body));
        this.last[id] = json;
      }
      for (const id of Object.keys(this.last)) if (!parts[id]) { await this.write(() => col.doc(id).delete()); delete this.last[id]; }
      if (this.state !== 'on') { this.state = 'on'; App.renderNav(); }
    } catch (e) {
      console.warn('Falha ao salvar', e);
      if (!this.warned) { this.warned = true; UI.toast(e && e.code === 'quota_exceeded' ? 'Limite de armazenamento atingido. Exporte um backup e remova dados antigos.' : 'Não foi possível salvar na sua conta agora. Tentaremos de novo na próxima alteração.', 'error'); }
      setTimeout(() => { this.warned = false; }, 60000);
    } finally {
      this.flushing = false;
      if (this.again) { this.again = false; this.flush(); }
    }
  },
  async write(fn) {
    try { await fn(); } catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); await fn(); } else throw e;
    }
  },

  /* Entrega de arquivos (Excel, backup, relatório) pela confirmação de download da plataforma */
  async save(filename, blob) {
    if (!this.downloads) return false;
    try { await this.downloads.save({ filename, data: blob }); }
    catch (e) { if (e && e.code !== 'declined') UI.toast('Não foi possível baixar o arquivo neste aplicativo.', 'error'); }
    return true;
  },
};
