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

  /* Resumo usado no Início, na Jornada e no aviso de "+XP" */
  calc() {
    const pts = this.pontos(), t = U.today();
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
    const hoje = porDia[t] || 0;
    return { pts, porDia, total, porClasse, streak, melhor, hoje, geral: this.nivel(total, this.needGeral) };
  },

  /* Missões do dia, montadas com os dados de hoje */
  missoes(r) {
    const t = U.today(), hojePts = r.pts.filter(p => p.d === t), cnt = tp => hojePts.filter(p => p.t === tp).length;
    const blocos = D.dayBlocks(t).filter(b => !D.isBreak(b) && b.status !== 'cancelada');
    const m = [{ t: `Ganhe ${this.META} XP e mantenha a sequência`, n: Math.min(r.hoje, this.META), de: this.META, xp: true }];
    if (blocos.length) { const de = Math.min(3, blocos.length); m.push({ t: `Conclua ${U.plural(de, 'atividade', 'atividades')} da agenda`, n: Math.min(cnt('bloco'), de), de, go: '#agenda' }); }
    if (S.tasks.some(x => OPEN(x.status)) || cnt('tarefa')) m.push({ t: S.tasks.some(D.taskLate) ? 'Conclua 1 tarefa (tem atrasada esperando)' : 'Conclua 1 tarefa', n: Math.min(cnt('tarefa'), 1), de: 1, go: '#tarefas' });
    if (S.occurrences.some(o => OPEN(o.status)) || cnt('imprevisto')) m.push({ t: 'Resolva 1 imprevisto', n: Math.min(cnt('imprevisto'), 1), de: 1, go: '#imprevistos' });
    else if (Meetings.toRegister().length || cnt('reuniao')) m.push({ t: 'Registre 1 reunião', n: Math.min(cnt('reuniao'), 1), de: 1, go: '#reunioes' });
    else m.push({ t: 'Registre 1 feedback com alguém da equipe', n: Math.min(cnt('feedback'), 1), de: 1, go: '#feedbacks' });
    return m.slice(0, 4);
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
    if (this.last && r.total > this.last.total) {
      const metaAgora = this.last.hoje < this.META && r.hoje >= this.META;
      this.pop(`+${r.total - this.last.total} XP`, metaAgora ? `Meta de hoje batida! Sequência: ${U.plural(r.streak, 'dia', 'dias')}` : '');
    }
    this.last = { total: r.total, hoje: r.hoje };
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
    const miss = J.missoes(r), conq = J.conquistas(r), feitas = miss.filter(m => m.n >= m.de).length;
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
      <div class="card">
        <div class="card-h"><h3>${U.icon('target')} Missões do dia</h3><span class="muted small">${feitas} de ${miss.length}</span></div>
        <ul class="jg-miss">${miss.map(m => { const ok = m.n >= m.de; return `<li class="${ok ? 'ok' : ''}"><span class="jg-chk">${ok ? U.icon('check', 15) : ''}</span><span class="jg-miss-t">${m.go && !ok ? `<a href="${m.go}">${m.t}</a>` : m.t}</span><span class="jg-miss-n num">${m.n}/${m.de}${m.xp ? ' XP' : ''}</span></li>`; }).join('')}</ul>
      </div>
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
