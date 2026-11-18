'use strict';
/* Gestão de tarefas — cadastro, filtros e alertas de prazo */
Views.tarefas = {
  title: 'Gestão de tarefas', icon: 'tasks', nav: 'Tarefas',
  fab: { act: 'tkNew', label: 'Nova tarefa' },
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
      return `<div class="task ${x.status} ${dl ? 'dl-row-' + dl.level : ''}">
        <button class="tk-ck ${late ? 'late' : ''} ${x.status === 'andamento' ? 'and' : ''}" data-act="tkSet" data-id="${x.id}" data-s="${fechada ? 'pendente' : 'concluida'}" title="${fechada ? 'Reabrir' : 'Concluir'}" aria-label="${fechada ? 'Reabrir' : 'Concluir'}: ${U.esc(x.title)}">${x.status === 'concluida' ? U.icon('check', 13) : x.status === 'cancelada' ? U.icon('x', 12) : ''}</button>
        <div class="tk-body" data-act="tkEdit" data-id="${x.id}">
          <div class="tk-title">${U.esc(x.title)}${H.demo(x)}</div>
          ${meta ? `<div class="tk-meta">${meta}</div>` : ''}
          ${x.description ? `<div class="tk-desc">${U.esc(x.description)}</div>` : ''}
        </div>
        ${prio}
        ${!OPEN(x.status) ? '' : x.status === 'andamento'
          ? `<button class="icon-btn tk-play on" data-act="tkSet" data-id="${x.id}" data-s="pendente" title="Pausar (volta para pendente)" aria-label="Pausar: ${U.esc(x.title)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/></svg></button>`
          : `<button class="icon-btn tk-play" data-act="tkSet" data-id="${x.id}" data-s="andamento" title="Começar agora" aria-label="Começar: ${U.esc(x.title)}">${U.icon('play', 14)}</button>`}
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
    const col = (titulo, sub, ks) => { const n = list.filter(x => ks.includes(grupoDe(x))).length; return `<section class="tk-col"><header><b>${titulo}</b><span>${sub}</span></header>${n ? grupos(ks, list) : `<p class="tk-col-vazio">${titulo === 'Hoje' ? 'Nada para hoje.' : 'Nada por aqui.'}</p>`}<button class="tk-add" data-act="tkNew">+ Adicionar</button></section>`; };
    const nome = ((S.settings.usuario || '').trim().split(' ')[0]) || '';
    // Sugestão 6: tela vazia com a voz do app
    const vazio = !all.length || (f.status === 'abertas' && !filtersOn && !list.length)
      ? H.vazio('Nada pendente.', nome ? `Pode respirar, ${U.esc(nome)}.` : 'Calma, Pae.', all.length ? 'Você zerou a lista. Quando aparecer algo, é só anotar ou falar.' : 'Sua lista começa aqui. Anote o que precisa fazer e o app lembra por você.',
        [['plus', 'Toque no + e escreva em poucas palavras'], ['mic', 'Ou grave um áudio: o app anota sozinho']], counts.concluida ? `${U.plural(counts.concluida, 'tarefa concluída', 'tarefas concluídas')} até agora` : '')
      : H.empty(f.status === 'atrasadas' && !filtersOn ? 'Nada atrasado. Tudo em dia.' : 'Nenhuma tarefa com esses filtros.');

    return `
    <div class="toolbar">
      <div class="stat-chips tk-abas" role="tablist">${stat('abertas', 'Abertas')}${stat('andamento', 'Em andamento', 'c-blue')}${stat('atrasadas', 'Atrasadas', 'c-red')}${stat('concluida', 'Concluídas', 'c-green')}${stat('todas', 'Todas')}</div>
    </div>
    <div class="tk-busca">
      <input type="search" placeholder="Buscar tarefa ou responsável…" value="${U.esc(f.q)}" data-input="tkSearch" aria-label="Buscar">
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
    UI.form({
      title: isNew ? 'Nova tarefa' : 'Editar tarefa',
      fields: [
        { name: 'title', label: 'O que precisa fazer?', required: true, value: x.title },
        { name: 'dueDate', label: 'Dia', type: 'date', value: x.dueDate, half: true },
        { name: 'dueTime', label: 'Horário', type: 'time', value: x.dueTime, half: true },
        { name: 'dur', label: 'Duração', type: 'select', options: Tasks.DURS, value: String(x.dur || ''), half: true },
        { name: 'responsible', label: 'Quem faz?', value: x.responsible, list: D.techNames(), placeholder: 'Você', half: true },
        { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: x.priority, half: true },
        { name: 'repeat', label: 'Repetir', type: 'select', options: Tasks.REPEAT, value: x.repeat || '', half: true },
        { name: 'description', label: 'Observação', type: 'textarea', rows: 2, value: obs, placeholder: 'Opcional' },
        { type: 'html', html: `<p class="muted small tk-form-dica">Sem dia, a tarefa aparece hoje na Agenda até você concluir.${isNew ? '' : ` Criada em ${U.fmtDateTime(x.createdAt)}${x.completedAt ? ` · concluída em ${U.fmtDateTime(x.completedAt)}` : ''}.`}</p>` },
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
  tkNew() { Tasks.form(null); },
  tkEdit({ id }) { Tasks.form(S.tasks.find(x => x.id === id)); },
  /* Botões da lista (como na Agenda): ✓ conclui, ↶ reabre, ⋯ mais opções */
  tkSet({ id, s }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    const prev = x.status, prevAt = x.completedAt;
    const nx = Tasks.setStatus(x, s); commit();
    const undo = { label: 'Desfazer', onClick: () => { Tasks.setStatus(x, prev); x.completedAt = prevAt; commit(); } };
    if (s === 'concluida') UI.toast(nx ? `Tarefa concluída. A próxima fica para ${U.fmtShort(nx.dueDate)}.` : 'Tarefa concluída.', 'ok', undo);
    else if (s === 'cancelada') UI.toast('Tarefa cancelada.', 'ok', undo);
  },
  tkMore({ id }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    const aberta = OPEN(x.status);
    UI.sheet(x.title, [
      { label: 'Editar', icon: 'edit', onClick: () => Tasks.form(x) },
      ...(aberta ? [{ label: 'Cancelar tarefa', icon: 'x', onClick: () => Actions.tkSet({ id, s: 'cancelada' }) }] : []),
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
