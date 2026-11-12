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
    App.ui.eqTab = 'pessoas'; App.ui.pessoa = null; App.go('equipe');
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
    if (this.list().some(e => e.id === o.e)) { App.go('equipe'); return UI.toast('Você já está nessa equipe.'); }
    UI.confirm(`Você foi convidado para a equipe <strong>${U.esc(nome)}</strong> no FlowFire.<br><small class="muted">Quem lidera a equipe vai ver só um resumo seu: nível, XP, sequência, meta do dia e o progresso das missões que ele enviar. Suas tarefas, feedbacks e atas continuam privados.</small>`, async () => {
      try {
        if (!this.ativo()) { await Fire.connect(); if (!Fire.user) return; }
        await Fire.api.d.set(this.p(o.e, 'membros', Fire.user.uid), { papel: 'membro', convite: o.c, entrouEm: Date.now(), ...this.resumo(o.e) });
        this.list().push({ id: o.e, nome, papel: 'membro' });
        commit(); this.start();
        App.go('equipe');
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

Object.assign(Actions, {
  eqCriar(_, f) { const nome = f.elements.nome.value.trim(); if (nome) Equipes.criar(nome).catch(x => UI.toast('Não foi possível criar: ' + Fire.erro(x), 'error')); },
  eqEntrar(_, f) { const v = f.elements.link.value.trim(), q = v.includes('?') ? v.slice(v.indexOf('?') + 1) : v; Equipes.aceitarConvite(q); },
  eqConvidar({ id }) { const e = Equipes.list().find(x => x.id === id); if (e) Equipes.convidar(e); },
  eqSair({ id }) { const e = Equipes.list().find(x => x.id === id); if (e) Equipes.sair(e); },
  eqMissoes({ id }) { Missoes.form(true, { equipe: id }); },
});
