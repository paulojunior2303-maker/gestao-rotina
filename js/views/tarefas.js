'use strict';
/* Gestão de tarefas — cadastro, filtros e alertas de prazo */
Views.tarefas = {
  title: 'Gestão de tarefas', icon: 'tasks', nav: 'Tarefas',
  fab: { act: 'tkNew', label: 'Nova tarefa' },
  render(params) {
    const f = App.ui.taskF = App.ui.taskF || { q: '', status: 'abertas', priority: '', category: '', period: '', from: '', to: '' };
    const t = U.today(), ws = U.weekStart(t), we = U.addDays(ws, 6);
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

    const stat = (k, l, cls = '') => `<button class="stat-chip ${cls} ${f.status === k ? 'active' : ''}" data-act="tkStatusF" data-v="${k}"><strong>${counts[k]}</strong><span>${l}</span></button>`;
    const sel = (name, opts, label) => `<select data-change="tkFilter" data-k="${name}" aria-label="${label}"><option value="">${label}</option>${UI.opts(opts, f[name])}</select>`;
    const filtersOn = f.priority || f.category || f.period || f.from || f.to || f.q;

    const row = x => {
      const dl = D.deadline(x.dueDate, x.dueTime, !OPEN(x.status));
      return `<div class="task ${x.status} ${dl ? 'dl-row-' + dl.level : ''}" style="--c:${D.cat(x.category).color}">
        <label class="tk-check" title="${x.status === 'concluida' ? 'Reabrir' : 'Concluir'}"><input type="checkbox" data-change="tkDone" data-id="${x.id}" ${x.status === 'concluida' ? 'checked' : ''} ${x.status === 'cancelada' ? 'disabled' : ''}><span></span></label>
        <div class="tk-body" data-act="tkEdit" data-id="${x.id}">
          <div class="tk-title">${U.esc(x.title)}${H.demo(x)}</div>
          ${x.description ? `<div class="tk-desc">${U.esc(x.description)}</div>` : ''}
          <div class="tk-meta">${H.cat(x.category)} ${H.prio(x.priority)} ${x.responsible ? `<span class="muted">${U.icon('user', 13)} ${U.esc(x.responsible)}</span>` : ''}
            ${x.dueDate ? `<span class="muted">${U.icon('flag', 13)} ${U.fmtDate(x.dueDate)}${x.dueTime ? ' ' + x.dueTime : ''}</span>` : '<span class="muted">Sem prazo</span>'}
            ${H.deadline(dl && dl.level !== 'ok' ? dl : null)}</div>
        </div>
        <div class="tk-side">
          <select class="status-sel" data-change="tkStatus" data-id="${x.id}" style="--c:${D.status(x.status).color}">${UI.opts(H.statusOptions(), x.status)}</select>
          <button class="icon-btn" data-act="tkDelete" data-id="${x.id}" title="Excluir">${U.icon('trash', 16)}</button>
        </div>
      </div>`;
    };

    return `
    <div class="toolbar">
      <div class="stat-chips">${stat('abertas', 'Abertas')}${stat('andamento', 'Em andamento', 'c-blue')}${stat('atrasadas', 'Atrasadas', 'c-red')}${stat('concluida', 'Concluídas', 'c-green')}${stat('todas', 'Todas')}</div>
    </div>
    <div class="filters card">
      <input type="search" placeholder="Buscar tarefa, descrição ou responsável…" value="${U.esc(f.q)}" data-input="tkSearch" aria-label="Buscar">
      ${sel('category', H.catOptions(), 'Todas as categorias')}
      ${sel('priority', H.prioOptions(), 'Todas as prioridades')}
      ${sel('period', [['hoje', 'Prazo hoje'], ['semana', 'Prazo nesta semana'], ['proximos', 'Próximos 7 dias'], ['semprazo', 'Sem prazo']], 'Qualquer prazo')}
      <label class="inline">De <input type="date" value="${f.from}" data-change="tkFilter" data-k="from"></label>
      <label class="inline">Até <input type="date" value="${f.to}" data-change="tkFilter" data-k="to"></label>
      ${filtersOn ? '<button class="btn sm ghost" data-act="tkClear">Limpar filtros</button>' : ''}
    </div>
    <p class="muted small">${U.plural(list.length, 'tarefa encontrada', 'tarefas encontradas')}</p>
    <div class="task-list">${list.length ? list.map(row).join('') : H.empty(all.length ? 'Nenhuma tarefa com esses filtros.' : 'Nenhuma tarefa cadastrada ainda.', all.length ? '' : '<button class="btn sm primary" data-act="tkNew">Criar primeira tarefa</button>')}</div>`;
  },
};

const Tasks = {
  form(x, defaults = {}) {
    const isNew = !x;
    x = x || { priority: 'media', status: 'pendente', category: 'administrativo', startDate: U.today(), ...defaults };
    UI.form({
      title: isNew ? 'Nova tarefa' : 'Editar tarefa',
      wide: true,
      fields: [
        { name: 'title', label: 'Nome', required: true, value: x.title },
        { name: 'description', label: 'Descrição', type: 'textarea', value: x.description },
        { name: 'category', label: 'Categoria', type: 'select', options: H.catOptions(), value: x.category, half: true },
        { name: 'responsible', label: 'Responsável (se delegada)', value: x.responsible, list: D.techNames(), half: true },
        { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: x.priority, half: true },
        { name: 'status', label: 'Status', type: 'select', options: H.statusOptions(), value: x.status, half: true },
        { name: 'startDate', label: 'Data de início', type: 'date', value: x.startDate, half: true },
        { name: 'dueDate', label: 'Prazo de conclusão', type: 'date', value: x.dueDate, half: true },
        { name: 'dueTime', label: 'Horário (opcional)', type: 'time', value: x.dueTime, half: true },
        { type: 'html', html: isNew ? '' : `<p class="muted small">Criada em ${U.fmtDateTime(x.createdAt)}${x.completedAt ? ` · Concluída em ${U.fmtDateTime(x.completedAt)}` : ''}</p>`, half: true },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: x.notes },
      ],
      validate: v => v.startDate && v.dueDate && v.dueDate < v.startDate ? 'O prazo não pode ser anterior à data de início.' : null,
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); Actions.tkDelete({ id: x.id }); } }],
      onSubmit(v) {
        if (isNew) S.tasks.push({ id: U.uid(), createdAt: new Date().toISOString(), completedAt: v.status === 'concluida' ? new Date().toISOString() : null, ...v });
        else { Tasks.setStatus(x, v.status); Object.assign(x, { ...v, status: x.status }); }
        commit(); UI.toast(isNew ? 'Tarefa criada.' : 'Tarefa atualizada.');
      },
    });
  },
  setStatus(x, s) {
    if (s === 'concluida' && x.status !== 'concluida') x.completedAt = new Date().toISOString();
    if (s !== 'concluida') x.completedAt = null;
    x.status = s;
  },
};

Object.assign(Actions, {
  tkNew() { Tasks.form(null); },
  tkEdit({ id }) { Tasks.form(S.tasks.find(x => x.id === id)); },
  tkDone({ id }, el) { const x = S.tasks.find(y => y.id === id); Tasks.setStatus(x, el.checked ? 'concluida' : 'pendente'); commit(); if (el.checked) UI.toast('Tarefa concluída.', 'ok', { label: 'Desfazer', onClick: () => { Tasks.setStatus(x, 'pendente'); commit(); } }); },
  tkStatus({ id }, el) { const x = S.tasks.find(y => y.id === id); Tasks.setStatus(x, el.value); commit(); },
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
  tkClear() { Object.assign(App.ui.taskF, { q: '', priority: '', category: '', period: '', from: '', to: '' }); App.render(); },
});
