'use strict';
/* Gestão de imprevistos — ocorrências que exigem atenção imediata */
/* Imprevistos: aparecem em destaque na Agenda (Pendências) e no dia do prazo */
const Occ = {
  row(o) {
    const dl = D.deadline(o.dueDate, o.dueTime, !OPEN(o.status));
    const sch = o.scheduled && o.scheduled.date ? (S.days[o.scheduled.date] || []).find(b => b.id === o.scheduled.blockId) : null;
    return `<div class="task occ-row prio-${o.priority} ${o.status} ${D.occLate(o) ? 'dl-row-late' : ''}" style="--c:var(--t-imprevisto)">
      <div class="tk-body" data-act="occEdit" data-id="${o.id}">
        <div class="tk-title">${U.esc(o.title)}${H.demo(o)}${o.status === 'andamento' ? ' ' + H.status('andamento') : ''}</div>
        <div class="tk-meta"><span class="badge b-red">Imprevisto</span>${['alta', 'urgente'].includes(o.priority) ? H.prio(o.priority) : ''}
          ${o.responsible ? `<span class="muted">${U.icon('user', 13)} ${U.esc(o.responsible)}</span>` : ''}
          ${sch ? `<span class="muted">${U.icon('calendar', 13)} ${U.fmtShort(o.scheduled.date)} ${sch.start}</span>` : o.dueDate ? `<span class="muted">${U.icon('flag', 13)} ${U.fmtShort(o.dueDate)}${o.dueTime ? ' ' + o.dueTime : ''}</span>` : ''}
          ${H.deadline(dl && dl.level !== 'ok' ? dl : null)}</div>
      </div>
      <div class="tk-side">
        ${OPEN(o.status) ? `${sch ? '' : `<button class="icon-btn" data-act="occSchedule" data-id="${o.id}" title="Encaixar na agenda" aria-label="Encaixar na agenda">${U.icon('calendar', 16)}</button>`}
          <button class="icon-btn ok" data-act="occStatus" data-id="${o.id}" data-s="concluida" title="Resolver" aria-label="Resolver">${U.icon('check', 16)}</button>`
          : `<button class="icon-btn" data-act="occStatus" data-id="${o.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir">${U.icon('undo', 16)}</button>`}
        <button class="icon-btn" data-act="occMore" data-id="${o.id}" title="Mais opções" aria-label="Mais opções">${U.icon('more', 16)}</button>
      </div>
    </div>`;
  },
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
  occMore({ id }) {
    const o = S.occurrences.find(x => x.id === id); if (!o) return;
    UI.sheet(o.title, [
      { label: 'Editar', icon: 'edit', onClick: () => Occ.form(o) },
      ...(OPEN(o.status) ? [{ label: o.scheduled ? 'Reagendar na agenda' : 'Encaixar na agenda', hint: 'Reserva um horário e reorganiza o dia', icon: 'calendar', onClick: () => Actions.occSchedule({ id }) },
        ...(o.status === 'pendente' ? [{ label: 'Começar agora', hint: 'Marca como em andamento', icon: 'play', onClick: () => Actions.occStatus({ id, s: 'andamento' }) }] : [])] : []),
      { sep: true },
      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => Actions.occDelete({ id }) },
    ]);
  },
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
