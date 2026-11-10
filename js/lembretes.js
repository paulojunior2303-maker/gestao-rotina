'use strict';
/* Lembretes: avisos de prazos de tarefas e imprevistos, compromissos e resumo do dia.
   App Android: notificações locais (tocam com o app fechado), com botão "Feito"/"Ciente".
   Navegador: avisos enquanto o site estiver aberto (em qualquer aba).
   Os avisos são recalculados a cada alteração dos dados: nada fica "preso" no aparelho. */
const Reminders = {
  REPEAT_MIN: 30,     // repetição enquanto não marcar Feito
  REPEATS: 4,         // até 2 h depois do prazo
  MAX: 60,            // o Android limita alarmes: agenda os 60 mais próximos (o resto entra quando o app abrir)
  DAYS: 14,
  timer: null,
  webTimer: null,
  webLast: 0,

  cfg() { return S.settings.lembretes; },
  on() { return !!(this.cfg() && this.cfg().on); },
  LN() { return Native.available() ? Native.P().LocalNotifications : null; },
  webSupported() { return !Native.available() && !Cloud.available() && 'Notification' in window; },

  at(date, time) { const [y, m, d] = date.split('-').map(Number); const [h, mi] = (time || '00:00').split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime(); },
  key(kind, x, date, time) { return `${kind}:${x.id}:${date}:${time || ''}`; },
  ciente(k) { return !!(S.meta && S.meta.ciente && S.meta.ciente[k]); },

  /* Lista de avisos futuros (puro: fácil de testar) */
  list(now = Date.now()) {
    const c = this.cfg(); if (!c) return [];
    const antes = Number(c.antes) || 0, until = now + this.DAYS * 86400000, out = [];
    const push = a => { if (a.when > now && a.when <= until) out.push(a); };
    const fmtAntes = antes === 0 ? 'agora' : antes < 60 ? `em ${antes} min` : `em ${antes / 60} h`;
    const prazo = (kind, x, title, date, time) => {
      const base = this.at(date, time), k = this.key(kind, x, date, time);
      if (this.ciente(k)) return;
      const lbl = kind === 'tarefa' ? 'Tarefa' : 'Imprevisto';
      push({ k, kind, id: x.id, when: base - antes * 60000, title: `${lbl} vence ${fmtAntes}`, body: `${x.title} · prazo às ${time}`, type: kind === 'tarefa' ? 'TAREFA' : 'AVISO' });
      if (c.repetir) for (let i = 1; i <= this.REPEATS; i++) push({ k, kind, id: x.id, when: base + i * this.REPEAT_MIN * 60000, title: `${lbl} atrasada`, body: `${x.title} · venceu às ${time}`, type: kind === 'tarefa' ? 'TAREFA' : 'AVISO' });
    };
    S.tasks.filter(x => OPEN(x.status) && x.dueDate && x.dueTime).forEach(x => prazo('tarefa', x, x.title, x.dueDate, x.dueTime));
    S.occurrences.filter(o => OPEN(o.status) && o.dueDate && o.dueTime).forEach(o => prazo('imprevisto', o, o.title, o.dueDate, o.dueTime));
    S.events.filter(e => e.date && e.time).forEach(e => {
      const k = this.key('evento', e, e.date, e.time);
      if (this.ciente(k)) return;
      const n = (e.pautas || []).length;
      push({ k, kind: 'evento', id: e.id, when: this.at(e.date, e.time) - antes * 60000, title: antes ? `Compromisso ${fmtAntes}` : 'Compromisso agora', body: `${e.title} · ${e.time}${n ? ` · ${U.plural(n, 'assunto')} na pauta` : ''}`, type: 'AVISO' });
    });
    // Resumo no início do expediente, nos dias úteis em que há algo marcado
    if (c.resumo) for (let i = 0; i < 7; i++) {
      const k = U.addDays(U.today(), i);
      if (!D.isWorkday(k)) continue;
      const tasks = S.tasks.filter(x => OPEN(x.status) && x.dueDate === k).length;
      const evs = S.events.filter(e => e.date === k).length;
      const occ = S.occurrences.filter(o => OPEN(o.status) && o.dueDate === k).length;
      const late = S.tasks.filter(x => OPEN(x.status) && x.dueDate && x.dueDate < k).length;
      const parts = [tasks && U.plural(tasks, 'prazo de tarefa', 'prazos de tarefa'), evs && U.plural(evs, 'compromisso'), occ && U.plural(occ, 'imprevisto') + ' com prazo', late && U.plural(late, 'tarefa atrasada', 'tarefas atrasadas')].filter(Boolean);
      if (parts.length) push({ k: 'resumo:' + k, kind: 'resumo', id: k, when: this.at(k, S.settings.workStart), title: 'Seu dia', body: parts.join(', ') + '.', type: '' });
    }
    return out.sort((a, b) => a.when - b.when).slice(0, this.MAX);
  },

  /* Chamado a cada gravação dos dados (com espera curta para juntar várias mudanças) */
  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply().catch(e => console.warn('lembretes', e)), 1200);
  },

  async apply() {
    const LN = this.LN();
    if (!LN) { this.webLoop(); return; }
    const pend = await LN.getPending();
    if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    if (!this.on()) return;
    // Esquece marcações "Ciente" antigas (mais de 30 dias)
    const old = U.addDays(U.today(), -30);
    for (const k of Object.keys(S.meta.ciente || {})) if ((k.split(':')[2] || '') < old) delete S.meta.ciente[k];
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') return;
    const list = this.list();
    if (!list.length) return;
    await LN.schedule({ notifications: list.map((a, i) => ({
      id: i + 1, title: a.title, body: a.body, channelId: 'lembretes', actionTypeId: a.type || undefined,
      schedule: { at: new Date(a.when), allowWhileIdle: true }, extra: { k: a.k, kind: a.kind, id: a.id },
      smallIcon: 'ic_stat_notify', iconColor: '#9461F5',
    })) });
  },

  /* App Android: canal, botões das notificações e o que fazer quando o usuário toca */
  async initNative() {
    const LN = this.LN(); if (!LN) return;
    try {
      await LN.createChannel({ id: 'lembretes', name: 'Lembretes', description: 'Prazos, compromissos e resumo do dia', importance: 5, visibility: 1, vibration: true });
      await LN.registerActionTypes({ types: [
        { id: 'TAREFA', actions: [{ id: 'feito', title: 'Feito' }, { id: 'ciente', title: 'Parar de avisar' }] },
        { id: 'AVISO', actions: [{ id: 'ciente', title: 'Ciente' }] },
      ] });
      LN.addListener('localNotificationActionPerformed', ev => this.onAction(ev.actionId, (ev.notification && ev.notification.extra) || {}));
    } catch (e) { console.warn('lembretes', e); }
    this.schedule();
  },

  onAction(actionId, x) {
    if (actionId === 'feito' && x.kind === 'tarefa') {
      const t = S.tasks.find(t => t.id === x.id);
      if (t && OPEN(t.status)) { t.status = 'concluida'; t.completedAt = new Date().toISOString(); commit(); UI.toast('Tarefa concluída pelo aviso.'); }
      return;
    }
    if (actionId === 'ciente' || actionId === 'feito') {
      S.meta.ciente = S.meta.ciente || {};
      S.meta.ciente[x.k] = true;
      commit();
      return;
    }
    // Toque no aviso: abre a tela relacionada
    const go = { tarefa: 'tarefas', imprevisto: 'imprevistos', resumo: 'dashboard' }[x.kind];
    if (go) App.go(go);
    else if (x.kind === 'evento') { const e = S.events.find(e => e.id === x.id); if (e) { App.go('mensal'); setTimeout(() => Events.view(e), 200); } }
  },

  /* Ligar: pede a permissão de notificações (Android 13+ ou navegador) */
  async enable() {
    const LN = this.LN();
    if (LN) {
      let p = await LN.checkPermissions();
      if (p.display !== 'granted') p = await LN.requestPermissions();
      if (p.display !== 'granted') { UI.toast('Sem permissão para notificações. Libere em Configurações do celular → Apps → Gestão de Rotina → Notificações.', 'warn'); return false; }
      return true;
    }
    if (!this.webSupported()) { UI.toast('Este navegador não permite avisos.', 'warn'); return false; }
    const r = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (r !== 'granted') { UI.toast('O navegador bloqueou os avisos. Libere nas configurações do site.', 'warn'); return false; }
    return true;
  },

  async test() {
    const LN = this.LN();
    const title = 'Aviso de teste', body = 'Se você está vendo isto, os lembretes estão funcionando.';
    if (LN) { await LN.schedule({ notifications: [{ id: 999, title, body, channelId: 'lembretes', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, smallIcon: 'ic_stat_notify', iconColor: '#9461F5', extra: { kind: 'teste' } }] }); return; }
    setTimeout(() => this.webShow({ title, body, kind: 'teste' }), 5000);
  },

  /* Navegador: confere a cada 30 s se algum aviso chegou na hora */
  webLoop() {
    clearInterval(this.webTimer);
    if (!this.on() || !this.webSupported() || Notification.permission !== 'granted') return;
    if (!this.webLast) this.webLast = Date.now();
    this.webTimer = setInterval(() => {
      const now = Date.now(), from = this.webLast;
      this.webLast = now;
      // list() só devolve avisos futuros; olha a janela desde a última conferência
      this.list(from).filter(a => a.when <= now).forEach(a => this.webShow(a));
    }, 30000);
  },
  async webShow(a) {
    const opts = { body: a.body, icon: 'icon.svg', tag: a.k || 'teste', data: { k: a.k, kind: a.kind, id: a.id } };
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.showNotification(a.title, opts); return; }
    } catch (e) { /* sem service worker: usa o aviso simples */ }
    const n = new Notification(a.title, opts);
    n.onclick = () => { window.focus(); this.onAction('tap', opts.data); n.close(); };
  },
};

/* Configurações → Lembretes */
Object.assign(Reminders, {
  section(sec) {
    const c = this.cfg(), nat = Native.available();
    if (!nat && !this.webSupported()) return sec('lembretes', 'Lembretes', '', `<p class="muted small">Os lembretes funcionam no app Android e no site aberto no navegador. Nesta versão eles não estão disponíveis.</p>`);
    const sw = (act, on, title, sub, cls = '') => `<label class="switch-row ${cls}"><span><strong>${title}</strong><small>${sub}</small></span><input type="checkbox" class="switch" data-change="${act}" ${on ? 'checked' : ''}></label>`;
    return sec('lembretes', 'Lembretes', nat ? 'Avisos no celular, mesmo com o app fechado.' : 'Avisos neste navegador enquanto o site estiver aberto (pode ser em outra aba).', `
      ${sw('lemOn', c.on, 'Receber lembretes', 'Prazos com horário de tarefas e imprevistos, compromissos e um resumo no início do expediente.', 'first')}
      ${c.on ? `
        <div class="field lem-antes"><label for="lem-antes">Avisar com antecedência</label><select id="lem-antes" data-change="lemAntes">${UI.opts([[0, 'Na hora'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 h antes']], c.antes)}</select></div>
        ${sw('lemRepetir', c.repetir, 'Repetir até marcar Feito', 'Se uma tarefa ou imprevisto passar do prazo, o aviso volta a cada 30 min, por até 2 h. No aviso, toque em Feito para concluir a tarefa.')}
        ${sw('lemResumo', c.resumo, 'Resumo do dia', `Às ${S.settings.workStart} dos dias úteis em que houver prazos, compromissos ou atrasos.`)}
        ${nat ? '<div id="lem-status" class="lem-status"><p class="muted small">Conferindo as permissões do celular…</p></div>' : ''}
        <div class="row-actions wrap"><button class="btn sm" data-act="lemTest">${U.icon('clock', 15)} Enviar aviso de teste</button></div>
        <p class="muted small mt">Só recebem aviso no horário as tarefas e imprevistos com <strong>horário de prazo</strong> e os compromissos com <strong>horário</strong>.</p>` : ''}`);
  },

  /* Permissões do Android que decidem se o aviso toca com o app fechado */
  async fillStatus(root) {
    const box = root.querySelector('#lem-status'); if (!box) return;
    const LN = this.LN(), Sis = Native.P().Sistema;
    const rows = [];
    try { const p = await LN.checkPermissions(); rows.push([p.display === 'granted', 'Notificações permitidas', 'Notificações bloqueadas', 'lemPerm', 'Permitir']); } catch (e) { /* sem plugin */ }
    try { const x = await LN.checkExactNotificationSetting(); rows.push([x.exact_alarm === 'granted', 'Alarmes no horário exato', 'Alarmes exatos desligados: o aviso pode atrasar', 'lemExact', 'Ligar']); } catch (e) { /* Android antigo */ }
    let xiaomi = false;
    try { const s = await Sis.status(); xiaomi = /xiaomi|redmi|poco/.test(s.fabricante); rows.push([s.bateriaLiberada, 'Bateria sem restrição', 'Economia de bateria pode bloquear os avisos', 'lemOpen', 'Liberar', 'bateria']); } catch (e) { /* sem plugin */ }
    box.innerHTML = rows.map(([ok, yes, no, act, lbl, tela]) => `<div class="lem-row ${ok ? 'ok' : 'warn'}">${U.icon(ok ? 'check' : 'alert', 16)}<span>${ok ? yes : no}</span>${ok ? '' : `<button class="btn sm" data-act="${act}" ${tela ? `data-tela="${tela}"` : ''}>${lbl}</button>`}</div>`).join('')
      + (xiaomi ? `<div class="lem-row info">${U.icon('info', 16)}<span>Celular Xiaomi: ative a <strong>Inicialização automática</strong> do Gestão de Rotina, senão o sistema impede os avisos com o app fechado.</span><button class="btn sm" data-act="lemOpen" data-tela="autostart">Abrir</button></div>` : '');
  },
});

Object.assign(Actions, {
  async lemOn(_, el) {
    if (el.checked && !(await Reminders.enable())) { el.checked = false; return; }
    S.settings.lembretes.on = el.checked; commit();
    UI.toast(el.checked ? 'Lembretes ligados.' : 'Lembretes desligados.');
  },
  lemAntes(_, el) { S.settings.lembretes.antes = Number(el.value); commit(); },
  lemRepetir(_, el) { S.settings.lembretes.repetir = el.checked; commit(); },
  lemResumo(_, el) { S.settings.lembretes.resumo = el.checked; commit(); },
  async lemTest() {
    if (!(await Reminders.enable())) return;
    await Reminders.test();
    UI.toast(Native.available() ? 'Aviso de teste em 5 segundos. Pode até fechar o app.' : 'Aviso de teste em 5 segundos.');
  },
  async lemPerm() { await Reminders.enable(); App.render(); },
  async lemExact() { try { await Reminders.LN().changeExactNotificationSetting(); } catch (e) { /* tela indisponível */ } },
  async lemOpen({ tela }) { try { await Native.P().Sistema.abrir({ tela }); } catch (e) { UI.toast('Abra Configurações do celular → Apps → Gestão de Rotina.', 'warn'); } },
});

/* Aviso de versão nova do APK (só no app Android): compara com a última Release do GitHub */
const Updater = {
  REPO: 'paulojunior2303-maker/gestao-rotina',
  info: null,
  newer(a, b) { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0; } return false; },
  async check() {
    if (!Native.available()) return;
    try {
      const cur = (await Native.P().App.getInfo()).version;
      const r = await fetch(`https://api.github.com/repos/${this.REPO}/releases/latest`, { cache: 'no-store' });
      if (!r.ok) return;
      const rel = await r.json();
      const v = String(rel.tag_name || '').replace(/^v/, '');
      if (!v || !this.newer(v, cur) || localStorage.getItem('gr-update-later') === v) return;
      this.info = { v, url: `https://github.com/${this.REPO}/releases/download/v${v}/GestaoRotina.apk` };
      if (App.route === 'dashboard' && !document.querySelector('.modal-wrap')) App.render();
    } catch (e) { /* sem internet: tenta na próxima abertura */ }
  },
  banner() {
    if (!this.info) return '';
    return `<div class="alert a-accent update-banner">${U.icon('download')} <span>Nova versão <strong>${U.esc(this.info.v)}</strong> disponível. Instale por cima da atual: seus dados ficam.</span>
      <a class="btn sm primary" href="${this.info.url}" target="_blank" rel="noopener">Baixar</a><button class="btn sm ghost" data-act="updLater">Depois</button></div>`;
  },
};

Actions.updLater = () => { if (Updater.info) localStorage.setItem('gr-update-later', Updater.info.v); Updater.info = null; App.render(); };
