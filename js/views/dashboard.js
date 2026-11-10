'use strict';
/* Dashboard — centro de controle */
Views.dashboard = {
  title: 'Início', icon: 'dashboard', nav: 'Início',
  fab: () => ({ act: 'quickAdd', label: 'Adicionar', data: { k: Cal.st('home').sel, from: 'home' } }),
  render() {
    const t = U.today(), nowM = U.nowMin();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const workday = D.isWorkday(t);
    const blocks = D.dayBlocks(t);
    const prog = D.progress(t);
    const focus = S.weekly.focus.find(f => f.day === U.weekday(t));

    const open = S.tasks.filter(x => OPEN(x.status));
    const lateTasks = open.filter(D.taskLate);
    const lateBlocks = blocks.filter(b => D.blockLate(b, t));
    const ws = U.weekStart(t), we = U.addDays(ws, 6);
    const doneWeek = S.tasks.filter(x => x.status === 'concluida' && x.completedAt && x.completedAt.slice(0, 10) >= ws && x.completedAt.slice(0, 10) <= we);
    const doneTotal = S.tasks.filter(x => x.status === 'concluida').length;
    const openOcc = S.occurrences.filter(o => OPEN(o.status));

    // Próximas atividades da agenda
    const next = blocks.filter(b => !D.blockDone(b) && U.toMin(b.end) > nowM).slice(0, 5);

    // Pendências prioritárias (o que resolver)
    const prioItems = [
      ...openOcc.map(o => ({ kind: 'Imprevisto', title: o.title, prio: o.priority, info: D.deadline(o.dueDate, o.dueTime, false), link: '#imprevistos', demo: o.demo })),
      ...open.filter(x => ['urgente', 'alta'].includes(x.priority) || D.taskLate(x)).map(x => ({ kind: 'Tarefa', title: x.title, prio: x.priority, info: D.deadline(x.dueDate, x.dueTime, false), link: '#tarefas', demo: x.demo })),
      // Reuniões com pauta que já aconteceram (últimos 7 dias) e ainda não foram registradas
      ...Meetings.toRegister().filter(e => e.date >= U.addDays(t, -7))
        .map(e => ({ kind: 'Registrar reunião', title: e.title, prio: 'media', info: null, link: '#reunioes', demo: e.demo, ev: e.id })),
    ].sort((a, b) => ((b.info?.level === 'late') - (a.info?.level === 'late')) || PRIORITY_RANK[a.prio] - PRIORITY_RANK[b.prio]).slice(0, 7);

    // O que cobrar da equipe
    const charge = [
      ...open.filter(x => x.responsible).map(x => ({ who: x.responsible, what: x.title, kind: 'Tarefa', info: D.deadline(x.dueDate, x.dueTime, false), demo: x.demo })),
      ...openOcc.filter(o => o.responsible).map(o => ({ who: o.responsible, what: o.title, kind: 'Imprevisto', info: D.deadline(o.dueDate, o.dueTime, false), demo: o.demo })),
      ...(S.settings.showProjetos ? S.projects : []).filter(p => ['andamento', 'planejamento', 'pausado'].includes(p.status)).flatMap(p => (p.pendencias || []).filter(x => !x.done).map(x => ({ who: p.responsible || '—', what: x.text, kind: 'Pendência · ' + p.name, info: null, demo: p.demo }))),
    ].sort((a, b) => ((b.info?.level === 'late') - (a.info?.level === 'late'))).slice(0, 7);

    // Projetos
    const projects = S.projects.filter(p => ['andamento', 'planejamento', 'pausado'].includes(p.status))
      .sort((a, b) => (D.projectLate(b) - D.projectLate(a)) || (a.dueDate || '9').localeCompare(b.dueDate || '9')).slice(0, 5);

    // Próximos 7 dias
    const upcoming = [];
    for (let i = 0; i <= 7; i++) {
      const k = U.addDays(t, i);
      S.tasks.filter(x => OPEN(x.status) && x.dueDate === k).forEach(x => upcoming.push({ k, label: x.title, type: 'Prazo de tarefa', demo: x.demo }));
      (S.settings.showProjetos ? S.projects : []).filter(p => !['concluido', 'cancelado'].includes(p.status) && p.dueDate === k).forEach(p => upcoming.push({ k, label: p.name, type: 'Prazo de projeto', demo: p.demo }));
      S.events.filter(e => e.date === k).forEach(e => upcoming.push({ k, label: e.title, type: 'Compromisso' + (e.time ? ' ' + e.time : '') + ((e.pautas || []).length ? `, ${U.plural(e.pautas.length, 'assunto')} na pauta` : ''), demo: e.demo, ev: e.id }));
      S.occurrences.filter(o => OPEN(o.status) && o.dueDate === k).forEach(o => upcoming.push({ k, label: o.title, type: 'Prazo de imprevisto', demo: o.demo }));
    }

    // Resumo semanal
    const wdays = S.settings.workDays.filter(d => d >= 1 && d <= 6).concat(S.settings.workDays.includes(0) ? [0] : []);
    const weekKeys = wdays.map(d => U.addDays(ws, (d + 6) % 7));
    const chk = S.weekly.checks[ws] || {};
    const wItems = S.weekly.focus.filter(f => S.settings.workDays.includes(f.day)).flatMap(f => f.items);
    const wDone = wItems.filter(i => chk[i.id]).length;
    const wPct = wItems.length ? Math.round(wDone / wItems.length * 100) : null;
    const dayVals = weekKeys.map(k => k > t ? null : (D.progress(k).pct ?? null));

    const goals = S.settings.goals.map(g => ({ g, st: D.goalStatus(g) }));

    const kpi = (label, value, sub, cls = '', href = '', status = '') => `<a class="kpi ${cls}" ${href ? `href="${href}"` : ''} ${status ? `data-act="goTasks" data-status="${status}"` : ''}><span class="kpi-l">${label}</span><strong class="kpi-v">${value}</strong><span class="kpi-s">${sub}</span></a>`;

    const dWd = U.WD[U.weekday(t)].replace('-feira', '');
    const dDate = `${dWd}, ${U.parse(t).getDate()} de ${U.MONTHS[U.parse(t).getMonth()].toLowerCase()}`;
    const showGoals = !!S.settings.showIndicadores, showProj = !!S.settings.showProjetos;

    return `
    ${Updater.banner()}
    <section class="today">
      <div class="today-top">
        <div class="today-txt">
          <p class="today-greet">${greet}</p>
          <h2 class="today-date">${dDate}</h2>
          <p class="today-focus">${workday ? (focus && focus.title ? `Foco do dia: <strong>${U.esc(focus.title)}</strong>` : `Expediente das ${S.settings.workStart} às ${S.settings.workEnd}`) : 'Hoje não é dia útil. Bom descanso.'}</p>
        </div>
        <div class="today-clock"><span id="dash-clock">${new Date().toLocaleTimeString('pt-BR')}</span>${workday && focus && focus.title ? `<small>Expediente ${S.settings.workStart}–${S.settings.workEnd}</small>` : ''}</div>
      </div>
      ${blocks.length ? H.dayRail(t) : ''}
    </section>

    <section class="card cal-card cal-home">${Cal.render('home')}${Cal.day('home')}</section>

    <section class="kpis">
      <div class="kpi kpi-ring">${Charts.ring(prog.pct, { size: 76, stroke: 7 })}<div><span class="kpi-l">Progresso do dia</span><span class="kpi-s">${prog.total ? `${prog.done} de ${U.plural(prog.total, 'atividade')}` : 'Sem atividades hoje'}</span><a class="link" href="#agenda">Abrir agenda</a></div></div>
      ${kpi('Tarefas concluídas', doneTotal, `${doneWeek.length} nesta semana`, 'k-green', '#tarefas', 'concluida')}
      ${kpi('Tarefas pendentes', open.length, `${open.filter(x => x.status === 'andamento').length} em andamento`, 'k-gray', '#tarefas', 'abertas')}
      ${kpi('Atrasadas', lateTasks.length + lateBlocks.length, `${U.plural(lateTasks.length, 'tarefa')} · ${lateBlocks.length} na agenda`, (lateTasks.length + lateBlocks.length) ? 'k-red' : 'k-gray', '#tarefas', 'atrasadas')}
      ${kpi('Imprevistos abertos', openOcc.length, openOcc.filter(D.occLate).length ? `${openOcc.filter(D.occLate).length} com prazo vencido` : 'Nenhum vencido', openOcc.length ? 'k-yellow' : 'k-gray', '#imprevistos')}
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h3>${U.icon('clock')} O que fazer hoje</h3><a class="link" href="#agenda">Agenda</a></div>
        ${next.length ? `<ul class="list">${next.map(b => `<li class="li ${D.blockNow(b, t) ? 'li-now' : ''}"><span class="li-time">${b.start}–${b.end}</span><span class="li-main" style="--c:${D.cat(b.category).color}"><span class="cat-dot"></span>${U.esc(b.title)}</span>${D.blockNow(b, t) ? '<span class="badge b-blue">Agora</span>' : b.status === 'andamento' ? H.status('andamento') : ''}</li>`).join('')}</ul>`
          : H.empty(workday ? (prog.total ? 'Todas as atividades de hoje foram encerradas.' : 'Nenhuma atividade na agenda de hoje.') : 'Sem agenda para hoje.')}
        ${lateBlocks.length ? `<div class="alert a-red">${U.icon('alert')} ${U.plural(lateBlocks.length, 'atividade')} da agenda ${lateBlocks.length > 1 ? 'passaram' : 'passou'} do horário sem conclusão. <a class="link" href="#agenda">Reorganizar</a></div>` : ''}
      </div>
      <div class="card">
        <div class="card-h"><h3>${U.icon('alert')} O que resolver</h3><a class="link" href="#tarefas">Tarefas</a></div>
        ${prioItems.length ? `<ul class="list">${prioItems.map(i => `<li class="li"><a href="${i.link}" class="li-main" ${i.ev ? `data-act="evView" data-id="${i.ev}"` : ''}>${i.ev ? H.chip('Reunião', '#9461f5') : H.prio(i.prio)} <span>${U.esc(i.title)}</span>${H.demo(i)}</a><span class="li-side"><small class="muted">${i.kind}</small>${H.deadline(i.info)}</span></li>`).join('')}</ul>`
          : H.empty('Nenhuma pendência urgente, de alta prioridade ou atrasada.')}
      </div>
    </section>

    <section class="${showProj ? 'grid-2' : 'grid-1'}">
      <div class="card">
        <div class="card-h"><h3>${U.icon('user')} O que cobrar da equipe</h3></div>
        ${charge.length ? `<ul class="list">${charge.map(c => `<li class="li li-stack"><div class="li-top"><strong>${U.esc(c.who)}</strong><small class="muted">${U.esc(c.kind)}</small>${H.deadline(c.info)}</div><div class="li-txt">${U.esc(c.what)}${H.demo(c)}</div></li>`).join('')}</ul>`
          : H.empty('Nada delegado em aberto. Defina um responsável em tarefas, imprevistos ou projetos para acompanhar aqui.')}
      </div>
      ${showProj ? `<div class="card">
        <div class="card-h"><h3>${U.icon('kanban')} Projetos em andamento</h3><a class="link" href="#projetos">Projetos</a></div>
        ${projects.length ? projects.map(p => { const pct = D.projectProgress(p); const dl = D.deadline(p.dueDate, null, false); return `<div class="proj-mini"><div class="pm-h"><a href="#projetos" class="pm-n">${U.esc(p.name)}</a>${H.demo(p)}${H.pstatus(p.status)}</div><div class="pm-b">${H.bar(pct, D.projectLate(p) ? 'var(--red)' : 'var(--accent)')}<strong>${pct}%</strong></div><div class="pm-f"><small class="muted">${U.esc(p.client || '')}</small>${H.deadline(dl)}</div></div>`; }).join('')
          : H.empty('Nenhum projeto ativo cadastrado.', '<a class="btn sm" href="#projetos">Cadastrar projeto</a>')}
      </div>` : ''}
    </section>

    <section class="${showGoals ? 'grid-2' : 'grid-1'} dash-foot">
      <div class="card flat">
        <div class="card-h"><h3>${U.icon('week')} Resumo da semana</h3><a class="link" href="#agenda">Agenda</a></div>
        <div class="stat-row">
          ${wItems.length ? `<div><small>Checklist semanal</small><strong>${wPct}%</strong></div>` : ''}
          <div><small>Tarefas concluídas</small><strong>${doneWeek.length}</strong></div>
          <div><small>Imprevistos na semana</small><strong>${S.occurrences.filter(o => o.date >= ws && o.date <= we).length}</strong></div>
        </div>
        ${wItems.length ? H.bar(wPct) : ''}
        <p class="muted small mt">Conclusão da agenda por dia</p>
        ${dayVals.some(v => v !== null) ? Charts.bars({ labels: weekKeys.map(k => U.WD_SHORT[U.weekday(k)]), series: [{ name: 'Agenda concluída', color: 'var(--accent)', values: dayVals }], height: 150, unit: '%', maxValue: 100 }) : '<div class="chart-empty"><span>Sem dados ainda nesta semana</span></div>'}
      </div>
      ${showGoals ? `<div class="card flat">
        <div class="card-h"><h3>${U.icon('target')} Resultados e metas</h3><a class="link" href="#indicadores">Indicadores</a></div>
        ${goals.length ? goals.map(({ g, st }) => `<div class="goal"><div class="goal-h"><span>${U.esc(g.name || metricLabel(g.metric))}</span>${H.demo(g)}${st.achieved === null ? '<span class="badge">Sem dados</span>' : st.achieved ? '<span class="badge b-green">Alcançada</span>' : '<span class="badge b-yellow">Em curso</span>'}</div>${H.bar(st.pct, st.achieved ? 'var(--green)' : 'var(--accent)')}<small class="muted">${st.val === null ? 'Nenhum dado lançado' : `${U.fmtNum(st.val)} ${g.direction === 'max' ? '(máx.' : '(meta'} ${U.fmtNum(st.target)}) · ${g.period}`}</small></div>`).join('')
          : H.empty('Nenhuma meta configurada.', '<a class="btn sm" href="#config">Configurar metas</a>')}
      </div>` : ''}
    </section>`;
  },
};
