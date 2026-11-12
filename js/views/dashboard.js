'use strict';
/* Dashboard — centro de controle */
Views.dashboard = {
  title: 'Início', icon: 'dashboard', nav: 'Início',
  fab: () => ({ act: 'quickAdd', label: 'Adicionar', data: { k: Cal.st('home').sel, from: 'home' } }),
  /* Topo da tela inicial: saudação e data no lugar do título (o relógio fica à direita) */
  hero() {
    const h = new Date().getHours(), t = U.today(), d = U.parse(t);
    const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return `<span class="th-greet">${greet}</span><span class="th-date">${U.WD[U.weekday(t)].replace('-feira', '')}, ${d.getDate()} de ${U.MONTHS[d.getMonth()].toLowerCase()}</span>`;
  },
  render() {
    const t = U.today(), nowM = U.nowMin();
    const workday = D.isWorkday(t);
    const blocks = D.dayBlocks(t);
    const prog = D.progress(t);
    const focus = S.weekly.focus.find(f => f.day === U.weekday(t));
    const ws = U.weekStart(t);

    // Agora: a atividade do momento e a próxima (com o botão de concluir)
    const naoFeitas = blocks.filter(b => !D.blockDone(b) && !D.isBreak(b));
    const atual = naoFeitas.find(b => D.blockNow(b, t)), proxima = naoFeitas.find(b => U.toMin(b.start) > nowM && b !== atual);
    const lin = (b, rot) => `<div class="ag-now ${rot === 'Agora' ? 'is-now' : ''}" style="--c:${D.cat(b.category).color}">
        <span class="ag-now-r">${rot}</span><span class="ag-now-t" data-act="goAgenda" data-d="${t}"><strong>${U.esc(b.title)}</strong><small class="muted">${b.start}–${b.end}</small></span>
        <button class="icon-btn ok" data-act="agStatusHoje" data-id="${b.id}" title="Concluir" aria-label="Concluir">${U.icon('check', 16)}</button></div>`;
    // Precisa de atenção: imprevistos abertos, atrasadas e reuniões para registrar (com os botões na frente)
    const occ = S.occurrences.filter(o => OPEN(o.status)).sort((a, b) => (D.occLate(b) - D.occLate(a)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    const atrasadas = S.tasks.filter(D.taskLate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    const hojeT = S.tasks.filter(x => OPEN(x.status) && !D.taskLate(x) && x.dueDate === t);
    const reg = Meetings.toRegister().filter(e => e.date >= U.addDays(t, -7));
    const atencao = [...occ.map(o => Occ.row(o)), ...atrasadas.map(x => Tasks.row(x)), ...hojeT.map(x => Tasks.row(x))];
    const nAt = atencao.length;

    // O que cobrar: por pessoa, quem tem algo em aberto
    const cobrar = Pessoas.todas().filter(p => p.abertas.length || p.missFb.length).slice(0, 6);

    // Resumo da semana
    const wdays = S.settings.workDays.filter(d => d >= 1 && d <= 6).concat(S.settings.workDays.includes(0) ? [0] : []);
    const weekKeys = wdays.map(d => U.addDays(ws, (d + 6) % 7));
    const dayVals = weekKeys.map(k => k > t ? null : (D.progress(k).pct ?? null));
    const doneWeek = S.tasks.filter(x => x.status === 'concluida' && x.completedAt && U.key(new Date(x.completedAt)) >= ws).length;
    const goals = S.settings.goals.map(g => ({ g, st: D.goalStatus(g) }));
    const showGoals = !!S.settings.showIndicadores, showProj = !!S.settings.showProjetos;
    const projects = showProj ? S.projects.filter(p => ['andamento', 'planejamento', 'pausado'].includes(p.status)).sort((a, b) => (D.projectLate(b) - D.projectLate(a)) || (a.dueDate || '9').localeCompare(b.dueDate || '9')).slice(0, 4) : [];

    return `
    ${Updater.banner()}
    <section class="day-card">
      ${Jogo.card()}
      <div class="dc-day">
        <div class="dc-day-h"><span>${workday ? (focus && focus.title ? `Foco: <strong>${U.esc(focus.title)}</strong> · ` : '') + `Expediente <strong>${S.settings.workStart}–${S.settings.workEnd}</strong>` : 'Hoje não é dia útil. Bom descanso.'}</span>
          ${prog.total ? `<a class="dc-prog" href="#agenda">${prog.done} de ${U.plural(prog.total, 'atividade')} · ${prog.pct}%</a>` : ''}</div>
        ${blocks.length ? H.dayRail(t) : ''}
      </div>
    </section>

    <section class="card home-now">
      <div class="card-h"><h3>${U.icon('clock')} Agora</h3><a class="link" href="#agenda" data-act="goAgenda" data-d="${t}">Abrir a agenda</a></div>
      ${atual || proxima ? `${atual ? lin(atual, 'Agora') : ''}${proxima ? lin(proxima, atual ? 'Depois' : 'Próxima') : ''}`
        : `<p class="muted small">${workday ? (prog.total ? 'As atividades de hoje foram encerradas.' : 'Nenhuma atividade na agenda de hoje.') : 'Sem agenda para hoje.'}</p>`}
      ${nAt || reg.length ? `<h4 class="home-sub">Precisa de atenção <span class="badge ${occ.length || atrasadas.length ? 'b-red' : ''}">${nAt + reg.length}</span></h4>
        <div class="task-list">${atencao.slice(0, 5).join('')}</div>
        ${reg.length ? `<div class="mt-list">${reg.slice(0, 2).map(e => Meetings.card(e, '<span class="btn sm primary">Registrar</span>')).join('')}</div>` : ''}
        ${nAt > 5 ? `<a class="link small" href="#agenda" data-act="goAgenda" data-d="${t}">Ver mais ${nAt - 5} na Agenda</a>` : ''}` : ''}
    </section>

    <section class="card cal-card cal-home">${Cal.render('home')}${Cal.day('home')}</section>

    <section class="${showProj ? 'grid-2' : 'grid-1'}">
      <div class="card">
        <div class="card-h"><h3>${U.icon('users')} O que cobrar da equipe</h3><a class="link" href="#equipe">Equipe</a></div>
        ${cobrar.length ? `<div class="fb-people">${cobrar.map(p => { const late = p.abertas.filter(x => D.taskLate(x) || D.occLate(x)).length; return `<div class="fb-person" role="button" tabindex="0" data-act="pessoaIr" data-n="${U.esc(p.nome)}"><span class="fb-av">${U.esc(FB.initials(p.nome))}</span>
            <span class="fb-p-body"><strong>${U.esc(p.nome)}</strong><small class="muted">${[p.abertas.length ? U.plural(p.abertas.length, 'item aberto', 'itens abertos') : '', p.missFb.length ? 'feedback pedido' : ''].filter(Boolean).join(' · ')}</small></span>
            ${late ? `<span class="badge b-red">${late} atrasado${late > 1 ? 's' : ''}</span>` : ''}${U.icon('right', 15)}</div>`; }).join('')}</div>`
          : H.empty('Nada delegado em aberto. Ao criar uma tarefa, escolha um responsável para acompanhar aqui.')}
      </div>
      ${showProj ? `<div class="card">
        <div class="card-h"><h3>${U.icon('kanban')} Projetos em andamento</h3><a class="link" href="#projetos">Projetos</a></div>
        ${projects.length ? projects.map(p => { const pct = D.projectProgress(p); return `<div class="proj-mini"><div class="pm-h"><a href="#projetos" class="pm-n">${U.esc(p.name)}</a>${H.demo(p)}${H.pstatus(p.status)}</div><div class="pm-b">${H.bar(pct, D.projectLate(p) ? 'var(--red)' : 'var(--accent)')}<strong>${pct}%</strong></div></div>`; }).join('') : H.empty('Nenhum projeto ativo.')}
      </div>` : ''}
    </section>

    <section class="${showGoals ? 'grid-2' : 'grid-1'} dash-foot">
      <div class="card flat">
        <div class="card-h"><h3>${U.icon('week')} Semana</h3><span class="muted small">${U.plural(doneWeek, 'tarefa concluída', 'tarefas concluídas')} · ${U.plural(S.occurrences.filter(o => o.date >= ws).length, 'imprevisto', 'imprevistos')}</span></div>
        <p class="muted small">Conclusão da agenda por dia</p>
        ${dayVals.some(v => v !== null) ? Charts.bars({ labels: weekKeys.map(k => U.WD_SHORT[U.weekday(k)]), series: [{ name: 'Agenda concluída', color: 'var(--accent)', values: dayVals }], height: 150, unit: '%', maxValue: 100 }) : '<div class="chart-empty"><span>Sem dados ainda nesta semana</span></div>'}
      </div>
      ${showGoals ? `<div class="card flat">
        <div class="card-h"><h3>${U.icon('target')} Resultados e metas</h3><a class="link" href="#indicadores">Indicadores</a></div>
        ${goals.length ? goals.map(({ g, st }) => `<div class="goal"><div class="goal-h"><span>${U.esc(g.name || metricLabel(g.metric))}</span>${H.demo(g)}${st.achieved === null ? '<span class="badge">Sem dados</span>' : st.achieved ? '<span class="badge b-green">Alcançada</span>' : '<span class="badge b-yellow">Em curso</span>'}</div>${H.bar(st.pct, st.achieved ? 'var(--green)' : 'var(--accent)')}</div>`).join('') : H.empty('Nenhuma meta configurada.', '<a class="btn sm" href="#config">Configurar metas</a>')}
      </div>` : ''}
    </section>`;
  },
};
