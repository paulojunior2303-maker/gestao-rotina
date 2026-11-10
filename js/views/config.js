'use strict';
/* Configurações — jornada, rotina, categorias, prioridades, status, técnicos, metas e dados */
Views.config = {
  title: 'Configurações', icon: 'settings', nav: 'Configurações',
  mount(root) {
    if (Native.available()) Reminders.fillStatus(root);
    const j = App.ui.cfgJump; App.ui.cfgJump = null;
    if (j) setTimeout(() => root.querySelector('#cfg-' + j)?.scrollIntoView({ block: 'start' }), 60);
  },
  render() {
    const st = S.settings;
    const freqTxt = r => r.freq === 'mensal' ? `Mensal, dia ${r.monthDay}` : (r.days || []).length === 5 && [1, 2, 3, 4, 5].every(d => r.days.includes(d)) ? 'Seg a Sex' : (r.days || []).map(d => U.WD_SHORT[d]).join(', ') || '—';
    const routine = D.sortBlocks(S.routine);
    const sec = (id, title, desc, body) => `<section class="card cfg" id="cfg-${id}"><div class="card-h"><div><h3>${title}</h3>${desc ? `<p class="muted small">${desc}</p>` : ''}</div></div>${body}</section>`;
    const lsSize = (() => { try { return Math.round((localStorage.getItem(STORAGE_KEY) || '').length / 1024); } catch (e) { return 0; } })();

    return `
    <nav class="cfg-nav">${[['aparencia', 'Aparência'], ['drive', 'Google Drive'], ['lembretes', 'Lembretes'], ['ia', 'IA'], ['jornada', 'Jornada'], ['rotina', 'Rotina padrão'], ['categorias', 'Categorias'], ['prioridades', 'Prioridades e status'], ['tecnicos', 'Técnicos'], ...(st.showIndicadores ? [['metas', 'Metas']] : []), ['dados', 'Dados']].map(([id, l]) => `<a href="#config" data-act="cfgJump" data-id="${id}">${l}</a>`).join('')}</nav>

    ${sec('aparencia', 'Aparência', 'Escolha o visual do app e quais telas aparecem no menu.', `
      <div class="theme-pick" role="radiogroup" aria-label="Tema">${[
        ['escuro', 'Escuro', 'Grafite e roxo'],
        ['claro', 'Claro', 'Fundo claro'],
        ['auto', 'Automático', 'Segue o aparelho'],
      ].map(([v, l, d]) => `<button class="theme-opt ${(st.theme || 'escuro') === v ? 'on' : ''}" role="radio" aria-checked="${(st.theme || 'escuro') === v}" data-act="themeSet" data-v="${v}">
          <span class="theme-prev tp-${v}"><i></i><i></i><i></i></span><strong>${l}</strong><small>${d}</small></button>`).join('')}</div>
      <label class="switch-row"><span><strong>Mostrar a tela Indicadores</strong><small>Lançamento de pontos de câmera, manutenções e retrabalhos, metas e relatórios em Excel e PDF. Os dados ficam guardados mesmo com a tela oculta.</small></span>
        <input type="checkbox" class="switch" data-change="cfgIndicadores" ${st.showIndicadores ? 'checked' : ''}></label>
      <label class="switch-row"><span><strong>Mostrar a tela Projetos</strong><small>Obras e projetos com etapas, Kanban e linha do tempo. Os dados ficam guardados mesmo com a tela oculta.</small></span>
        <input type="checkbox" class="switch" data-change="cfgProjetos" ${st.showProjetos ? 'checked' : ''}></label>`)}

    ${Drive.section(sec)}

    ${Reminders.section(sec)}

    ${sec('ia', 'IA (Google Gemini)', IA.supported() ? 'Preenche o registro das reuniões a partir da gravação ou das suas anotações. Usa a sua própria chave do Google.' : '', !IA.supported() ? '<p class="muted small">A IA funciona no app Android e no site. No link do Claude ela não está disponível.</p>' : `
      ${IA.key() ? `<div class="lem-row ok">${U.icon('check', 16)}<span>Chave cadastrada (termina em <strong>${U.esc(IA.key().slice(-4))}</strong>)</span><button class="btn sm" data-act="iaTest">Testar</button><button class="btn sm ghost danger-text" data-act="iaRemove">Remover</button></div>` : ''}
      <form class="ia-key" data-submit="iaSave">
        <label for="ia-key">${IA.key() ? 'Trocar a chave' : 'Chave da API'}</label>
        <div class="inline-add"><input id="ia-key" name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Cole aqui a chave do AI Studio"><button type="button" class="btn sm ghost" data-act="iaShow">Mostrar</button><button class="btn sm primary">Salvar</button></div>
      </form>
      <form class="ia-agent" data-submit="iaAgentSave">
        <label for="ia-agent">Instruções do seu agente <span class="muted">(opcional)</span></label>
        <p class="muted small">Cole aqui o prompt do agente que você usa para atas e pautas. A IA segue esse padrão ao montar a ata e a pauta. Em branco, usa um estilo padrão objetivo.</p>
        <textarea id="ia-agent" name="agente" rows="6" placeholder="Ex.: Atue como meu assistente de documentação…">${U.esc((st.ia && st.ia.agente) || '')}</textarea>
        <div class="field ia-level"><label for="ia-nivel">Nível da ata</label><select id="ia-nivel" name="nivel">${UI.opts([['detalhada', 'Detalhada'], ['compacta', 'Compacta'], ['resumida', 'Resumida']], (st.ia && st.ia.nivel) || 'detalhada')}</select></div>
        <div class="row-actions"><button class="btn sm primary">Salvar instruções</button>${st.ia && st.ia.agente ? `<span class="muted small">${U.plural(st.ia.agente.length, 'caractere')} salvos</span>` : ''}</div>
      </form>
      <details class="ia-help"><summary>Como conseguir a chave</summary><ol class="steps">
        <li>Abra <strong>aistudio.google.com</strong> e entre com sua conta Google.</li>
        <li>Toque em <strong>Get API key</strong> e depois em <strong>Create API key</strong>.</li>
        <li>Copie a chave e cole no campo acima.</li></ol></details>
      <p class="muted small mt">A chave fica guardada nos seus dados (e nos backups). Nada é enviado para a IA sem você tocar em “Preencher com IA”. No plano gratuito, o Google pode usar o conteúdo para melhorar os modelos; ative o faturamento no AI Studio para evitar isso.</p>`)}

    ${sec('jornada', 'Jornada de trabalho', 'Horários usados para alertas de “fora do expediente” e para encaixar imprevistos.', `
      <form class="form-grid cfg-form" data-submit="cfgJornada">
        <div class="field"><label>Entrada</label><input type="time" name="workStart" value="${st.workStart}" required></div>
        <div class="field"><label>Saída</label><input type="time" name="workEnd" value="${st.workEnd}" required></div>
        <div class="field full"><label for="cfg-break">Intervalo de almoço</label><select id="cfg-break" name="breakMode" data-change="cfgBreakMode">${UI.opts([['flexivel', 'Flexível: marco na hora, pela Agenda'], ['fixo', 'Horário fixo todos os dias'], ['nenhum', 'Sem intervalo']], st.breakMode || 'fixo')}</select>
          <small class="hint">${(st.breakMode || 'fixo') === 'flexivel' ? 'Na Agenda, toque em <strong>Intervalo agora</strong> quando for almoçar: as atividades seguintes são empurradas.' : (st.breakMode || 'fixo') === 'fixo' ? 'O intervalo entra na agenda de todos os dias úteis, no horário abaixo.' : 'Nenhum intervalo é colocado na agenda.'}</small></div>
        ${(st.breakMode || 'fixo') === 'fixo' ? `<div class="field"><label>Início do intervalo</label><input type="time" name="breakStart" value="${st.breakStart}"></div>
        <div class="field"><label>Fim do intervalo</label><input type="time" name="breakEnd" value="${st.breakEnd}"></div>` : (st.breakMode || 'fixo') === 'flexivel' ? `<div class="field"><label>Duração do intervalo</label><select name="breakDur">${UI.opts([[30, '30 min'], [45, '45 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas']], st.breakDur || 60)}</select></div>` : ''}
        <div class="field full"><span class="lbl">Dias de trabalho</span><div class="wd-pick">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="workDays" value="${d}" ${st.workDays.includes(d) ? 'checked' : ''}><span>${U.WD_SHORT[d]}</span></label>`).join('')}</div></div>
        <div class="field"><label>Alertar prazos com antecedência de (dias)</label><input type="number" name="alertDays" min="0" max="30" value="${st.alertDays}"></div>
        ${(st.breakMode || 'fixo') === 'fixo' ? '<div class="field full"><label class="check"><input type="checkbox" name="syncBreak" checked> <span>Atualizar também o horário do bloco “Intervalo” na rotina padrão</span></label></div>' : ''}
        <div class="full"><button class="btn primary">Salvar jornada</button></div>
      </form>`)}

    ${sec('rotina', 'Rotina padrão (horários das atividades)', 'Modelo usado para montar a agenda de cada dia útil. Alterações valem para os dias que ainda não foram editados.', `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Horário</th><th>Atividade</th><th>Categoria</th><th>Prioridade</th><th>Frequência</th><th></th></tr></thead>
        <tbody>${routine.map(r => `<tr><td class="nowrap">${r.start}–${r.end}</td><td>${U.esc(r.title)}${r.fixed ? ' <span class="badge">fixo</span>' : ''}</td><td>${H.cat(r.category)}</td><td>${H.prio(r.priority)}</td><td>${freqTxt(r)}</td>
          <td class="nowrap"><button class="icon-btn xs" data-act="rtEdit" data-id="${r.id}" title="Editar">${U.icon('edit', 14)}</button><button class="icon-btn xs" data-act="rtDel" data-id="${r.id}" title="Excluir">${U.icon('trash', 14)}</button></td></tr>`).join('')}</tbody>
      </table></div>
      <div class="row-actions"><button class="btn sm" data-act="rtNew">${U.icon('plus', 15)} Nova atividade recorrente</button><button class="btn sm ghost" data-act="rtReset">${U.icon('undo', 15)} Restaurar rotina original</button></div>`)}

    ${sec('categorias', 'Categorias de atividades', 'Usadas na agenda e nas tarefas. A cor identifica a categoria em todo o aplicativo.', `
      <div class="cfg-list">${st.categories.map(c => `<div class="cfg-item"><input type="color" value="${c.color}" data-change="catColor" data-id="${c.id}" aria-label="Cor"><input type="text" value="${U.esc(c.name)}" data-change="catName" data-id="${c.id}" aria-label="Nome"><button class="icon-btn xs" data-act="catDel" data-id="${c.id}" title="Excluir">${U.icon('trash', 14)}</button></div>`).join('')}</div>
      <form class="inline-add" data-submit="catAdd"><input type="color" name="color" value="#0ea5e9"><input name="name" placeholder="Nova categoria…" required><button class="btn sm">${U.icon('plus', 15)} Adicionar</button></form>`)}

    ${sec('prioridades', 'Prioridades e status', 'Você pode renomear e mudar as cores. Os quatro níveis são fixos porque orientam alertas e ordenação.', `
      <div class="grid-2 tight">
        <div><h4>Prioridades</h4><div class="cfg-list">${['baixa', 'media', 'alta', 'urgente'].map(k => `<div class="cfg-item"><input type="color" value="${st.priorities[k].color}" data-change="prColor" data-k="${k}"><input type="text" value="${U.esc(st.priorities[k].label)}" data-change="prLabel" data-k="${k}"></div>`).join('')}</div></div>
        <div><h4>Status</h4><div class="cfg-list">${['pendente', 'andamento', 'concluida', 'cancelada'].map(k => `<div class="cfg-item"><input type="color" value="${st.statuses[k].color}" data-change="stColor" data-k="${k}"><input type="text" value="${U.esc(st.statuses[k].label)}" data-change="stLabel" data-k="${k}"></div>`).join('')}</div></div>
      </div>`)}

    ${sec('tecnicos', 'Técnicos da equipe', 'Usados como responsáveis e na produtividade individual.', `
      <div class="cfg-list">${st.technicians.length ? st.technicians.map(t => `<div class="cfg-item"><input type="text" value="${U.esc(t.name)}" data-change="tecName" data-id="${t.id}">${H.demo(t)}<button class="icon-btn xs" data-act="tecDel" data-id="${t.id}">${U.icon('trash', 14)}</button></div>`).join('') : '<p class="muted small">Nenhum técnico cadastrado.</p>'}</div>
      <form class="inline-add" data-submit="tecAdd"><input name="name" placeholder="Nome do técnico…" required><button class="btn sm">${U.icon('plus', 15)} Adicionar</button></form>`)}

    ${!st.showIndicadores ? '' : sec('metas', 'Metas', 'Comparadas com os dados lançados em Indicadores, tarefas e projetos.', `
      ${st.goals.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Meta</th><th>Indicador</th><th>Período</th><th>Alvo</th><th></th></tr></thead><tbody>${st.goals.map(g => `<tr><td>${U.esc(g.name || '—')}${H.demo(g)}</td><td>${metricLabel(g.metric)}</td><td>${g.period}</td><td>${g.direction === 'max' ? 'no máximo' : 'no mínimo'} ${g.target}</td><td class="nowrap"><button class="icon-btn xs" data-act="goalEdit" data-id="${g.id}">${U.icon('edit', 14)}</button><button class="icon-btn xs" data-act="goalDel" data-id="${g.id}">${U.icon('trash', 14)}</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Nenhuma meta cadastrada.</p>'}
      <div class="row-actions"><button class="btn sm" data-act="goalNew">${U.icon('plus', 15)} Nova meta</button></div>`)}

    ${sec('dados', 'Dados e armazenamento', `Os dados ficam salvos ${Guide.whereData()} (~${lsSize} KB)${Drive.connected() ? ' e sincronizados com o seu Google Drive.' : '. Cada versão (app Android, site, link do Claude) guarda os seus próprios dados; conecte o Google Drive (acima) para deixá-los iguais.'}`, `
      <h4>Levar dados para outra versão ou aparelho</h4>
      <p class="muted small">Gera um <strong>código de texto</strong> com todos os seus dados. Mande para você mesmo (WhatsApp, e-mail, Keep) e cole na outra versão.</p>
      <div class="row-actions wrap">
        <button class="btn primary" data-act="xferOut">${U.icon('arrow', 15)} Enviar meus dados</button>
        <button class="btn" data-act="xferIn">${U.icon('download', 15)} Receber dados</button>
      </div>
      <h4>Backup em arquivo</h4>
      <div class="row-actions wrap">
        <button class="btn" data-act="dataExport">${U.icon('download', 15)} Exportar backup (arquivo)</button>
        <label class="btn">${U.icon('upload', 15)} Importar backup<input type="file" data-change="dataImport" hidden></label>
      </div>
      <h4>Dados de demonstração</h4>
      <p class="muted small">Exemplos marcados com “[Exemplo]” e o selo EXEMPLO, para conhecer o aplicativo. Não representam sua operação.</p>
      <div class="row-actions wrap">
        ${Store.hasDemo() ? `<button class="btn warn" data-act="demoRemove">${U.icon('trash', 15)} Remover dados de demonstração</button>` : `<button class="btn" data-act="demoLoad">${U.icon('plus', 15)} Carregar dados de demonstração</button>`}
      </div>
      <h4>Ajuda</h4>
      <div class="row-actions wrap"><button class="btn" data-act="tourOpen">${U.icon('play', 14)} Rever tutorial</button><a class="btn" href="#guia">${U.icon('info', 15)} Abrir guia de uso</a></div>
      <h4>Zona de risco</h4>
      <div class="row-actions"><button class="btn danger" data-act="dataReset">${U.icon('trash', 15)} Apagar todos os dados</button></div>`)}`;
  },
};

const Routine = {
  form(r) {
    const isNew = !r;
    r = r || { start: '08:00', end: '08:30', category: 'administrativo', priority: 'media', freq: 'semanal', days: [...S.settings.workDays], monthDay: 1 };
    UI.form({
      title: isNew ? 'Nova atividade recorrente' : 'Editar atividade da rotina',
      fields: [
        { name: 'title', label: 'Atividade', required: true, value: r.title },
        { name: 'start', label: 'Início', type: 'time', required: true, value: r.start, half: true },
        { name: 'end', label: 'Fim', type: 'time', required: true, value: r.end, half: true },
        { name: 'category', label: 'Categoria', type: 'select', options: H.catOptions(), value: r.category, half: true },
        { name: 'priority', label: 'Prioridade', type: 'select', options: H.prioOptions(), value: r.priority, half: true },
        { name: 'freq', label: 'Frequência', type: 'select', options: [['semanal', 'Dias da semana selecionados'], ['mensal', 'Mensal (um dia do mês)']], value: r.freq, half: true },
        { name: 'monthDay', label: 'Dia do mês', type: 'number', min: 1, max: 31, value: r.monthDay, half: true, showIf: 'freq=mensal', hint: 'Só aparece se o dia for útil.' },
        { name: 'days', label: 'Repetir em', type: 'weekdays', value: r.days, showIf: 'freq=semanal', hint: 'Somente os dias marcados como dias de trabalho exibem a rotina.' },
        { name: 'fixed', label: 'Horário fixo (não é deslocado na reorganização)', type: 'checkbox', value: r.fixed },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: r.notes },
      ],
      validate: v => U.toMin(v.end) <= U.toMin(v.start) ? 'O horário de fim deve ser depois do início.' : (v.freq === 'semanal' && !v.days.length ? 'Selecione ao menos um dia.' : (v.freq === 'mensal' && !(v.monthDay >= 1 && v.monthDay <= 31) ? 'Informe um dia do mês entre 1 e 31.' : null)),
      onSubmit(v) {
        if (isNew) S.routine.push({ id: U.uid(), ...v }); else Object.assign(r, v);
        commit(); UI.toast('Rotina atualizada. Vale para os dias ainda não editados.');
      },
    });
  },
};

const Goals = {
  form(g) {
    const isNew = !g;
    g = g || { metric: 'pontosCamera', period: 'semanal', direction: 'min', target: null };
    UI.form({
      title: isNew ? 'Nova meta' : 'Editar meta',
      fields: [
        { name: 'name', label: 'Nome da meta (opcional)', value: g.name },
        { name: 'metric', label: 'Indicador', type: 'select', options: GOAL_METRICS.map(m => [m.key, m.label]), value: g.metric, half: true },
        { name: 'period', label: 'Período', type: 'select', options: [['diaria', 'Diária'], ['semanal', 'Semanal'], ['mensal', 'Mensal']], value: g.period, half: true },
        { name: 'direction', label: 'Tipo', type: 'select', options: [['min', 'Atingir no mínimo'], ['max', 'Manter no máximo (ex.: retrabalhos)']], value: g.direction, half: true },
        { name: 'target', label: 'Valor alvo', type: 'number', min: 0, required: true, value: g.target, half: true },
      ],
      onSubmit(v) { if (isNew) S.settings.goals.push({ id: U.uid(), ...v }); else Object.assign(g, v); commit(); },
    });
  },
};

Object.assign(Actions, {
  cfgJump({ id }) {
    if (App.route !== 'config') { App.ui.cfgJump = id; App.go('config'); return; }
    document.getElementById('cfg-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  async iaSave(_, form) {
    const k = form.elements.key.value.trim();
    if (!k) { UI.toast('Cole a chave antes de salvar.', 'warn'); return; }
    S.settings.ia = { ...(S.settings.ia || {}), key: k }; commit();
    UI.toast('Chave salva. Testando…');
    try { await IA.test(); UI.toast('IA funcionando.'); } catch (e) { UI.toast(U.esc(e.message), 'error'); }
  },
  async iaTest(_, el) {
    el.disabled = true;
    try { await IA.test(); UI.toast('IA funcionando.'); } catch (e) { UI.toast(U.esc(e.message), 'error'); }
    el.disabled = false;
  },
  iaRemove() { UI.confirm('Remover a chave da IA deste app?', () => { S.settings.ia = { ...(S.settings.ia || {}), key: '' }; commit(); UI.toast('Chave removida.'); }, { okLabel: 'Remover', danger: true }); },
  iaAgentSave(_, form) {
    S.settings.ia = { ...(S.settings.ia || {}), agente: form.elements.agente.value.trim(), nivel: form.elements.nivel.value };
    commit(); UI.toast(S.settings.ia.agente ? 'Instruções do agente salvas.' : 'Usando o estilo padrão.');
  },
  iaShow(_, el) { const i = el.closest('.ia-key').querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  cfgBreakMode(_, el) { S.settings.breakMode = el.value; commit(); UI.toast(el.value === 'flexivel' ? 'Intervalo flexível: marque pela Agenda.' : el.value === 'fixo' ? 'Intervalo em horário fixo.' : 'Sem intervalo na agenda.'); },
  cfgJornada(_, form) {
    const fd = new FormData(form);
    const v = { workStart: fd.get('workStart'), workEnd: fd.get('workEnd'), breakMode: fd.get('breakMode') || 'fixo', workDays: fd.getAll('workDays').map(Number), alertDays: Number(fd.get('alertDays') || 0) };
    if (fd.get('breakStart')) { v.breakStart = fd.get('breakStart'); v.breakEnd = fd.get('breakEnd'); }
    if (fd.get('breakDur')) v.breakDur = Number(fd.get('breakDur'));
    if (U.toMin(v.workEnd) <= U.toMin(v.workStart)) return UI.toast('A saída deve ser depois da entrada.', 'error');
    if (v.breakMode === 'fixo' && v.breakStart && v.breakEnd && U.toMin(v.breakEnd) <= U.toMin(v.breakStart)) return UI.toast('O fim do intervalo deve ser depois do início.', 'error');
    if (!v.workDays.length) return UI.toast('Selecione ao menos um dia de trabalho.', 'error');
    const old = { ...S.settings };
    Object.assign(S.settings, v);
    if (fd.get('syncBreak') && v.breakStart && v.breakEnd) {
      const br = S.routine.find(r => r.category === 'intervalo' && r.start === old.breakStart) || S.routine.find(r => r.category === 'intervalo');
      if (br) { br.start = v.breakStart; br.end = v.breakEnd; }
    }
    commit(); UI.toast('Jornada salva.');
  },
  rtNew() { Routine.form(null); },
  rtEdit({ id }) { Routine.form(S.routine.find(r => r.id === id)); },
  rtDel({ id }) { const r = S.routine.find(x => x.id === id); UI.confirm(`Remover <strong>${U.esc(r.title)}</strong> da rotina padrão?`, () => { S.routine = S.routine.filter(x => x.id !== id); commit(); }, { danger: true, okLabel: 'Remover' }); },
  rtReset() { UI.confirm('Restaurar a rotina padrão original (12 blocos de 08:00 às 18:00)? Os dias já editados não mudam.', () => { S.routine = Store.defaults().routine; commit(); }); },
  catColor({ id }, el) { D.cat(id).color = el.value; commit(); },
  catName({ id }, el) { if (el.value.trim()) { S.settings.categories.find(c => c.id === id).name = el.value.trim(); commit(); } },
  catAdd(_, form) { const name = form.elements.name.value.trim(); S.settings.categories.push({ id: U.uid(), name, color: form.elements.color.value }); commit(); },
  catDel({ id }) {
    const c = D.cat(id);
    const used = S.tasks.some(t => t.category === id) || S.routine.some(r => r.category === id);
    UI.confirm(`Excluir a categoria <strong>${U.esc(c.name)}</strong>?${used ? '<br><small class="muted">Ela está em uso; esses itens passarão a aparecer como “Sem categoria”.</small>' : ''}`, () => { S.settings.categories = S.settings.categories.filter(x => x.id !== id); commit(); }, { danger: true, okLabel: 'Excluir' });
  },
  prColor({ k }, el) { S.settings.priorities[k].color = el.value; commit(); },
  prLabel({ k }, el) { if (el.value.trim()) { S.settings.priorities[k].label = el.value.trim(); commit(); } },
  stColor({ k }, el) { S.settings.statuses[k].color = el.value; commit(); },
  stLabel({ k }, el) { if (el.value.trim()) { S.settings.statuses[k].label = el.value.trim(); commit(); } },
  tecAdd(_, form) { const name = form.elements.name.value.trim(); if (D.techNames().includes(name)) return UI.toast('Esse técnico já está cadastrado.', 'warn'); S.settings.technicians.push({ id: U.uid(), name }); commit(); },
  tecName({ id }, el) { const t = S.settings.technicians.find(x => x.id === id); if (el.value.trim()) { t.name = el.value.trim(); commit(); } },
  tecDel({ id }) { const t = S.settings.technicians.find(x => x.id === id); UI.confirm(`Remover <strong>${U.esc(t.name)}</strong>? Os lançamentos já feitos são mantidos.`, () => { S.settings.technicians = S.settings.technicians.filter(x => x.id !== id); commit(); }, { danger: true, okLabel: 'Remover' }); },
  goalNew() { Goals.form(null); },
  goalEdit({ id }) { Goals.form(S.settings.goals.find(g => g.id === id)); },
  goalDel({ id }) { UI.confirm('Excluir esta meta?', () => { S.settings.goals = S.settings.goals.filter(g => g.id !== id); commit(); }, { danger: true, okLabel: 'Excluir' }); },
  dataExport() { U.download(`backup-gestao-rotina_${U.today()}.json`, new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' })); UI.toast('Backup exportado.'); },
  dataImport(_, el) {
    const file = el.files[0]; if (!file) return;
    file.text().then(txt => Transfer.decode(txt)).then(data => Transfer.confirmImport(data)).catch(e => UI.toast(U.esc(e.message), 'error'));
    el.value = '';
  },
  cfgProjetos(_, el) { S.settings.showProjetos = el.checked; commit(); UI.toast(el.checked ? 'Projetos aparece no menu, em Planejamento.' : 'Projetos ocultado. Os dados continuam guardados.'); },
  cfgIndicadores(_, el) { S.settings.showIndicadores = el.checked; commit(); UI.toast(el.checked ? 'Indicadores aparece no menu, em Planejamento.' : 'Indicadores ocultado. Os dados continuam guardados.'); },
  themeSet({ v }) { S.settings.theme = v; commit(); UI.toast(v === 'escuro' ? 'Modo escuro ativado.' : v === 'auto' ? 'O tema agora segue o aparelho.' : 'Modo claro ativado.'); },
  xferOut() { Transfer.openExport(); },
  xferIn() { Transfer.openImport(); },
  demoLoad() { Store.loadDemo(); commit(); UI.toast('Dados de demonstração carregados (marcados como EXEMPLO).'); },
  demoRemove() { UI.confirm('Remover todos os dados de demonstração? Seus dados reais não serão afetados.', () => { Store.removeDemo(); commit(); UI.toast('Dados de demonstração removidos.'); }, { okLabel: 'Remover' }); },
  dataReset() { UI.confirm('Apagar <strong>todos</strong> os dados e voltar às configurações iniciais? Essa ação não pode ser desfeita. Considere exportar um backup antes.', () => { Store.replace(Store.defaults()); App.render(); UI.toast('Dados apagados.'); }, { danger: true, okLabel: 'Apagar tudo' }); },
});
