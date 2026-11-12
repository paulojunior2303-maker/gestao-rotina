'use strict';
/* Gestão de tarefas — cadastro, filtros e alertas de prazo */
/* Tarefas: aparecem na Agenda (no dia do prazo e em Pendências) e na página de cada pessoa da Equipe */
const Tasks = {
  /* Linha da tarefa com os botões na frente: ▶ começar, ✓ concluir, ✕ cancelar (ou ↶ reabrir) e ⋯ editar/excluir */
  row(x, { semResp = false } = {}) {
    const dl = D.deadline(x.dueDate, x.dueTime, !OPEN(x.status));
    const fim = x.status === 'concluida' || x.status === 'cancelada';
    return `<div class="task ${x.status} ${dl ? 'dl-row-' + dl.level : ''}" style="--c:${D.cat(x.category).color}">
      <div class="tk-body" data-act="tkEdit" data-id="${x.id}">
        <div class="tk-title">${U.esc(x.title)}${H.demo(x)}${x.status === 'andamento' || x.status === 'cancelada' ? ' ' + H.status(x.status) : ''}</div>
        <div class="tk-meta">${['alta', 'urgente'].includes(x.priority) ? H.prio(x.priority) : ''}
          ${x.responsible && !semResp ? `<span class="muted">${U.icon('user', 13)} ${U.esc(x.responsible)}</span>` : ''}
          ${x.dueDate ? `<span class="muted">${U.icon('flag', 13)} ${U.fmtShort(x.dueDate)}${x.dueTime ? ' ' + x.dueTime : ''}</span>` : ''}
          ${H.deadline(dl && dl.level !== 'ok' ? dl : null)}</div>
      </div>
      <div class="tk-side">
        ${fim ? `<button class="icon-btn" data-act="tkSet" data-id="${x.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir">${U.icon('undo', 16)}</button>`
          : `${x.status === 'andamento'
              ? `<button class="icon-btn" data-act="tkSet" data-id="${x.id}" data-s="pendente" title="Voltar para pendente" aria-label="Voltar para pendente">${U.icon('undo', 16)}</button>`
              : `<button class="icon-btn info" data-act="tkSet" data-id="${x.id}" data-s="andamento" title="Começar agora" aria-label="Começar agora">${U.icon('play', 14)}</button>`}
             <button class="icon-btn ok" data-act="tkSet" data-id="${x.id}" data-s="concluida" title="Concluir" aria-label="Concluir">${U.icon('check', 16)}</button>
             <button class="icon-btn" data-act="tkSet" data-id="${x.id}" data-s="cancelada" title="Cancelar tarefa" aria-label="Cancelar tarefa">${U.icon('x', 16)}</button>`}
        <button class="icon-btn" data-act="tkMore" data-id="${x.id}" title="Mais opções" aria-label="Mais opções">${U.icon('more', 16)}</button>
      </div>
    </div>`;
  },
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
  /* Botões da lista (como na Agenda): ✓ conclui, ↶ reabre, ⋯ mais opções */
  tkSet({ id, s }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    const prev = x.status, prevAt = x.completedAt;
    Tasks.setStatus(x, s); commit();
    const undo = { label: 'Desfazer', onClick: () => { x.status = prev; x.completedAt = prevAt; commit(); } };
    if (s === 'concluida') UI.toast('Tarefa concluída.', 'ok', undo);
    else if (s === 'cancelada') UI.toast('Tarefa cancelada.', 'ok', undo);
  },
  tkMore({ id, v }) {
    const x = S.tasks.find(y => y.id === id); if (!x) return;
    const full = v === 'full' && OPEN(x.status);
    UI.sheet(x.title, [
      { label: 'Editar', icon: 'edit', onClick: () => Tasks.form(x) },
      ...(full ? [x.status === 'andamento' ? { label: 'Voltar para pendente', icon: 'undo', onClick: () => Actions.tkSet({ id, s: 'pendente' }) } : { label: 'Começar agora', hint: 'Marca como em andamento', icon: 'play', onClick: () => Actions.tkSet({ id, s: 'andamento' }) },
        { label: 'Cancelar tarefa', icon: 'x', onClick: () => Actions.tkSet({ id, s: 'cancelada' }) }] : []),
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
});
