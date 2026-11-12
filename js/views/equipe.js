'use strict';
/* Equipe — tudo sobre pessoas num lugar só (substitui Reuniões e feedbacks):
   - aba Pessoas: o que fazer agora (reuniões a registrar, feedbacks pedidos), a equipe na nuvem (gestor: convidar e
     enviar missões) e a lista de pessoas. Cada pessoa tem uma página: tarefas e imprevistos com ela, missões e feedbacks.
   - aba Reuniões: próximas, para registrar e registradas.
   A lista de pessoas junta a equipe cadastrada, quem tem feedback, quem é responsável por algo e os membros da equipe na nuvem. */
const Pessoas = {
  chave: n => (n || '').trim().toLowerCase(),
  /* Todas as pessoas, com o que há de cada uma */
  todas() {
    const mapa = new Map(), add = (nome, extra = {}) => {
      nome = (nome || '').trim(); if (!nome) return null;
      const k = this.chave(nome);
      if (!mapa.has(k)) mapa.set(k, { nome, tec: null, membro: null, eq: null, fbs: [], abertas: [], missFb: [] });
      return Object.assign(mapa.get(k), extra);
    };
    S.settings.technicians.forEach(t => add(t.name, { tec: t }));
    if (typeof Equipes !== 'undefined' && Equipes.ativo())
      for (const e of Equipes.gestorDe()) for (const m of Equipes.membros[e.id] || []) if (m.id !== Fire.user.uid) add(m.nome || m.email, { membro: m, eq: e });
    FB.list().forEach(f => { const p = add(f.pessoa); if (p) p.fbs.push(f); });
    [...S.tasks.filter(x => OPEN(x.status)), ...S.occurrences.filter(o => OPEN(o.status))].forEach(x => { const p = add(x.responsible); if (p) p.abertas.push(x); });
    Missoes.list().filter(m => m.tipo === 'feedbackItem' && !Missoes.itemFeito(m)).forEach(m => { const p = add(m.pessoa); if (p) p.missFb.push(m); });
    return [...mapa.values()].map(p => ({ ...p, fbs: p.fbs.sort((a, b) => b.date.localeCompare(a.date)) }))
      .sort((a, b) => (b.missFb.length - a.missFb.length) || (b.abertas.filter(D.taskLate).length - a.abertas.filter(D.taskLate).length) || a.nome.localeCompare(b.nome));
  },
  uma(nome) { return this.todas().find(p => this.chave(p.nome) === this.chave(nome)); },
  /* Renomear: atualiza a lista e tudo que cita a pessoa */
  renomear(antigo, novo) {
    const k = this.chave(antigo), troca = v => (this.chave(v) === k ? novo : v);
    S.settings.technicians.forEach(t => { t.name = troca(t.name); });
    S.tasks.forEach(x => { x.responsible = troca(x.responsible); });
    S.occurrences.forEach(o => { o.responsible = troca(o.responsible); });
    S.projects.forEach(p => { p.responsible = troca(p.responsible); });
    FB.list().forEach(f => { f.pessoa = troca(f.pessoa); });
    Missoes.list().forEach(m => { if (m.pessoa) { const n = troca(m.pessoa); if (n !== m.pessoa) { m.pessoa = n; m.titulo = 'Feedback com ' + n; } } });
    (S.indicators || []).forEach(r => { r.technician = troca(r.technician); });
  },
};

Views.equipe = {
  title: 'Equipe', icon: 'users', nav: 'Equipe',
  fab() {
    if (App.ui.eqTab === 'reunioes') return { act: 'mtNew', label: 'Nova reunião' };
    if (App.ui.pessoa) return { act: 'fbNew', label: 'Registrar feedback', data: { n: App.ui.pessoa } };
    return { act: 'eqAdd', label: 'Adicionar' };
  },
  render() {
    const tab = App.ui.eqTab === 'reunioes' ? 'reunioes' : 'pessoas';
    const nReg = Meetings.toRegister().length;
    const tabs = `<div class="tabs mt-tabs" role="tablist">${[['pessoas', 'Pessoas', 0], ['reunioes', 'Reuniões', nReg]].map(([v, l, n]) => `<button class="tab ${tab === v ? 'active' : ''}" role="tab" aria-selected="${tab === v}" data-act="eqTab" data-v="${v}">${l}${n ? ` <span class="tab-n">${n}</span>` : ''}</button>`).join('')}</div>`;
    if (tab === 'reunioes') return tabs + Meetings.lista();
    if (App.ui.pessoa) return this.pessoa(App.ui.pessoa);
    return tabs + this.pessoas();
  },

  /* ---------- Aba Pessoas ---------- */
  pessoas() {
    const ps = Pessoas.todas(), reg = Meetings.toRegister(), fbPend = ps.flatMap(p => p.missFb.map(m => ({ p, m })));
    const agora = [
      ...reg.slice(0, 3).map(e => Meetings.card(e, '<span class="btn sm primary">Registrar</span>')),
      ...fbPend.map(({ p, m }) => `<div class="mt-card" role="button" tabindex="0" data-act="msAbrir" data-id="${m.id}"><span class="fb-av">${U.esc(FB.initials(p.nome))}</span>
        <span class="mt-body"><span class="mt-title">${U.esc(m.titulo)}</span><span class="mt-meta">Missão${m.de_ ? ` de ${U.esc(m.de_)}` : ''}${m.data ? ` · ${U.fmtShort(m.data)}` : ''} · +${m.xp} XP</span></span><span class="btn sm primary">Registrar</span></div>`),
    ];
    const card = p => {
      const late = p.abertas.filter(x => D.taskLate(x) || D.occLate(x)).length, r = p.membro && p.membro.resumo, f = p.fbs[0];
      const linha = [p.abertas.length ? `${U.plural(p.abertas.length, 'item aberto', 'itens abertos')}${late ? ` · <span class="c-red">${late} atrasado${late > 1 ? 's' : ''}</span>` : ''}` : '',
        f ? `feedback em ${U.fmtShort(f.date)}` : 'sem feedback ainda'].filter(Boolean).join(' · ');
      return `<div class="fb-person" role="button" tabindex="0" data-act="pessoaAbrir" data-n="${U.esc(p.nome)}">
        <span class="fb-av">${U.esc(FB.initials(p.nome))}</span>
        <span class="fb-p-body"><strong>${U.esc(p.nome)}${p.tec ? H.demo(p.tec) : ''}</strong><small class="muted">${linha}</small></span>
        ${r ? `<span class="pes-jg"><span class="jg-stat jg-flame ${r.streak ? 'lit' : ''}">${U.icon('flame', 13)}<b>${r.streak || 0}</b></span><span class="jg-lvb">${r.nivel || 1}</span></span>` : ''}
        ${p.missFb.length ? '<span class="badge b-yellow">Feedback</span>' : f ? H.chip(IA.TONS[f.tom] || 'Neutro', FB.TOM_COLOR[f.tom] || '#8e87a3') : ''}${U.icon('right', 15)}</div>`;
    };
    return `
      ${agora.length ? `<section class="mt-sec"><h3 class="mt-h">Para fazer agora <span class="badge b-yellow">${agora.length}</span></h3><div class="mt-list">${agora.join('')}</div></section>` : ''}
      ${this.nuvem()}
      <section class="mt-sec"><h3 class="mt-h">Pessoas <span class="muted small">${ps.length || ''}</span></h3>
        ${ps.length ? `<div class="fb-people">${ps.map(card).join('')}</div>` : `<div class="card mt-empty"><h3>Sua equipe aparece aqui</h3><p class="muted small">Toque em <strong>+</strong> → <strong>Adicionar pessoa</strong>. Também entram sozinhas quem recebe um feedback, quem é responsável por uma tarefa e quem entra na sua equipe pela Conta FlowFire.</p></div>`}
      </section>`;
  },
  /* Bloco da equipe na nuvem (Conta FlowFire) */
  nuvem() {
    if (!Fire.supported()) return '';
    if (!Fire.user) return `<div class="card eq-cta"><span>${U.icon('users', 18)}</span><div><strong>Equipe na nuvem</strong><small class="muted">Convide as pessoas, envie missões direto para o app delas e acompanhe o nível e a sequência de cada uma, ao vivo.</small></div><button class="btn sm" data-act="fireEntrar">Entrar com Google</button></div>`;
    const eqs = Equipes.list();
    if (!eqs.length) return `<details class="card eq-more"><summary>${U.icon('users', 16)} Montar a equipe na nuvem</summary>
      <section class="grid-2">
        <form class="eq-new" data-submit="eqCriar"><h4>Criar uma equipe</h4><p class="muted small">Você vira o gestor: convida as pessoas e envia missões.</p>
          <div class="inline-add"><input name="nome" maxlength="60" required placeholder="Nome da equipe"><button class="btn primary">Criar</button></div></form>
        <form class="eq-new" data-submit="eqEntrar"><h4>Entrar com convite</h4><p class="muted small">Cole o link que você recebeu.</p>
          <div class="inline-add"><input name="link" required placeholder="Link do convite"><button class="btn">Entrar</button></div></form>
      </section></details>`;
    return eqs.map(e => e.papel === 'gestor'
      ? `<section class="card eq-head"><div><h3>${U.icon('users', 17)} ${U.esc(e.nome)}</h3><p class="muted small">Equipe na nuvem · você é o gestor · ${U.plural((Equipes.membros[e.id] || []).filter(m => m.id !== Fire.user.uid).length, 'pessoa', 'pessoas')} · atualiza ao vivo</p></div><span class="grow"></span>
          <button class="btn sm" data-act="eqConvidar" data-id="${e.id}">Convidar</button><button class="btn sm primary" data-act="eqMissoes" data-id="${e.id}">${U.icon('target', 14)} Enviar missões</button>
          <button class="icon-btn" data-act="eqSair" data-id="${e.id}" title="Excluir equipe" aria-label="Excluir equipe">${U.icon('trash', 15)}</button></section>`
      : (() => { const miss = Jogo.calc().miss.filter(m => m.equipe === e.id), feitas = miss.filter(m => m.feitaEm).length;
        return `<section class="card eq-head"><div><h3>${U.icon('users', 17)} ${U.esc(e.nome)}</h3><p class="muted small">Você é membro · ${miss.length ? `${feitas}/${miss.length} missões concluídas` : 'nenhuma missão ainda'} · quem lidera vê só o seu resumo</p></div><span class="grow"></span>
          <a class="btn sm" href="#jornada">Ver missões</a><button class="btn sm ghost" data-act="eqSair" data-id="${e.id}">Sair</button></section>`; })()).join('');
  },

  /* ---------- Página de uma pessoa ---------- */
  pessoa(nome) {
    const p = Pessoas.uma(nome);
    if (!p) { App.ui.pessoa = null; return this.render(); }
    const r = p.membro && p.membro.resumo, miss = (p.membro && p.membro.missoes) || [];
    const tom = k => p.fbs.filter(f => f.tom === k).length;
    return `
      <div class="toolbar"><button class="btn sm ghost" data-act="pessoaAbrir" data-n="">${U.icon('left', 15)} Pessoas</button></div>
      <section class="card pes-head">
        <span class="fb-av big">${U.esc(FB.initials(p.nome))}</span>
        <div class="pes-head-t"><h2>${U.esc(p.nome)}</h2>
          <p class="muted small">${p.fbs.length ? `${U.plural(p.fbs.length, 'feedback')}: ${tom('positivo')} positivos, ${tom('neutro')} neutros, ${tom('melhorar')} a melhorar` : 'Nenhum feedback ainda'}${p.eq ? ` · equipe ${U.esc(p.eq.nome)} (${Equipes.quando(p.membro.atualizadoEm)})` : ''}</p>
          ${r ? `<div class="eq-m-stats"><span class="jg-stat jg-flame ${r.streak ? 'lit' : ''}">${U.icon('flame', 15)}<b>${r.streak || 0}</b></span><span class="jg-stat jg-xp">${U.icon('bolt', 14)}<b>${r.xp || 0}</b> XP</span><span class="jg-lv"><span class="jg-lvb">${r.nivel || 1}</span>Nível</span><span class="muted small">Meta de hoje ${Math.min(r.hoje || 0, r.meta || 40)}/${r.meta || 40}</span></div>` : ''}
        </div>
        <div class="pes-acts">
          <button class="btn sm primary" data-act="fbNew" data-n="${U.esc(p.nome)}">${U.icon('chat', 14)} Registrar feedback</button>
          <button class="btn sm" data-act="pessoaTarefa" data-n="${U.esc(p.nome)}">${U.icon('tasks', 14)} Nova tarefa</button>
          ${p.membro ? `<button class="btn sm" data-act="eqMissoesPara" data-e="${p.eq.id}" data-id="${p.membro.id}">${U.icon('target', 14)} Enviar missões</button>` : ''}
        </div>
        <button class="icon-btn pes-mais" data-act="pessoaMais" data-n="${U.esc(p.nome)}" title="Mais opções" aria-label="Mais opções">${U.icon('more', 16)}</button>
      </section>
      ${p.missFb.length ? `<section class="mt-sec"><h3 class="mt-h">Feedback pedido</h3><div class="mt-list">${p.missFb.map(m => `<div class="mt-card" role="button" tabindex="0" data-act="msAbrir" data-id="${m.id}"><span class="mt-body"><span class="mt-title">${U.esc(m.titulo)}</span><span class="mt-meta">Missão${m.de_ ? ` de ${U.esc(m.de_)}` : ''}${m.data ? ` · ${U.fmtShort(m.data)}` : ''}</span></span><span class="btn sm primary">Registrar</span></div>`).join('')}</div></section>` : ''}
      <section class="mt-sec"><h3 class="mt-h">Com ${U.esc(p.nome.split(' ')[0])} <span class="muted small">${p.abertas.length || ''}</span></h3>
        ${p.abertas.length ? `<div class="task-list">${p.abertas.map(x => S.occurrences.includes(x) ? Occ.row(x) : Tasks.row(x, { semResp: true })).join('')}</div>` : '<p class="muted small">Nada em aberto. Use <strong>Nova tarefa</strong> para passar algo e acompanhar aqui (e no Início, em "O que cobrar").</p>'}
      </section>
      ${miss.length ? `<section class="mt-sec"><h3 class="mt-h">Missões</h3><ul class="jg-miss card">${miss.map(x => `<li class="${x.feitaEm ? 'ok' : x.expirada ? 'exp' : ''}"><span class="jg-chk">${x.feitaEm ? U.icon('check', 15) : ''}</span><span class="jg-miss-t"><span>${U.esc(x.titulo)}</span><small class="muted">${x.feitaEm ? 'concluída em ' + U.fmtShort(x.feitaEm) : x.expirada ? 'prazo encerrado' : x.prazo ? 'até ' + U.fmtShort(x.prazo) : 'em andamento'} · +${x.xp} XP</small></span><span class="jg-miss-n num">${x.n}/${x.de}</span></li>`).join('')}</ul></section>` : ''}
      <section class="mt-sec"><h3 class="mt-h">Feedbacks</h3>
        ${p.fbs.length ? `<div class="mt-list">${p.fbs.map(f => FB.card(f, false)).join('')}</div>` : '<p class="muted small">Toque em <strong>Registrar feedback</strong> para gravar a conversa e a IA escrever o registro.</p>'}</section>`;
  },
};

Object.assign(Actions, {
  eqTab({ v }) { App.ui.eqTab = v; App.ui.pessoa = null; App.render({ resetScroll: true }); },
  pessoaAbrir({ n }) { App.ui.pessoa = n || null; App.render({ resetScroll: true }); },
  pessoaTarefa({ n }) { Tasks.form(null, { responsible: n }); },
  eqMissoesPara({ e, id }) { Missoes.form(true, { equipe: e, membro: id }); },
  eqAdd() {
    const gestor = typeof Equipes !== 'undefined' && Equipes.ativo() && Equipes.gestorDe().length;
    UI.sheet('Adicionar', [
      { label: 'Registrar feedback', hint: 'Conversa individual, com gravação e IA', icon: 'chat', onClick: () => FB.form(null) },
      { label: 'Nova reunião', hint: 'Com pauta, gravação e ata', icon: 'users', onClick: () => Events.form(null, U.today(), { reuniao: true }) },
      { label: 'Adicionar pessoa', hint: 'Entra na lista da equipe', icon: 'user', onClick: () => Actions.pessoaNova() },
      ...(gestor ? [{ label: 'Enviar missões', hint: 'Chegam direto no app da pessoa', icon: 'target', onClick: () => Missoes.form(true, { equipe: Equipes.gestorDe()[0].id }) }] : []),
    ]);
  },
  pessoaNova() {
    UI.form({
      title: 'Adicionar pessoa', submitLabel: 'Adicionar',
      fields: [{ name: 'nome', label: 'Nome', required: true, placeholder: 'Ex.: Carlos Silva' }],
      validate: v => D.techNames().some(n => Pessoas.chave(n) === Pessoas.chave(v.nome)) ? 'Essa pessoa já está na lista.' : null,
      onSubmit(v) { S.settings.technicians.push({ id: U.uid(), name: v.nome.trim() }); commit(); UI.toast(`${v.nome.trim()} entrou na lista.`); },
    });
  },
  pessoaMais({ n }) {
    const p = Pessoas.uma(n); if (!p) return;
    UI.sheet(p.nome, [
      { label: 'Renomear', hint: 'Atualiza tarefas, feedbacks e missões com o novo nome', icon: 'edit', onClick: () => UI.form({
        title: 'Renomear', submitLabel: 'Salvar', fields: [{ name: 'nome', label: 'Nome', required: true, value: p.nome }],
        validate: v => Pessoas.chave(v.nome) !== Pessoas.chave(p.nome) && Pessoas.uma(v.nome) ? 'Já existe alguém com esse nome.' : null,
        onSubmit(v) { Pessoas.renomear(p.nome, v.nome.trim()); App.ui.pessoa = v.nome.trim(); commit(); },
      }) },
      ...(p.membro ? [{ label: 'Remover da equipe na nuvem', hint: 'Deixa de ver o resumo; o link de convite é trocado', icon: 'x', onClick: () => Equipes.remover(p.eq, p.membro) }] : []),
      ...(p.tec ? [{ sep: true }, { label: 'Tirar da lista', hint: 'O histórico (feedbacks e tarefas) continua guardado', icon: 'trash', danger: true, onClick: () => UI.confirm(`Tirar <strong>${U.esc(p.nome)}</strong> da lista?`, () => { S.settings.technicians = S.settings.technicians.filter(t => t !== p.tec); App.ui.pessoa = null; commit(); }, { danger: true, okLabel: 'Tirar' }) }] : []),
    ]);
  },
});
