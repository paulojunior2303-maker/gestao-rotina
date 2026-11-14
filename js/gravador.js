'use strict';
/* Gravador de reuniões e feedbacks: um toque para gravar, descrever depois.
   - O áudio vai para o celular (IndexedDB) a cada poucos segundos: se o app fechar no meio, nada se perde.
   - A cada 10 minutos fecha uma "parte" (arquivo de áudio completo) e ela já vai para a transcrição.
   - Sem internet ou sem chave da IA, a parte espera; o app tenta de novo sozinho (ao voltar a internet,
     ao abrir o app e a cada minuto). Quando todas as partes estão transcritas, a IA faz o resumo.
   - O áudio fica guardado até a pessoa apagar. A transcrição completa fica no aparelho; o resumo vai
     para a reunião (S.events, com gravacaoId) ou para o feedback (S.feedbacks), que aparecem no calendário.
   Estado: S.gravacoes = [{ id, at, date, time, dur, status: gravando|processando|pendente|pronta, motivo,
     partes: [{ n, ini, dur, st: gravando|pend|ok|erro|perdida, chars }], tipo: ''|reuniao|feedback, titulo, pessoa, notas,
     resumo, combinados: [], ref: { kind: ev|fb, id }, audio: bool, recuperada }] */

const AudioDB = {
  NAME: 'flowfire-audio' + (typeof CANAL_ENXUTO !== 'undefined' && CANAL_ENXUTO ? ':enxuto' : typeof CANAL_TESTE !== 'undefined' && CANAL_TESTE ? ':teste' : ''),
  db: null, mem: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise(res => {
      let req;
      try { req = indexedDB.open(this.NAME, 1); } catch (e) { this.mem = this.mem || {}; return res(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('pedacos', { keyPath: ['g', 'n', 'i'] });
        db.createObjectStore('partes', { keyPath: ['g', 'n'] });
        db.createObjectStore('textos', { keyPath: ['g', 'n'] });
      };
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => { this.mem = this.mem || {}; res(null); };   // sem IndexedDB: fica só na memória (avisado na tela)
    });
  },
  /* Uma operação: idb(store) no IndexedDB; mem(map) na reserva em memória */
  async op(store, mode, idb, mem) {
    const db = await this.open();
    if (!db) return mem(this.mem[store] = this.mem[store] || new Map());
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), r = idb(t.objectStore(store));
      t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  key: (store, o) => JSON.stringify(store === 'pedacos' ? [o.g, o.n, o.i] : [o.g, o.n]),
  match: (o, prefix) => prefix.every((p, i) => [o.g, o.n, o.i][i] === p),
  range: prefix => IDBKeyRange.bound(prefix, [...prefix, []]),
  put(store, obj) { return this.op(store, 'readwrite', st => st.put(obj), m => { m.set(this.key(store, obj), obj); }); },
  get(store, key) { return this.op(store, 'readonly', st => st.get(key), m => m.get(JSON.stringify(key))); },
  /* Tudo de uma gravação ([g]) ou de uma parte ([g, n]) */
  all(store, prefix) { return this.op(store, 'readonly', st => st.getAll(this.range(prefix)), m => [...m.values()].filter(o => this.match(o, prefix))).then(r => r || []); },
  del(store, prefix) { return this.op(store, 'readwrite', st => st.delete(this.range(prefix)), m => { [...m.entries()].forEach(([k, o]) => { if (this.match(o, prefix)) m.delete(k); }); }); },
  persistente() { return !this.mem; },
};

const Gravador = {
  SEG_MS: 10 * 60 * 1000,   // uma parte a cada 10 minutos
  SLICE_MS: 5000,           // o áudio vai para o celular a cada 5 segundos
  cur: null, busy: false, again: false, lock: null, live: {},

  list() { return S.gravacoes || (S.gravacoes = []); },
  find(id) { return this.list().find(g => g.id === id); },
  recording() { return !!this.cur; },
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) && !(typeof Cloud !== 'undefined' && Cloud.available()); },
  elapsed() { return this.cur ? Math.floor((Date.now() - this.cur.t0) / 1000) : 0; },
  fmt(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}:${U.pad(m)}:${U.pad(s % 60)}` : `${m}:${U.pad(s % 60)}`; },
  nome(g) { return g.titulo || (g.tipo === 'feedback' ? `Feedback${g.pessoa ? ' com ' + g.pessoa : ''}` : g.tipo === 'reuniao' ? 'Reunião' : 'Gravação sem nome'); },
  salvar() { Store.save(); if (typeof App !== 'undefined' && ['gravacoes', 'dashboard'].includes(App.route) && !document.querySelector('.modal-wrap input:focus, .modal-wrap textarea:focus')) App.render(); Gravador.paintBar(); },

  /* ---------- Gravar ---------- */
  async start() {
    if (this.cur) return this.tela();
    if (!this.supported()) return UI.toast('Este aparelho ou navegador não permite gravar áudio aqui.', 'error');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return UI.toast('Sem acesso ao microfone. Permita o microfone para o app e tente de novo.', 'error'); }
    await AudioDB.open();
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const g = { id: U.uid(), at: new Date().toISOString(), date: U.today(), time: U.nowTime(), dur: 0, status: 'gravando', motivo: '', partes: [], tipo: '', titulo: '', pessoa: '', notas: '', resumo: '', combinados: [], ref: null, audio: true };
    this.list().push(g);
    this.cur = { g, stream, mime, t0: Date.now(), rec: null, chain: Promise.resolve() };
    this.segmento();
    this.cur.timer = setInterval(() => { g.dur = this.elapsed(); this.paintBar(); this.paintTela(); }, 1000);
    this.acordado(true);
    Store.save(); App.render();
    this.tela();
  },
  segmento() {
    const c = this.cur, g = c.g, n = g.partes.length;
    const p = { n, ini: this.elapsed(), dur: 0, st: 'gravando', chars: 0 };
    g.partes.push(p);
    let i = 0;
    const rec = c.rec = new MediaRecorder(c.stream, { ...(c.mime ? { mimeType: c.mime } : {}), audioBitsPerSecond: 24000 });
    const t0 = Date.now();
    rec.ondataavailable = ev => {
      if (!ev.data || !ev.data.size) return;
      const piece = { g: g.id, n, i: i++, blob: ev.data, type: rec.mimeType || c.mime || 'audio/webm' };
      c.chain = c.chain.then(() => AudioDB.put('pedacos', piece)).catch(() => {});
    };
    rec.onstop = () => {
      p.dur = Math.round((Date.now() - t0) / 1000);
      const still = this.cur === c && c.running !== false;
      if (still) this.segmento();   // a próxima parte começa na hora, sem buraco
      c.chain = c.chain.then(() => this.fecharParte(g, n)).then(() => { if (!still && c.onEnd) c.onEnd(); });
    };
    rec.start(this.SLICE_MS);
    c.segTimer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, this.SEG_MS);
  },
  /* Junta os pedaços de uma parte num arquivo só e manda para a transcrição */
  async fecharParte(g, n) {
    const p = g.partes[n];
    const pieces = (await AudioDB.all('pedacos', [g.id, n])).sort((a, b) => a.i - b.i);
    if (!pieces.length) { p.st = 'perdida'; p.vazia = true; this.salvar(); return; }
    const type = pieces[0].type || 'audio/webm';
    const blob = new Blob(pieces.map(x => x.blob), { type });
    await AudioDB.put('partes', { g: g.id, n, blob, mime: type.split(';')[0] });
    await AudioDB.del('pedacos', [g.id, n]);
    p.st = 'pend'; p.bytes = blob.size;
    this.salvar();
    this.processar();
  },
  stop() {
    const c = this.cur; if (!c) return Promise.resolve();
    c.running = false;
    clearInterval(c.timer); clearTimeout(c.segTimer);
    const g = c.g;
    g.dur = this.elapsed();
    return new Promise(res => {
      c.onEnd = () => {
        c.stream.getTracks().forEach(t => t.stop());
        g.status = 'processando';
        this.cur = null; this.acordado(false);
        this.salvar(); this.processar(); res(g);
      };
      if (c.rec && c.rec.state !== 'inactive') c.rec.stop(); else c.chain.then(() => c.onEnd());
    });
  },
  /* Tela acesa durante a gravação */
  async acordado(on) {
    try { if (typeof Recorder !== 'undefined') Recorder.keepScreen(on); } catch (e) { /* ignorado */ }
    try {
      if (on && navigator.wakeLock) this.lock = await navigator.wakeLock.request('screen');
      else if (!on && this.lock) { await this.lock.release(); this.lock = null; }
    } catch (e) { /* sem suporte */ }
  },

  /* O app fechou no meio da gravação: junta o que ficou guardado */
  async recuperar() {
    const soltas = this.list().filter(g => g.status === 'gravando' && (!this.cur || this.cur.g !== g));
    for (const g of soltas) {
      for (const p of g.partes) if (p.st === 'gravando') await this.fecharParte(g, p.n);
      g.status = 'processando'; g.recuperada = true;
      const last = g.partes[g.partes.length - 1];
      if (last) { const ps = await AudioDB.get('partes', [g.id, last.n]); if (ps && ps.blob) last.dur = last.dur || 0; }
    }
    if (soltas.length) { this.salvar(); UI.toast(`${U.plural(soltas.length, 'gravação interrompida foi recuperada', 'gravações interrompidas foram recuperadas')}. O áudio estava salvo.`, 'warn'); }
  },

  /* ---------- Transcrição e resumo (com novas tentativas) ---------- */
  async processar() {
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      for (const g of this.list()) {
        if (!['gravando', 'processando', 'pendente'].includes(g.status)) continue;
        const ok = await this.transcrever(g);
        if (!ok) continue;
        if (g.status !== 'gravando' && g.partes.every(p => ['ok', 'perdida'].includes(p.st))) await this.resumir(g);
      }
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; setTimeout(() => this.processar(), 50); }
    }
  },
  /* Transcreve as partes que faltam. Devolve false se parou (sem internet/chave) */
  async transcrever(g) {
    for (const p of g.partes) {
      if (!['pend', 'erro'].includes(p.st)) continue;
      if (!navigator.onLine) { this.espera(g, 'Sem internet. A transcrição continua sozinha quando a conexão voltar.'); return false; }
      if (!IA.ready()) { this.espera(g, 'Falta a chave da IA (Configurações → IA). O áudio está guardado.'); return false; }
      const a = await AudioDB.get('partes', [g.id, p.n]);
      if (!a || !a.blob) { p.st = 'perdida'; continue; }
      try {
        const b64 = await Native.blobToBase64(a.blob);
        const text = await IA.transcribe({ mime: a.mime || 'audio/webm', b64 }, { timeout: 240000 });
        await AudioDB.put('textos', { g: g.id, n: p.n, text });
        p.st = 'ok'; p.chars = text.length; p.err = '';
        this.live[g.id] = text;
        if (g.status === 'pendente') { g.status = 'processando'; g.motivo = ''; }
        this.salvar();
      } catch (e) {
        p.st = 'erro'; p.err = e.message;
        this.espera(g, /conex|internet/i.test(e.message) ? 'Sem internet. A transcrição continua sozinha quando a conexão voltar.' : e.message + ' O app tenta de novo em instantes.');
        return false;
      }
    }
    return true;
  },
  espera(g, motivo) { if (g.status !== 'gravando') g.status = 'pendente'; g.motivo = motivo; this.salvar(); },
  async transcricao(g) {
    const ts = await AudioDB.all('textos', [g.id]);
    const by = new Map(ts.map(x => [x.n, x.text]));
    return g.partes.filter(p => by.get(p.n)).map(p => `[${this.fmt(p.ini)}]\n${by.get(p.n)}`).join('\n\n');
  },
  async resumir(g) {
    const tx = await this.transcricao(g);
    if (!tx.trim()) { g.status = 'pronta'; g.vazia = true; g.resumo = ''; g.combinados = []; this.vincular(g, ''); this.salvar(); return; }
    if (!navigator.onLine) return this.espera(g, 'Sem internet para fazer o resumo. Ele sai sozinho quando a conexão voltar.');
    try {
      if (g.tipo === 'feedback' && g.pessoa) {
        const r = await IA.feedback({ nome: g.pessoa, date: g.date, notes: g.notas || '', transcript: tx });
        g.resumo = r.resumo; g.combinados = r.acordos;
      } else {
        const r = await IA.ata({ title: this.nome(g), date: g.date, time: g.time, pautas: [] }, { transcript: tx, notes: g.notas || '' });
        g.resumo = r.ata; g.combinados = r.combinados;
      }
      g.status = 'pronta'; g.motivo = ''; g.resumidaEm = new Date().toISOString();
      this.vincular(g, tx);
      this.salvar();
      UI.toast(`Resumo pronto: ${this.nome(g)}.`, 'ok', { label: 'Abrir', onClick: () => Actions.gvOpen({ id: g.id }) });
    } catch (e) { this.espera(g, 'Resumo: ' + e.message); }
  },
  /* Cria/atualiza a reunião ou o feedback ligado à gravação (aparecem no calendário e no resto do app) */
  vincular(g, tx) {
    const comb = (g.combinados || []).join('\n');
    const old = g.ref;
    const isFb = g.tipo === 'feedback' && g.pessoa;
    if (old && ((old.kind === 'fb') !== !!isFb)) {   // mudou de tipo: tira o registro antigo
      if (old.kind === 'ev') S.events = S.events.filter(e => e.id !== old.id); else S.feedbacks = FB.list().filter(f => f.id !== old.id);
      g.ref = null;
    }
    if (isFb) {
      let f = g.ref && FB.list().find(x => x.id === g.ref.id);
      if (!f) { f = { id: U.uid(), createdAt: new Date().toISOString(), gravacaoId: g.id }; FB.list().push(f); g.ref = { kind: 'fb', id: f.id }; }
      Object.assign(f, { pessoa: g.pessoa, date: g.date, tipo: 'feedback', tom: f.tom || 'neutro', notas: g.notas || '', resumo: g.resumo || '', acordos: comb, ...(tx ? { transcricao: tx.slice(0, 30000) } : {}) });
      if (!S.settings.technicians.some(t => t.name.toLowerCase() === g.pessoa.toLowerCase())) S.settings.technicians.push({ id: U.uid(), name: g.pessoa });
    } else {
      let e = g.ref && S.events.find(x => x.id === g.ref.id);
      if (!e) { e = { id: U.uid(), reuniao: true, pautas: [], gravacaoId: g.id }; S.events.push(e); g.ref = { kind: 'ev', id: e.id }; }
      Object.assign(e, { title: this.nome(g), date: g.date, time: g.time, reuniao: true, registro: { at: g.resumidaEm || new Date().toISOString(), tratadas: [], combinados: comb, ata: g.resumo || '', ...(tx ? { transcricao: tx.slice(0, 30000) } : {}) } });
    }
  },

  /* ---------- Telas ---------- */
  barHtml() {
    if (!this.cur) return '';
    return `<button class="gv-bar" data-act="gvTela"><span class="gv-dot"></span><strong>Gravando</strong><span class="gv-bar-t">${this.fmt(this.elapsed())}</span><span class="grow"></span><small>Toque para abrir</small></button>`;
  },
  paintBar() {
    const b = document.querySelector('.gv-bar-t'); if (b) b.textContent = this.fmt(this.elapsed());
    const r = document.querySelector('.bn-rec-t'); if (r) r.textContent = this.cur ? this.fmt(this.elapsed()) : 'Gravar';
  },
  tela() {
    if (this.telaM) return;
    const m = this.telaM = UI.modal({ title: 'Gravando', body: '<div class="gv-tela"></div>', onClose: () => { this.telaM = null; } });
    m.setFooter('');
    m.el.classList.add('gv-modal');
    this.paintTela(true);
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-stop')) {
        b.disabled = true; b.textContent = 'Encerrando…';
        const g = await this.stop();
        m.close();
        setTimeout(() => this.descrever(g, true), 150);
      }
      if (b.hasAttribute('data-min')) m.close();
    });
  },
  paintTela(full) {
    const m = this.telaM; if (!m) return;
    const box = m.el.querySelector('.gv-tela'); if (!box) return;
    const c = this.cur;
    if (!c) return;
    const g = c.g, s = this.elapsed();
    const feitas = g.partes.filter(p => p.st === 'ok').length, salvas = g.partes.filter(p => p.st !== 'gravando').length;
    const nextIn = Math.max(0, Math.round(this.SEG_MS / 1000) - (s - (g.partes[g.partes.length - 1] || { ini: 0 }).ini));
    if (!full && box.querySelector('.gv-clock')) {
      box.querySelector('.gv-clock').textContent = this.fmt(s);
      box.querySelector('.gv-st').innerHTML = this.stHtml(g, feitas, salvas, nextIn);
      return;
    }
    box.innerHTML = `
      <div class="gv-big"><span class="gv-dot lg"></span><span class="gv-clock">${this.fmt(s)}</span></div>
      <p class="gv-st">${this.stHtml(g, feitas, salvas, nextIn)}</p>
      <p class="muted small gv-tip">${U.icon('info', 13)} Pode deixar o celular na mesa com a tela acesa. O áudio é salvo no aparelho a cada 5 segundos: se o app fechar, nada se perde.${AudioDB.persistente() ? '' : ' <strong>Atenção: este navegador não deixa guardar o áudio; não feche o app.</strong>'}</p>
      <button class="btn danger gv-stop" data-stop>${U.icon('stop', 18)} Encerrar gravação</button>
      <button class="btn ghost" data-min>Continuar gravando e usar o app</button>`;
  },
  stHtml(g, feitas, salvas, nextIn) {
    const n = g.partes.length;
    return `Parte ${n}${n > 1 ? ` · ${salvas} salva${salvas > 1 ? 's' : ''}${feitas ? `, ${feitas} transcrita${feitas > 1 ? 's' : ''}` : ''}` : ''} · próxima parte em ${this.fmt(nextIn)}${g.motivo ? `<br><span class="c-yellow small">${U.esc(g.motivo)}</span>` : ''}`;
  },
  /* Descrever (agora ou depois): tipo, nome, pessoa e anotações */
  descrever(g, fresh) {
    if (!g) return;
    UI.form({
      title: fresh ? 'Gravação salva. O que foi?' : 'Descrever gravação',
      submitLabel: 'Salvar',
      fields: [
        ...(fresh ? [{ type: 'html', html: `<p class="muted small">${this.fmt(g.dur)} gravados. A transcrição e o resumo saem sozinhos${IA.ready() ? '' : ' assim que você cadastrar a chave da IA'}. Se preferir, descreva depois.</p>` }] : []),
        { name: 'tipo', label: 'Tipo', type: 'radio', value: g.tipo || 'reuniao', options: [['reuniao', 'Reunião'], ['feedback', 'Feedback com alguém da equipe']] },
        { name: 'pessoa', label: 'Com quem?', value: g.pessoa, list: D.techNames(), placeholder: 'Nome do colaborador', showIf: 'tipo=feedback' },
        { name: 'titulo', label: 'Assunto (opcional)', value: g.titulo, placeholder: 'Ex.: Alinhamento da equipe', showIf: 'tipo=reuniao' },
        { name: 'notas', label: 'Anotações (opcional)', type: 'textarea', rows: 2, value: g.notas, placeholder: 'Algo que a gravação não pegou' },
      ],
      validate: v => v.tipo === 'feedback' && !v.pessoa ? 'Diga com quem foi o feedback.' : null,
      extra: fresh ? [{ label: 'Descrever depois', cls: 'ghost', onClick: (_, m) => { m.close(); UI.toast('Gravação salva. Descreva quando quiser em Gravações.'); } }] : [],
      onSubmit(v) {
        const mudou = v.tipo !== g.tipo || (v.tipo === 'feedback' && v.pessoa !== g.pessoa);
        Object.assign(g, { tipo: v.tipo, pessoa: v.tipo === 'feedback' ? v.pessoa : '', titulo: v.tipo === 'reuniao' ? v.titulo : '', notas: v.notas });
        if (g.status === 'pronta' && mudou) { g.status = 'processando'; Gravador.salvar(); Gravador.processar(); UI.toast('Refazendo o resumo com a nova descrição…'); }
        else { if (g.status === 'pronta') Gravador.vincular(g, ''); Gravador.salvar(); UI.toast('Descrição salva.'); }
      },
    });
  },
  async apagarAudio(g) {
    await AudioDB.del('partes', [g.id]); await AudioDB.del('pedacos', [g.id]);
    g.audio = false; this.salvar();
  },
  async excluir(g) {
    await AudioDB.del('partes', [g.id]); await AudioDB.del('pedacos', [g.id]); await AudioDB.del('textos', [g.id]);
    S.gravacoes = this.list().filter(x => x !== g);
    this.salvar();
  },
  init() {
    window.addEventListener('online', () => this.processar());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.processar(); });
    // Tenta de novo: a cada 10 s quando estava sem internet e ela voltou; a cada minuto nos outros casos
    let n = 0;
    setInterval(() => {
      n++;
      const falta = this.list().filter(g => ['processando', 'pendente'].includes(g.status) || g.partes.some(p => ['pend', 'erro'].includes(p.st)));
      if (!falta.length || !navigator.onLine) return;
      if (n % 6 === 0 || falta.some(g => /internet/i.test(g.motivo || ''))) this.processar();
    }, 10000);
    window.addEventListener('beforeunload', e => { if (this.cur) { e.preventDefault(); e.returnValue = ''; } });
    this.recuperar().then(() => this.processar());
  },
};

/* Tela "Gravações": lista e detalhe */
Views.gravacoes = {
  title: 'Gravações', icon: 'mic', nav: 'Gravações',
  render() {
    const g = App.ui.gvId && Gravador.find(App.ui.gvId);
    if (g) return this.detalhe(g);
    App.ui.gvId = null;
    const all = [...Gravador.list()].sort((a, b) => b.at.localeCompare(a.at));
    const pend = all.filter(x => x.status === 'pendente');
    const semDesc = all.filter(x => !x.tipo && x.status !== 'gravando');
    const card = x => `<button class="card gv-card" data-act="gvOpen" data-id="${x.id}">
      <span class="gv-ic ${x.status === 'gravando' ? 'rec' : ''}">${U.icon(x.tipo === 'feedback' ? 'chat' : 'mic', 17)}</span>
      <span class="gv-main"><strong>${U.esc(Gravador.nome(x))}</strong><small>${U.fmtShort(x.date)} ${x.time} · ${Gravador.fmt(x.dur)}</small>${Views.gravacoes.chip(x)}</span>${U.icon('right', 16)}</button>`;
    return `
      ${Gravador.supported() ? '' : `<div class="alert a-yellow">${U.icon('info')} <span>Gravar não funciona aqui. Use o app ou o site num navegador comum.</span></div>`}
      ${!IA.ready() && IA.supported() ? `<div class="alert a-yellow">${U.icon('spark')} <span>Para transcrever e resumir, cadastre a chave da IA. As gravações ficam guardadas até lá.</span> <a class="link" href="#config" data-act="cfgJump" data-id="ia">Configurar</a></div>` : ''}
      ${pend.length ? `<div class="alert a-yellow">${U.icon('clock')} <span>${U.plural(pend.length, 'gravação esperando', 'gravações esperando')} para transcrever: ${U.esc(pend[0].motivo || '')}</span> <button class="link" data-act="gvRetry">Tentar agora</button></div>` : ''}
      ${semDesc.length ? `<p class="muted small">${U.plural(semDesc.length, 'gravação sem descrição', 'gravações sem descrição')}. Toque para dizer se foi reunião ou feedback.</p>` : ''}
      ${all.length ? `<div class="gv-list">${all.map(card).join('')}</div>` : H.empty('Nenhuma gravação ainda. Toque em <strong>Gravar</strong>, na barra de baixo, para começar. Não precisa criar a reunião antes.')}`;
  },
  chip(x) {
    const ok = x.partes.filter(p => p.st === 'ok').length, tot = x.partes.length;
    if (x.status === 'gravando') return '<span class="badge b-red">● Gravando</span>';
    if (x.status === 'pronta') return x.vazia ? '<span class="badge">Sem fala reconhecida</span>' : `<span class="badge b-green">Resumo pronto${x.tipo ? '' : ' · descrever'}</span>`;
    if (x.status === 'pendente') return `<span class="badge b-yellow">Esperando · ${ok} de ${tot} partes</span>`;
    return `<span class="badge b-blue">${ok < tot ? `Transcrevendo ${ok} de ${tot}` : 'Fazendo o resumo'}</span>`;
  },
  detalhe(g) {
    const done = g.status === 'pronta';
    const comb = g.combinados || [];
    const ok = g.partes.filter(p => p.st === 'ok').length;
    return `
      <div class="ps-head"><button class="icon-btn" data-act="gvBack" aria-label="Voltar">${U.icon('left', 18)}</button>
        <div class="grow"><h2>${U.esc(Gravador.nome(g))}</h2><small class="muted">${U.fmtDate(g.date)} às ${g.time} · ${Gravador.fmt(g.dur)}${g.recuperada ? ' · recuperada' : ''}</small></div></div>
      <div class="gv-acts">
        ${g.status === 'gravando' ? `<button class="btn primary" data-act="gvTela">${U.icon('mic', 15)} Abrir gravação</button>` : `<button class="btn ${g.tipo ? 'ghost' : 'primary'}" data-act="gvDesc" data-id="${g.id}">${U.icon('edit', 15)} ${g.tipo ? 'Editar descrição' : 'Descrever'}</button>`}
        ${done && g.resumo ? `<button class="btn ghost" data-act="gvCopy" data-id="${g.id}">${U.icon('download', 15)} Copiar resumo</button>` : ''}
      </div>
      <div class="card gv-status">${Views.gravacoes.chip(g)}
        <p class="small">${done ? 'Transcrição e resumo prontos.' : g.status === 'gravando' ? 'Gravando agora.' : `Transcrição: ${ok} de ${g.partes.length} partes${ok === g.partes.length ? ', fazendo o resumo' : ''}.`}${g.motivo && g.status === 'pendente' ? `<br><span class="c-yellow">${U.esc(g.motivo)}</span>` : ''}</p>
        ${g.status === 'pendente' ? `<button class="btn sm" data-act="gvRetry">Tentar agora</button>` : ''}
        ${done && g.tipo ? `<button class="link" data-act="gvRedo" data-id="${g.id}">Refazer resumo</button>` : ''}
      </div>
      ${g.resumo ? `<div class="card"><div class="card-h"><h3>${U.icon('spark')} Resumo</h3></div><div class="ata pre">${U.esc(g.resumo)}</div></div>` : ''}
      ${comb.length ? `<div class="card"><div class="card-h"><h3>${U.icon('tasks')} ${g.tipo === 'feedback' ? 'Acordos' : 'Combinados'}</h3></div>
        <ul class="gv-comb">${comb.map(c => `<li>${U.esc(c)}</li>`).join('')}</ul>
        ${g.tarefas ? `<p class="muted small">${U.plural(g.tarefas, 'tarefa criada', 'tarefas criadas')}.</p>` : `<button class="btn sm" data-act="gvTasks" data-id="${g.id}">${U.icon('plus', 14)} Virar tarefas</button>`}</div>` : ''}
      <details class="card gv-tx" data-gv-tx="${g.id}"><summary>${U.icon('list', 16)} Transcrição completa</summary><div class="gv-tx-body muted small">Carregando…</div></details>
      <div class="card"><div class="card-h"><h3>${U.icon('mic')} Áudio</h3></div>
        ${g.audio ? `<div class="gv-audio" data-gv-audio="${g.id}"><p class="muted small">Carregando…</p></div>
          ${g.status === 'pronta' ? `<button class="btn sm ghost danger-text" data-act="gvDelAudio" data-id="${g.id}">${U.icon('trash', 14)} Apagar o áudio (fica a transcrição)</button>` : ''}`
          : '<p class="muted small">O áudio foi apagado. A transcrição e o resumo continuam aqui.</p>'}
      </div>
      <div class="row-actions"><button class="btn ghost danger-text" data-act="gvDel" data-id="${g.id}">${U.icon('trash', 15)} Excluir gravação</button></div>`;
  },
  mount(root) {
    const g = App.ui.gvId && Gravador.find(App.ui.gvId); if (!g) return;
    const tx = root.querySelector('.gv-tx-body');
    if (tx) Gravador.transcricao(g).then(t => { tx.textContent = t || 'Ainda sem transcrição.'; tx.classList.toggle('pre', !!t); });
    const box = root.querySelector('[data-gv-audio]');
    if (box) Promise.all(g.partes.map(p => AudioDB.get('partes', [g.id, p.n]))).then(list => {
      (Views.gravacoes.urls || []).forEach(u => URL.revokeObjectURL(u));
      Views.gravacoes.urls = [];
      const rows = list.map((a, i) => { if (!a || !a.blob) return ''; const u = URL.createObjectURL(a.blob); Views.gravacoes.urls.push(u); const p = g.partes[i];
        return `<div class="gv-part"><span class="small">Parte ${p.n + 1} · ${Gravador.fmt(p.ini)}${p.st === 'ok' ? ' ✓' : ''}</span><audio controls preload="none" src="${u}"></audio><button class="icon-btn" data-act="gvDown" data-id="${g.id}" data-n="${p.n}" aria-label="Baixar parte ${p.n + 1}">${U.icon('download', 15)}</button></div>`; }).join('');
      box.innerHTML = rows || '<p class="muted small">O áudio ainda está sendo salvo.</p>';
    });
  },
};

Object.assign(Actions, {
  gvRec() { Gravador.start(); },
  gvTela() { Gravador.tela(); },
  gvOpen({ id }) { App.ui.gvId = id; if (App.route !== 'gravacoes') App.go('gravacoes'); else { App.render(); window.scrollTo(0, 0); } },
  gvBack() { App.ui.gvId = null; App.render(); },
  gvDesc({ id }) { Gravador.descrever(Gravador.find(id)); },
  gvRetry() { Gravador.list().forEach(g => { g.partes.forEach(p => { if (p.st === 'erro') p.st = 'pend'; }); }); Gravador.processar(); UI.toast('Tentando de novo…'); },
  gvRedo({ id }) { const g = Gravador.find(id); if (!g) return; g.status = 'processando'; Gravador.salvar(); Gravador.processar(); UI.toast('Refazendo o resumo…'); },
  async gvCopy({ id }) { const g = Gravador.find(id); try { await navigator.clipboard.writeText(g.resumo); UI.toast('Resumo copiado.'); } catch (e) { UI.toast('Não foi possível copiar.', 'warn'); } },
  gvTasks({ id }) {
    const g = Gravador.find(id); if (!g) return;
    (g.combinados || []).forEach(title => S.tasks.push({ id: U.uid(), title, description: `${g.tipo === 'feedback' ? 'Acordo do feedback' : 'Combinado da reunião'} "${Gravador.nome(g)}" (${U.fmtShort(g.date)}).`, category: g.tipo === 'feedback' ? 'equipe' : 'administrativo', priority: 'media', status: 'pendente', responsible: g.tipo === 'feedback' ? g.pessoa : '', createdAt: new Date().toISOString(), startDate: U.today(), dueDate: '', dueTime: '', notes: '' }));
    g.tarefas = (g.combinados || []).length; commit();
    UI.toast(`${U.plural(g.tarefas, 'tarefa criada', 'tarefas criadas')}.`, 'ok', { label: 'Ver', onClick: () => App.go('tarefas') });
  },
  async gvDown({ id, n }) { const a = await AudioDB.get('partes', [id, +n]); if (a && a.blob) U.download(`gravacao-${Gravador.find(id).date}-parte${+n + 1}.${/mp4/.test(a.mime) ? 'm4a' : /ogg/.test(a.mime) ? 'ogg' : 'webm'}`, a.blob); },
  gvDelAudio({ id }) { const g = Gravador.find(id); UI.confirm('Apagar o áudio desta gravação? A transcrição e o resumo continuam.', () => Gravador.apagarAudio(g).then(() => UI.toast('Áudio apagado.')), { danger: true, okLabel: 'Apagar áudio' }); },
  gvDel({ id }) {
    const g = Gravador.find(id);
    UI.confirm(`Excluir a gravação <strong>${U.esc(Gravador.nome(g))}</strong>, com o áudio e a transcrição?${g.ref ? '<br><small class="muted">A reunião ou o feedback com o resumo continua no calendário.</small>' : ''}`, () => Gravador.excluir(g).then(() => { App.ui.gvId = null; App.render(); UI.toast('Gravação excluída.'); }), { danger: true, okLabel: 'Excluir' });
  },
});
