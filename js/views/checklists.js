'use strict';
/* Checklists: modelos (S.checklists) e checklists feitos (S.checks).
   Cada item recebe ✓ OK, ⚠ Problema (com observação) ou N/A. Ao concluir, cada problema pode virar um imprevisto.
   Os modelos prontos abaixo são só sugestões de itens (nada é registrado sem a pessoa marcar). */
const CK = {
  PRONTOS: [
    { nome: 'Abertura de turno', itens: ['Conferir mensagens e chamados da noite', 'Ver câmeras offline no monitoramento', 'Conferir gravação dos NVRs/DVRs', 'Checar veículos e ferramentas', 'Distribuir as ordens do dia para a equipe', 'Alinhar prioridades com a equipe'] },
    { nome: 'Manutenção preventiva CFTV', itens: ['Imagem de todas as câmeras ok (dia e noite)', 'Foco e posicionamento das câmeras', 'Limpeza das lentes e caixas', 'Gravação ok e dias de retenção conferidos', 'Saúde dos HDs do gravador', 'Fontes e nobreak funcionando', 'Conectores e cabos sem oxidação', 'Data e hora do sistema certas', 'Acesso remoto (app) funcionando', 'Rack organizado e ventilado'] },
    { nome: 'Entrega de obra / instalação', itens: ['Todas as câmeras do projeto instaladas', 'Ângulos aprovados com o cliente', 'Gravação configurada', 'Senhas trocadas e entregues ao cliente', 'App instalado e testado no celular do cliente', 'Cabos identificados e rack organizado', 'Local limpo, sem sobras de material', 'Treinamento rápido feito com o cliente', 'Termo de entrega assinado'] },
    { nome: 'Passagem de turno', itens: ['Chamados em aberto repassados', 'Equipamentos com defeito informados', 'Pendências com clientes informadas', 'Ocorrências de segurança registradas', 'Ferramentas e veículos devolvidos'] },
  ],
  list() { return S.checklists || (S.checklists = []); },
  runs() { return S.checks || (S.checks = []); },
  addPronto(i) {
    const p = CK.PRONTOS[i]; if (!p) return null;
    const m = { id: U.uid(), nome: p.nome, itens: p.itens.map(texto => ({ id: U.uid(), texto })) };
    CK.list().push(m); return m;
  },
  start(modelo, local = '') {
    const r = { id: U.uid(), modeloId: modelo.id, nome: modelo.nome, date: U.today(), at: new Date().toISOString(), local, fim: null, occIds: [], itens: modelo.itens.map(i => ({ id: i.id, texto: i.texto, r: null, obs: '' })) };
    CK.runs().push(r); return r;
  },
  count(r) {
    const c = { ok: 0, prob: 0, na: 0, falta: 0 };
    r.itens.forEach(i => { c[i.r || 'falta']++; });
    return c;
  },
  form(m) {
    const isNew = !m;
    UI.form({
      title: isNew ? 'Novo checklist' : 'Editar checklist',
      fields: [
        { name: 'nome', label: 'Nome', required: true, value: m ? m.nome : '', placeholder: 'Ex.: Visita técnica' },
        { name: 'itens', label: 'Itens (um por linha)', type: 'textarea', rows: 8, required: true, value: m ? m.itens.map(i => i.texto).join('\n') : '' },
      ],
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, md) => { md.close(); UI.confirm(`Excluir o modelo <strong>${U.esc(m.nome)}</strong>? Os checklists já feitos continuam no histórico.`, () => { S.checklists = CK.list().filter(x => x.id !== m.id); commit(); }, { danger: true, okLabel: 'Excluir' }); } }],
      onSubmit(v) {
        const linhas = v.itens.split('\n').map(x => x.trim()).filter(Boolean);
        if (!linhas.length) return 'Escreva pelo menos um item.';
        if (isNew) CK.list().push({ id: U.uid(), nome: v.nome, itens: linhas.map(texto => ({ id: U.uid(), texto })) });
        else {
          const old = new Map(m.itens.map(i => [i.texto, i.id]));
          Object.assign(m, { nome: v.nome, itens: linhas.map(texto => ({ id: old.get(texto) || U.uid(), texto })) });
        }
        commit(); UI.toast(isNew ? 'Checklist criado.' : 'Checklist atualizado.');
      },
    });
  },
};

Views.checklists = {
  title: 'Checklists', icon: 'list', nav: 'Checklists',
  fab: () => App.ui.ckRun ? null : { act: 'ckNew', label: 'Novo checklist' },
  render() {
    const run = App.ui.ckRun && CK.runs().find(r => r.id === App.ui.ckRun);
    if (run) return this.run(run);
    App.ui.ckRun = null;
    const modelos = CK.list(), runs = CK.runs();
    const abertos = runs.filter(r => !r.fim).sort((a, b) => b.at.localeCompare(a.at));
    const hist = runs.filter(r => r.fim).sort((a, b) => b.fim.localeCompare(a.fim)).slice(0, 12);
    const usados = new Set(modelos.map(m => m.nome));
    const prontos = CK.PRONTOS.map((p, i) => ({ ...p, i })).filter(p => !usados.has(p.nome));
    return `
      <p class="muted small">Listas de conferência para não esquecer nada. Marque cada item; o que der problema pode virar um imprevisto.</p>
      ${abertos.length ? `<h3 class="mt-h">Em andamento</h3><div class="ck-grid">${abertos.map(r => { const c = CK.count(r); return `
        <button class="card ck-card ck-open" data-act="ckOpen" data-id="${r.id}"><span class="ck-ic">${U.icon('play', 16)}</span><span class="ck-main"><strong>${U.esc(r.nome)}</strong><small>${r.local ? U.esc(r.local) + ' · ' : ''}${r.itens.length - c.falta} de ${r.itens.length} itens · ${U.fmtShort(r.date)}</small></span>${U.icon('right', 16)}</button>`; }).join('')}</div>` : ''}
      <h3 class="mt-h">Seus checklists</h3>
      ${modelos.length ? `<div class="ck-grid">${modelos.map(m => `
        <div class="card ck-card"><span class="ck-ic">${U.icon('list', 16)}</span><span class="ck-main"><strong>${U.esc(m.nome)}</strong><small>${U.plural(m.itens.length, 'item', 'itens')}</small></span>
          <button class="icon-btn" data-act="ckEdit" data-id="${m.id}" aria-label="Editar">${U.icon('edit', 15)}</button>
          <button class="btn sm primary" data-act="ckStart" data-id="${m.id}">${U.icon('play', 13)} Iniciar</button></div>`).join('')}</div>`
        : H.empty('Nenhum checklist ainda. Comece por um dos modelos prontos abaixo ou toque em + para criar o seu.')}
      ${prontos.length ? `<h3 class="mt-h">Modelos prontos</h3><div class="ck-grid">${prontos.map(p => `
        <div class="card ck-card ck-pronto"><span class="ck-ic">${U.icon('plus', 16)}</span><span class="ck-main"><strong>${U.esc(p.nome)}</strong><small>${U.plural(p.itens.length, 'item', 'itens')}: ${U.esc(p.itens.slice(0, 2).join(', ').toLowerCase())}…</small></span>
          <button class="btn sm" data-act="ckAddPronto" data-i="${p.i}">Usar</button></div>`).join('')}</div>` : ''}
      ${hist.length ? `<h3 class="mt-h">Feitos recentemente</h3><ul class="list card">${hist.map(r => { const c = CK.count(r); return `
        <li class="li" role="button" data-act="ckOpen" data-id="${r.id}"><span class="li-time">${U.fmtShort(r.date)}</span><span class="li-main"><span>${U.esc(r.nome)}${r.local ? ' · ' + U.esc(r.local) : ''}</span></span>
          <span class="li-side">${c.prob ? `<span class="badge b-red">${U.plural(c.prob, 'problema')}</span>` : '<span class="badge b-green">Tudo ok</span>'}</span></li>`; }).join('')}</ul>` : ''}`;
  },
  run(r) {
    const c = CK.count(r), feito = r.itens.length - c.falta, pct = Math.round(feito / r.itens.length * 100);
    const done = !!r.fim;
    const item = (i, n) => `<li class="ck-it ck-${i.r || 'none'}">
      <div class="ck-it-t"><span class="ck-n">${n + 1}</span><span>${U.esc(i.texto)}</span></div>
      ${done ? `<div class="ck-res">${i.r === 'ok' ? '✓ OK' : i.r === 'prob' ? '⚠ Problema' : i.r === 'na' ? 'N/A' : '—'}${i.obs ? ` · ${U.esc(i.obs)}` : ''}</div>` : `
      <div class="ck-btns" role="group" aria-label="Resultado">
        <button class="ck-b ok ${i.r === 'ok' ? 'on' : ''}" data-act="ckMark" data-id="${r.id}" data-it="${i.id}" data-v="ok" aria-pressed="${i.r === 'ok'}">${U.icon('check', 15)} OK</button>
        <button class="ck-b prob ${i.r === 'prob' ? 'on' : ''}" data-act="ckMark" data-id="${r.id}" data-it="${i.id}" data-v="prob" aria-pressed="${i.r === 'prob'}">${U.icon('alert', 14)} Problema</button>
        <button class="ck-b na ${i.r === 'na' ? 'on' : ''}" data-act="ckMark" data-id="${r.id}" data-it="${i.id}" data-v="na" aria-pressed="${i.r === 'na'}">N/A</button>
      </div>
      ${i.r === 'prob' ? `<input class="cap-in ck-obs" placeholder="O que aconteceu? (vira o título do imprevisto)" value="${U.esc(i.obs)}" data-change="ckObs" data-id="${r.id}" data-it="${i.id}">` : ''}`}
    </li>`;
    return `
      <div class="ps-head"><button class="icon-btn" data-act="ckBack" aria-label="Voltar">${U.icon('left', 18)}</button>
        <div class="grow"><h2>${U.esc(r.nome)}</h2><small class="muted">${U.fmtDate(r.date)}${done ? ' · concluído' : ''}</small></div></div>
      ${done ? '' : `<input class="cap-in" placeholder="Onde? (cliente, local)" value="${U.esc(r.local || '')}" data-change="ckLocal" data-id="${r.id}" aria-label="Local">`}
      <div class="ck-prog"><span>${feito} de ${r.itens.length}${c.prob ? ` · <span class="c-red">${U.plural(c.prob, 'problema')}</span>` : ''}</span>${H.bar(pct, c.prob ? 'var(--yellow)' : 'var(--accent)')}</div>
      <ol class="ck-list">${r.itens.map(item).join('')}</ol>
      ${done ? `${(r.occIds || []).length ? `<p class="muted small">${U.plural(r.occIds.length, 'imprevisto criado', 'imprevistos criados')} a partir deste checklist. <a class="link" href="#imprevistos">Ver</a></p>` : ''}
        <div class="row-actions"><button class="btn ghost danger-text" data-act="ckDel" data-id="${r.id}">${U.icon('trash', 15)} Excluir</button></div>`
      : `<div class="ck-foot"><button class="btn ghost danger-text" data-act="ckDel" data-id="${r.id}">Descartar</button><span class="grow"></span><button class="btn primary" data-act="ckFinish" data-id="${r.id}">${U.icon('check', 15)} Concluir checklist</button></div>`}`;
  },
};

Object.assign(Actions, {
  ckNew() { CK.form(null); },
  ckEdit({ id }) { CK.form(CK.list().find(m => m.id === id)); },
  ckAddPronto({ i }) { const m = CK.addPronto(+i); commit(); UI.toast(`"${m.nome}" adicionado. Você pode editar os itens.`); },
  ckStart({ id }) {
    const m = CK.list().find(x => x.id === id); if (!m) return;
    const r = CK.start(m); App.ui.ckRun = r.id; commit(); window.scrollTo(0, 0);
  },
  ckOpen({ id }) { App.ui.ckRun = id; App.render(); window.scrollTo(0, 0); },
  ckBack() { App.ui.ckRun = null; App.render(); },
  ckMark({ id, it, v }) {
    const r = CK.runs().find(x => x.id === id); const i = r && r.itens.find(x => x.id === it); if (!i) return;
    i.r = i.r === v ? null : v;
    commit();
    if (i.r === 'prob') setTimeout(() => { const el = document.querySelector(`.ck-obs[data-it="${it}"]`); if (el) el.focus(); }, 60);
  },
  ckObs({ id, it }, el) { const r = CK.runs().find(x => x.id === id); const i = r && r.itens.find(x => x.id === it); if (i) { i.obs = el.value.trim(); commit(); } },
  ckLocal({ id }, el) { const r = CK.runs().find(x => x.id === id); if (r) { r.local = el.value.trim(); commit(); } },
  ckFinish({ id }) {
    const r = CK.runs().find(x => x.id === id); if (!r) return;
    const c = CK.count(r), probs = r.itens.filter(i => i.r === 'prob');
    const fields = [{ type: 'html', html: `<p>${c.ok} ok · ${c.prob} com problema · ${c.na} N/A${c.falta ? ` · <strong>${c.falta} sem resposta</strong>` : ''}</p>` }];
    if (probs.length) fields.push({ name: 'occ', label: `Criar ${U.plural(probs.length, 'imprevisto')} com os problemas`, type: 'checkbox', value: true });
    UI.form({
      title: 'Concluir checklist', submitLabel: 'Concluir', fields,
      onSubmit(v) {
        r.fim = new Date().toISOString();
        if (v.occ) probs.forEach(i => {
          const o = { id: U.uid(), createdAt: r.fim, scheduled: null, title: i.obs || i.texto, description: `Checklist "${r.nome}"${r.local ? ` em ${r.local}` : ''}: ${i.texto}`, priority: 'alta', status: 'pendente', date: U.today(), time: U.nowTime(), dueDate: '', dueTime: '', responsible: '', notes: '' };
          S.occurrences.push(o); r.occIds.push(o.id);
        });
        commit();
        UI.toast(v.occ ? `Checklist concluído. ${U.plural(probs.length, 'imprevisto criado', 'imprevistos criados')}.` : 'Checklist concluído.');
      },
    });
  },
  ckDel({ id }) {
    const r = CK.runs().find(x => x.id === id); if (!r) return;
    UI.confirm(`Excluir este checklist (${U.esc(r.nome)}, ${U.fmtShort(r.date)})?`, () => { S.checks = CK.runs().filter(x => x.id !== id); App.ui.ckRun = null; commit(); }, { danger: true, okLabel: 'Excluir' });
  },
});
