'use strict';
/* Gestão de imprevistos — ocorrências que exigem atenção imediata */
Views.imprevistos = {
  title: 'Imprevistos', icon: 'alert', nav: 'Imprevistos',
  fab: { act: 'capture', label: 'Registrar imprevisto', data: { type: 'imprevisto' } },
  render() {
    const f = App.ui.occFilter || 'abertas';
    const all = S.occurrences;
    const list = all.filter(o => f === 'todas' ? true : f === 'abertas' ? OPEN(o.status) : !OPEN(o.status))
      .sort((a, b) => (OPEN(b.status) - OPEN(a.status)) || (D.occLate(b) - D.occLate(a)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.date + b.time).localeCompare(a.date + a.time));
    const nOpen = all.filter(o => OPEN(o.status)).length;
    const tk = U.today();
    const nToday = all.filter(o => o.date === tk).length, minToday = Capture.minutesOn(tk);
    const tab = (v, l, n) => `<button class="tab ${f === v ? 'active' : ''}" aria-pressed="${f === v}" data-act="occFilter" data-v="${v}">${l} <span>${n}</span></button>`;

    const card = o => {
      const dl = D.deadline(o.dueDate, o.dueTime, !OPEN(o.status));
      const sch = o.scheduled && o.scheduled.date ? (S.days[o.scheduled.date] || []).find(b => b.id === o.scheduled.blockId) : null;
      return `<div class="occ card prio-border-${o.priority} ${D.occLate(o) ? 'late' : ''} ${OPEN(o.status) ? '' : 'closed'}">
        <div class="occ-h"><h2 class="occ-t">${U.esc(o.title)}</h2>${H.demo(o)}<span class="grow"></span>${H.prio(o.priority)} ${H.status(o.status)}</div>
        <div class="occ-meta">
          <span>${U.icon('clock', 14)} Registrado ${U.fmtDate(o.date)} ${o.time || ''}</span>
          ${o.responsible ? `<span>${U.icon('user', 14)} ${U.esc(o.responsible)}</span>` : ''}
          ${o.dueDate ? `<span>${U.icon('flag', 14)} Prazo ${U.fmtDate(o.dueDate)} ${o.dueTime || ''}</span>` : ''}
          ${H.deadline(dl)}
        </div>
        ${o.description ? `<p>${U.esc(o.description)}</p>` : ''}
        ${o.notes ? `<p class="muted small"><strong>Obs.:</strong> ${U.esc(o.notes)}</p>` : ''}
        ${sch ? `<p class="small sched">${U.icon('calendar', 14)} Na agenda: ${U.fmtDate(o.scheduled.date)}, ${sch.start}–${sch.end} · <a class="link" href="#agenda" data-act="goAgenda" data-d="${o.scheduled.date}">abrir</a></p>` : ''}
        <div class="occ-actions">
          ${OPEN(o.status) ? `<button class="btn sm" data-act="occSchedule" data-id="${o.id}">${U.icon('calendar', 15)} ${sch ? 'Reagendar' : 'Encaixar na agenda'}</button>
          ${o.status === 'pendente' ? `<button class="btn sm ghost" data-act="occStatus" data-id="${o.id}" data-s="andamento">${U.icon('play', 13)} Iniciar</button>` : ''}
          <button class="btn sm ghost ok-text" data-act="occStatus" data-id="${o.id}" data-s="concluida">${U.icon('check', 15)} Resolver</button>`
          : `<button class="btn sm ghost" data-act="occStatus" data-id="${o.id}" data-s="pendente">${U.icon('undo', 15)} Reabrir</button>`}
          <span class="grow"></span>
          <button class="icon-btn" data-act="occEdit" data-id="${o.id}" title="Editar" aria-label="Editar imprevisto">${U.icon('edit', 16)}</button>
          <button class="icon-btn" data-act="occDelete" data-id="${o.id}" title="Excluir" aria-label="Excluir imprevisto">${U.icon('trash', 16)}</button>
        </div>
      </div>`;
    };

    return `
    <div class="toolbar">
      <div class="tabs">${tab('abertas', 'Abertos', nOpen)}${tab('encerradas', 'Encerrados', all.length - nOpen)}${tab('todas', 'Todos', all.length)}</div>
    </div>
    ${nToday || minToday ? `<div class="occ-today card">${U.icon('alert', 18)}<span>Hoje: <strong>${U.plural(nToday, 'imprevisto')}</strong>${minToday ? ` · <strong>${U.fmtDur(minToday)}</strong> tomados da agenda` : ''}</span></div>` : ''}
    <p class="muted small">Aconteceu algo? Toque no <strong>+</strong>, escreva em poucas palavras e diga quanto tempo vai tomar: o app encaixa agora na agenda e empurra o resto do dia.</p>
    <div class="occ-list">${list.length ? list.map(card).join('') : (f === 'abertas' ? H.vazio('Nenhum imprevisto.', 'Dia sob controle.', all.length ? 'Tudo o que apareceu já foi resolvido.' : 'Quando algo sair do previsto, anote aqui: o app encaixa na agenda e empurra o resto do dia.', [['plus', 'Toque no + e diga quanto tempo vai tomar']]) : H.empty('Nenhum registro.'))}</div>`;
  },
};

const Occ = {
  /* Quadro de imprevistos em destaque (pedido do usuário: imprevisto vem antes de tudo).
     Fica no topo do Início, da Agenda e da Lista de tarefas, só quando há imprevisto aberto (registrar é pelo "+" de qualquer tela). */
  emAndamento(exceto) { return S.occurrences.find(o => o.status === 'andamento' && o.id !== exceto); },
  painel() {
    const abertos = S.occurrences.filter(o => OPEN(o.status)).sort((a, b) => (b.status === 'andamento') - (a.status === 'andamento') || (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    const novo = () => `<button class="oc-novo" data-act="capture" data-type="imprevisto">${U.icon('plus', 15)} Imprevisto</button>`;
    if (!abertos.length) return '';
    const ha = iso => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d`; };
    const card = o => {
      const run = o.status === 'andamento';
      const sch = o.scheduled && o.scheduled.date ? (S.days[o.scheduled.date] || []).find(b => b.id === o.scheduled.blockId) : null;
      return `<div class="oc-card ${run ? 'run' : ''}">
        <div class="oc-info" data-act="occEdit" data-id="${o.id}">
          <span class="oc-tag">${run ? '<i class="run-dot"></i>resolvendo agora' : 'imprevisto'}</span>
          <strong>${U.esc(o.title)}${H.demo(o)}</strong>
          <small>${o.createdAt ? 'registrado ' + ha(o.createdAt) : U.fmtShort(o.date) + (o.time ? ' ' + o.time : '')}${o.responsible ? ' · ' + U.esc(o.responsible) : ''}${sch ? ` · na agenda ${sch.start}–${sch.end}` : ''}</small>
        </div>
        <div class="oc-acoes">${run
          ? `<button class="oc-btn ghost" data-act="occStatus" data-id="${o.id}" data-s="pendente" aria-label="Pausar"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg></button><button class="oc-btn ok" data-act="occStatus" data-id="${o.id}" data-s="concluida">${U.icon('check', 16)} Resolvido</button>`
          : `<button class="oc-btn go" data-act="occComecar" data-id="${o.id}">${U.icon('play', 14)} Começar</button>`}</div>
      </div>`;
    };
    return `<section class="oc-painel"><div class="oc-h"><span>${U.icon('alert', 15)} ${U.plural(abertos.length, 'imprevisto aberto', 'imprevistos abertos')}</span>${novo()}</div>${abertos.map(card).join('')}</section>`;
  },
  /* Começar um imprevisto: vai para a agenda AGORA (30 min, empurrando o resto) e pausa o que estava em execução */
  comecar(o, dur = 30) {
    const t = U.today(), avisos = [];
    const tk = typeof Tasks !== 'undefined' && Tasks.emExecucao();
    if (tk) { tk.status = 'pendente'; avisos.push(`“${tk.title}” foi pausada`); }
    const outro = this.emAndamento(o.id);
    if (outro) { outro.status = 'pendente'; Occ.syncBlock(outro); }
    if (!(o.scheduled && o.scheduled.date === t)) {
      const r = Capture.encaixarAgora(o, dur);
      o.status = 'andamento';
      avisos.push(`entrou na agenda agora (${r.start}–${r.end})`);
    } else { o.status = 'andamento'; const b = D.findBlock(t, o.scheduled.blockId); if (b) b.status = 'andamento'; }
    commit();
    UI.toast(`Imprevisto em andamento: ${avisos.join(' e ')}.`, 'ok');
  },
  form(o, { scheduleAfter = false, defaults = {} } = {}) {
    const isNew = !o;
    o = o || { priority: 'urgente', status: 'pendente', date: U.today(), time: U.nowTime(), ...defaults };
    // Enxuto (pedido do usuário): tudo numa tela só, dois campos por linha. O status muda pelos botões do cartão (Iniciar, Resolver, Reabrir).
    const obs = [o.description, o.notes].filter(Boolean).join('\n');
    const fields = [
      { name: 'title', label: 'O que aconteceu?', required: true, value: o.title },
      { name: 'responsible', label: 'Quem resolve?', value: o.responsible, list: D.techNames(), placeholder: 'Você', half: true },
      { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: o.priority, half: true },
      { name: 'date', label: 'Aconteceu em', type: 'date', required: true, value: o.date, half: true },
      { name: 'time', label: 'Horário', type: 'time', value: o.time, half: true },
      { name: 'description', label: 'Observação', type: 'textarea', rows: 2, value: obs, placeholder: 'Opcional' },
      { type: 'html', html: '<span class="tk-form-dica" hidden></span>' },
    ];
    if (isNew) fields.push({ name: 'schedule', label: 'Encaixar na agenda depois de salvar', type: 'checkbox', value: scheduleAfter });
    UI.form({
      title: isNew ? 'Registrar imprevisto' : 'Editar imprevisto',
      fields,
      onSubmit(v) {
        const { schedule, ...data } = v;
        data.notes = '';
        let target = o;
        if (isNew) { target = { id: U.uid(), createdAt: new Date().toISOString(), scheduled: null, status: o.status || 'pendente', ...data }; S.occurrences.push(target); }
        else Object.assign(target, data);
        Occ.syncBlock(target);
        commit();
        UI.toast(isNew ? 'Imprevisto registrado.' : 'Imprevisto atualizado.');
        if (schedule) setTimeout(() => Agenda.scheduleDialog(target), 200);
      },
    });
  },
  syncBlock(o) {
    if (!o.scheduled) return;
    const b = (S.days[o.scheduled.date] || []).find(x => x.id === o.scheduled.blockId);
    if (!b) return;
    b.title = 'Imprevisto: ' + o.title; b.priority = o.priority;
    if (o.status === 'concluida' && b.status !== 'concluida') b.status = 'concluida';
    if (o.status === 'cancelada') b.status = 'cancelada';
  },
};

Object.assign(Actions, {
  occFilter({ v }) { App.ui.occFilter = v; App.render(); },
  occNew() { Occ.form(null); },
  occEdit({ id }) { Occ.form(S.occurrences.find(o => o.id === id)); },
  occComecar({ id }) { const o = S.occurrences.find(x => x.id === id); if (o) Occ.comecar(o); },
  occSchedule({ id }) { Agenda.scheduleDialog(S.occurrences.find(o => o.id === id)); },
  occStatus({ id, s }) {
    const o = S.occurrences.find(x => x.id === id); if (!o) return;
    if (s === 'andamento') return Occ.comecar(o);
    o.status = s; if (s === 'concluida') o.resolvedAt = new Date().toISOString();
    let gap = 0;
    const t = U.today(), b = s === 'concluida' && o.scheduled && o.scheduled.date === t ? D.findBlock(t, o.scheduled.blockId) : null;
    if (b) {
      const nowR = Math.ceil(U.nowMin() / 5) * 5;
      if (U.toMin(b.start) < nowR && U.toMin(b.end) > nowR) { gap = U.toMin(b.end) - nowR; b.end = U.fromMin(nowR); }
    }
    Occ.syncBlock(o); commit();
    if (s === 'concluida') {
      if (gap >= 10) UI.toast(`Imprevisto resolvido ${U.fmtDur(gap)} antes do previsto.`, 'ok', { label: 'Adiantar a agenda', onClick: () => Replan.fromNow({ quiet: false }) });
      else UI.toast('Imprevisto resolvido.');
    }
  },
  occDelete({ id }) {
    const o = S.occurrences.find(x => x.id === id);
    UI.confirm(`Excluir o imprevisto <strong>${U.esc(o.title)}</strong>?${o.scheduled ? '<br><small class="muted">O horário reservado na agenda também será removido.</small>' : ''}`, () => {
      if (o.scheduled && S.days[o.scheduled.date]) S.days[o.scheduled.date] = S.days[o.scheduled.date].filter(b => b.id !== o.scheduled.blockId);
      S.occurrences = S.occurrences.filter(x => x.id !== id); commit(); UI.toast('Imprevisto excluído.');
    }, { danger: true, okLabel: 'Excluir' });
  },
});
