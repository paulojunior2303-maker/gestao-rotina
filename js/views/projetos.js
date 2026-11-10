'use strict';
/* Gestão de projetos — Kanban e linha do tempo */
Views.projetos = {
  title: 'Gestão de projetos', icon: 'kanban', nav: 'Projetos',
  fab: { act: 'pjNew', label: 'Novo projeto' },
  render() {
    const mode = App.ui.projMode || 'kanban';
    const ps = S.projects;
    const card = p => {
      const pct = D.projectProgress(p);
      const dl = D.deadline(p.dueDate, null, ['concluido', 'cancelado'].includes(p.status));
      const pend = (p.pendencias || []).filter(x => !x.done).length;
      return `<div class="pj-card ${D.projectLate(p) ? 'late' : ''}" draggable="true" data-pid="${p.id}" data-act="pjOpen" data-id="${p.id}">
        <div class="pj-name">${U.esc(p.name)}${H.demo(p)}</div>
        ${p.client ? `<div class="muted small">${U.esc(p.client)}</div>` : ''}
        <div class="pm-b">${H.bar(pct, p.status === 'concluido' ? 'var(--green)' : D.projectLate(p) ? 'var(--red)' : 'var(--accent)')}<strong>${pct}%</strong></div>
        <div class="pj-meta">
          ${p.responsible ? `<span>${U.icon('user', 13)} ${U.esc(p.responsible)}</span>` : ''}
          ${p.stages && p.stages.length ? `<span>${U.icon('tasks', 13)} ${p.stages.filter(s => s.done).length}/${p.stages.length}</span>` : ''}
          ${pend ? `<span class="c-yellow">${U.icon('alert', 13)} ${U.plural(pend, 'pendência', 'pendências')}</span>` : ''}
        </div>
        ${dl && dl.level !== 'ok' ? H.deadline(dl) : p.dueDate ? `<small class="muted">Prazo ${U.fmtDate(p.dueDate)}</small>` : ''}
      </div>`;
    };

    let body;
    if (!ps.length) body = H.empty('Nenhum projeto cadastrado.', '<button class="btn sm primary" data-act="pjNew">Cadastrar projeto</button>');
    else if (mode === 'kanban') {
      body = `<div class="kanban">${Object.entries(PROJECT_STATUS).map(([k, st]) => {
        const items = ps.filter(p => p.status === k);
        if (k === 'cancelado' && !items.length) return '';
        return `<div class="kb-col" data-drop="${k}"><div class="kb-h" style="--c:${st.color}"><span class="cat-dot"></span>${st.label}<span class="kb-n">${items.length}</span></div><div class="kb-items">${items.map(card).join('') || '<div class="kb-empty">Arraste projetos para cá</div>'}</div></div>`;
      }).join('')}</div><p class="muted small">Arraste os cartões entre as colunas para mudar o status (no celular, abra o projeto e altere o status).</p>`;
    } else {
      const dated = ps.filter(p => p.startDate && p.dueDate && p.status !== 'cancelado');
      const undated = ps.filter(p => !(p.startDate && p.dueDate) && p.status !== 'cancelado');
      if (!dated.length) body = H.empty('Defina data de início e prazo nos projetos para vê-los na linha do tempo.');
      else {
        const t = U.today();
        let min = dated.reduce((m, p) => p.startDate < m ? p.startDate : m, t);
        let max = dated.reduce((m, p) => p.dueDate > m ? p.dueDate : m, t);
        min = U.monthStart(U.monthKey(min)); max = U.monthEnd(U.monthKey(max));
        const total = U.diffDays(min, max) + 1;
        const pos = k => U.clamp(U.diffDays(min, k) / total * 100, 0, 100);
        const months = []; for (let mk = U.monthKey(min); mk <= U.monthKey(max); mk = U.addMonths(mk, 1)) months.push(mk);
        body = `<div class="card gantt">
          <div class="g-row g-head"><div class="g-name"></div><div class="g-track">${months.map(mk => `<span class="g-month" style="left:${pos(U.monthStart(mk))}%;width:${(U.diffDays(U.monthStart(mk), U.monthEnd(mk)) + 1) / total * 100}%">${U.MONTHS[Number(mk.slice(5)) - 1].slice(0, 3)}/${mk.slice(2, 4)}</span>`).join('')}</div></div>
          ${dated.sort((a, b) => a.startDate.localeCompare(b.startDate)).map(p => {
            const pct = D.projectProgress(p), st = PROJECT_STATUS[p.status];
            const l = pos(p.startDate), w = Math.max(1.2, pos(U.addDays(p.dueDate, 1)) - l);
            return `<div class="g-row"><div class="g-name" data-act="pjOpen" data-id="${p.id}">${U.esc(p.name)}${H.demo(p)}<small>${st.label} · ${pct}%</small></div>
              <div class="g-track"><span class="g-today" style="left:${pos(t)}%"></span>
              <div class="g-bar ${D.projectLate(p) ? 'late' : ''}" style="left:${l}%;width:${w}%;--c:${st.color}" data-act="pjOpen" data-id="${p.id}" title="${U.esc(p.name)}: ${U.fmtDate(p.startDate)} → ${U.fmtDate(p.dueDate)}"><span style="width:${pct}%"></span></div></div></div>`;
          }).join('')}
          <p class="muted small mt">A linha vermelha vertical marca hoje. O preenchimento da barra indica o percentual concluído.</p>
        </div>
        ${undated.length ? `<p class="muted small">Sem datas definidas: ${undated.map(p => `<a class="link" data-act="pjOpen" data-id="${p.id}">${U.esc(p.name)}</a>`).join(', ')}</p>` : ''}`;
      }
    }

    const cnt = k => ps.filter(p => p.status === k).length;
    return `
    <div class="toolbar">
      <div class="tabs">
        <button class="tab ${mode === 'kanban' ? 'active' : ''}" data-act="pjMode" data-v="kanban">${U.icon('kanban', 15)} Kanban</button>
        <button class="tab ${mode === 'timeline' ? 'active' : ''}" data-act="pjMode" data-v="timeline">${U.icon('timeline', 15)} Linha do tempo</button>
      </div>
      <span class="muted small">${cnt('andamento')} em andamento · ${cnt('planejamento')} em planejamento · ${cnt('concluido')} concluídos${ps.filter(D.projectLate).length ? ` · <span class="c-red">${ps.filter(D.projectLate).length} com prazo vencido</span>` : ''}</span>
    </div>
    ${body}`;
  },
  mount(root) {
    root.querySelectorAll('.pj-card[draggable]').forEach(c => {
      c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.pid); c.classList.add('dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
    });
    root.querySelectorAll('[data-drop]').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('over');
        const p = S.projects.find(x => x.id === e.dataTransfer.getData('text/plain'));
        if (p && p.status !== col.dataset.drop) { Projects.setStatus(p, col.dataset.drop); commit(); UI.toast(`Status alterado para ${PROJECT_STATUS[p.status].label}.`); }
      });
    });
  },
};

const Projects = {
  openId: null, modal: null,
  setStatus(p, s) {
    if (s === 'concluido' && p.status !== 'concluido') p.completedAt = new Date().toISOString();
    if (s !== 'concluido') p.completedAt = null;
    p.status = s;
  },
  form(p) {
    const isNew = !p;
    p = p || { status: 'planejamento', startDate: U.today(), manualProgress: 0 };
    UI.form({
      title: isNew ? 'Novo projeto' : 'Editar projeto', wide: true,
      fields: [
        { name: 'name', label: 'Nome do projeto', required: true, value: p.name },
        { name: 'client', label: 'Cliente ou empreendimento', value: p.client, half: true },
        { name: 'responsible', label: 'Responsável', value: p.responsible, list: D.techNames(), half: true },
        { name: 'description', label: 'Descrição', type: 'textarea', value: p.description },
        { name: 'startDate', label: 'Data de início', type: 'date', value: p.startDate, half: true },
        { name: 'dueDate', label: 'Prazo previsto', type: 'date', value: p.dueDate, half: true },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label]), value: p.status, half: true },
        { name: 'manualProgress', label: 'Percentual de conclusão (%)', type: 'number', min: 0, max: 100, value: p.manualProgress, half: true, hint: 'Usado apenas quando o projeto não tem etapas cadastradas. Com etapas, o percentual é calculado automaticamente.' },
        { name: 'stagesText', label: isNew ? 'Etapas de execução (uma por linha)' : 'Etapas', type: isNew ? 'textarea' : 'html', html: '<p class="muted small">As etapas e pendências são gerenciadas na tela de detalhes do projeto.</p>', rows: 4, placeholder: 'Ex.:\nVistoria técnica\nInstalação\nConfiguração\nEntrega' },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: p.notes },
      ],
      validate: v => v.startDate && v.dueDate && v.dueDate < v.startDate ? 'O prazo não pode ser anterior à data de início.' : (v.manualProgress !== null && (v.manualProgress < 0 || v.manualProgress > 100) ? 'O percentual deve estar entre 0 e 100.' : null),
      onSubmit(v) {
        const { stagesText, status, ...data } = v;
        if (isNew) {
          const np = { id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, status: 'planejamento', stages: (stagesText || '').split('\n').map(s => s.trim()).filter(Boolean).map(name => ({ id: U.uid(), name, done: false })), pendencias: [], ...data };
          Projects.setStatus(np, status);
          S.projects.push(np);
        } else { Object.assign(p, data); Projects.setStatus(p, status); }
        commit(); Projects.refresh(); UI.toast(isNew ? 'Projeto criado.' : 'Projeto atualizado.');
      },
    });
  },
  detailHtml(p) {
    const pct = D.projectProgress(p);
    const dl = D.deadline(p.dueDate, null, ['concluido', 'cancelado'].includes(p.status));
    return `
      <div class="pj-detail">
        <div class="pj-info">
          <div><small>Cliente / empreendimento</small><strong>${U.esc(p.client || '—')}</strong></div>
          <div><small>Responsável</small><strong>${U.esc(p.responsible || '—')}</strong></div>
          <div><small>Início</small><strong>${U.fmtDate(p.startDate)}</strong></div>
          <div><small>Prazo previsto</small><strong>${U.fmtDate(p.dueDate)}</strong> ${H.deadline(dl && dl.level !== 'ok' ? dl : null)}</div>
          <div><small>Status</small><select data-change="pjStatus" data-id="${p.id}">${UI.opts(Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label]), p.status)}</select></div>
        </div>
        ${p.description ? `<p>${U.esc(p.description)}</p>` : ''}
        <div class="pm-b big">${H.bar(pct, p.status === 'concluido' ? 'var(--green)' : 'var(--accent)')}<strong>${pct}%</strong></div>
        <small class="muted">${p.stages.length ? 'Calculado pelas etapas concluídas.' : 'Percentual manual (cadastre etapas para cálculo automático).'}</small>

        <h4>Etapas de execução</h4>
        <ul class="checklist">${p.stages.map(s => `<li><label class="check"><input type="checkbox" data-change="pjStage" data-id="${p.id}" data-sid="${s.id}" ${s.done ? 'checked' : ''}><span>${U.esc(s.name)}</span></label><button class="icon-btn xs" data-act="pjStageDel" data-id="${p.id}" data-sid="${s.id}" title="Remover">${U.icon('x', 13)}</button></li>`).join('') || '<li class="muted small">Nenhuma etapa.</li>'}</ul>
        <form class="inline-add" data-submit="pjStageAdd" data-id="${p.id}"><input name="text" placeholder="Nova etapa…" required><button class="btn sm">${U.icon('plus', 15)}</button></form>

        <h4>Pendências</h4>
        <ul class="checklist">${p.pendencias.map(s => `<li><label class="check"><input type="checkbox" data-change="pjPend" data-id="${p.id}" data-sid="${s.id}" ${s.done ? 'checked' : ''}><span>${U.esc(s.text)}</span></label><button class="icon-btn xs" data-act="pjPendDel" data-id="${p.id}" data-sid="${s.id}" title="Remover">${U.icon('x', 13)}</button></li>`).join('') || '<li class="muted small">Nenhuma pendência.</li>'}</ul>
        <form class="inline-add" data-submit="pjPendAdd" data-id="${p.id}"><input name="text" placeholder="Nova pendência…" required><button class="btn sm">${U.icon('plus', 15)}</button></form>

        ${p.notes ? `<h4>Observações</h4><p class="pre">${U.esc(p.notes)}</p>` : ''}
      </div>`;
  },
  open(id) {
    const p = S.projects.find(x => x.id === id); if (!p) return;
    Projects.openId = id;
    const m = UI.modal({
      title: p.name, wide: true, body: Projects.detailHtml(p),
      footer: `<button class="btn ghost danger-text" data-del>${U.icon('trash', 15)} Excluir</button><span class="grow"></span><button class="btn primary" data-edit>${U.icon('edit', 15)} Editar dados</button>`,
      onClose: () => { Projects.openId = null; Projects.modal = null; },
    });
    Projects.modal = m;
    m.el.querySelector('[data-edit]').onclick = () => Projects.form(S.projects.find(x => x.id === id));
    m.el.querySelector('[data-del]').onclick = () => UI.confirm(`Excluir o projeto <strong>${U.esc(p.name)}</strong>?`, () => { S.projects = S.projects.filter(x => x.id !== id); m.close(); commit(); UI.toast('Projeto excluído.'); }, { danger: true, okLabel: 'Excluir' });
  },
  refresh() {
    if (!Projects.modal) return;
    const p = S.projects.find(x => x.id === Projects.openId); if (!p) return;
    Projects.modal.setBody(Projects.detailHtml(p));
    Projects.modal.el.querySelector('.modal-head h2').textContent = p.name;
  },
  sub(id, list, sid) { const p = S.projects.find(x => x.id === id); return [p, p[list].find(s => s.id === sid)]; },
};

Object.assign(Actions, {
  pjMode({ v }) { App.ui.projMode = v; App.render(); },
  pjNew() { Projects.form(null); },
  pjOpen({ id }) { Projects.open(id); },
  pjStatus({ id }, el) { const p = S.projects.find(x => x.id === id); Projects.setStatus(p, el.value); commit(); Projects.refresh(); },
  pjStage({ id, sid }, el) { const [, s] = Projects.sub(id, 'stages', sid); s.done = el.checked; commit(); Projects.refresh(); },
  pjPend({ id, sid }, el) { const [, s] = Projects.sub(id, 'pendencias', sid); s.done = el.checked; commit(); Projects.refresh(); },
  pjStageDel({ id, sid }) { const p = S.projects.find(x => x.id === id); p.stages = p.stages.filter(s => s.id !== sid); commit(); Projects.refresh(); },
  pjPendDel({ id, sid }) { const p = S.projects.find(x => x.id === id); p.pendencias = p.pendencias.filter(s => s.id !== sid); commit(); Projects.refresh(); },
  pjStageAdd({ id }, form) { const p = S.projects.find(x => x.id === id); p.stages.push({ id: U.uid(), name: form.elements.text.value.trim(), done: false }); commit(); Projects.refresh(); Projects.modal.el.querySelector('[data-submit="pjStageAdd"] input').focus(); },
  pjPendAdd({ id }, form) { const p = S.projects.find(x => x.id === id); p.pendencias.push({ id: U.uid(), text: form.elements.text.value.trim(), done: false }); commit(); Projects.refresh(); Projects.modal.el.querySelector('[data-submit="pjPendAdd"] input').focus(); },
});
