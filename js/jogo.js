'use strict';
/* Modo jogo (Jornada): XP, níveis, sequência, missões e conquistas.
   Nada é guardado à parte: o XP é CALCULADO a partir do que já está salvo (agenda, tarefas, imprevistos,
   reuniões e feedbacks). Assim vale o histórico, fica igual em todos os aparelhos e não dá para ganhar duas vezes.
   Liga/desliga em Configurações → Aparência (settings.jogo). */
const Jogo = {
  META: 40,   // XP por dia para manter a sequência
  PONTOS: { bloco: 5, diaBom: 20, tarefa: 10, noPrazo: 5, imprevisto: 15, reuniao: 20, feedback: 20 },
  CLASSES: {
    rotina: { nome: 'Rotina', sub: 'Atividades da agenda', icon: 'clock', cor: '#9461f5' },
    execucao: { nome: 'Execução', sub: 'Tarefas concluídas', icon: 'tasks', cor: '#3fb5a8' },
    equipe: { nome: 'Equipe', sub: 'Reuniões e feedbacks', icon: 'users', cor: '#e29cf5' },
    imprevistos: { nome: 'Imprevistos', sub: 'Urgências resolvidas', icon: 'alert', cor: '#f0566a' },
  },
  on() { return !!(S && S.settings && S.settings.jogo !== false); },
  day(iso) { return iso ? U.key(new Date(iso)) : null; },
  needGeral: L => 200 + 100 * (L - 1),
  needClasse: L => 80 + 40 * (L - 1),
  nivel(xp, need) { let L = 1, rest = xp; while (rest >= need(L)) { rest -= need(L); L++; } return { L, rest, need: need(L), pct: Math.round(rest / need(L) * 100) }; },

  /* Cada ponto ganho: { d: dia, xp, c: classe, t: tipo } */
  pontos() {
    const P = this.PONTOS, out = [], t = U.today();
    for (const [k, blocks] of Object.entries(S.days || {})) {
      if (k > t) continue;
      const real = blocks.filter(b => !D.isBreak(b) && b.status !== 'cancelada' && !b.demo);
      const done = real.filter(b => b.status === 'concluida');
      done.forEach(() => out.push({ d: k, xp: P.bloco, c: 'rotina', t: 'bloco' }));
      if (real.length >= 3 && done.length / real.length >= 0.8) out.push({ d: k, xp: P.diaBom, c: 'rotina', t: 'diaBom' });
    }
    S.tasks.forEach(x => {
      if (x.demo || x.status !== 'concluida' || !x.completedAt) return;
      const d = this.day(x.completedAt);
      out.push({ d, xp: P.tarefa, c: 'execucao', t: 'tarefa' });
      if (x.dueDate && d <= x.dueDate) out.push({ d, xp: P.noPrazo, c: 'execucao', t: 'noPrazo' });
    });
    S.occurrences.forEach(o => { if (!o.demo && o.status === 'concluida') out.push({ d: this.day(o.resolvedAt) || o.date, xp: P.imprevisto, c: 'imprevistos', t: 'imprevisto' }); });
    S.events.forEach(e => { if (!e.demo && e.registro) out.push({ d: this.day(e.registro.at) || e.date, xp: P.reuniao, c: 'equipe', t: 'reuniao' }); });
    (S.feedbacks || []).forEach(f => out.push({ d: this.day(f.createdAt) || f.date, xp: P.feedback, c: 'equipe', t: 'feedback' }));
    return out.filter(p => p.d);
  },

  /* Resumo usado no Início, na Jornada e no aviso de "+XP". Guardado em cache até o próximo salvamento (Store.rev). */
  calc() {
    const t = U.today(), chave = Store.rev + '|' + t;
    if (this._cache && this._cache.chave === chave) return this._cache.r;
    const base = this.pontos();
    const baseDia = {}; base.forEach(p => { baseDia[p.d] = (baseDia[p.d] || 0) + p.xp; });
    const miss = Missoes.estado(base, baseDia);
    const pts = base.concat(miss.filter(m => m.feitaEm).map(m => ({ d: m.feitaEm, xp: m.xp, c: null, t: 'missao' })));
    const porDia = {}; pts.forEach(p => { porDia[p.d] = (porDia[p.d] || 0) + p.xp; });
    const total = pts.reduce((s, p) => s + p.xp, 0);
    const porClasse = Object.fromEntries(Object.keys(this.CLASSES).map(c => [c, pts.filter(p => p.c === c).reduce((s, p) => s + p.xp, 0)]));
    const bateu = k => (porDia[k] || 0) >= this.META;
    // Sequência: dias úteis seguidos batendo a meta. Folga não quebra (e conta se bateu). Hoje só conta depois de bater.
    let streak = 0;
    for (let k = bateu(t) ? t : U.addDays(t, -1), n = 0; n < 400; k = U.addDays(k, -1), n++) {
      if (bateu(k)) streak++; else if (D.isWorkday(k)) break;
    }
    // Maior sequência da história (para as conquistas)
    const dias = Object.keys(porDia).sort();
    let melhor = 0;
    if (dias.length) {
      let run = 0;
      for (let k = dias[0]; k <= t; k = U.addDays(k, 1)) {
        if (bateu(k)) { run++; melhor = Math.max(melhor, run); } else if (D.isWorkday(k) && k !== t) run = 0;
      }
    }
    const r = { pts, porDia, total, porClasse, streak, melhor, hoje: porDia[t] || 0, geral: this.nivel(total, this.needGeral), miss };
    this._cache = { chave, r };
    return r;
  },

  conquistas(r) {
    const n = tp => r.pts.filter(p => p.t === tp).length;
    return [
      { n: 'Primeiros passos', d: 'Ganhe o primeiro XP', ok: r.total > 0, s: 'star' },
      { n: 'Pegando ritmo', d: '3 dias seguidos', ok: r.melhor >= 3, s: 'flame' },
      { n: 'Semana de fogo', d: '5 dias seguidos', ok: r.melhor >= 5, s: 'flame' },
      { n: 'Imparável', d: '20 dias seguidos', ok: r.melhor >= 20, s: 'flame' },
      { n: 'Dia redondo', d: 'Feche um dia com 80% da agenda', ok: n('diaBom') > 0, s: 'clock' },
      { n: 'Executor', d: '50 tarefas concluídas', ok: n('tarefa') >= 50, s: 'tasks' },
      { n: 'No prazo', d: '20 tarefas dentro do prazo', ok: n('noPrazo') >= 20, s: 'flag' },
      { n: 'Primeira ata', d: 'Registre uma reunião', ok: n('reuniao') > 0, s: 'chat' },
      { n: 'Líder presente', d: '10 feedbacks registrados', ok: n('feedback') >= 10, s: 'users' },
      { n: 'Apaga-incêndio', d: '10 imprevistos resolvidos', ok: n('imprevisto') >= 10, s: 'alert' },
      { n: 'Missão cumprida', d: 'Complete uma missão', ok: n('missao') > 0, s: 'target' },
      { n: 'Nível 5', d: 'Chegue ao nível geral 5', ok: r.geral.L >= 5, s: 'trophy' },
      { n: 'Nível 10', d: 'Chegue ao nível geral 10', ok: r.geral.L >= 10, s: 'trophy' },
    ];
  },

  /* Cartão compacto no topo do Início */
  card() {
    if (!this.on()) return '';
    const r = this.calc(), mp = Math.min(100, Math.round(r.hoje / this.META * 100));
    return `<a class="jg-card" href="#jornada" aria-label="Abrir a Jornada">
      <span class="jg-stat jg-flame ${r.streak ? 'lit' : ''}" title="${U.plural(r.streak, 'dia seguido', 'dias seguidos')} batendo a meta">${U.icon('flame', 18)}<b class="num">${r.streak}</b></span>
      <span class="jg-stat jg-xp">${U.icon('bolt', 17)}<b class="num">${r.total}</b> XP</span>
      <span class="jg-lv"><span class="jg-lvb num">${r.geral.L}</span>Nível</span>
      <span class="jg-meta"><span class="jg-meta-t"><span>Meta de hoje</span><b class="num">${Math.min(r.hoje, this.META)}/${this.META}</b></span><span class="jg-bar"><i style="width:${Math.max(mp, 3)}%"></i></span></span>
      ${U.icon('right', 16)}
    </a>`;
  },

  ring(pct, cor, inner) {
    const R = 30, C = 2 * Math.PI * R;
    return `<span class="jg-ring"><svg viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="6"/><circle cx="34" cy="34" r="${R}" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - Math.max(pct, 3) / 100)).toFixed(1)}"/></svg>${inner}</span>`;
  },

  /* "+10 XP" discreto quando você conclui algo (e aviso ao bater a meta do dia) */
  last: null,
  check() {
    if (!this.on()) { this.last = null; return; }
    const r = this.calc();
    const feitas = r.miss.filter(m => m.feitaEm).map(m => m.id);
    if (this.last && r.total > this.last.total) {
      const metaAgora = this.last.hoje < this.META && r.hoje >= this.META;
      const nova = r.miss.find(m => m.feitaEm && !this.last.feitas.includes(m.id));
      this.pop(`+${r.total - this.last.total} XP`, nova ? `Missão cumprida: ${nova.titulo}` : metaAgora ? `Meta de hoje batida! Sequência: ${U.plural(r.streak, 'dia', 'dias')}` : '');
    }
    this.last = { total: r.total, hoje: r.hoje, feitas };
  },
  pop(txt, sub) {
    let el = document.getElementById('xp-pop');
    if (!el) { el = document.createElement('div'); el.id = 'xp-pop'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `${U.icon(sub ? 'flame' : 'bolt', 16)}<b>${txt}</b>${sub ? `<small>${U.esc(sub)}</small>` : ''}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.popT); this.popT = setTimeout(() => el.classList.remove('show'), sub ? 3200 : 1800);
  },
};

Views.jornada = {
  title: 'Jornada', icon: 'trophy', nav: 'Jornada',
  render() {
    const J = Jogo, r = J.calc(), t = U.today(), g = r.geral;
    const mp = Math.min(100, Math.round(r.hoje / J.META * 100));
    const ws = U.weekStart(t);
    const semana = [0, 1, 2, 3, 4, 5, 6].map(i => { const k = U.addDays(ws, i), ok = (r.porDia[k] || 0) >= J.META; return `<div class="jg-day ${ok ? 'ok' : ''} ${k === t ? 'today' : ''} ${D.isWorkday(k) ? '' : 'off'}"><span class="jg-dot">${ok ? U.icon('flame', 16) : ''}</span><small>${Cal.WD[i]}</small></div>`; }).join('');
    const conq = J.conquistas(r);
    const P = J.PONTOS;
    return `
    <section class="card jg-top">
      <div class="jg-top-stats">
        <div class="jg-big jg-flame ${r.streak ? 'lit' : ''}">${U.icon('flame', 26)}<div><b class="num">${r.streak}</b><small>${r.streak === 1 ? 'dia seguido' : 'dias seguidos'}</small></div></div>
        <div class="jg-big jg-xp">${U.icon('bolt', 24)}<div><b class="num">${r.total}</b><small>XP no total</small></div></div>
        <div class="jg-big jg-lvl"><span class="jg-lvb big num">${g.L}</span><div><b>Nível ${g.L}</b><small class="num">${g.rest} / ${g.need} XP para o ${g.L + 1}</small></div></div>
      </div>
      <span class="jg-bar lg"><i style="width:${Math.max(g.pct, 3)}%"></i></span>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h3>${U.icon('flame')} Sua semana</h3><span class="muted small">Meta: ${J.META} XP por dia</span></div>
        <div class="jg-week">${semana}</div>
        <div class="jg-meta-row"><span>Hoje</span><b class="num">${r.hoje} / ${J.META} XP</b></div>
        <span class="jg-bar gold"><i style="width:${Math.max(mp, 3)}%"></i></span>
        <p class="muted small">${r.hoje >= J.META ? 'Meta de hoje batida. A sequência está garantida.' : `Faltam ${J.META - r.hoje} XP. Folga e fim de semana não quebram a sequência.`}</p>
      </div>
      ${Missoes.card(r)}
    </section>

    <section>
      <div class="card-h jg-h"><h3>Suas áreas</h3><span class="muted small">Cada área sobe de nível com o que você faz nela</span></div>
      <div class="jg-classes">${Object.entries(J.CLASSES).map(([id, c]) => { const xp = r.porClasse[id], n = J.nivel(xp, J.needClasse), hoje = r.pts.filter(p => p.d === t && p.c === id).reduce((s, p) => s + p.xp, 0);
        return `<div class="card jg-cls" style="--c:${c.cor}">${J.ring(n.pct, c.cor, `<span class="jg-ic">${U.icon(c.icon, 20)}</span><span class="jg-lvtag num">${n.L}</span>`)}
          <div class="jg-cls-b"><strong>${c.nome}</strong><small class="muted">${c.sub}</small><span class="jg-bar sm"><i style="width:${Math.max(n.pct, 4)}%;background:${c.cor}"></i></span><small class="num"><b>${n.rest} / ${n.need} XP</b> para o nível ${n.L + 1}${hoje ? ` · <span class="jg-today">+${hoje} hoje</span>` : ''}</small></div></div>`; }).join('')}</div>
    </section>

    <section class="card">
      <div class="card-h"><h3>${U.icon('trophy')} Conquistas</h3><span class="muted small">${conq.filter(a => a.ok).length} de ${conq.length}</span></div>
      <div class="jg-conq">${conq.map(a => `<div class="jg-badge ${a.ok ? 'on' : ''}" title="${U.esc(a.d)}"><span class="jg-medal">${U.icon(a.s, 22)}</span><strong>${a.n}</strong><small>${a.d}</small></div>`).join('')}</div>
    </section>

    <details class="card jg-how">
      <summary>${U.icon('info')} Como ganhar XP</summary>
      <ul class="jg-how-l">
        <li><span>Concluir uma atividade da agenda</span><b>+${P.bloco}</b></li>
        <li><span>Fechar o dia com 80% da agenda concluída</span><b>+${P.diaBom}</b></li>
        <li><span>Concluir uma tarefa</span><b>+${P.tarefa}</b></li>
        <li><span>… dentro do prazo (bônus)</span><b>+${P.noPrazo}</b></li>
        <li><span>Resolver um imprevisto</span><b>+${P.imprevisto}</b></li>
        <li><span>Registrar uma reunião</span><b>+${P.reuniao}</b></li>
        <li><span>Registrar um feedback</span><b>+${P.feedback}</b></li>
      </ul>
      <p class="muted small">O XP é calculado a partir do que está salvo no app, então vale o que você já fez antes. Reabrir algo concluído tira o XP dele. Para desligar o modo jogo: Configurações → Aparência.</p>
    </details>`;
  },
};

/* Missões da Jornada: quem lidera monta um pacote e envia por link (WhatsApp); quem recebe abre o link e aceita.
   Missões de ATRIBUIÇÃO criam o item de verdade no app de quem recebe (tarefa, reunião na agenda, imprevisto,
   pessoa em Feedbacks) e ficam concluídas quando esse item é concluído. Missões de META contam o que a pessoa faz. */
const Missoes = {
  /* Atribuições: [rótulo, título, rótulo do campo de texto, exemplo, usa data, usa hora] */
  ITENS: {
    tarefaItem: ['Tarefa (entra em Tarefas)', x => x.titulo, 'Tarefa', 'Ex.: Atualizar a planilha de materiais', true, true],
    reuniaoItem: ['Reunião (entra na agenda)', x => 'Reunião: ' + x.titulo, 'Assunto da reunião', 'Ex.: Alinhamento da escala', true, true],
    feedbackItem: ['Feedback com alguém (entra em Feedbacks)', x => 'Feedback com ' + x.titulo, 'Com quem', 'Nome do colaborador', true, false],
    imprevistoItem: ['Imprevisto para resolver', x => 'Resolver: ' + x.titulo, 'O que resolver', 'Ex.: Câmera offline no cliente X', true, true],
  },
  TIPOS: {
    tarefa: ['Concluir tarefas', n => `Concluir ${U.plural(n, 'tarefa', 'tarefas')}`],
    noPrazo: ['Concluir tarefas no prazo', n => `Concluir ${U.plural(n, 'tarefa', 'tarefas')} dentro do prazo`],
    bloco: ['Concluir atividades da agenda', n => `Concluir ${U.plural(n, 'atividade', 'atividades')} da agenda`],
    diaBom: ['Fechar dias com 80% da agenda', n => `Fechar ${U.plural(n, 'dia', 'dias')} com 80% da agenda`],
    meta: ['Bater a meta de XP do dia', n => `Bater a meta de XP em ${U.plural(n, 'dia', 'dias')}`],
    reuniao: ['Registrar reuniões', n => `Registrar ${U.plural(n, 'reunião', 'reuniões')}`],
    feedback: ['Registrar feedbacks', n => `Registrar ${U.plural(n, 'feedback', 'feedbacks')}`],
    imprevisto: ['Resolver imprevistos', n => `Resolver ${U.plural(n, 'imprevisto', 'imprevistos')}`],
    manual: ['Outra (a pessoa marca quando fizer)', () => ''],
  },
  valido(tipo) { return !!(this.ITENS[tipo] || this.TIPOS[tipo]); },
  SITE: 'https://paulojunior2303-maker.github.io/gestao-rotina/',
  /* XP da missão é automático: valor de cada unidade × quantidade (arredondado de 5 em 5, entre 10 e 500) */
  VALOR: { tarefa: 10, noPrazo: 12, bloco: 3, diaBom: 15, meta: 15, reuniao: 15, feedback: 15, imprevisto: 12 },
  MANUAL_XP: 30,
  ITEM_XP: { tarefaItem: 20, reuniaoItem: 30, feedbackItem: 30, imprevistoItem: 25 },
  xpDe(tipo, alvo) { return this.ITEM_XP[tipo] || (tipo === 'manual' ? this.MANUAL_XP : Math.min(500, Math.max(10, Math.round(this.VALOR[tipo] * alvo / 5) * 5))); },
  list() { return S.missoes || (S.missoes = []); },

  /* Progresso de cada missão: conta o que foi feito desde que ela foi aceita (e até o prazo, se houver) */
  estado(base, baseDia) {
    const t = U.today();
    return this.list().map(m => {
      const fim = m.prazo || '9999-12-31', dentro = d => d >= m.desde && d <= fim;
      let n = 0, feitaEm = null;
      if (m.tipo === 'manual') { n = m.feitaEm ? 1 : 0; feitaEm = m.feitaEm || null; }
      else if (this.ITENS[m.tipo]) { feitaEm = this.itemFeito(m); n = feitaEm ? 1 : 0; }
      else {
        const datas = m.tipo === 'meta'
          ? Object.keys(baseDia).filter(d => dentro(d) && baseDia[d] >= Jogo.META)
          : base.filter(p => p.t === m.tipo && dentro(p.d)).map(p => p.d);
        datas.sort(); n = Math.min(datas.length, m.alvo);
        if (datas.length >= m.alvo) feitaEm = datas[m.alvo - 1];
      }
      const de = m.tipo === 'manual' || this.ITENS[m.tipo] ? 1 : m.alvo;
      return { ...m, n, de, feitaEm, expirada: !feitaEm && !!m.prazo && t > m.prazo };
    });
  },

  /* Dia em que o item criado pela missão foi concluído (ou null) */
  itemFeito(m) {
    const ref = m.ref || {}, day = iso => iso ? U.key(new Date(iso)) : U.today();
    if (m.tipo === 'tarefaItem') { const x = S.tasks.find(y => y.id === ref.id); return x && x.status === 'concluida' ? day(x.completedAt) : null; }
    if (m.tipo === 'reuniaoItem') { const e = S.events.find(y => y.id === ref.id); return e && e.registro ? day(e.registro.at) : null; }
    if (m.tipo === 'imprevistoItem') { const o = S.occurrences.find(y => y.id === ref.id); return o && o.status === 'concluida' ? day(o.resolvedAt) : null; }
    if (m.tipo === 'feedbackItem') {
      const nome = (m.pessoa || '').trim().toLowerCase();
      const ds = (S.feedbacks || []).filter(f => (f.pessoa || '').trim().toLowerCase() === nome).map(f => f.createdAt ? day(f.createdAt) : f.date).filter(d => d >= m.desde).sort();
      return ds[0] || null;
    }
    return null;
  },
  /* Abrir o item da missão (tarefa, reunião, imprevisto ou registrar o feedback) */
  abrir(m) {
    const ref = m.ref || {};
    if (m.tipo === 'tarefaItem') { const x = S.tasks.find(y => y.id === ref.id); if (x) return Tasks.form(x); }
    if (m.tipo === 'reuniaoItem') { const e = S.events.find(y => y.id === ref.id); if (e) return Events.view(e); }
    if (m.tipo === 'imprevistoItem') { const o = S.occurrences.find(y => y.id === ref.id); if (o) return Occ.form(o); }
    if (m.tipo === 'feedbackItem') return FB.form(null, m.pessoa);
    UI.toast('O item desta missão foi excluído.', 'warn');
  },

  card(r) {
    const ativas = r.miss.filter(m => !m.feitaEm && !m.expirada), feitas = r.miss.filter(m => m.feitaEm), fora = r.miss.filter(m => m.expirada);
    const item = m => `<li class="${m.feitaEm ? 'ok' : m.expirada ? 'exp' : ''}">
        <span class="jg-chk">${m.feitaEm ? U.icon('check', 15) : ''}</span>
        <span class="jg-miss-t">${this.ITENS[m.tipo] ? `<a href="#jornada" data-act="msAbrir" data-id="${m.id}">${U.esc(m.titulo)}</a>` : `<span>${U.esc(m.titulo)}</span>`}
          <small class="muted">${m.de_ ? `De ${U.esc(m.de_)} · ` : ''}${m.data ? `${U.fmtShort(m.data)}${m.hora ? ' ' + m.hora : ''} · ` : ''}${m.prazo ? `até ${U.fmtShort(m.prazo)} · ` : ''}+${m.xp} XP${m.expirada ? ' · prazo encerrado' : ''}</small>
          ${!m.feitaEm && m.tipo !== 'manual' && !this.ITENS[m.tipo] ? `<span class="jg-bar sm"><i style="width:${Math.max(Math.round(m.n / m.de * 100), 3)}%"></i></span>` : ''}</span>
        ${this.ITENS[m.tipo] ? (m.feitaEm ? '' : `<button class="btn sm" data-act="msAbrir" data-id="${m.id}">${m.tipo === 'feedbackItem' ? 'Registrar' : 'Abrir'}</button>`) : m.tipo === 'manual' && !m.expirada ? (m.feitaEm ? `<button class="icon-btn" data-act="msFeita" data-id="${m.id}" data-v="" title="Desmarcar">${U.icon('undo', 15)}</button>` : `<button class="btn sm" data-act="msFeita" data-id="${m.id}" data-v="1">Concluí</button>`) : `<span class="jg-miss-n num">${m.n}/${m.de}</span>`}
        <button class="icon-btn xs" data-act="msDel" data-id="${m.id}" title="Remover missão" aria-label="Remover missão">${U.icon('x', 14)}</button></li>`;
    return `<div class="card jg-miss-card">
      <div class="card-h"><h3>${U.icon('target')} Missões</h3><span class="muted small">${feitas.length} de ${r.miss.length}</span></div>
      ${r.miss.length ? `<ul class="jg-miss">${ativas.map(item).join('')}</ul>
        ${feitas.length || fora.length ? `<details class="jg-done"><summary>Concluídas e encerradas (${feitas.length + fora.length})</summary><ul class="jg-miss">${feitas.concat(fora).map(item).join('')}</ul></details>` : ''}`
        : `<p class="muted small">Nenhuma missão ainda. Quem lidera a equipe monta as missões e envia por um link; você também pode criar as suas.</p>`}
      <div class="row-actions wrap jg-miss-actions">
        <button class="btn sm primary" data-act="msEnviar">${U.icon('arrow', 15)} Enviar missões para alguém</button>
        <button class="btn sm" data-act="msNova">${U.icon('plus', 15)} Criar para mim</button>
        <button class="btn sm ghost" data-act="msReceber">${U.icon('download', 15)} Receber</button>
        ${r.miss.length ? `<button class="btn sm ghost" data-act="msProgresso">${U.icon('upload', 15)} Enviar meu progresso</button>` : ''}
      </div>
    </div>`;
  },

  /* Formulário de uma ou mais missões (para mim ou para enviar) */
  form(paraOutro) {
    const opt = (k, l) => `<option value="${k}">${l}</option>`;
    const tipos = `<optgroup label="Atribuir (cria no app da pessoa)">${Object.entries(this.ITENS).map(([k, [l]]) => opt(k, l)).join('')}</optgroup>
      <optgroup label="Metas (o app conta sozinho)">${Object.entries(this.TIPOS).filter(([k]) => k !== 'manual').map(([k, [l]]) => opt(k, l)).join('')}</optgroup>
      <optgroup label="Livre">${opt('manual', this.TIPOS.manual[0])}</optgroup>`;
    const linha = () => `<div class="ms-row">
        <label class="ms-f ms-f-tipo"><span>Missão</span><select class="ms-tipo">${tipos}</select></label>
        <label class="ms-f ms-f-n"><span>Quantidade</span><input class="ms-n" type="number" min="1" max="999" value="5" inputmode="numeric"></label>
        <label class="ms-f ms-f-txt"><span class="ms-txt-l">Título</span><input class="ms-txt" type="text" maxlength="90" list="ms-pessoas"></label>
        <label class="ms-f ms-f-data"><span>Data</span><input class="ms-data" type="date" min="${U.today()}"></label>
        <label class="ms-f ms-f-hora"><span>Horário</span><input class="ms-hora" type="time"></label>
        <button type="button" class="icon-btn xs ms-rm" title="Remover esta missão" aria-label="Remover esta missão">${U.icon('x', 14)}</button>
        <p class="ms-sum"></p></div>`;
    const m = UI.modal({
      title: paraOutro ? 'Enviar missões' : 'Criar missão para mim',
      wide: true,
      body: `${paraOutro ? `<div class="form-grid">
          <div class="field"><label>Para quem</label><input name="para" list="ms-pessoas" maxlength="60" placeholder="Nome da pessoa"></div>
          <div class="field"><label>Seu nome (aparece para a pessoa)</label><input name="de" maxlength="60" value="${U.esc(S.settings.meuNome || '')}" placeholder="Ex.: Victor"></div></div>` : ''}
        <datalist id="ms-pessoas">${D.techNames().map(n => `<option value="${U.esc(n)}">`).join('')}</datalist>
        <p class="muted small"><strong>Atribuir</strong> cria o item ${paraOutro ? 'no app da pessoa' : 'no seu app'} (a tarefa em Tarefas, a reunião na agenda, o feedback em Feedbacks) e, com data, ele aparece no calendário. A missão fica concluída quando o item for concluído. <strong>Metas</strong> contam o que for feito a partir de ${paraOutro ? 'quando a pessoa aceitar' : 'hoje'}. O XP é calculado sozinho.</p>
        <div class="ms-rows">${linha()}</div>
        <button type="button" class="btn sm ghost ms-add">${U.icon('plus', 15)} Adicionar outra missão</button>
        <div class="field ms-prazo"><label>Prazo para tudo (opcional)</label><input type="date" name="prazo" min="${U.today()}"></div>
        <p class="form-error" hidden></p>`,
      footer: `<span class="grow"></span><button class="btn ghost" data-no>Cancelar</button><button class="btn primary" data-ok>${paraOutro ? `${U.icon('arrow', 15)} Gerar link` : 'Salvar'}</button>`,
    });
    const el = m.el, rows = el.querySelector('.ms-rows');
    const ler = row => {
      const tipo = row.querySelector('.ms-tipo').value;
      return { tipo, alvo: Math.min(999, Math.max(1, Math.round(Number(row.querySelector('.ms-n').value) || 1))), titulo: row.querySelector('.ms-txt').value.trim(), data: row.querySelector('.ms-data').value || '', hora: row.querySelector('.ms-hora').value || '' };
    };
    // Mostra só os campos de cada tipo, o que a pessoa vai ver e o XP calculado
    const sync = row => {
      const x = ler(row), it = this.ITENS[x.tipo], manual = x.tipo === 'manual';
      row.querySelector('.ms-f-n').hidden = !!it || manual;
      row.querySelector('.ms-f-data').hidden = !(it || manual);
      row.querySelector('.ms-f-hora').hidden = !(it && it[5]);
      row.querySelector('.ms-txt-l').textContent = it ? it[2] : manual ? 'Escreva a missão' : 'Título (opcional)';
      row.querySelector('.ms-txt').placeholder = it ? it[3] : manual ? 'Ex.: revisar 1 POP' : 'Usa o título automático';
      const tit = this.titulo(x);
      row.querySelector('.ms-sum').innerHTML = `${U.esc(tit || '(preencha o campo acima)')}${x.data && (it || manual) ? ` · ${U.fmtShort(x.data)}${x.hora && it && it[5] ? ' ' + x.hora : ''}` : ''} · <b>+${this.xpDe(x.tipo, x.alvo)} XP</b>${manual ? ' <small>(marcada à mão)</small>' : ''}`;
    };
    rows.querySelectorAll('.ms-row').forEach(sync);
    el.addEventListener('input', e => { const r = e.target.closest('.ms-row'); if (r) sync(r); });
    el.addEventListener('change', e => { const r = e.target.closest('.ms-row'); if (r) sync(r); });
    el.querySelector('.ms-add').onclick = () => { rows.insertAdjacentHTML('beforeend', linha()); rows.querySelectorAll('.ms-row').forEach(sync); };
    rows.addEventListener('click', e => { if (e.target.closest('.ms-rm') && rows.children.length > 1) e.target.closest('.ms-row').remove(); });
    el.querySelector('[data-no]').onclick = () => m.close();
    el.querySelector('[data-ok]').onclick = () => {
      const err = el.querySelector('.form-error'), fail = msg => { err.textContent = msg; err.hidden = false; };
      const prazo = el.querySelector('[name=prazo]').value || '';
      const lista = [...rows.querySelectorAll('.ms-row')].map(r => {
        const x = ler(r), it = this.ITENS[x.tipo];
        if (!it && x.tipo !== 'manual') { x.data = ''; x.hora = ''; }
        if (!(it && it[5])) x.hora = '';
        if (it || x.tipo === 'manual') x.alvo = 1;
        return { ...x, xp: this.xpDe(x.tipo, x.alvo) };
      });
      if (lista.some(x => (this.ITENS[x.tipo] || x.tipo === 'manual') && !x.titulo)) return fail('Preencha o campo de cada missão (ex.: o nome da tarefa ou de quem recebe o feedback).');
      if (lista.some(x => x.tipo === 'reuniaoItem' && !x.data)) return fail('Informe a data da reunião.');
      if (!paraOutro) { this.aceitar({ de: '', prazo, missoes: lista }); m.close(); UI.toast(U.plural(lista.length, 'missão criada', 'missões criadas') + '.'); return; }
      const para = el.querySelector('[name=para]').value.trim(), de = el.querySelector('[name=de]').value.trim();
      if (!para) return fail('Informe para quem são as missões.');
      if (de && de !== S.settings.meuNome) { S.settings.meuNome = de; Store.save(); }
      m.close();
      this.compartilhar({ id: U.uid(), de, para, prazo, missoes: lista });
    };
  },

  /* Pacote <-> código (vai no link) */
  codificar(p) { return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, ...p })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  decodificar(txt) {
    const m = String(txt || '').trim().match(/[?&]p=([A-Za-z0-9_-]+)/) || String(txt || '').trim().match(/^([A-Za-z0-9_-]{20,})$/);
    if (!m) return null;
    try {
      const b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const o = JSON.parse(decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4)))));
      const cut = (s, n) => String(s || '').slice(0, n);
      const missoes = (Array.isArray(o.missoes) ? o.missoes : []).slice(0, 30)
        .filter(x => x && this.valido(x.tipo))
        .map(x => { const alvo = Math.min(999, Math.max(1, Math.round(Number(x.alvo) || 1))), dt = /^\d{4}-\d{2}-\d{2}$/.test(x.data || '') ? x.data : '', hr = /^\d{2}:\d{2}$/.test(x.hora || '') ? x.hora : '';
          return { tipo: x.tipo, alvo, titulo: cut(x.titulo, 90), data: dt, hora: hr, xp: this.xpDe(x.tipo, alvo) }; })
        .filter(x => !(this.ITENS[x.tipo] || x.tipo === 'manual') || x.titulo);
      if (!missoes.length) return null;
      return { id: cut(o.id, 40) || U.uid(), de: cut(o.de, 60), para: cut(o.para, 60), prazo: /^\d{4}-\d{2}-\d{2}$/.test(o.prazo || '') ? o.prazo : '', missoes };
    } catch (e) { return null; }
  },
  link(p) { return `${this.SITE}${CANAL_TESTE ? 'teste/' : ''}#missoes?p=${this.codificar(p)}`; },

  async compartilhar(p) {
    const url = this.link(p);
    const txt = `${p.de ? p.de + ' te enviou' : 'Você recebeu'} ${U.plural(p.missoes.length, 'missão', 'missões')} no FlowFire:\n${p.missoes.map(x => '• ' + this.titulo(x)).join('\n')}${p.prazo ? `\nPrazo: ${U.fmtDate(p.prazo)}` : ''}\n\nAbra o link para aceitar (no app do celular: Jornada → Missões → Receber e cole o link):\n${url}`;
    UI.modal({
      title: `Missões para ${p.para}`,
      body: `<p>Mande este texto para <strong>${U.esc(p.para)}</strong> pelo WhatsApp ou e-mail. Quando a pessoa abrir o link e aceitar, as missões entram na Jornada dela e o progresso conta sozinho.</p>
        <textarea class="ms-share" rows="8" readonly>${U.esc(txt)}</textarea>`,
      footer: `<button class="btn ghost" data-copy>${U.icon('download', 15)} Copiar</button><span class="grow"></span><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Enviar pelo WhatsApp</a>`,
    }).el.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(txt); UI.toast('Copiado.'); } catch (e) { UI.toast('Selecione o texto e copie.', 'warn'); } };
  },

  titulo(x) { const it = this.ITENS[x.tipo]; return it ? (x.titulo ? it[1](x) : '') : (x.titulo || this.TIPOS[x.tipo][1](x.alvo)); },

  /* Recebe um pacote: confirma e guarda as missões (a contagem começa hoje) */
  receber(txt) {
    const p = this.decodificar(txt);
    if (!p) { UI.toast('Link ou código de missões inválido.', 'error'); return false; }
    if (this.list().some(m => m.pacote === p.id)) { App.go('jornada'); UI.toast('Você já aceitou essas missões.'); return true; }
    UI.confirm(`${p.de ? `<strong>${U.esc(p.de)}</strong> te enviou` : 'Você recebeu'} ${U.plural(p.missoes.length, 'missão', 'missões')}${p.para ? ` (para ${U.esc(p.para)})` : ''}:<ul class="ms-prev">${p.missoes.map(x => `<li>${U.esc(this.titulo(x))}${x.data ? ` (${U.fmtShort(x.data)}${x.hora ? ' ' + x.hora : ''})` : ''} <b>+${x.xp} XP</b></li>`).join('')}</ul>${p.prazo ? `Prazo: ${U.fmtDate(p.prazo)}<br>` : ''}<small class="muted">Tarefas, reuniões e imprevistos já entram no seu app${p.missoes.some(x => x.data) ? ' e no calendário' : ''}. As metas contam a partir de hoje.</small>`,
      () => { this.aceitar(p); App.go('jornada'); UI.toast('Missões aceitas. Boa jornada!'); }, { title: 'Novas missões', okLabel: 'Aceitar missões' });
    return true;
  },
  aceitar(p) {
    const t = U.today(), pacote = p.id || null;
    S.settings.jogo = true;   // quem aceita missões usa a Jornada
    const now = new Date().toISOString(), origem = p.de ? `Missão de ${p.de}.` : 'Missão da Jornada.';
    const cat = id => (S.settings.categories.some(c => c.id === id) ? id : (S.settings.categories[0] || {}).id || '');
    p.missoes.forEach(x => {
      const m = { id: U.uid(), pacote, de_: p.de || '', titulo: this.titulo(x), tipo: x.tipo, alvo: x.alvo, xp: x.xp, prazo: p.prazo || '', data: x.data || '', hora: x.hora || '', desde: t, feitaEm: null };
      const quando = x.data || p.prazo || '';
      if (x.tipo === 'tarefaItem') {
        const k = { id: U.uid(), title: x.titulo, description: origem, category: cat('equipe'), priority: 'alta', status: 'pendente', startDate: '', dueDate: quando, dueTime: x.hora || '', responsible: '', notes: '', createdAt: now, completedAt: null, missao: m.id };
        S.tasks.push(k); m.ref = { id: k.id };
      } else if (x.tipo === 'reuniaoItem') {
        const e = { id: U.uid(), title: x.titulo, date: x.data || quando || t, time: x.hora || '', pautas: [], notes: origem, reuniao: true, missao: m.id };
        S.events.push(e); m.ref = { id: e.id };
      } else if (x.tipo === 'imprevistoItem') {
        const o = { id: U.uid(), createdAt: now, scheduled: null, title: x.titulo, description: origem, priority: 'alta', date: t, time: U.fromMin(U.nowMin()), dueDate: quando, dueTime: x.hora || '', responsible: '', notes: '', status: 'pendente', missao: m.id };
        S.occurrences.push(o); m.ref = { id: o.id };
      } else if (x.tipo === 'feedbackItem') {
        m.pessoa = x.titulo;
        if (!D.techNames().some(n => n.toLowerCase() === x.titulo.toLowerCase())) S.settings.technicians.push({ id: U.uid(), name: x.titulo });
      }
      this.list().push(m);
    });
    commit();
  },

  progresso() {
    const r = Jogo.calc();
    const txt = `Progresso das minhas missões (${U.fmtDate(U.today())}):\n${r.miss.map(m => `${m.feitaEm ? '✅' : m.expirada ? '⌛' : '⬜'} ${m.titulo}: ${m.feitaEm ? 'concluída em ' + U.fmtShort(m.feitaEm) : `${m.n}/${m.de}`}`).join('\n')}\nNível ${r.geral.L} · ${r.total} XP · sequência de ${U.plural(r.streak, 'dia', 'dias')}`;
    UI.modal({
      title: 'Enviar meu progresso',
      body: `<p class="muted small">Mande para quem te passou as missões.</p><textarea class="ms-share" rows="8" readonly>${U.esc(txt)}</textarea>`,
      footer: `<span class="grow"></span><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Enviar pelo WhatsApp</a>`,
    });
  },
};

Object.assign(Actions, {
  msEnviar() { Missoes.form(true); },
  msNova() { Missoes.form(false); },
  msReceber() {
    const m = UI.form({
      title: 'Receber missões', submitLabel: 'Continuar',
      fields: [{ name: 'code', label: 'Cole aqui o link (ou o código) que você recebeu', type: 'textarea', rows: 4, required: true }],
      onSubmit(v) { Missoes.receber(v.code); },
    });
    return m;
  },
  msFeita({ id, v }) { const m = Missoes.list().find(x => x.id === id); if (!m) return; m.feitaEm = v ? U.today() : null; commit(); },
  msDel({ id }) { const m = Missoes.list().find(x => x.id === id); if (!m) return; UI.confirm(`Remover a missão <strong>${U.esc(m.titulo)}</strong>?`, () => { S.missoes = Missoes.list().filter(x => x.id !== id); commit(); }, { danger: true, okLabel: 'Remover' }); },
  msProgresso() { Missoes.progresso(); },
  msAbrir({ id }) { const m = Missoes.list().find(x => x.id === id); if (m) Missoes.abrir(m); },
});
