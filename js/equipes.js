'use strict';
/* Equipes (usa a Conta FlowFire / Firebase).
   - O gestor cria a equipe e convida por link (#equipe?e=<id>&c=<convite>&n=<nome>).
   - Cada membro publica só um RESUMO (nível, XP, sequência, meta de hoje e progresso das missões da equipe).
     Tarefas, feedbacks, atas etc. continuam privados.
   - O gestor envia pacotes de missões direto para um membro; o app do membro aceita sozinho e cria os itens.
   Caminho: canais/{canal}/equipes/{id}/(membros|pacotes). Regras em firestore.rules. */
const Equipes = {
  membros: {},     // id da equipe -> lista de membros (só para o gestor)
  subs: [], timer: null,
  list() { return S.equipes || (S.equipes = []); },
  gestorDe() { return this.list().filter(e => e.papel === 'gestor'); },
  ativo() { return !!(typeof Fire !== 'undefined' && Fire.user && Fire.api && Fire.api.d); },
  p(...rest) { return ['canais', Fire.canal(), 'equipes', ...rest]; },
  rnd(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); },
  eu() { const u = Fire.user || {}; return { nome: (S.settings.meuNome || u.name || (u.email || '').split('@')[0] || 'Sem nome').slice(0, 60), email: u.email || '', foto: u.photo || '' }; },

  /* Resumo que o gestor vê (nada além disto sai do aparelho do membro) */
  resumo(eq) {
    const r = Jogo.calc();
    return {
      ...this.eu(),
      resumo: { xp: r.total, nivel: r.geral.L, streak: r.streak, hoje: r.hoje, meta: Jogo.META },
      missoes: r.miss.filter(m => m.equipe === eq).map(m => ({ titulo: m.titulo, n: m.n, de: m.de, feitaEm: m.feitaEm || null, expirada: !!m.expirada, xp: m.xp, data: m.data || '', prazo: m.prazo || '' })),
      atualizadoEm: Date.now(),
    };
  },

  /* ---------- Criar, convidar, entrar, sair ---------- */
  async criar(nome) {
    const id = this.rnd(12), convite = this.rnd(20), d = Fire.api.d, uid = Fire.user.uid;
    await d.set(this.p(id), { nome, dono: uid, donoNome: this.eu().nome, convite, criadaEm: Date.now() });
    await d.set(this.p(id, 'membros', uid), { papel: 'gestor', entrouEm: Date.now(), ...this.resumo(id) });
    this.list().push({ id, nome, papel: 'gestor', convite });
    commit(); this.start();
    App.ui.eqSel = id; App.go('equipe');
    UI.toast(`Equipe “${nome}” criada. Agora convide as pessoas.`);
  },
  link(e) { return `${Missoes.SITE}${CANAL_TESTE ? 'teste/' : ''}#equipe?e=${e.id}&c=${e.convite}&n=${encodeURIComponent(e.nome)}`; },
  convidar(e) {
    const txt = `${this.eu().nome} te convidou para a equipe “${e.nome}” no FlowFire.\nAbra o link e entre com a sua conta Google (no app do celular: Equipe → Entrar com convite e cole o link):\n${this.link(e)}`;
    const m = UI.modal({
      title: `Convidar para ${e.nome}`,
      body: `<p>Mande este convite para cada pessoa da equipe. Ela abre o link, entra com a conta Google e já aparece no seu painel.</p>
        <textarea class="ms-share" rows="6" readonly>${U.esc(txt)}</textarea>
        <p class="muted small">Quem tiver o link consegue entrar. Se ele vazar, use <strong>Gerar novo link</strong>: o antigo deixa de funcionar.</p>`,
      footer: `<button class="btn ghost" data-novo>Gerar novo link</button><span class="grow"></span><button class="btn ghost" data-copy>Copiar</button><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Enviar pelo WhatsApp</a>`,
    });
    m.el.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(txt); UI.toast('Copiado.'); } catch (x) { UI.toast('Selecione o texto e copie.', 'warn'); } };
    m.el.querySelector('[data-novo]').onclick = async () => {
      try { const convite = this.rnd(20); await Fire.api.d.update(this.p(e.id), { convite }); e.convite = convite; commit(); m.close(); this.convidar(e); UI.toast('Link novo gerado. O anterior não funciona mais.'); }
      catch (x) { UI.toast('Não foi possível gerar: ' + Fire.erro(x), 'error'); }
    };
  },
  /* Abriu um link de convite */
  async aceitarConvite(q) {
    const o = Object.fromEntries(new URLSearchParams(q));
    if (!o.e || !o.c) return UI.toast('Convite inválido.', 'error');
    const nome = String(o.n || 'equipe').slice(0, 60);
    if (this.list().some(e => e.id === o.e)) { App.ui.eqSel = o.e; App.go('equipe'); return UI.toast('Você já está nessa equipe.'); }
    UI.confirm(`Você foi convidado para a equipe <strong>${U.esc(nome)}</strong> no FlowFire.<br><small class="muted">Quem lidera a equipe vai ver só um resumo seu: nível, XP, sequência, meta do dia e o progresso das missões que ele enviar. Suas tarefas, feedbacks e atas continuam privados.</small>`, async () => {
      try {
        if (!this.ativo()) { await Fire.connect(); if (!Fire.user) return; }
        await Fire.api.d.set(this.p(o.e, 'membros', Fire.user.uid), { papel: 'membro', convite: o.c, entrouEm: Date.now(), ...this.resumo(o.e) });
        this.list().push({ id: o.e, nome, papel: 'membro' });
        commit(); this.start();
        App.ui.eqSel = o.e; App.go('equipe');
        UI.toast(`Você entrou na equipe “${nome}”.`);
      } catch (x) { UI.toast(/permission/i.test(String(x && (x.code || x.message))) ? 'Este convite não vale mais. Peça um link novo a quem lidera a equipe.' : 'Não foi possível entrar: ' + Fire.erro(x), 'error'); }
    }, { title: 'Convite de equipe', okLabel: 'Entrar na equipe' });
  },
  sair(e) {
    UI.confirm(e.papel === 'gestor' ? `Excluir a equipe <strong>${U.esc(e.nome)}</strong>? Os membros deixam de aparecer no seu painel. Os dados de cada um continuam no app deles.` : `Sair da equipe <strong>${U.esc(e.nome)}</strong>? Quem lidera deixa de ver o seu resumo.`, async () => {
      try {
        if (e.papel === 'gestor') { for (const m of this.membros[e.id] || []) await Fire.api.d.del(this.p(e.id, 'membros', m.id)).catch(() => {}); await Fire.api.d.del(this.p(e.id)); }
        else await Fire.api.d.del(this.p(e.id, 'membros', Fire.user.uid));
      } catch (x) { /* já não era membro */ }
      S.equipes = this.list().filter(x => x.id !== e.id); commit(); this.start();
      UI.toast(e.papel === 'gestor' ? 'Equipe excluída.' : 'Você saiu da equipe.');
    }, { danger: true, okLabel: e.papel === 'gestor' ? 'Excluir equipe' : 'Sair' });
  },
  remover(e, m) {
    UI.confirm(`Remover <strong>${U.esc(m.nome)}</strong> da equipe? Para voltar, a pessoa vai precisar de um link novo.`, async () => {
      try {
        await Fire.api.d.del(this.p(e.id, 'membros', m.id));
        const convite = this.rnd(20); await Fire.api.d.update(this.p(e.id), { convite }); e.convite = convite; commit();
        UI.toast(`${m.nome} foi removido. O link de convite foi trocado.`);
      } catch (x) { UI.toast('Não foi possível remover: ' + Fire.erro(x), 'error'); }
    }, { danger: true, okLabel: 'Remover' });
  },

  /* ---------- Missões direto para um membro ---------- */
  async enviar(eqId, uid, pacote) {
    const e = this.list().find(x => x.id === eqId), m = (this.membros[eqId] || []).find(x => x.id === uid);
    const doc = JSON.parse(JSON.stringify({ ...pacote, para: uid, paraNome: m ? m.nome : '', deUid: Fire.user.uid, criadoEm: Date.now(), aceitoEm: null }));
    await Fire.api.d.set(this.p(eqId, 'pacotes', pacote.id), doc);
    UI.toast(`${U.plural(pacote.missoes.length, 'missão enviada', 'missões enviadas')} para ${m ? m.nome : 'a pessoa'}${e ? ' (' + e.nome + ')' : ''}. Chegam no app dela sozinhas.`);
  },
  pac: {},   // últimos pacotes vistos por equipe
  receber(eqId, pacotes) {
    this.pac[eqId] = pacotes;
    // Espera um instante antes de aceitar: se a mesma pessoa estiver com outro aparelho aberto, só um aceita
    clearTimeout(this['rt' + eqId]);
    this['rt' + eqId] = setTimeout(() => this.aceitarNovos(eqId), 600 + Math.random() * 1400);
  },
  aceitarNovos(eqId) {
    const pacotes = this.pac[eqId] || [];
    const novos = pacotes.filter(p => !p.aceitoEm && !Missoes.list().some(m => m.pacote === p.id));
    for (const p of novos) {
      Missoes.aceitar({ ...p, equipe: eqId });
      Fire.api.d.update(this.p(eqId, 'pacotes', p.id), { aceitoEm: Date.now() }).catch(() => {});
      UI.toast(`${p.de || 'Sua equipe'} te enviou ${U.plural(p.missoes.length, 'missão', 'missões')}. Veja na Jornada.`, 'ok', { label: 'Ver', onClick: () => App.go('jornada') });
    }
    pacotes.filter(p => !p.aceitoEm && Missoes.list().some(m => m.pacote === p.id)).forEach(p => Fire.api.d.update(this.p(eqId, 'pacotes', p.id), { aceitoEm: Date.now() }).catch(() => {}));
  },

  /* ---------- Ouvir as mudanças ao vivo ---------- */
  stop() { this.subs.forEach(f => { try { f(); } catch (x) { /* ok */ } }); this.subs = []; clearTimeout(this.timer); },
  start() {
    this.stop();
    if (!this.ativo()) return;
    const uid = Fire.user.uid, d = Fire.api.d;
    for (const e of this.list()) {
      const perdeu = x => { if (/permission/i.test(String(x && (x.code || x.message)))) this.removido(e); };
      this.subs.push(d.onQuery(this.p(e.id, 'pacotes'), ['para', uid], ps => this.receber(e.id, ps), perdeu));
      if (e.papel === 'gestor') this.subs.push(d.onQuery(this.p(e.id, 'membros'), null, ms => { this.membros[e.id] = ms; this.redesenhar(); }, x => console.warn(x)));
    }
    this.publicar();
  },
  redesenhar() {
    const busy = document.querySelector('.modal-wrap') || (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
    if (App.route === 'equipe' && !busy) App.render();
  },
  /* Publica o resumo deste aparelho em cada equipe (chamado após salvar) */
  schedule() { if (!this.ativo() || !this.list().length) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.publicar(), 2500); },
  publicar() {
    if (!this.ativo()) return;
    for (const e of this.list()) Fire.api.d.update(this.p(e.id, 'membros', Fire.user.uid), JSON.parse(JSON.stringify(this.resumo(e.id))))
      .catch(x => { if (/permission|not-found/i.test(String(x && (x.code || x.message)))) this.removido(e); else console.warn('resumo', x); });
  },
  /* Quem lidera removeu esta pessoa (ou excluiu a equipe) */
  removido(e) {
    if (!this.list().some(x => x.id === e.id)) return;
    S.equipes = this.list().filter(y => y.id !== e.id); commit(); this.start();
    UI.toast(`Você não faz mais parte da equipe “${e.nome}”.`, 'warn');
  },
  quando(t) {
    if (!t) return 'ainda não atualizou';
    const min = Math.round((Date.now() - t) / 60000);
    return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
  },
};

Views.equipe = {
  title: 'Equipe', icon: 'user', nav: 'Equipe',
  render() {
    if (!Fire.supported()) return H.empty('Equipes não funcionam dentro do link do Claude. Use o app ou o site.');
    if (!Fire.user) return `<div class="card eq-hero"><h2>${U.icon('users')} Equipes</h2>
      <p>Crie a sua equipe, convide as pessoas por link e envie missões direto para o app de cada uma. Você acompanha o nível, a sequência e o progresso das missões de todos, ao vivo.</p>
      <p class="muted small">Para usar equipes, entre na sua Conta FlowFire (a mesma conta Google em todos os aparelhos).</p>
      <button class="btn primary" data-act="fireEntrar">Entrar com Google</button></div>`;
    const eqs = Equipes.list();
    const novo = `<section class="grid-2">
      <form class="card eq-new" data-submit="eqCriar"><h3>${U.icon('plus')} Criar uma equipe</h3><p class="muted small">Você vira o gestor: convida as pessoas e envia missões.</p>
        <div class="inline-add"><input name="nome" maxlength="60" required placeholder="Nome da equipe (ex.: Equipe técnica)"><button class="btn primary">Criar</button></div></form>
      <form class="card eq-new" data-submit="eqEntrar"><h3>${U.icon('download')} Entrar com convite</h3><p class="muted small">Cole o link que você recebeu de quem lidera a equipe.</p>
        <div class="inline-add"><input name="link" required placeholder="Cole aqui o link do convite"><button class="btn">Entrar</button></div></form>
    </section>`;
    if (!eqs.length) return `<div class="card eq-hero"><h2>${U.icon('users')} Equipes</h2><p>Você ainda não está em nenhuma equipe.</p></div>${novo}`;
    const sel = eqs.find(e => e.id === App.ui.eqSel) || eqs[0];
    const tabs = eqs.length > 1 ? `<div class="tabs mt-tabs">${eqs.map(e => `<button class="tab ${e.id === sel.id ? 'active' : ''}" data-act="eqSel" data-id="${e.id}">${U.esc(e.nome)}</button>`).join('')}</div>` : '';
    return tabs + (sel.papel === 'gestor' ? this.gestor(sel) : this.membro(sel)) + `<details class="card eq-more"><summary>${U.icon('plus', 15)} Criar outra equipe ou entrar em outra</summary>${novo}</details>`;
  },
  gestor(e) {
    const ms = (Equipes.membros[e.id] || []).slice().sort((a, b) => (a.papel === 'gestor') - (b.papel === 'gestor') || (b.resumo?.xp || 0) - (a.resumo?.xp || 0));
    const card = m => {
      const r = m.resumo || {}, miss = m.missoes || [], feitas = miss.filter(x => x.feitaEm).length, mp = Math.min(100, Math.round((r.hoje || 0) / (r.meta || 40) * 100));
      return `<div class="card eq-m" role="button" tabindex="0" data-act="eqMembro" data-e="${e.id}" data-id="${m.id}">
        <div class="eq-m-h"><span class="fb-av">${U.esc(FB.initials(m.nome || '?'))}</span>
          <span class="eq-m-n"><strong>${U.esc(m.nome || 'Sem nome')}${m.id === Fire.user.uid ? ' <small class="muted">(você)</small>' : ''}</strong><small class="muted">${Equipes.quando(m.atualizadoEm)}</small></span>
          <span class="jg-lvb num" title="Nível">${r.nivel || 1}</span></div>
        <div class="eq-m-stats"><span class="jg-stat jg-flame ${r.streak ? 'lit' : ''}">${U.icon('flame', 15)}<b class="num">${r.streak || 0}</b></span><span class="jg-stat jg-xp">${U.icon('bolt', 14)}<b class="num">${r.xp || 0}</b> XP</span>
          <span class="eq-m-miss">${miss.length ? `${U.icon('target', 14)} ${feitas}/${miss.length} missões` : '<span class="muted">Sem missões</span>'}</span></div>
        <div class="jg-meta-t"><span>Meta de hoje</span><b class="num">${Math.min(r.hoje || 0, r.meta || 40)}/${r.meta || 40}</b></div>
        <span class="jg-bar gold"><i style="width:${Math.max(mp, 3)}%"></i></span>
      </div>`;
    };
    return `<section class="card eq-head">
        <div><h2>${U.esc(e.nome)}</h2><p class="muted small">Você é o gestor · ${U.plural(ms.length, 'pessoa', 'pessoas')} · atualiza ao vivo</p></div>
        <span class="grow"></span>
        <button class="btn" data-act="eqConvidar" data-id="${e.id}">${U.icon('users', 15)} Convidar</button>
        <button class="btn primary" data-act="eqMissoes" data-id="${e.id}">${U.icon('target', 15)} Enviar missões</button>
      </section>
      ${ms.length > 1 ? '' : `<p class="muted small">Ninguém entrou ainda. Toque em <strong>Convidar</strong> e mande o link pelo WhatsApp.</p>`}
      <div class="eq-grid">${ms.map(card).join('')}</div>
      <p class="muted small">Você vê só o resumo de cada pessoa. Tarefas, feedbacks e atas delas continuam privados. <a class="link" href="#equipe" data-act="eqSair" data-id="${e.id}">Excluir equipe</a></p>`;
  },
  membro(e) {
    const r = Jogo.calc(), miss = r.miss.filter(m => m.equipe === e.id);
    return `<section class="card eq-head"><div><h2>${U.esc(e.nome)}</h2><p class="muted small">Você é membro. Quem lidera vê o seu nível, XP, sequência e as missões que enviou.</p></div></section>
      <section class="card"><div class="card-h"><h3>${U.icon('target')} Missões desta equipe</h3><a class="link" href="#jornada">Abrir a Jornada</a></div>
        ${miss.length ? `<ul class="jg-miss">${miss.map(m => `<li class="${m.feitaEm ? 'ok' : ''}"><span class="jg-chk">${m.feitaEm ? U.icon('check', 15) : ''}</span><span class="jg-miss-t"><span>${U.esc(m.titulo)}</span><small class="muted">+${m.xp} XP${m.prazo ? ` · até ${U.fmtShort(m.prazo)}` : ''}</small></span><span class="jg-miss-n num">${m.n}/${m.de}</span></li>`).join('')}</ul>`
          : '<p class="muted small">Nenhuma missão desta equipe ainda. Quando chegarem, elas aparecem aqui, na Jornada e, se forem tarefas ou reuniões, direto nas telas delas.</p>'}</section>
      <p class="muted small"><a class="link" href="#equipe" data-act="eqSair" data-id="${e.id}">Sair da equipe</a></p>`;
  },
};

Object.assign(Actions, {
  eqCriar(_, f) { const nome = f.elements.nome.value.trim(); if (nome) Equipes.criar(nome).catch(x => UI.toast('Não foi possível criar: ' + Fire.erro(x), 'error')); },
  eqEntrar(_, f) { const v = f.elements.link.value.trim(), q = v.includes('?') ? v.slice(v.indexOf('?') + 1) : v; Equipes.aceitarConvite(q); },
  eqSel({ id }) { App.ui.eqSel = id; App.render(); },
  eqConvidar({ id }) { const e = Equipes.list().find(x => x.id === id); if (e) Equipes.convidar(e); },
  eqSair({ id }) { const e = Equipes.list().find(x => x.id === id); if (e) Equipes.sair(e); },
  eqMissoes({ id }) { Missoes.form(true, { equipe: id }); },
  eqMembro({ e, id }) {
    const eq = Equipes.list().find(x => x.id === e), m = (Equipes.membros[e] || []).find(x => x.id === id); if (!eq || !m) return;
    const miss = m.missoes || [];
    const mo = UI.modal({
      title: m.nome || 'Membro',
      body: `<p class="muted small">${U.esc(m.email || '')} · atualizado ${Equipes.quando(m.atualizadoEm)}</p>
        <div class="eq-m-stats big"><span class="jg-stat jg-flame ${m.resumo?.streak ? 'lit' : ''}">${U.icon('flame', 17)}<b>${m.resumo?.streak || 0}</b> dias</span><span class="jg-stat jg-xp">${U.icon('bolt', 16)}<b>${m.resumo?.xp || 0}</b> XP</span><span class="jg-lv"><span class="jg-lvb">${m.resumo?.nivel || 1}</span>Nível</span></div>
        <h4>Missões</h4>${miss.length ? `<ul class="jg-miss">${miss.map(x => `<li class="${x.feitaEm ? 'ok' : x.expirada ? 'exp' : ''}"><span class="jg-chk">${x.feitaEm ? U.icon('check', 15) : ''}</span><span class="jg-miss-t"><span>${U.esc(x.titulo)}</span><small class="muted">${x.feitaEm ? 'concluída em ' + U.fmtShort(x.feitaEm) : x.expirada ? 'prazo encerrado' : x.prazo ? 'até ' + U.fmtShort(x.prazo) : 'em andamento'} · +${x.xp} XP</small></span><span class="jg-miss-n num">${x.n}/${x.de}</span></li>`).join('')}</ul>` : '<p class="muted small">Nenhuma missão ainda.</p>'}`,
      footer: `${m.id !== Fire.user.uid ? '<button class="btn ghost danger-text" data-rm>Remover da equipe</button>' : ''}<span class="grow"></span><button class="btn primary" data-env>${U.icon('target', 15)} Enviar missões</button>`,
    });
    mo.el.querySelector('[data-env]').onclick = () => { mo.close(); Missoes.form(true, { equipe: e, membro: id }); };
    const rm = mo.el.querySelector('[data-rm]'); if (rm) rm.onclick = () => { mo.close(); Equipes.remover(eq, m); };
  },
});
