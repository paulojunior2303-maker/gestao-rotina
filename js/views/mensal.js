'use strict';
/* Planejamento mensal — 4 ciclos + calendário com prazos e compromissos */
const cycleOf = k => { const d = U.parse(k).getDate(); return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4; };
const CYCLE_COLORS = ['var(--cy1)', 'var(--cy2)', 'var(--cy3)', 'var(--cy4)'];

const Month = {
  itemsOn(k) {
    const out = [];
    S.events.filter(e => e.date === k).forEach(e => out.push({ type: 'evento', label: e.title, time: e.time, id: e.id, demo: e.demo, done: !!e.registro }));
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
      return `<div class="cycle card ${curCycle === c.n ? 'is-current' : ''} ${!c.title && !c.items.length ? 'is-empty' : ''}" style="--cc:${CYCLE_COLORS[i]}">
        <div class="wk-h"><div><small>Semana ${c.n}, dias ${range[0]} a ${range[1]}${curCycle === c.n ? ' · agora' : ''}</small><h3>${c.title ? U.esc(c.title) : '<span class="muted">Sem foco definido</span>'}</h3></div>
        <button class="icon-btn" data-act="mcEdit" data-n="${c.n}" title="${c.title ? 'Editar foco' : 'Definir foco'}" aria-label="${c.title ? 'Editar foco' : 'Definir foco'}">${U.icon('edit', 15)}</button></div>
        ${c.items.length ? `${H.bar(p, 'var(--cc)')}<small class="muted">${dn}/${c.items.length} concluídos</small>` : ''}
        <ul class="checklist">${c.items.map(x => `<li><label class="check"><input type="checkbox" data-change="mcCheck" data-id="${x.id}" ${chk[x.id] ? 'checked' : ''}><span>${U.esc(x.text)}</span></label><button class="icon-btn xs" data-act="mcItemEdit" data-n="${c.n}" data-id="${x.id}" title="Editar item">${U.icon('edit', 13)}</button></li>`).join('')}</ul>
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
    <div class="plan-intro">
      <p>O mês é dividido em <strong>4 semanas</strong>. Dê um foco a cada uma e liste as entregas do período. A lista se repete todo mês; as marcações valem só para o mês exibido. Abaixo, o calendário reúne prazos e compromissos.</p>
      <button class="link" data-act="guideOpen" data-id="mensal">Como funciona</button>
    </div>
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" data-act="mShift" data-n="-1" aria-label="Mês anterior">${U.icon('left')}</button>
        <strong class="range-lbl">${U.fmtMonth(mk)}</strong>
        <button class="icon-btn" data-act="mShift" data-n="1" aria-label="Próximo mês">${U.icon('right')}</button>
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
      <p class="muted small mt">A faixa no topo de cada dia indica a semana do mês. Toque em um dia para ver detalhes, criar um compromisso ou abrir a agenda.</p>
    </div>`;
  },
};

const Events = {
  /* Pauta guardada como lista; no formulário, um assunto por linha (mantém os ids dos que já existiam) */
  pautaFromText(txt, old = []) {
    return txt.split('\n').map(l => l.trim()).filter(Boolean).map(text => { const o = old.find(x => x.text === text); return { id: o ? o.id : U.uid(), text }; });
  },
  canRegister(e) { return e.date <= U.today(); },
  form(e, date) {
    const isNew = !e;
    e = e || { date: date || U.today() };
    UI.form({
      title: isNew ? 'Novo compromisso' : 'Editar compromisso',
      fields: [
        { name: 'title', label: 'Compromisso', required: true, value: e.title, placeholder: 'Ex.: Reunião com a equipe' },
        { name: 'date', label: 'Data', type: 'date', required: true, value: e.date, half: true },
        { name: 'time', label: 'Horário', type: 'time', value: e.time, half: true },
        { name: 'pauta', label: 'Pauta (opcional)', type: 'textarea', rows: 3, value: (e.pautas || []).map(x => x.text).join('\n'), placeholder: 'Um assunto por linha', hint: 'Assuntos para tratar. No dia, use “Registrar reunião” para marcar o que foi tratado e anotar o que foi combinado.' },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: e.notes },
        ...(isNew ? [{ name: 'toAgenda', label: 'Adicionar também na agenda do dia (30 min)', type: 'checkbox', value: false }] : []),
      ],
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); S.events = S.events.filter(x => x.id !== e.id); commit(); UI.toast('Compromisso excluído.'); } }],
      validate: v => v.toAgenda && !v.time ? 'Informe o horário para adicionar à agenda.' : null,
      onSubmit(v) {
        const { toAgenda, pauta, ...data } = v;
        data.pautas = Events.pautaFromText(pauta, e.pautas || []);
        if (isNew) S.events.push({ id: U.uid(), ...data }); else Object.assign(e, data);
        if (toAgenda) D.ensureDay(v.date).push({ id: U.uid(), title: v.title, start: v.time, end: U.fromMin(U.toMin(v.time) + 30), category: 'administrativo', priority: 'media', status: 'pendente', notes: v.notes, fixed: true });
        commit(); UI.toast('Compromisso salvo.');
      },
    });
  },

  /* Detalhes do compromisso: pauta, registro da reunião e ações */
  view(e) {
    const r = e.registro, pautas = e.pautas || [];
    const done = id => r && r.tratadas.includes(id);
    const m = UI.modal({
      title: e.title,
      body: `
        <p class="muted">${U.fmtLong(e.date)}${e.time ? `, às ${e.time}` : ''}${H.demo(e)}</p>
        ${e.notes ? `<p class="pre">${U.esc(e.notes)}</p>` : ''}
        ${pautas.length ? `<h4>Pauta</h4><ul class="pauta">${pautas.map(x => `<li class="${r ? (done(x.id) ? 'ok' : 'no') : ''}">${r ? U.icon(done(x.id) ? 'check' : 'x', 15) : '<i></i>'}<span>${U.esc(x.text)}</span></li>`).join('')}</ul>` : ''}
        ${r ? `<h4>Registro da reunião</h4><p class="muted small">Registrada em ${U.fmtDateTime(r.at)}${pautas.length ? `. ${r.tratadas.length} de ${U.plural(pautas.length, 'assunto')} tratados.` : '.'}</p>
          ${r.combinados ? `<p class="ata pre">${U.esc(r.combinados)}</p>` : '<p class="muted">Nada anotado como combinado.</p>'}`
          : Events.canRegister(e) ? `<p class="muted small mt">Depois da reunião, toque em <strong>Registrar reunião</strong> para marcar o que foi tratado e anotar os combinados.</p>` : ''}`,
      footer: `<button class="btn ghost" data-ed>${U.icon('edit', 15)} Editar</button><span class="grow"></span>${Events.canRegister(e) ? `<button class="btn primary" data-reg>${U.icon('check', 15)} ${r ? 'Editar registro' : 'Registrar reunião'}</button>` : ''}`,
    });
    m.el.querySelector('[data-ed]').onclick = () => { m.close(); Events.form(e); };
    const reg = m.el.querySelector('[data-reg]'); if (reg) reg.onclick = () => { m.close(); Events.register(e); };
  },

  /* Registro: o que foi tratado e o que foi combinado (vira tarefa, se quiser) */
  register(e) {
    const r = e.registro || { tratadas: [], combinados: '' };
    const pautas = e.pautas || [];
    UI.form({
      title: 'Registrar reunião',
      submitLabel: 'Salvar registro',
      fields: [
        { type: 'html', html: `<p class="muted small">${U.esc(e.title)}, ${U.fmtShort(e.date)}${e.time ? ' ' + e.time : ''}</p>` },
        ...(pautas.length ? [{ type: 'html', html: '<span class="lbl">Assuntos tratados</span>' }, ...pautas.map(x => ({ name: 'p_' + x.id, label: U.esc(x.text), type: 'checkbox', value: e.registro ? r.tratadas.includes(x.id) : true }))] : []),
        { name: 'combinados', label: 'O que foi combinado', type: 'textarea', rows: 4, value: r.combinados, placeholder: 'Um combinado por linha. Ex.: Carlos envia o relatório até sexta' },
        { name: 'mkTasks', label: 'Criar uma tarefa para cada combinado', type: 'checkbox', value: false, hint: 'As tarefas entram em Tarefas, com o nome da reunião na descrição. Ajuste prazo e responsável depois.' },
      ],
      onSubmit(v) {
        e.registro = { at: new Date().toISOString(), tratadas: pautas.filter(x => v['p_' + x.id]).map(x => x.id), combinados: v.combinados };
        let n = 0;
        if (v.mkTasks) v.combinados.split('\n').map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).forEach(title => {
          n++;
          S.tasks.push({ id: U.uid(), title, description: `Combinado na reunião “${e.title}” (${U.fmtShort(e.date)}).`, category: 'equipe', priority: 'media', status: 'pendente', createdAt: new Date().toISOString(), startDate: U.today(), dueDate: '', dueTime: '', notes: '', completedAt: null });
        });
        commit();
        UI.toast(n ? `Reunião registrada e ${U.plural(n, 'tarefa criada', 'tarefas criadas')}.` : 'Reunião registrada.');
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
    UI.form({ title: `Foco da semana ${n} do mês`, fields: [{ name: 'title', label: 'Foco', value: c.title, placeholder: 'Ex.: Diagnóstico, Equipe, Fechamento…', hint: 'Um tema para essa parte do mês. Pode deixar em branco.' }], onSubmit(v) { c.title = v.title; commit(); } });
  },
  mcItemAdd({ n }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n));
    UI.form({ title: `Novo item da semana ${n}`, fields: [{ name: 'text', label: 'Item', required: true, placeholder: 'Ex.: Fechar relatório do mês' }], onSubmit(v) { c.items.push({ id: U.uid(), text: v.text }); commit(); } });
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
        <p class="muted">${D.isWorkday(k) ? `Dia útil, semana ${cycleOf(k)} do mês${S.monthly.cycles[cycleOf(k) - 1]?.title ? ': ' + U.esc(S.monthly.cycles[cycleOf(k) - 1].title) : ''}` : 'Dia não útil'}</p>
        <h4>Prazos e compromissos</h4>
        ${items.length ? `<ul class="list">${items.map(i => `<li class="li"><span class="li-time">${i.time || '—'}</span><span class="li-main"><span class="cal-it-dot t-${i.type}"></span>${U.esc(i.label)}${H.demo(i)}</span><small class="muted">${Month.TYPE[i.type]}${i.done ? (i.type === 'evento' ? ' · registrado' : ' · concluído') : i.late ? ' · <span class="c-red">atrasado</span>' : ''}</small>${i.type === 'evento' ? `<button class="btn sm" data-act="evView" data-id="${i.id}">Abrir</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nada programado.</p>'}
        <h4>Agenda</h4>
        <p>${ag.length ? `${ag.length} atividades · ${prog.pct === null ? '—' : prog.pct + '% concluído'}` : 'Sem atividades na agenda.'}</p>`,
      footer: `<button class="btn ghost" data-go>Abrir agenda do dia</button><span class="grow"></span><button class="btn primary" data-new>${U.icon('plus', 15)} Compromisso</button>`,
    });
    m.el.querySelector('[data-go]').onclick = () => { m.close(); App.ui.agendaDate = k; location.hash = '#agenda'; };
    m.el.querySelector('[data-new]').onclick = () => { m.close(); Events.form(null, k); };
    m.el.addEventListener('click', ev => { if (ev.target.closest('[data-act="evView"]')) m.close(); });
  },
  evEdit({ id }) { Events.form(S.events.find(e => e.id === id)); },
  evView({ id }) { const e = S.events.find(e => e.id === id); if (e) Events.view(e); },
});
