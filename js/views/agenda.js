'use strict';
/* Cronograma diário — agenda por horário com remanejamento */
Views.agenda = {
  title: 'Cronograma diário', icon: 'clock', nav: 'Cronograma diário',
  render(params) {
    const k = App.ui.agendaDate || U.today();
    const t = U.today();
    const blocks = D.dayBlocks(k);
    const conflicts = D.conflicts(blocks);
    const prog = D.progress(k);
    const endMin = U.toMin(S.settings.workEnd), startMin = U.toMin(S.settings.workStart);
    const late = blocks.filter(b => D.blockLate(b, k));
    const focus = S.weekly.focus.find(f => f.day === U.weekday(k));
    const counts = st => blocks.filter(b => !D.isBreak(b) && b.status === st).length;
    const occ = S.occurrences.filter(o => OPEN(o.status) && !(o.scheduled && o.scheduled.date));

    const row = b => {
      const c = D.cat(b.category);
      const isLate = D.blockLate(b, k), isNow = D.blockNow(b, k);
      const dur = U.toMin(b.end) - U.toMin(b.start);
      const outside = U.toMin(b.start) < startMin || U.toMin(b.end) > endMin;
      const badges = [
        isNow ? '<span class="badge b-blue">Agora</span>' : '',
        isLate ? '<span class="badge b-red">Atrasada</span>' : '',
        conflicts.has(b.id) ? '<span class="badge b-yellow">Conflito de horário</span>' : '',
        outside && !D.blockDone(b) ? '<span class="badge b-yellow">Fora do expediente</span>' : '',
        b.occurrenceId ? '<span class="badge b-red">Imprevisto</span>' : '',
        b.fixed ? '<span class="badge">Horário fixo</span>' : '',
      ].join('');
      if (D.isBreak(b)) {
        return `<div class="blk blk-break" style="--c:${c.color}"><div class="blk-time"><strong>${b.start}</strong><span>${b.end}</span></div><div class="blk-body"><span class="blk-title">${U.esc(b.title)}</span></div><div class="blk-actions"><button class="icon-btn" data-act="agEdit" data-id="${b.id}" title="Editar">${U.icon('edit', 16)}</button></div></div>`;
      }
      return `<div class="blk st-${b.status} ${isLate ? 'late' : ''} ${isNow ? 'now' : ''}" style="--c:${c.color}">
        <div class="blk-time"><strong>${b.start}</strong><span>${b.end}</span><small>${U.fmtDur(dur)}</small></div>
        <div class="blk-body" data-act="agEdit" data-id="${b.id}">
          <div class="blk-head"><span class="blk-title">${U.esc(b.title)}</span>${badges}</div>
          <div class="blk-meta">${H.cat(b.category)} ${H.prio(b.priority)} ${H.status(b.status)}</div>
          ${b.notes ? `<p class="blk-notes">${U.esc(b.notes)}</p>` : ''}
        </div>
        <div class="blk-actions">
          ${b.status === 'concluida'
            ? `<button class="icon-btn" data-act="agStatus" data-id="${b.id}" data-s="pendente" title="Reabrir">${U.icon('undo', 16)}</button>`
            : `<button class="icon-btn ok" data-act="agStatus" data-id="${b.id}" data-s="concluida" title="Concluir">${U.icon('check', 16)}</button>
               ${b.status !== 'andamento' ? `<button class="icon-btn info" data-act="agStatus" data-id="${b.id}" data-s="andamento" title="Iniciar (em andamento)">${U.icon('play', 14)}</button>` : ''}`}
          <button class="icon-btn" data-act="agMore" data-id="${b.id}" title="Mais opções">${U.icon('more', 16)}</button>
        </div>
      </div>`;
    };

    return `
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" data-act="agShift" data-n="-1" title="Dia anterior">${U.icon('left')}</button>
        <input type="date" value="${k}" data-change="agDate" aria-label="Data">
        <button class="icon-btn" data-act="agShift" data-n="1" title="Próximo dia">${U.icon('right')}</button>
        ${k !== t ? '<button class="btn sm ghost" data-act="agShift" data-n="0">Hoje</button>' : ''}
      </div>
      <span class="grow"></span>
      <button class="btn ghost" data-act="agMenu">${U.icon('more')} Reorganizar</button>
      <button class="btn warn" data-act="agImprevisto">${U.icon('alert')} Imprevisto</button>
      <button class="btn primary" data-act="agNew">${U.icon('plus')} Nova atividade</button>
    </div>

    <div class="card day-head">
      <div>
        <h2>${U.fmtLong(k)}</h2>
        <p class="muted">${D.isWorkday(k) ? (focus ? `Foco do dia: <strong>${U.esc(focus.title)}</strong>` : 'Dia útil') : 'Dia não útil (folga) — você ainda pode adicionar atividades.'}${S.days[k] ? '' : (blocks.length ? ' · Rotina padrão' : '')}</p>
      </div>
      <div class="day-prog">
        ${H.bar(prog.pct, 'var(--green)')}
        <div class="day-counts"><span>${prog.pct === null ? '—' : prog.pct + '%'} concluído</span><span class="c-green">${counts('concluida')} concluídas</span><span class="c-blue">${counts('andamento')} em andamento</span><span class="c-gray">${counts('pendente')} pendentes</span>${late.length ? `<span class="c-red">${late.length} atrasadas</span>` : ''}</div>
      </div>
    </div>

    ${late.length && k <= t ? `<div class="alert a-red">${U.icon('alert')} <span>${U.plural(late.length, 'atividade atrasada', 'atividades atrasadas')}. Use <strong>Reorganizar</strong> para remanejá-las ou o menu ⋯ de cada uma.</span></div>` : ''}
    ${occ.length ? `<div class="alert a-yellow">${U.icon('alert')} <span>${U.plural(occ.length, 'imprevisto aberto', 'imprevistos abertos')} sem horário na agenda.</span> <a class="link" href="#imprevistos">Ver imprevistos</a></div>` : ''}

    <div class="timeline">
      ${blocks.length ? blocks.map(row).join('') : H.empty('Nenhuma atividade neste dia.', '<button class="btn sm primary" data-act="agNew">Adicionar atividade</button>')}
    </div>
    <p class="muted small mt">Dica: clique em uma atividade para editar horário, prioridade e observações. Ao alterar um horário, você pode deslocar automaticamente as atividades seguintes, sem mexer no intervalo.</p>`;
  },
};

const Agenda = {
  day() { return App.ui.agendaDate || U.today(); },
  blockFields(b = {}, isNew) {
    const fields = [
      { name: 'title', label: 'Atividade', required: true, value: b.title },
      { name: 'start', label: 'Início', type: 'time', required: true, value: b.start, half: true },
      { name: 'end', label: 'Fim', type: 'time', required: true, value: b.end, half: true },
      { name: 'category', label: 'Categoria', type: 'select', options: H.catOptions(), value: b.category, half: true },
      { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: b.priority || 'media', half: true },
      { name: 'status', label: 'Status', type: 'select', options: H.statusOptions(), value: b.status || 'pendente', half: true },
      { name: 'fixed', label: 'Horário fixo (não é deslocado na reorganização)', type: 'checkbox', value: b.fixed, half: true },
      { name: 'notes', label: 'Observações', type: 'textarea', value: b.notes },
      { name: 'reflow', label: 'Se houver sobreposição, deslocar as atividades seguintes (mantém o intervalo e a ordem)', type: 'checkbox', value: true },
    ];
    if (!isNew && b.routineId) fields.push({ name: 'applyRoutine', label: 'Aplicar também à rotina padrão (dias futuros ainda não alterados)', type: 'checkbox', value: false });
    return fields;
  },
  validateTimes(v) { if (U.toMin(v.end) <= U.toMin(v.start)) return 'O horário de fim deve ser depois do início.'; },
  afterReflow(k, moved) {
    const over = D.overflowCount(k);
    if (over) UI.toast(`${U.plural(over, 'atividade')} ${over > 1 ? 'passaram' : 'passou'} do horário de saída. Considere movê-las para o próximo dia útil.`, 'warn');
    else if (moved) UI.toast(`${U.plural(moved, 'atividade deslocada', 'atividades deslocadas')}.`);
  },
  scheduleDialog(occ) {
    const t = U.today();
    let date = Agenda.day() >= t ? Agenda.day() : t;
    let start = U.fromMin(Math.ceil(U.nowMin() / 5) * 5);
    if (date !== t || U.toMin(start) < U.toMin(S.settings.workStart)) start = S.settings.workStart;
    if (date === t && U.toMin(start) >= U.toMin(S.settings.workEnd)) { date = D.nextWorkday(t); start = S.settings.workStart; }
    UI.form({
      title: 'Encaixar imprevisto na agenda',
      submitLabel: 'Encaixar',
      fields: [
        { type: 'html', html: `<div class="alert a-red">${U.icon('alert')} <strong>${U.esc(occ.title)}</strong></div>` },
        { name: 'date', label: 'Data', type: 'date', value: date, required: true, half: true },
        { name: 'start', label: 'Início', type: 'time', value: start, required: true, half: true },
        { name: 'duration', label: 'Duração (minutos)', type: 'number', value: 30, min: 5, step: 5, required: true, half: true },
        { name: 'mode', label: 'Como reorganizar o dia', type: 'radio', value: 'deslocar', options: [['deslocar', 'Deslocar as atividades seguintes (mantém a ordem e o intervalo)'], ['encaixar', 'Apenas encaixar (as demais ficam como estão; pode gerar conflito)']] },
      ],
      validate: v => (!v.duration || v.duration < 5) ? 'Informe uma duração de pelo menos 5 minutos.' : null,
      onSubmit(v) {
        if (occ.scheduled) { const old = S.days[occ.scheduled.date]; if (old) S.days[occ.scheduled.date] = old.filter(b => b.id !== occ.scheduled.blockId); }
        const day = D.ensureDay(v.date);
        const b = { id: U.uid(), start: v.start, end: U.fromMin(U.toMin(v.start) + v.duration), title: 'Imprevisto: ' + occ.title, category: 'imprevistos', priority: occ.priority, status: 'pendente', notes: occ.description || '', fixed: false, occurrenceId: occ.id, demo: occ.demo || undefined };
        day.push(b);
        occ.scheduled = { date: v.date, blockId: b.id };
        let moved = 0;
        if (v.mode === 'deslocar') moved = D.reflow(v.date, b.id);
        commit();
        Agenda.afterReflow(v.date, moved);
        UI.toast(`Encaixado em ${U.fmtShort(v.date)} às ${v.start}.`, 'ok', { label: 'Ver agenda', onClick: () => { App.ui.agendaDate = v.date; location.hash = '#agenda'; App.render(); } });
      },
    });
  },
  moveDialog(k, b) {
    UI.form({
      title: 'Mover atividade para outra data',
      submitLabel: 'Mover',
      fields: [
        { type: 'html', html: `<p><strong>${U.esc(b.title)}</strong> · ${b.start}–${b.end}</p>` },
        { name: 'date', label: 'Nova data', type: 'date', value: D.nextWorkday(k), required: true, half: true },
        { name: 'start', label: 'Novo início', type: 'time', value: b.start, required: true, half: true },
        { name: 'reflow', label: 'Deslocar as atividades seguintes no dia de destino, se houver sobreposição', type: 'checkbox', value: false },
      ],
      validate: v => v.date === k ? 'Escolha uma data diferente (para mudar só o horário, use Editar).' : null,
      onSubmit(v) {
        const nb = D.moveBlock(k, b.id, v.date, v.start);
        let moved = 0;
        if (nb && v.reflow) moved = D.reflow(v.date, nb.id);
        commit();
        Agenda.afterReflow(v.date, moved);
        UI.toast(`Atividade movida para ${U.fmtShort(v.date)}.`);
      },
    });
  },
};

Object.assign(Actions, {
  agShift({ n }) { n = Number(n); App.ui.agendaDate = n === 0 ? U.today() : U.addDays(Agenda.day(), n); App.render(); },
  agDate(_, el) { if (el.value) { App.ui.agendaDate = el.value; App.render(); } },
  agStatus({ id, s }) {
    const k = Agenda.day(); const b = D.findBlock(k, id); if (!b) return;
    b.status = s;
    if (s === 'andamento') D.ensureDay(k).forEach(x => { if (x !== b && x.status === 'andamento' && !D.isBreak(x)) x.status = 'pendente'; });
    commit();
  },
  agNew() {
    const k = Agenda.day();
    const bl = D.dayBlocks(k);
    const start = k === U.today() ? U.fromMin(Math.ceil(U.nowMin() / 15) * 15) : S.settings.workStart;
    UI.form({
      title: `Nova atividade — ${U.fmtDate(k)}`,
      fields: Agenda.blockFields({ start, end: U.fromMin(U.toMin(start) + 30), category: 'administrativo' }, true),
      validate: Agenda.validateTimes,
      onSubmit(v) {
        const b = { id: U.uid(), title: v.title, start: v.start, end: v.end, category: v.category, priority: v.priority, status: v.status, fixed: v.fixed, notes: v.notes };
        D.ensureDay(k).push(b);
        const moved = v.reflow && bl.length ? D.reflow(k, b.id) : 0;
        commit(); Agenda.afterReflow(k, moved);
        UI.toast('Atividade adicionada.');
      },
    });
  },
  agEdit({ id }) {
    const k = Agenda.day();
    const cur = D.dayBlocks(k).find(b => b.id === id); if (!cur) return;
    UI.form({
      title: 'Editar atividade',
      fields: Agenda.blockFields(cur, false),
      validate: Agenda.validateTimes,
      extra: [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); Actions.agDelete({ id }); } }],
      onSubmit(v) {
        const b = D.findBlock(k, id);
        const timeChanged = v.start !== b.start || v.end !== b.end;
        Object.assign(b, { title: v.title, start: v.start, end: v.end, category: v.category, priority: v.priority, status: v.status, fixed: v.fixed, notes: v.notes });
        if (v.applyRoutine && b.routineId) {
          const r = S.routine.find(x => x.id === b.routineId);
          if (r) Object.assign(r, { title: v.title, start: v.start, end: v.end, category: v.category, priority: v.priority, fixed: v.fixed, notes: v.notes });
        }
        const moved = timeChanged && v.reflow ? D.reflow(k, b.id) : 0;
        if (b.occurrenceId && v.status === 'concluida') { const o = S.occurrences.find(x => x.id === b.occurrenceId); if (o && OPEN(o.status)) UI.toast('Lembre-se de atualizar o status do imprevisto, se ele foi resolvido.', 'warn'); }
        commit(); Agenda.afterReflow(k, moved);
      },
    });
  },
  agDelete({ id }) {
    const k = Agenda.day();
    const b = D.dayBlocks(k).find(x => x.id === id); if (!b) return;
    UI.confirm(`Excluir a atividade <strong>${U.esc(b.title)}</strong> deste dia?${b.routineId ? '<br><small class="muted">Ela continua na rotina padrão dos outros dias.</small>' : ''}`, () => {
      const arr = D.ensureDay(k); const i = arr.findIndex(x => x.id === id);
      const [removed] = arr.splice(i, 1);
      if (removed.occurrenceId) { const o = S.occurrences.find(x => x.id === removed.occurrenceId); if (o) o.scheduled = null; }
      commit();
      UI.toast('Atividade excluída.', 'ok', { label: 'Desfazer', onClick: () => { D.ensureDay(k).push(removed); if (removed.occurrenceId) { const o = S.occurrences.find(x => x.id === removed.occurrenceId); if (o) o.scheduled = { date: k, blockId: removed.id }; } commit(); } });
    }, { danger: true, okLabel: 'Excluir' });
  },
  agMore({ id }) {
    const k = Agenda.day();
    const b = D.dayBlocks(k).find(x => x.id === id); if (!b) return;
    const delay = min => () => {
      const x = D.findBlock(k, id);
      const s = U.toMin(x.start) + min, e = U.toMin(x.end) + min;
      if (e > 1439) { UI.toast('Não é possível adiar além do fim do dia.', 'error'); return; }
      x.start = U.fromMin(s); x.end = U.fromMin(e);
      const moved = D.reflow(k, id); commit(); Agenda.afterReflow(k, moved);
    };
    UI.sheet(b.title, [
      { label: 'Editar', icon: 'edit', onClick: () => Actions.agEdit({ id }) },
      { label: 'Marcar como pendente', icon: 'undo', onClick: () => Actions.agStatus({ id, s: 'pendente' }) },
      { label: 'Cancelar atividade', icon: 'x', onClick: () => Actions.agStatus({ id, s: 'cancelada' }) },
      { sep: true },
      { label: 'Adiar 15 minutos', hint: 'Desloca as seguintes, preservando o intervalo', icon: 'clock', onClick: delay(15) },
      { label: 'Adiar 30 minutos', hint: 'Desloca as seguintes, preservando o intervalo', icon: 'clock', onClick: delay(30) },
      { label: 'Mover para o próximo dia útil', hint: U.fmtLong(D.nextWorkday(k)), icon: 'arrow', onClick: () => { D.moveBlock(k, id, D.nextWorkday(k)); commit(); UI.toast('Atividade movida para o próximo dia útil.'); } },
      { label: 'Mover para outra data…', icon: 'calendar', onClick: () => Agenda.moveDialog(k, b) },
      { label: 'Duplicar', icon: 'plus', onClick: () => { const arr = D.ensureDay(k); const x = arr.find(y => y.id === id); arr.push({ ...x, id: U.uid(), routineId: null, occurrenceId: null, status: 'pendente' }); commit(); } },
      { sep: true },
      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => Actions.agDelete({ id }) },
    ]);
  },
  agMenu() {
    const k = Agenda.day();
    const late = D.dayBlocks(k).filter(b => D.blockLate(b, k));
    UI.sheet('Reorganizar o dia', [
      { label: `Mover atrasadas para o próximo dia útil (${late.length})`, hint: 'Mantém o horário original no novo dia', icon: 'arrow', onClick: () => { if (!late.length) return UI.toast('Não há atividades atrasadas.', 'warn'); const to = D.nextWorkday(k); late.forEach(b => D.moveBlock(k, b.id, to)); commit(); UI.toast(`${U.plural(late.length, 'atividade movida', 'atividades movidas')} para ${U.fmtShort(to)}.`); } },
      { label: 'Encaixar um imprevisto', icon: 'alert', onClick: () => Actions.agImprevisto() },
      { sep: true },
      { label: 'Restaurar rotina padrão neste dia', hint: 'Descarta as alterações feitas neste dia', icon: 'undo', danger: true, onClick: () => UI.confirm('Restaurar a rotina padrão? As alterações e status deste dia serão perdidos.', () => { delete S.days[k]; S.occurrences.forEach(o => { if (o.scheduled && o.scheduled.date === k) o.scheduled = null; }); commit(); }, { danger: true, okLabel: 'Restaurar' }) },
      { label: 'Limpar todas as atividades do dia', icon: 'trash', danger: true, onClick: () => UI.confirm('Remover todas as atividades deste dia?', () => { S.days[k] = []; S.occurrences.forEach(o => { if (o.scheduled && o.scheduled.date === k) o.scheduled = null; }); commit(); }, { danger: true, okLabel: 'Limpar' }) },
    ]);
  },
  agImprevisto() { Occ.form(null, { scheduleAfter: true }); },
});
