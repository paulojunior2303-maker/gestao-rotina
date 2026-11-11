'use strict';
/* Gestão de imprevistos — ocorrências que exigem atenção imediata */
Views.imprevistos = {
  title: 'Imprevistos', icon: 'alert', nav: 'Imprevistos',
  fab: { act: 'occNew', label: 'Registrar imprevisto' },
  render() {
    const f = App.ui.occFilter || 'abertas';
    const all = S.occurrences;
    const list = all.filter(o => f === 'todas' ? true : f === 'abertas' ? OPEN(o.status) : !OPEN(o.status))
      .sort((a, b) => (OPEN(b.status) - OPEN(a.status)) || (D.occLate(b) - D.occLate(a)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.date + b.time).localeCompare(a.date + a.time));
    const nOpen = all.filter(o => OPEN(o.status)).length;
    const tab = (v, l, n) => `<button class="tab ${f === v ? 'active' : ''}" data-act="occFilter" data-v="${v}">${l} <span>${n}</span></button>`;

    const card = o => {
      const dl = D.deadline(o.dueDate, o.dueTime, !OPEN(o.status));
      const sch = o.scheduled && o.scheduled.date ? (S.days[o.scheduled.date] || []).find(b => b.id === o.scheduled.blockId) : null;
      return `<div class="occ card prio-border-${o.priority} ${D.occLate(o) ? 'late' : ''} ${OPEN(o.status) ? '' : 'closed'}">
        <div class="occ-h"><h3>${U.esc(o.title)}</h3>${H.demo(o)}<span class="grow"></span>${H.prio(o.priority)} ${H.status(o.status)}</div>
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
          <button class="icon-btn" data-act="occEdit" data-id="${o.id}" title="Editar">${U.icon('edit', 16)}</button>
          <button class="icon-btn" data-act="occDelete" data-id="${o.id}" title="Excluir">${U.icon('trash', 16)}</button>
        </div>
      </div>`;
    };

    return `
    <div class="toolbar">
      <div class="tabs">${tab('abertas', 'Abertos', nOpen)}${tab('encerradas', 'Encerrados', all.length - nOpen)}${tab('todas', 'Todos', all.length)}</div>
    </div>
    <p class="muted small">Registre aqui demandas urgentes que exigem sua atenção imediata. Use <strong>Encaixar na agenda</strong> para reservar um horário e reorganizar o dia automaticamente.</p>
    <div class="occ-list">${list.length ? list.map(card).join('') : H.empty(f === 'abertas' ? 'Nenhum imprevisto em aberto.' : 'Nenhum registro.')}</div>`;
  },
};

const Occ = {
  form(o, { scheduleAfter = false } = {}) {
    const isNew = !o;
    o = o || { priority: 'urgente', status: 'pendente', date: U.today(), time: U.nowTime() };
    const fields = [
      { name: 'title', label: 'Título', required: true, value: o.title },
      { name: 'description', label: 'Descrição', type: 'textarea', value: o.description },
      { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: o.priority, half: true },
      { name: 'status', label: 'Status', type: 'select', options: H.statusOptions(), value: o.status, half: true },
      { name: 'date', label: 'Data da ocorrência', type: 'date', required: true, value: o.date, half: true },
      { name: 'time', label: 'Horário', type: 'time', value: o.time, half: true },
      { name: 'dueDate', label: 'Prazo', type: 'date', value: o.dueDate, half: true },
      { name: 'dueTime', label: 'Horário limite', type: 'time', value: o.dueTime, half: true },
      { name: 'responsible', label: 'Responsável', value: o.responsible, list: D.techNames(), placeholder: 'Você ou alguém da equipe' },
      { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: o.notes },
    ];
    if (isNew) fields.push({ name: 'schedule', label: 'Encaixar na agenda após salvar', type: 'checkbox', value: scheduleAfter });
    UI.form({
      title: isNew ? 'Registrar imprevisto' : 'Editar imprevisto',
      fields,
      onSubmit(v) {
        const { schedule, ...data } = v;
        let target = o;
        if (isNew) { target = { id: U.uid(), createdAt: new Date().toISOString(), scheduled: null, ...data }; S.occurrences.push(target); }
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
  occSchedule({ id }) { Agenda.scheduleDialog(S.occurrences.find(o => o.id === id)); },
  occStatus({ id, s }) {
    const o = S.occurrences.find(x => x.id === id); if (!o) return;
    o.status = s; if (s === 'concluida') o.resolvedAt = new Date().toISOString();
    Occ.syncBlock(o); commit();
    if (s === 'concluida') UI.toast('Imprevisto resolvido.');
  },
  occDelete({ id }) {
    const o = S.occurrences.find(x => x.id === id);
    UI.confirm(`Excluir o imprevisto <strong>${U.esc(o.title)}</strong>?${o.scheduled ? '<br><small class="muted">O horário reservado na agenda também será removido.</small>' : ''}`, () => {
      if (o.scheduled && S.days[o.scheduled.date]) S.days[o.scheduled.date] = S.days[o.scheduled.date].filter(b => b.id !== o.scheduled.blockId);
      S.occurrences = S.occurrences.filter(x => x.id !== id); commit(); UI.toast('Imprevisto excluído.');
    }, { danger: true, okLabel: 'Excluir' });
  },
});
