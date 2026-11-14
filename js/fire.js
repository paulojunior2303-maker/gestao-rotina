'use strict';
/* Conta FlowFire na nuvem (Firebase): login com Google e sincronização ao vivo entre aparelhos.
   - Os dados são divididos em documentos (como no Cloud): core, tarefas, … e meses (agenda, reuniões, feedbacks, indicadores).
     Cada documento guarda o JSON como texto (evita limitações de tipo do Firestore; limite de 1 MiB por documento).
   - Caminho: canais/{oficial|teste}/usuarios/{uid}/docs/{id}. As regras do Firestore só deixam cada pessoa ler e gravar os próprios.
   - Local primeiro: o app continua salvando no aparelho; as mudanças sobem em seguida e as dos outros aparelhos chegam ao vivo.
   - A biblioteca do Firebase só é baixada quando a pessoa usa a conta (o app continua leve e funcionando sem internet). */
const Fire = {
  CONFIG: {
    apiKey: 'AIzaSyCr7IwC5WiNDaWVNm1CQGViNUAZh7jVcnM',
    authDomain: 'gestao-de-rotina-514301.firebaseapp.com',
    projectId: 'gestao-de-rotina-514301',
    storageBucket: 'gestao-de-rotina-514301.firebasestorage.app',
    messagingSenderId: '108519751846',
    appId: '1:108519751846:web:3258158c1fdf04254fb467',
  },
  SDK: 'https://www.gstatic.com/firebasejs/13.3.0/',
  SCOPES: ['openid', 'email', 'profile'],
  KEY: 'flowfire-conta' + (typeof CANAL_TESTE !== 'undefined' && CANAL_TESTE ? ':teste' : ''),   // lembra que a pessoa usa a conta neste aparelho
  state: 'off',      // off | loading | on | syncing | error
  user: null, api: null, last: {}, timer: null, unsub: null, msg: '',
  dev: (() => { try { let d = localStorage.getItem('ff-dev'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('ff-dev', d); } return d; } catch (e) { return 'x'; } })(),

  supported() { return (typeof CANAL_ENXUTO === 'undefined' || !CANAL_ENXUTO) && (typeof Cloud === 'undefined' || !Cloud.available()); },
  canal() { return typeof CANAL_TESTE !== 'undefined' && CANAL_TESTE ? 'teste' : 'oficial'; },
  wanted() { try { return localStorage.getItem(this.KEY) === '1'; } catch (e) { return false; } },
  setWanted(v) { try { v ? localStorage.setItem(this.KEY, '1') : localStorage.removeItem(this.KEY); } catch (e) { /* sem armazenamento */ } },
  connected() { return !!this.user; },

  /* ---------- Documentos ---------- */
  split(s) {
    const parts = {
      core: { version: s.version, meta: s.meta || {}, settings: s.settings, routine: s.routine, weekly: s.weekly, monthly: s.monthly, missoes: s.missoes || [], equipes: s.equipes || [], diario: s.diario || {}, checklists: s.checklists || [] },
      tasks: { items: s.tasks || [] }, projects: { items: s.projects || [] }, occurrences: { items: s.occurrences || [] },
    };
    const mes = (pre, k, put) => { const id = pre + '-' + String(k || '0000-00').slice(0, 7); put(parts[id] = parts[id] || (pre === 'days' ? { days: {} } : { items: [] })); };
    for (const [k, blocks] of Object.entries(s.days || {})) mes('days', k, p => { p.days[k] = blocks; });
    (s.indicators || []).forEach(r => mes('ind', r.date, p => p.items.push(r)));
    (s.events || []).forEach(e => mes('ev', e.date, p => p.items.push(e)));
    (s.feedbacks || []).forEach(f => mes('fb', f.date, p => p.items.push(f)));
    (s.checks || []).forEach(c => mes('ck', c.date, p => p.items.push(c)));
    (s.gravacoes || []).forEach(g => mes('gv', g.date, p => p.items.push(g)));
    const out = {};
    for (const [id, p] of Object.entries(parts)) out[id] = JSON.stringify(p);
    return out;
  },
  join(docs) {
    const core = docs.core || {};
    const s = { version: core.version || 1, meta: core.meta || {}, settings: core.settings, routine: core.routine, weekly: core.weekly, monthly: core.monthly, missoes: core.missoes || [], equipes: core.equipes || [], diario: core.diario || {}, checklists: core.checklists || [],
      tasks: (docs.tasks || {}).items || [], projects: (docs.projects || {}).items || [], occurrences: (docs.occurrences || {}).items || [],
      days: {}, indicators: [], events: [], feedbacks: [], checks: [], gravacoes: [] };
    for (const [id, d] of Object.entries(docs)) {
      if (id.startsWith('days-')) Object.assign(s.days, d.days || {});
      else if (id.startsWith('ind-')) s.indicators.push(...(d.items || []));
      else if (id.startsWith('ev-')) s.events.push(...(d.items || []));
      else if (id.startsWith('fb-')) s.feedbacks.push(...(d.items || []));
      else if (id.startsWith('ck-')) s.checks.push(...(d.items || []));
      else if (id.startsWith('gv-')) s.gravacoes.push(...(d.items || []));
    }
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    return s;
  },
  parse(raw) { const o = {}; for (const [id, txt] of Object.entries(raw)) { try { o[id] = JSON.parse(txt); } catch (e) { /* documento inválido */ } } return o; },

  /* ---------- Biblioteca do Firebase (carregada só quando usada) ---------- */
  async load() {
    if (this.api) return this.api;
    if (window.__fireFake) return (this.api = window.__fireFake);   // testes automáticos
    const [A, U, F] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(this.SDK + f)));
    const app = A.initializeApp(this.CONFIG), auth = U.getAuth(app), db = F.getFirestore(app);
    const col = uid => F.collection(db, 'canais', this.canal(), 'usuarios', uid, 'docs');
    this.api = {
      onAuth: cb => U.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null)),
      signInPopup: async () => { await U.signInWithPopup(auth, new U.GoogleAuthProvider()); },
      signInToken: async token => { await U.signInWithCredential(auth, U.GoogleAuthProvider.credential(null, token)); },
      signOut: () => U.signOut(auth),
      getAll: async uid => { const snap = await F.getDocs(col(uid)); const o = {}; snap.forEach(d => { o[d.id] = d.data(); }); return o; },
      set: (uid, id, data) => F.setDoc(F.doc(col(uid), id), data),
      del: (uid, id) => F.deleteDoc(F.doc(col(uid), id)),
      listen: (uid, cb) => F.onSnapshot(col(uid), snap => {
        if (snap.metadata.hasPendingWrites) return;
        const all = {}; snap.forEach(d => { all[d.id] = d.data(); }); cb(all);
      }, e => this.fail(e)),
      // Operações gerais (equipes): caminho como lista, ex.: ['canais', 'oficial', 'equipes', id]
      d: {
        get: async p => { const x = await F.getDoc(F.doc(db, ...p)); return x.exists() ? x.data() : null; },
        set: (p, data, merge) => F.setDoc(F.doc(db, ...p), data, merge ? { merge: true } : {}),
        update: (p, data) => F.updateDoc(F.doc(db, ...p), data),
        del: p => F.deleteDoc(F.doc(db, ...p)),
        onQuery: (p, w, cb, err) => F.onSnapshot(w ? F.query(F.collection(db, ...p), F.where(w[0], '==', w[1])) : F.collection(db, ...p),
          snap => { const out = []; snap.forEach(x => out.push({ id: x.id, ...x.data() })); cb(out); }, err),
      },
    };
    return this.api;
  },

  /* ---------- Entrar / sair ---------- */
  async init() {
    if (!this.supported() || !this.wanted()) return;
    this.setState('loading');
    try { await this.start(); } catch (e) { this.fail(e); }
  },
  async start() {
    const api = await this.load();
    if (this._authUnsub) return;
    await new Promise(res => {
      let first = true;
      this._authUnsub = api.onAuth(async u => {
        const was = this.user && this.user.uid;
        this.user = u;
        if (u && u.uid !== was) { try { await this.attach(); } catch (e) { this.fail(e); } }
        if (!u) { this.detach(); this.setState(this.wanted() ? 'needs-auth' : 'off'); }
        if (first) { first = false; res(); }
      });
    });
  },
  async connect() {
    if (!this.supported()) return UI.toast('A conta FlowFire não funciona dentro do link do Claude. Use o app ou o site.', 'warn');
    this.setWanted(true); this.setState('loading');
    try {
      await this.start();
      if (this.user) return this.attach();
      if (typeof Native !== 'undefined' && Native.available()) {
        const r = await Native.P().Google.autorizar({ escopos: this.SCOPES, interativo: true });
        await this.api.signInToken(r.accessToken);
      } else await this.api.signInPopup();
    } catch (e) {
      const cancel = /popup-closed|cancel|cancelled-popup/i.test(String(e && (e.code || e.message)));
      if (!this.user) this.setWanted(false);
      this.setState(this.user ? 'on' : 'off');
      UI.toast(cancel ? 'Login cancelado.' : 'Não foi possível entrar: ' + this.erro(e), cancel ? 'warn' : 'error');
    }
  },
  async disconnect() {
    this.setWanted(false); this.detach();
    try { if (this.api) await this.api.signOut(); } catch (e) { /* já saiu */ }
    this.user = null; this.setState('off'); App.render();
    UI.toast('Você saiu da conta. Os dados continuam neste aparelho.');
  },

  /* Primeira conexão neste aparelho: junta o que há aqui com o que há na nuvem */
  async attach() {
    this.setState('syncing');
    const raw = await this.api.getAll(this.user.uid);
    const remote = this.parse(Object.fromEntries(Object.entries(raw).map(([id, d]) => [id, d.v])));
    const local = this.split(S);
    const temNuvem = !!remote.core, temLocal = Drive.hasData(S) || (S.missoes || []).length > 0;
    let escolha = 'nuvem';
    if (!temNuvem) escolha = 'local';
    else if (temLocal && JSON.stringify(this.join(remote)) !== JSON.stringify(this.join(this.parse(local)))) escolha = await this.ask(remote.core && remote.core.meta && remote.core.meta.updatedAt);
    if (escolha === 'nuvem') {
      this.last = Object.fromEntries(Object.entries(raw).map(([id, d]) => [id, d.v]));
      Store.replace(this.join(remote), { fromCloud: true });
      App.render();
    } else {
      this.last = Object.fromEntries(Object.entries(raw).map(([id, d]) => [id, d.v]));
      await this.push(true);
    }
    this.listen();
    this.setState('on');
    if (typeof Equipes !== 'undefined') Equipes.start();
    if (['config', 'equipe'].includes(App.route)) App.render();
  },
  ask(remoteAt) {
    const localAt = (S.meta && S.meta.updatedAt) || 0, fmt = t => t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem data';
    return new Promise(res => {
      const m = UI.modal({
        title: 'Juntar os dados',
        body: `<p>Sua conta já tem dados salvos na nuvem, e este aparelho também tem dados diferentes. Qual versão você quer manter?</p>
          <ul class="ms-prev"><li><strong>Nuvem</strong>: alterada em ${fmt(remoteAt)}${remoteAt >= localAt ? ' (mais recente)' : ''}</li><li><strong>Este aparelho</strong>: alterado em ${fmt(localAt)}${localAt > remoteAt ? ' (mais recente)' : ''}</li></ul>
          <p class="muted small">A versão escolhida passa a valer em todos os aparelhos. Se estiver em dúvida, faça antes um backup em Configurações → Dados.</p>`,
        footer: `<button class="btn ghost" data-local>Usar a deste aparelho</button><span class="grow"></span><button class="btn primary" data-nuvem>Usar a da nuvem</button>`,
        canClose: () => false,
      });
      m.el.querySelector('[data-local]').onclick = () => { m.close(); res('local'); };
      m.el.querySelector('[data-nuvem]').onclick = () => { m.close(); res('nuvem'); };
    });
  },
  detach() { if (typeof Equipes !== 'undefined') Equipes.stop(); if (this.unsub) { try { this.unsub(); } catch (e) { /* ok */ } } this.unsub = null; clearTimeout(this.timer); this.last = {}; },

  /* ---------- Sincronização ---------- */
  schedule() {
    if (!this.user || !this.unsub) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push().catch(e => this.fail(e)), 1200);
  },
  async push(all) {
    if (!this.user) return;
    const parts = this.split(S), uid = this.user.uid, at = Date.now(), jobs = [];
    for (const [id, v] of Object.entries(parts)) if (all || this.last[id] !== v) { this.last[id] = v; jobs.push(this.api.set(uid, id, { v, at, dev: this.dev })); }
    for (const id of Object.keys(this.last)) if (!(id in parts)) { delete this.last[id]; jobs.push(this.api.del(uid, id)); }
    if (!jobs.length) return;
    this.setState('syncing');
    await Promise.all(jobs);
    this.setState('on');
  },
  listen() {
    this.unsub = this.api.listen(this.user.uid, all => {
      const remote = Object.fromEntries(Object.entries(all).map(([id, d]) => [id, d.v]));
      const local = this.split(S);
      let changed = false;
      const next = {};
      const ids = new Set([...Object.keys(remote), ...Object.keys(local)]);
      for (const id of ids) {
        const mudouAqui = local[id] !== this.last[id];          // alterado neste aparelho e ainda não enviado
        if (id in remote && remote[id] !== this.last[id] && !mudouAqui) { next[id] = remote[id]; this.last[id] = remote[id]; changed = true; }
        else if (!(id in remote) && id in this.last && !mudouAqui) { delete this.last[id]; changed = true; continue; }   // apagado em outro aparelho
        else if (id in local) next[id] = local[id];
      }
      if (!changed) return;
      const eqAntes = JSON.stringify(S.equipes || []);
      Store.replace(this.join(this.parse(next)), { fromCloud: true });
      if (typeof Equipes !== 'undefined' && JSON.stringify(S.equipes || []) !== eqAntes) Equipes.start();
      const busy = document.querySelector('.modal-wrap') || (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
      if (busy) this.pendingRender = true; else App.render();
      this.schedule();   // se algo deste aparelho ainda não subiu, envia agora
    });
  },

  /* ---------- Estado e interface ---------- */
  setState(s) { this.state = s; if (typeof App !== 'undefined' && App.renderNav && S) App.renderNav(); const el = document.getElementById('fire-status'); if (el) el.innerHTML = this.statusText(); },
  fail(e) { console.warn('Conta FlowFire', e); this.msg = this.erro(e); this.setState('error'); },
  erro(e) {
    const c = String((e && (e.code || e.message)) || e);
    if (/permission|insufficient/i.test(c)) return 'sem permissão no banco de dados (confira as regras do Firestore).';
    if (/network|offline|unavailable|Failed to fetch|import/i.test(c)) return 'sem conexão com a internet.';
    if (/unauthorized-domain/i.test(c)) return 'este endereço não está autorizado no Firebase.';
    if (/popup-blocked/i.test(c)) return 'o navegador bloqueou a janela de login. Libere pop-ups para este site.';
    return c.replace(/^Firebase: /, '');
  },
  statusText() {
    if (this.state === 'syncing') return `<span class="dot-wait"></span> Sincronizando…`;
    if (this.state === 'loading') return `<span class="dot-wait"></span> Conectando…`;
    if (this.state === 'error') return `<span class="dot-err"></span> Erro: ${U.esc(this.msg)}`;
    if (this.user) return `<span class="dot-ok"></span> Conectado como <strong>${U.esc(this.user.email || this.user.name || '')}</strong>. Seus dados ficam iguais em todos os aparelhos.`;
    if (this.state === 'needs-auth') return `<span class="dot-wait"></span> Entre de novo para continuar sincronizando.`;
    return 'Desconectado.';
  },
  section(sec) {
    if (!this.supported()) return '';
    const on = !!this.user;
    return sec('conta', 'Conta FlowFire (nuvem)', 'Entre com a sua conta Google: seus dados ficam salvos na nuvem, iguais no celular, no computador e no site, atualizando sozinhos. O app continua funcionando sem internet.', `
      <p class="fire-status" id="fire-status">${this.statusText()}</p>
      <div class="row-actions wrap">
        ${on ? `<button class="btn ghost" data-act="fireSync">${U.icon('undo', 15)} Sincronizar agora</button><button class="btn ghost danger-text" data-act="fireSair">Sair da conta</button>`
          : `<button class="btn primary" data-act="fireEntrar"><svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg> Entrar com Google</button>`}
      </div>
      <p class="muted small">Cada pessoa só enxerga os próprios dados. ${typeof CANAL_TESTE !== 'undefined' && CANAL_TESTE ? 'Esta versão de teste usa um espaço separado do app oficial.' : ''}</p>`);
  },
};

Object.assign(Actions, {
  fireEntrar() { Fire.connect(); },
  fireSair() { UI.confirm('Sair da conta FlowFire neste aparelho? Os dados continuam aqui, mas deixam de sincronizar.', () => Fire.disconnect(), { okLabel: 'Sair' }); },
  async fireSync() { try { await Fire.push(true); UI.toast('Sincronizado.'); } catch (e) { Fire.fail(e); } },
});
