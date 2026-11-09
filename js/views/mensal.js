'use strict';
/* Planejamento mensal — 4 ciclos + calendário com prazos e compromissos */
const cycleOf = k => { const d = U.parse(k).getDate(); return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4; };
const CYCLE_COLORS = ['#0284c7', '#7c3aed', '#0d9488', '#d97706'];

const Month = {
  itemsOn(k) {
    const out = [];
    S.events.filter(e => e.date === k).forEach(e => out.push({ type: 'evento', label: e.title, time: e.time, id: e.id, demo: e.demo }));
    S.tasks.filter(x => x.dueDate === k && x.status !== 'cancelada').forEach(x => out.push({ type: 'tarefa', label: x.title, time: x.dueTime, done: x.status === 'concluida', late: D.taskLate(x), id: x.id, demo: x.demo }));
    S.projects.filter(p => p.dueDate === k && p.status !== 'cancelado').forEach(p => out.push({ type: 'projeto', label: p.name, done: p.status === 'concluido', late: D.projectLate(p), id: p.id, demo: p.demo }));
    S.occurrences.filter(o => o.dueDate === k && o.status !== 'cancelada').forEach(o => out.push({ type: 'imprevisto', label: o.title, time: o.dueTime, done: o.status === 'concluida', late: D.occLate(o), id: o.id, demo: o.demo }));
    return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  },
  TYPE: { evento: 'Compromisso', tarefa: 'Prazo de tarefa', projeto: 'Prazo de projeto', imprevisto: 'Prazo de imprevisto' },
};

Views.mensal = {
  title: 'Planejamento mensal', icon: 'calendar', nav: 'Planejamento mensal',
  render() {
    const mk = App.ui.month || U.monthKey(U.today());
    const t = U.today();
    const chk = S.monthly.checks[mk] || {};
    const curCycle = U.monthKey(t) === mk ? cycleOf(t) : null;

    const cycles = S.monthly.cycles.map((c, i) => {
      const dn = c.items.filter(x => chk[x.id]).length;
      const p = c.items.length ? Math.round(dn / c.items.length * 100) : null;
      const range = [[1, 7], [8, 14], [15, 21], [22, Number(U.monthEnd(mk).slice(8))]][i];
      return `<div class="cycle card ${curCycle === c.n ? 'is-current' : ''}" style="--cc:${CYCLE_COLORS[i]}">
        <div class="wk-h"><div><small>Semana ${c.n} · dias ${range[0]}–${range[1]}</small><h3>${U.esc(c.title)}</h3></div>
        <button class="icon-btn" data-act="mcEdit" data-n="${c.n}" title="Editar ciclo">${U.icon('edit', 15)}</button></div>
        ${H.bar(p, 'var(--cc)')}<small class="muted">${c.items.length ? `${dn}/${c.items.length}` : 'Sem itens'}${curCycle === c.n ? ' · <strong>ciclo atual</strong>' : ''}</small>
        <ul class="checklist">${c.items.map(x => `<li><label class="check"><input type="checkbox" data-change="mcCheck" data-id="${x.id}" ${chk[x.id] ? 'checked' : ''}><span>${U.esc(x.text)}</span></label><button class="icon-btn xs" data-act="mcItemEdit" data-n="${c.n}" data-id="${x.id}">${U.icon('edit', 13)}</button></li>`).join('')}</ul>
        <button class="btn sm ghost add-item" data-act="mcItemAdd" data-n="${c.n}">${U.icon('plus', 15)} Adicionar item</button>
      </div>`;
    }).join('');

    // Calendário (semana começando no domingo)
    const first = U.monthStart(mk), last = U.monthEnd(mk);
    const gridStart = U.addDays(first, -U.weekday(first));
    const cells = [];
    for (let k = gridStart; cells.length < 42; k = U.addDays(k, 1)) { cells.push(k); if (cells.length >= 35 && k >= last && U.weekday(k) === 6) break; }
    const cal = cells.map(k => {
      const inMonth = U.monthKey(k) === mk;
      const items = inMonth ? Month.itemsOn(k) : [];
      const hasAgenda = !!(S.days[k] && S.days[k].length);
      const cyc = inMonth ? cycleOf(k) : 0;
      return `<button class="cal-cell ${inMonth ? '' : 'out'} ${k === t ? 'today' : ''} ${D.isWorkday(k) ? '' : 'off'}" data-act="calDay" data-k="${k}" ${inMonth ? `style="--cc:${CYCLE_COLORS[cyc - 1]}"` : ''}>
        <span class="cal-n">${U.parse(k).getDate()}</span>
        ${hasAgenda ? `<span class="cal-ag" title="Agenda do dia com alterações">${D.progress(k).pct ?? 0}%</span>` : ''}
        <span class="cal-items">${items.slice(0, 3).map(i => `<span class="cal-it t-${i.type} ${i.done ? 'done' : ''} ${i.late ? 'late' : ''}">${i.time ? i.time + ' ' : ''}${U.esc(i.label)}</span>`).join('')}${items.length > 3 ? `<span class="cal-more">+${items.length - 3}</span>` : ''}</span>
        ${items.length ? `<span class="cal-dots">${items.slice(0, 4).map(i => `<i class="t-${i.type} ${i.late ? 'late' : ''}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('');

    return `
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" data-act="mShift" data-n="-1">${U.icon('left')}</button>
        <strong class="range-lbl">${U.fmtMonth(mk)}</strong>
        <button class="icon-btn" data-act="mShift" data-n="1">${U.icon('right')}</button>
        ${mk !== U.monthKey(t) ? '<button class="btn sm ghost" data-act="mShift" data-n="0">Mês atual</button>' : ''}
      </div>
      <span class="grow"></span>
      <button class="btn primary" data-act="evNew">${U.icon('plus')} Novo compromisso</button>
    </div>
    <div class="cycles">${cycles}</div>
    <div class="card">
      <div class="card-h"><h3>${U.icon('calendar')} Calendário</h3>
        <div class="legend"><span><i class="t-evento"></i>Compromisso</span><span><i class="t-tarefa"></i>Tarefa</span><span><i class="t-projeto"></i>Projeto</span><span><i class="t-imprevisto"></i>Imprevisto</span></div></div>
      <div class="cal">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-wd">${d}</div>`).join('')}${cal}</div>
      <p class="muted small mt">A faixa colorida no topo de cada dia indica o ciclo do mês. Clique em um dia para ver detalhes, adicionar compromissos ou abrir a agenda.</p>
    </div>`;
  },
};

const Events = {
  form(e, date) {
    const isNew = !e;
    e = e || { date: date || U.today() };
    UI.form({
      title: isNew ? 'Novo compromisso' : 'Editar compromisso',
      fields: [
        { name: 'title', label: 'Compromisso', required: true, value: e.title },
        { name: 'date', label: 'Data', type: 'date', required: true, value: e.date, half: true },
        { name: 'time', label: 'Horário', type: 'time', value: e.time, half: true },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: e.notes },
        ...(isNew ? [{ name: 'toAgenda', label: 'Adicionar também na agenda do dia (30 min)', type: 'checkbox', value: false }] : []),
      ],
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); S.events = S.events.filter(x => x.id !== e.id); commit(); UI.toast('Compromisso excluído.'); } }],
      validate: v => v.toAgenda && !v.time ? 'Informe o horário para adicionar à agenda.' : null,
      onSubmit(v) {
        const { toAgenda, ...data } = v;
        if (isNew) S.events.push({ id: U.uid(), ...data }); else Object.assign(e, data);
        if (toAgenda) D.ensureDay(v.date).push({ id: U.uid(), title: v.title, start: v.time, end: U.fromMin(U.toMin(v.time) + 30), category: 'administrativo', priority: 'media', status: 'pendente', notes: v.notes, fixed: true });
        commit(); UI.toast('Compromisso salvo.');
      },
    });
  },
};

Object.assign(Actions, {
  mShift({ n }) { n = Number(n); App.ui.month = n === 0 ? U.monthKey(U.today()) : U.addMonths(App.ui.month || U.monthKey(U.today()), n); App.render(); },
  mcCheck({ id }, el) {
    const mk = App.ui.month || U.monthKey(U.today());
    const c = S.monthly.checks[mk] = S.monthly.checks[mk] || {};
    if (el.checked) c[id] = true; else delete c[id];
    commit();
  },
  mcEdit({ n }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n));
    UI.form({ title: `Ciclo da semana ${n}`, fields: [{ name: 'title', label: 'Foco do ciclo', required: true, value: c.title }], onSubmit(v) { c.title = v.title; commit(); } });
  },
  mcItemAdd({ n }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n));
    UI.form({ title: `Novo item — Semana ${n}`, fields: [{ name: 'text', label: 'Item', required: true }], onSubmit(v) { c.items.push({ id: U.uid(), text: v.text }); commit(); } });
  },
  mcItemEdit({ n, id }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n)); const it = c.items.find(i => i.id === id);
    UI.form({
      title: 'Editar item', fields: [{ name: 'text', label: 'Item', required: true, value: it.text }],
      extra: [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); c.items = c.items.filter(i => i.id !== id); commit(); } }],
      onSubmit(v) { it.text = v.text; commit(); },
    });
  },
  evNew() { Events.form(null); },
  calDay({ k }) {
    const items = Month.itemsOn(k);
    const ag = D.dayBlocks(k);
    const prog = D.progress(k);
    const m = UI.modal({
      title: U.fmtLong(k),
      body: `
        <p class="muted">${D.isWorkday(k) ? `Dia útil · Ciclo ${cycleOf(k)}: ${U.esc(S.monthly.cycles[cycleOf(k) - 1]?.title || '')}` : 'Dia não útil'}</p>
        <h4>Prazos e compromissos</h4>
        ${items.length ? `<ul class="list">${items.map(i => `<li class="li"><span class="li-time">${i.time || '—'}</span><span class="li-main"><span class="cal-it-dot t-${i.type}"></span>${U.esc(i.label)}${H.demo(i)}</span><small class="muted">${Month.TYPE[i.type]}${i.done ? ' · concluído' : i.late ? ' · <span class="c-red">atrasado</span>' : ''}</small>${i.type === 'evento' ? `<button class="icon-btn xs" data-act="evEdit" data-id="${i.id}">${U.icon('edit', 13)}</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nada programado.</p>'}
        <h4>Agenda</h4>
        <p>${ag.length ? `${ag.length} atividades · ${prog.pct === null ? '—' : prog.pct + '% concluído'}` : 'Sem atividades na agenda.'}</p>`,
      footer: `<button class="btn ghost" data-go>Abrir agenda do dia</button><span class="grow"></span><button class="btn primary" data-new>${U.icon('plus', 15)} Compromisso</button>`,
    });
    m.el.querySelector('[data-go]').onclick = () => { m.close(); App.ui.agendaDate = k; location.hash = '#agenda'; };
    m.el.querySelector('[data-new]').onclick = () => { m.close(); Events.form(null, k); };
    m.el.addEventListener('click', ev => { if (ev.target.closest('[data-act="evEdit"]')) m.close(); });
  },
  evEdit({ id }) { Events.form(S.events.find(e => e.id === id)); },
});
