'use strict';
/* Agenda — uma tela só: calendário compacto em cima (semana; "Ver mês" abre o mês inteiro) e, embaixo,
   o dia escolhido numa lista única por horário: atividades da rotina + reuniões, compromissos e prazos. */
Views.agenda = {
  title: 'Agenda', icon: 'clock', nav: 'Agenda',
  fab: () => ({ act: 'quickAdd', label: 'Adicionar neste dia', data: { k: Agenda.day(), from: 'agenda' } }),
  render() {
    const k = Agenda.day(), t = U.today();
    Cal.sync('agenda', k);
    const blocks = D.dayBlocks(k);
    const conflicts = D.conflicts(blocks);
    const prog = D.progress(k);
    const late = blocks.filter(b => D.blockLate(b, k));
    const items = Cal.itemsOn(k);
    const d = U.parse(k), wd = U.WD[d.getDay()];
    const when = k === t ? 'Hoje' : k === U.addDays(t, 1) ? 'Amanhã' : k === U.addDays(t, -1) ? 'Ontem' : '';

    const row = b => {
      const c = D.cat(b.category);
      const isLate = D.blockLate(b, k), isNow = D.blockNow(b, k);
      if (D.isBreak(b)) {
        return `<div class="blk blk-break" style="--c:${c.color}"><div class="blk-time"><strong>${b.start}</strong><span>${b.end}</span></div><div class="blk-body" data-act="agEdit" data-id="${b.id}"><span class="blk-title">${U.esc(b.title)}</span></div></div>`;
      }
      const badges = [
        isNow ? '<span class="badge b-blue">Agora</span>' : '',
        isLate ? '<span class="badge b-red">Atrasada</span>' : '',
        conflicts.has(b.id) ? '<span class="badge b-yellow">Conflito</span>' : '',
        b.status === 'andamento' && !isNow ? H.status('andamento') : '',
      ].join('');
      return `<div class="blk st-${b.status} ${isLate ? 'late' : ''} ${isNow ? 'now' : ''}" style="--c:${c.color}">
        <div class="blk-time"><strong>${b.start}</strong><span>${b.end}</span></div>
        <div class="blk-body" data-act="agEdit" data-id="${b.id}">
          <div class="blk-head"><span class="blk-title">${U.esc(b.title)}</span>${badges}</div>
          ${b.notes ? `<p class="blk-notes">${U.esc(b.notes)}</p>` : ''}
        </div>
        <div class="blk-actions">
          ${b.status === 'concluida'
            ? `<button class="icon-btn" data-act="agStatus" data-id="${b.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir">${U.icon('undo', 16)}</button>`
            : `<button class="icon-btn ok" data-act="agStatus" data-id="${b.id}" data-s="concluida" title="Concluir" aria-label="Concluir">${U.icon('check', 16)}</button>`}
          <button class="icon-btn" data-act="agMore" data-id="${b.id}" title="Mais opções" aria-label="Mais opções">${U.icon('more', 16)}</button>
        </div>
      </div>`;
    };
    // Reuniões, compromissos e prazos entram na mesma lista, pela hora
    const item = i => `<div class="blk blk-it ${i.done ? 'st-concluida' : ''} ${i.late ? 'late' : ''}" style="--c:var(--t-${i.type})" role="button" tabindex="0" data-act="${i.act}" data-id="${i.id}">
        <div class="blk-time"><strong>${i.time || (i.type === 'reuniao' || i.type === 'evento' ? 'Dia' : 'Prazo')}</strong>${i.time ? '' : `<span>${i.type === 'reuniao' || i.type === 'evento' ? 'todo' : 'do dia'}</span>`}</div>
        <div class="blk-body"><div class="blk-head"><span class="blk-title">${U.esc(i.label)}${H.demo(i)}</span></div>
          <small class="blk-kind">${Cal.TYPES[i.type]}${i.done ? (i.type === 'reuniao' ? ' · registrada' : ' · concluído') : i.late ? ' · <span class="c-red">atrasado</span>' : ''}</small></div>
        <div class="blk-actions">${U.icon('right', 16)}</div></div>`;
    const list = [
      ...items.filter(i => !i.time).map(i => ({ t: '', h: item(i) })),
      ...blocks.map(b => ({ t: b.start, h: row(b) })),
      ...items.filter(i => i.time).map(i => ({ t: i.time, h: item(i) })),
    ].map((x, n) => ({ ...x, n })).sort((a, b) => a.t.localeCompare(b.t) || a.n - b.n);

    const summary = !blocks.length ? (D.isWorkday(k) ? 'Nenhuma atividade na rotina deste dia' : 'Dia de folga')
      : `${prog.done} de ${U.plural(prog.total, 'atividade')} concluída${prog.done === 1 ? '' : 's'}${late.length ? ` · <span class="c-red">${late.length} atrasada${late.length > 1 ? 's' : ''}</span>` : ''}`;

    return `
    <section class="card cal-card ag-cal">${Cal.render('agenda')}</section>

    <section class="ag-day">
      <div class="ag-head">
        <div class="ag-head-t">
          <small class="muted">${when ? `${when} · ` : ''}${wd}</small>
          <h2>${d.getDate()} de ${U.MONTHS[d.getMonth()].toLowerCase()}</h2>
          <p class="muted small">${summary}</p>
        </div>
        <span class="grow"></span>
        ${blocks.length ? `<button class="btn sm ghost" data-act="agMenu" aria-label="Reorganizar o dia">${U.icon('more', 16)} Reorganizar</button>` : ''}
      </div>
      ${blocks.length ? H.dayRail(k, { link: false }) : ''}
      ${late.length && k <= t ? `<div class="alert a-red">${U.icon('alert')} <span>${U.plural(late.length, 'atividade passou', 'atividades passaram')} do horário. Use <strong>Reorganizar</strong> para remanejar.</span></div>` : ''}
      <div class="timeline">
        ${list.length ? list.map(x => x.h).join('') : H.empty(D.isWorkday(k) ? 'Nada marcado para este dia.' : 'Dia de folga. Nada marcado.', `<small class="muted">Toque em <strong>+</strong> para adicionar.${S.routine.length ? '' : ' Para a agenda se montar sozinha todo dia, cadastre sua rotina em <a class="link" href="#config" data-act="cfgJump" data-id="rotina">Configurações → Rotina padrão</a>.'}</small>`)}
      </div>
    </section>`;
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
  agStatus({ id, s }) {
    const k = Agenda.day(); const b = D.findBlock(k, id); if (!b) return;
    b.status = s;
    if (s === 'andamento') D.ensureDay(k).forEach(x => { if (x !== b && x.status === 'andamento' && !D.isBreak(x)) x.status = 'pendente'; });
    commit();
  },
  agNew(d = {}) {
    const k = Agenda.day();
    const bl = D.dayBlocks(k);
    const start = k === U.today() ? U.fromMin(Math.ceil(U.nowMin() / 15) * 15) : S.settings.workStart;
    UI.form({
      title: `Nova atividade — ${U.fmtDate(k)}`,
      fields: Agenda.blockFields({ title: d.title || '', start, end: U.fromMin(U.toMin(start) + 30), category: 'administrativo' }, true),
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
      b.status === 'andamento' ? { label: 'Marcar como pendente', icon: 'undo', onClick: () => Actions.agStatus({ id, s: 'pendente' }) }
        : { label: 'Começar agora', hint: 'Marca como em andamento', icon: 'play', onClick: () => Actions.agStatus({ id, s: 'andamento' }) },
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
      { label: 'Reorganizar meu dia', hint: 'Refaz os horários do que falta, em sequência (com prévia)', icon: 'timeline', onClick: () => Replan.open(k) },
      { label: `Mover atrasadas para o próximo dia útil (${late.length})`, hint: 'Mantém o horário original no novo dia', icon: 'arrow', onClick: () => { if (!late.length) return UI.toast('Não há atividades atrasadas.', 'warn'); const to = D.nextWorkday(k); late.forEach(b => D.moveBlock(k, b.id, to)); commit(); UI.toast(`${U.plural(late.length, 'atividade movida', 'atividades movidas')} para ${U.fmtShort(to)}.`); } },
      { label: 'Encaixar um imprevisto', icon: 'alert', onClick: () => Actions.agImprevisto() },
      ...(k === U.today() ? [{ label: 'Abrir o dia', hint: 'O que ficou de ontem e as 3 prioridades', icon: 'spark', onClick: () => Ritual.abrir() },
        { label: 'Fechar o dia', hint: 'O que não deu tempo vai para o lugar certo', icon: 'check', onClick: () => Ritual.fechar() }] : []),
      { sep: true },
      { label: 'Restaurar rotina padrão neste dia', hint: 'Descarta as alterações feitas neste dia', icon: 'undo', danger: true, onClick: () => UI.confirm('Restaurar a rotina padrão? As alterações e status deste dia serão perdidos.', () => { delete S.days[k]; S.occurrences.forEach(o => { if (o.scheduled && o.scheduled.date === k) o.scheduled = null; }); commit(); }, { danger: true, okLabel: 'Restaurar' }) },
      { label: 'Limpar todas as atividades do dia', icon: 'trash', danger: true, onClick: () => UI.confirm('Remover todas as atividades deste dia?', () => { S.days[k] = []; S.occurrences.forEach(o => { if (o.scheduled && o.scheduled.date === k) o.scheduled = null; }); commit(); }, { danger: true, okLabel: 'Limpar' }) },
    ]);
  },
  agImprevisto() { Occ.form(null, { scheduleAfter: true }); },
  /* Intervalo flexível: marca o almoço agora (ou no horário escolhido) e empurra o que vem depois */
  agBreak() {
    const k = Agenda.day(), t = U.today();
    const start = k === t ? U.fromMin(Math.round(U.nowMin() / 5) * 5) : S.settings.breakStart || '12:00';
    UI.form({
      title: 'Intervalo',
      submitLabel: 'Marcar intervalo',
      fields: [
        { name: 'start', label: 'Início', type: 'time', value: start, required: true, half: true },
        { name: 'dur', label: 'Duração', type: 'select', options: [[30, '30 min'], [45, '45 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas']], value: S.settings.breakDur || 60, half: true },
        { name: 'reflow', label: 'Empurrar as atividades seguintes para depois do intervalo', type: 'checkbox', value: true },
      ],
      onSubmit(v) {
        const s = U.toMin(v.start), end = U.fromMin(s + Number(v.dur));
        const day = D.ensureDay(k);
        const b = { id: U.uid(), title: 'Intervalo', start: v.start, end, category: 'intervalo', priority: 'baixa', status: 'pendente', notes: '', fixed: true };
        day.push(b);
        // Atividade em andamento que atravessa o intervalo é encurtada até o início dele
        const moved = v.reflow ? D.reflow(k, b.id) : 0;
        commit();
        UI.toast(`Intervalo das ${v.start} às ${end}.${moved ? ` ${U.plural(moved, 'atividade deslocada', 'atividades deslocadas')}.` : ''}`);
        if (moved) Agenda.afterReflow(k, 0);
      },
    });
  },
});
