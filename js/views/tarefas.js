'use strict';
/* Gestão de tarefas — cadastro, filtros e alertas de prazo */
Views.tarefas = {
  title: 'Tarefas', icon: 'tasks', nav: 'Tarefas',
  fab: { act: 'quickAdd', label: 'Adicionar' },   // o mesmo "+" de todas as telas (Capture)
  render(params) {
    const f = App.ui.taskF = App.ui.taskF || { q: '', status: 'abertas', priority: '', category: '', period: '', from: '', to: '' };
    const t = U.today(), ws = Cal.inicioSemana(t), we = U.addDays(ws, 6);
    const all = S.tasks;
    const counts = {
      abertas: all.filter(x => OPEN(x.status)).length,
      atrasadas: all.filter(D.taskLate).length,
      andamento: all.filter(x => x.status === 'andamento').length,
      concluida: all.filter(x => x.status === 'concluida').length,
      todas: all.length,
    };
    let list = all.filter(x => {
      if (f.status === 'abertas' && !OPEN(x.status)) return false;
      if (f.status === 'atrasadas' && !D.taskLate(x)) return false;
      if (['pendente', 'andamento', 'concluida', 'cancelada'].includes(f.status) && x.status !== f.status) return false;
      if (f.priority && x.priority !== f.priority) return false;
      if (f.category && x.category !== f.category) return false;
      if (f.q) { const q = f.q.toLowerCase(); if (![x.title, x.description, x.notes, x.responsible].some(s => (s || '').toLowerCase().includes(q))) return false; }
      if (f.period === 'hoje' && x.dueDate !== t) return false;
      if (f.period === 'semana' && !(x.dueDate >= ws && x.dueDate <= we)) return false;
      if (f.period === 'proximos' && !(x.dueDate >= t && x.dueDate <= U.addDays(t, 7))) return false;
      if (f.period === 'semprazo' && x.dueDate) return false;
      if (f.from && !(x.dueDate && x.dueDate >= f.from)) return false;
      if (f.to && !(x.dueDate && x.dueDate <= f.to)) return false;
      return true;
    });
    list.sort((a, b) => (OPEN(b.status) - OPEN(a.status)) || (D.taskLate(b) - D.taskLate(a)) || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

    const stat = (k, l, cls = '') => `<button class="stat-chip ${cls} ${f.status === k ? 'active' : ''}" aria-pressed="${f.status === k}" data-act="tkStatusF" data-v="${k}"><strong>${counts[k]}</strong><span>${l}</span></button>`;
    const sel = (name, opts, label) => `<select data-change="tkFilter" data-k="${name}" aria-label="${label}"><option value="">${label}</option>${UI.opts(opts, f[name])}</select>`;
    const filtersOn = f.priority || f.category || f.period || f.from || f.to || f.q;
    const nFiltros = [f.priority, f.category, f.period, f.from || f.to].filter(Boolean).length;

    // Sugestão 1 (lista de papel): linha sem cartão, círculo para concluir, agrupada por quando
    const tm = U.addDays(t, 1), d7 = U.addDays(t, 7);
    const row = x => {
      const dl = D.deadline(x.dueDate, x.dueTime, !OPEN(x.status));
      const fechada = x.status === 'concluida' || x.status === 'cancelada';
      const quando = !x.dueDate ? '' : x.dueDate === t || x.dueDate === tm ? '' : x.dueDate === U.addDays(t, -1) ? 'ontem' : `${U.WD_SHORT[U.weekday(x.dueDate)].toLowerCase()} ${U.fmtShort(x.dueDate)}`;
      const hora = x.dueTime ? x.dueTime + (Cal.fimTarefa(x) ? ' – ' + Cal.fimTarefa(x) : '') : '';
      const late = OPEN(x.status) && D.taskLate(x);
      const meta = [late ? `<span class="dl-late">${x.dueDate === t ? 'venceu hoje' : x.dueDate === U.addDays(t, -1) ? 'era ontem' : 'era ' + U.WD_SHORT[U.weekday(x.dueDate)].toLowerCase() + ' ' + U.fmtShort(x.dueDate)}${x.dueTime ? ', ' + x.dueTime : ''}</span>` : [quando, hora].filter(Boolean).join(', '),
        x.status === 'andamento' ? '<span class="run-tag"><i class="run-dot"></i>em execução</span>' : '', x.status === 'cancelada' ? 'cancelada' : '',
        x.responsible ? U.esc(x.responsible) : '', x.repeat ? `<span class="tk-rep">${U.icon('undo', 12)} ${Tasks.repeatLabel(x.repeat)}</span>` : ''].filter(Boolean).join(' · ');
      const prio = OPEN(x.status) && (x.priority === 'alta' || x.priority === 'urgente') ? `<span class="tk-prio p-${x.priority}">${D.prio(x.priority).label.toLowerCase()}</span>` : '';
      return `<div class="task ${x.status} p-${x.priority || 'media'} ${dl ? 'dl-row-' + dl.level : ''}">
        ${Tasks.botao(x, late)}
        <div class="tk-body" data-act="tkEdit" data-id="${x.id}">
          <div class="tk-title">${U.esc(x.title)}${H.demo(x)}</div>
          ${meta ? `<div class="tk-meta">${meta}</div>` : ''}
          ${x.description ? `<div class="tk-desc">${U.esc(x.description)}</div>` : ''}
        </div>
        ${x.status === 'andamento' ? Tasks.pausaBtn(x) : prio}
        <button class="icon-btn tk-mais" data-act="tkMore" data-id="${x.id}" title="Mais opções" aria-label="Mais opções">${U.icon('more', 16)}</button>
      </div>`;
    };
    const grupoDe = x => !OPEN(x.status) ? (x.status === 'concluida' ? 'feitas' : 'canceladas') : x.status === 'andamento' ? 'execucao' : D.taskLate(x) ? 'atrasadas' : !x.dueDate ? 'semdata'
      : x.dueDate <= t ? 'hoje' : x.dueDate === tm ? 'amanha' : x.dueDate <= d7 ? 'semana' : 'depois';
    const NOMES = { execucao: 'Em execução agora', atrasadas: 'Atrasadas', hoje: `Hoje · ${U.WD[U.weekday(t)].replace('-feira', '').toLowerCase()}, ${+t.slice(8)}`, amanha: 'Amanhã', semana: 'Próximos 7 dias', depois: 'Mais adiante', semdata: 'Sem data', feitas: 'Concluídas', canceladas: 'Canceladas' };
    const grupos = (ks, l) => ks.map(k => { const it = l.filter(x => grupoDe(x) === k); return it.length ? `<div class="tk-grp g-${k}">${NOMES[k]}<span>${it.length}</span></div>${it.map(row).join('')}` : ''; }).join('');
    const ORDEM = ['execucao', 'atrasadas', 'hoje', 'amanha', 'semana', 'depois', 'semdata', 'feitas', 'canceladas'];
    // Sugestão 5: no computador, as abertas em três colunas (Hoje · Depois · Sem data)
    const pc = window.matchMedia && matchMedia('(min-width: 901px)').matches;
    const colunas = pc && f.status === 'abertas' && list.length;
    const col = (titulo, sub, ks) => { const n = list.filter(x => ks.includes(grupoDe(x))).length; return `<section class="tk-col"><header><b>${titulo}</b><span>${sub}</span></header>${n ? grupos(ks, list) : `<p class="tk-col-vazio">${titulo === 'Hoje' ? 'Nada para hoje.' : 'Nada por aqui.'}</p>`}<button class="tk-add" data-act="quickAdd">+ Adicionar</button></section>`; };
    const nome = ((S.settings.usuario || '').trim().split(' ')[0]) || '';
    // Sugestão 6: tela vazia com a voz do app
    const vazio = !all.length || (f.status === 'abertas' && !filtersOn && !list.length)
      ? H.vazio('Nada pendente.', nome ? `Pode respirar, ${U.esc(nome)}.` : 'Calma, Pae.', all.length ? 'Você zerou a lista. Quando aparecer algo, é só anotar ou falar.' : 'Sua lista começa aqui. Anote o que precisa fazer e o app lembra por você.',
        [['plus', 'Toque no + e escreva em poucas palavras'], ['mic', 'Ou grave um áudio: o app anota sozinho']], counts.concluida ? `${U.plural(counts.concluida, 'tarefa concluída', 'tarefas concluídas')} até agora` : '')
      : H.empty(f.status === 'atrasadas' && !filtersOn ? 'Nada atrasado. Tudo em dia.' : 'Nenhuma tarefa com esses filtros.');

    return `
    ${Occ.painel()}
    <div class="toolbar">
      <div class="stat-chips tk-abas" role="tablist">${stat('abertas', 'Abertas')}${stat('andamento', 'Em andamento', 'c-blue')}${stat('atrasadas', 'Atrasadas', 'c-red')}${stat('concluida', 'Concluídas', 'c-green')}${stat('todas', 'Todas')}</div>
    </div>
    <div class="tk-busca">
      <input type="search" placeholder="Buscar tarefa ou pessoa" value="${U.esc(f.q)}" data-input="tkSearch" aria-label="Buscar">
      <button class="btn ghost tk-fbtn ${App.ui.taskFOpen ? 'on' : ''}" data-act="tkFiltros" aria-expanded="${App.ui.taskFOpen || nFiltros ? 'true' : 'false'}">${U.icon('filter', 16)} Filtros${nFiltros ? ` <b class="tk-fn">${nFiltros}</b>` : ''}</button>
    </div>
    <div class="filters card tk-filtros ${App.ui.taskFOpen || nFiltros ? 'aberto' : ''}">
      ${sel('category', H.catOptions(), 'Todas as categorias')}
      ${sel('priority', H.prioOptions(), 'Todas as prioridades')}
      ${sel('period', [['hoje', 'Prazo hoje'], ['semana', 'Prazo nesta semana'], ['proximos', 'Próximos 7 dias'], ['semprazo', 'Sem prazo']], 'Qualquer prazo')}
      <label class="inline">De <input type="date" value="${f.from}" data-change="tkFilter" data-k="from"></label>
      <label class="inline">Até <input type="date" value="${f.to}" data-change="tkFilter" data-k="to"></label>
      ${filtersOn ? '<button class="btn sm ghost" data-act="tkClear">Limpar filtros</button>' : ''}
    </div>
    ${filtersOn ? `<p class="muted small">${U.plural(list.length, 'tarefa encontrada', 'tarefas encontradas')}</p>` : ''}
    ${colunas ? `<div class="tk-cols">${col('Hoje', U.fmtShort(t), ['execucao', 'atrasadas', 'hoje'])}${col('Depois', 'próximos dias', ['amanha', 'semana', 'depois'])}${col('Sem data', 'quando der', ['semdata'])}</div>`
      : `<div class="task-list">${list.length ? grupos(ORDEM, list) : vazio}</div>`}`;
  },
};

const Tasks = {
  /* Formulário enxuto (pedido do usuário): tudo numa tela só, sem "Mais opções".
     Categoria, status e data de início saem do formulário (ficam como estão; o status muda pelos botões ▶ ✓ ✕ da lista).
     Descrição e observações antigas viram um campo só, "Observação". */
  form(x, defaults = {}) {
    const isNew = !x;
    x = x || { priority: 'media', status: 'pendente', category: 'administrativo', startDate: U.today(), ...defaults };
    const obs = [x.description, x.notes].filter(Boolean).join('\n');
    // Toda tarefa entra na agenda (pedido do usuário): dia e horário obrigatórios, com sugestões de horários livres
    const dia0 = x.dueDate || U.today();
    const m = UI.form({
      title: isNew ? 'Nova tarefa' : 'Editar tarefa',
      fields: [
        { name: 'title', label: 'O que precisa fazer?', required: true, value: x.title },
        { name: 'dueDate', label: 'Dia', type: 'date', value: dia0, required: true, half: true },
        { name: 'dueTime', label: 'Horário', type: 'time', value: x.dueTime, required: true, half: true },
        { type: 'html', html: '<div class="tk-livres"></div>' },
        { name: 'dur', label: 'Duração', type: 'select', options: Tasks.DURS.filter(([v]) => v), value: String(x.dur || 30), half: true },
        { name: 'responsible', label: 'Quem faz?', value: x.responsible, list: D.techNames(), placeholder: 'Você', half: true },
        { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: x.priority, half: true },
        { name: 'repeat', label: 'Repetir', type: 'select', options: Tasks.REPEAT, value: x.repeat || '', half: true },
        { name: 'description', label: 'Observação', type: 'textarea', rows: 2, value: obs, placeholder: 'Opcional' },
        { type: 'html', html: `<p class="muted small tk-form-dica">Dia e horário são obrigatórios: toda tarefa entra na agenda.${isNew ? '' : ` Criada em ${U.fmtDateTime(x.createdAt)}${x.completedAt ? ` · concluída em ${U.fmtDateTime(x.completedAt)}` : ''}.`}</p>` },
      ],
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); Actions.tkDelete({ id: x.id }); } }],
      onSubmit(v) {
        if (v.repeat && !v.dueDate) v.dueDate = U.today();
        v.dur = v.dueDate && v.dueTime ? Number(v.dur) || 0 : 0;
        v.notes = '';
        if (isNew) S.tasks.push({ id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, category: x.category, status: 'pendente', startDate: x.startDate || U.today(), ...v });
        else Object.assign(x, v);
        commit(); UI.toast(isNew ? 'Tarefa criada.' : 'Tarefa atualizada.');
      },
    });
    // Horários livres do dia escolhido (atualiza quando muda o dia ou a duração; um toque preenche o horário)
    const fm = m.el.querySelector('form'), caixa = m.el.querySelector('.tk-livres');
    const pinta = () => {
      const d = fm.elements.dueDate.value || U.today(), h = fm.elements.dueTime.value;
      const l = Agenda.livres(d, fm.elements.dur.value, { ignorar: x.id });
      caixa.innerHTML = `<span class="lbl">Horários livres</span><div class="cap-chips">${l.length ? l.map(o => `<button type="button" class="cap-chip ${o.h === h ? 'on' : ''} ${o.sobre ? 'sobre' : ''}" data-livre="${o.h}" title="${o.sobre ? 'No horário de: ' + U.esc(o.sobre) : 'Horário livre'}">${o.h}${o.sobre ? '<i>•</i>' : ''}</button>`).join('') : '<span class="muted small">Nada livre neste dia no expediente.</span>'}</div>`;
    };
    pinta();
    fm.addEventListener('change', e => { if (['dueDate', 'dur', 'dueTime'].includes(e.target.name)) pinta(); });
    caixa.addEventListener('click', e => { const b = e.target.closest('[data-livre]'); if (b) { fm.elements.dueTime.value = b.dataset.livre; pinta(); } });
  },
  /* Botão único (pedido do usuário): ▶ começa; na tarefa em execução vira ✓ e conclui; concluída/cancelada reabre.
     Assim nada é concluído sem antes ser começado. */
  emExecucao(exceto) { return S.tasks.find(y => y.status === 'andamento' && y.id !== exceto); },
  botao(x, late, extra = '') {
    const nome = U.esc(x.title);
    if (x.status === 'concluida') return `<button class="tk-ck feito" data-act="tkSet" data-id="${x.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir: ${nome}">${U.icon('check', 13)}</button>`;
    if (x.status === 'cancelada') return `<button class="tk-ck canc" data-act="tkSet" data-id="${x.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir: ${nome}">${U.icon('x', 12)}</button>`;
    if (x.status === 'andamento') return `<button class="tk-ck and" data-act="tkSet" data-id="${x.id}" data-s="concluida" title="Concluir" aria-label="Concluir: ${nome}">${U.icon('check', 14)}</button>`;
    const outra = this.emExecucao(x.id);
    return `<button class="tk-ck play ${late ? 'late' : ''} ${outra ? 'bloq' : ''}" data-act="tkSet" data-id="${x.id}" data-s="andamento" title="${outra ? 'Termine ou reagende a tarefa em execução primeiro' : 'Começar'}" aria-label="Começar: ${nome}">${U.icon('play', 11)}</button>`;
  },
  /* Pausar com um toque (pedido do usuário: fácil de achar). Fica à vista só na tarefa em execução */
  pausaBtn(x) { return `<button class="tk-pausa" data-act="tkPausar" data-id="${x.id}" title="Pausar" aria-label="Pausar: ${U.esc(x.title)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/></svg><span>Pausar</span></button>`; },
  /* Regras: uma tarefa em execução por vez; só conclui o que foi começado */
  pode(x, s) {
    if (s === 'andamento') {
      const oc = Occ.emAndamento();   // imprevisto vem antes de tudo
      if (oc) { UI.toast(`Resolva primeiro o imprevisto “${oc.title}”.`, 'warn', { label: 'Ver', onClick: () => App.go('agenda') }); return false; }
      const outra = this.emExecucao(x.id);
      if (outra) { UI.toast(`Uma tarefa por vez: conclua ou reagende “${outra.title}” antes de começar outra.`, 'warn', { label: 'Ver', onClick: () => Actions.goTasks({ status: 'andamento' }) }); return false; }
    }
    if (s === 'concluida' && x.status !== 'andamento') { UI.toast('Comece a tarefa antes de concluir: toque no ▶.', 'warn'); return false; }
    return true;
  },
  /* "Pausar ou reagendar" (pedido do usuário: no lugar de Cancelar, para a tarefa nunca sumir).
     Um toque resolve: pausar (continua no mesmo dia), mais tarde hoje (+1 h, +2 h ou outro horário) ou outro dia. Sempre com "Desfazer". */
  reagendar(x) {
    const t = U.today(), agora = Math.ceil(U.nowMin() / 15) * 15, fimExp = U.toMin(S.settings.workEnd || '18:00');
    const hm = m => U.fromMin(Math.min(1439, m));
    const amanha = U.addDays(t, 1), util = D.nextWorkday(t);
    const seg = (() => { let k = U.addDays(t, 1); while (U.weekday(k) !== 1) k = U.addDays(k, 1); return k; })();
    const dia = k => k === amanha ? 'Amanhã' : `${U.WD_SHORT[U.weekday(k)]} ${U.fmtShort(k)}`;
    const op = (rot, sub, d, h) => `<button type="button" class="rg-op" data-d="${d}" data-h="${h || ''}"><strong>${rot}</strong>${sub ? `<small>${sub}</small>` : ''}</button>`;
    const hoje = [agora + 60, agora + 120].filter(m => m < 1440).map((m, n) => op(n ? 'Daqui a 2 h' : 'Daqui a 1 h', 'às ' + hm(m), t, hm(m)));
    if (fimExp - 60 > agora + 120) hoje.push(op('No fim do expediente', 'às ' + hm(fimExp - 60), t, hm(fimExp - 60)));
    const dias = [op(dia(amanha), x.dueTime ? 'às ' + x.dueTime : 'sem horário', amanha, x.dueTime)];
    if (util !== amanha) dias.push(op('Próximo dia útil', `${dia(util)}${x.dueTime ? ' às ' + x.dueTime : ''}`, util, x.dueTime));
    if (seg !== amanha && seg !== util) dias.push(op('Segunda-feira', `${U.fmtShort(seg)}${x.dueTime ? ' às ' + x.dueTime : ''}`, seg, x.dueTime));
    const m = UI.modal({
      title: x.status === 'andamento' ? 'Pausar ou reagendar' : 'Reagendar',
      body: `<div class="rg">
        <p class="rg-nome">${U.esc(x.title)}</p>
        ${x.status === 'andamento' ? `<button type="button" class="rg-op rg-pausa" data-pausa="1"><strong>Só pausar</strong><small>Para de executar agora e continua ${x.dueDate && x.dueDate !== t ? 'em ' + U.fmtShort(x.dueDate) : 'na lista de hoje'}</small></button>` : ''}
        ${hoje.length ? `<span class="rg-l">Mais tarde, hoje</span><div class="rg-grade">${hoje.join('')}</div>` : ''}
        <div class="rg-linha"><label for="rg-hora">Outro horário hoje</label><input type="time" id="rg-hora" class="cap-in"><button type="button" class="btn sm" data-hoje>Ok</button></div>
        <span class="rg-l">Outro dia</span><div class="rg-grade">${dias.join('')}</div>
        <div class="rg-linha"><label for="rg-data">Outra data</label><input type="date" id="rg-data" class="cap-in" min="${t}"><input type="time" id="rg-data-h" class="cap-in" value="${x.dueTime || ''}" aria-label="Horário (opcional)"><button type="button" class="btn sm" data-outra>Ok</button></div>
        <div class="form-error" hidden></div>
      </div>`,
      footer: '<span class="grow"></span><button type="button" class="btn ghost" data-cancel>Fechar</button>',
    });
    const err = msg => { const e = m.el.querySelector('.form-error'); e.textContent = msg; e.hidden = !msg; };
    const aplicar = (d, h, pausa) => {
      const antes = { dueDate: x.dueDate, dueTime: x.dueTime, dur: x.dur, status: x.status };
      if (x.status === 'andamento') x.status = 'pendente';
      if (!pausa) { x.dueDate = d; x.dueTime = h || ''; if (!x.dueTime) x.dur = 0; }
      commit(); m.close();
      const quando = pausa ? '' : `${d === t ? 'hoje' : d === amanha ? 'amanhã' : U.fmtShort(d)}${h ? ' às ' + h : ''}`;
      UI.toast(pausa ? 'Tarefa pausada. Continua na sua lista.' : `Reagendada para ${quando}.`, 'ok', { label: 'Desfazer', onClick: () => { Object.assign(x, antes); commit(); } });
    };
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-cancel')) return m.close();
      if (b.dataset.pausa) return aplicar(null, null, true);
      if (b.dataset.d) return aplicar(b.dataset.d, b.dataset.h);
      if (b.hasAttribute('data-hoje')) { const h = m.el.querySelector('#rg-hora').value; return h ? aplicar(t, h) : err('Escolha o horário.'); }
      if (b.hasAttribute('data-outra')) { const d = m.el.querySelector('#rg-data').value; return d ? aplicar(d, m.el.querySelector('#rg-data-h').value) : err('Escolha a data.'); }
    });
  },
  setStatus(x, s) {
    const was = x.status;
    if (s === 'concluida' && x.status !== 'concluida') x.completedAt = new Date().toISOString();
    if (s !== 'concluida') x.completedAt = null;
    x.status = s;
    // Tarefa que se repete: ao concluir, nasce a próxima; ao reabrir, a próxima (ainda intocada) some
    if (x.repeat && s === 'concluida' && was !== 'concluida' && !(x.nextId && S.tasks.some(y => y.id === x.nextId))) {
      const n = { ...x, id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, status: 'pendente', top: null, nextId: null, dueDate: Tasks.nextDue(x), startDate: U.today(), repeatDay: x.repeat === 'mensal' ? (x.repeatDay || +(x.dueDate || U.today()).slice(8, 10)) : undefined };
      S.tasks.push(n); x.nextId = n.id;
      return n;
    }
    if (s !== 'concluida' && x.nextId) {
      const n = S.tasks.find(y => y.id === x.nextId);
      if (n && n.status === 'pendente') S.tasks.splice(S.tasks.indexOf(n), 1);
      x.nextId = null;
    }
    return null;
  },
  DURS: [['', 'Não sei'], ['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 hora'], ['90', '1h30'], ['120', '2 horas'], ['180', '3 horas'], ['240', '4 horas']],
  REPEAT: [['', 'Não repete'], ['diaria', 'Todo dia útil'], ['semanal', 'Toda semana'], ['quinzenal', 'A cada 2 semanas'], ['mensal', 'Todo mês']],
  repeatLabel: r => (Tasks.REPEAT.find(x => x[0] === r) || [, ''])[1],
  /* Próximo prazo de uma tarefa que se repete (nunca no passado) */
  nextDue(x) {
    const t = U.today();
    const dia = x.repeatDay || +(x.dueDate || t).slice(8, 10);   // mensal: mantém o dia (31 → 28/fev → 31/mar)
    const step = k => {
      if (x.repeat === 'diaria') return D.nextWorkday(k);
      if (x.repeat === 'semanal') return U.addDays(k, 7);
      if (x.repeat === 'quinzenal') return U.addDays(k, 14);
      const [y, m] = k.split('-').map(Number), mk = U.addMonths(`${y}-${U.pad(m)}`, 1);
      return `${mk}-${U.pad(Math.min(dia, +U.monthEnd(mk).slice(8, 10)))}`;
    };
    let n = step(x.dueDate || t);
    for (let i = 0; i < 400 && n < t; i++) n = step(n);
    if (x.repeat === 'diaria' && n <= t) n = D.nextWorkday(t);
    return n;
  },
};

Object.assign(Actions, {
  tkEdit({ id }) { Tasks.form(S.tasks.find(x => x.id === id)); },
  /* Botões da lista (como na Agenda): ✓ conclui, ↶ reabre, ⋯ mais opções */
  tkSet({ id, s }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    if (!Tasks.pode(x, s)) return;
    const prev = x.status, prevAt = x.completedAt;
    const nx = Tasks.setStatus(x, s); commit();
    const undo = { label: 'Desfazer', onClick: () => { Tasks.setStatus(x, prev); x.completedAt = prevAt; commit(); } };
    if (s === 'concluida') UI.toast(nx ? `Tarefa concluída. A próxima fica para ${U.fmtShort(nx.dueDate)}.` : 'Tarefa concluída.', 'ok', undo);
    else if (s === 'cancelada') UI.toast('Tarefa cancelada.', 'ok', undo);
  },
  tkPausar({ id }) {
    const x = S.tasks.find(y => y.id === id); if (!x || x.status !== 'andamento') return;
    x.status = 'pendente'; commit();
    UI.toast('Tarefa pausada. Continua na sua lista.', 'ok', { label: 'Reagendar', onClick: () => Tasks.reagendar(x) });
  },
  tkMore({ id }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    const aberta = OPEN(x.status);
    UI.sheet(x.title, [
      { label: 'Editar', icon: 'edit', onClick: () => Tasks.form(x) },
      ...(aberta ? [{ label: x.status === 'andamento' ? 'Pausar ou reagendar' : 'Reagendar', hint: x.status === 'andamento' ? 'Para agora e continua mais tarde ou em outro dia' : 'Outro horário hoje ou outro dia', icon: 'calendar', onClick: () => Tasks.reagendar(x) }] : []),
      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => Actions.tkDelete({ id }) },
    ]);
  },
  tkDelete({ id }) {
    const x = S.tasks.find(y => y.id === id);
    UI.confirm(`Excluir a tarefa <strong>${U.esc(x.title)}</strong>?`, () => {
      const i = S.tasks.indexOf(x); S.tasks.splice(i, 1); commit();
      UI.toast('Tarefa excluída.', 'ok', { label: 'Desfazer', onClick: () => { S.tasks.splice(i, 0, x); commit(); } });
    }, { danger: true, okLabel: 'Excluir' });
  },
  tkStatusF({ v }) { App.ui.taskF.status = v; App.render(); },
  tkFilter({ k }, el) { App.ui.taskF[k] = el.value; App.render(); },
  tkSearch(_, el) { App.ui.taskF.q = el.value; App.render({ keepFocus: true }); },
  tkFiltros() { App.ui.taskFOpen = !App.ui.taskFOpen; App.render(); },
  tkClear() { Object.assign(App.ui.taskF, { q: '', priority: '', category: '', period: '', from: '', to: '' }); App.render(); },
});
