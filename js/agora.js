'use strict';
/* Cartão "Agora" do Início: o que fazer neste momento e o que vem em seguida, com ações de um toque. */
const Agora = {
  /* Atividade de agora (sem intervalo/concluídas) e a próxima, no dia de hoje */
  state() {
    const t = U.today(), n = U.nowMin();
    const bl = D.dayBlocks(t).filter(b => b.status !== 'cancelada');
    const now = bl.find(b => !D.blockDone(b) && U.toMin(b.start) <= n && U.toMin(b.end) > n) || null;
    const run = bl.find(b => b.status === 'andamento' && !D.isBreak(b) && b !== now) || null;
    const next = bl.find(b => !D.blockDone(b) && U.toMin(b.start) > n && b !== run) || null;
    const behind = bl.filter(b => D.blockLate(b, t) && b !== run);
    const left = bl.filter(b => !D.blockDone(b) && !D.isBreak(b)).length;
    return { t, n, now, run, next, behind, left, total: bl.length };
  },

  card() {
    const t = U.today();
    if (!D.isWorkday(t) && !D.dayBlocks(t).length) return '';
    const s = Agora.state();
    const cur = s.run || s.now;
    const inMin = m => m <= 0 ? 'agora' : m < 60 ? `em ${m} min` : `em ${U.fmtDur(m)}`;
    let main;
    if (cur && D.isBreak(cur)) {
      main = `<div class="agr-now agr-break"><span class="agr-l">${U.icon('pause', 14)} Intervalo até ${cur.end}</span><h3>Bom descanso</h3>
        <div class="agr-acts"><button class="btn sm ghost" data-act="agoraImprevisto">${U.icon('alert', 15)} Imprevisto</button></div></div>`;
    } else if (cur) {
      const a = U.toMin(cur.start), z = U.toMin(cur.end), pct = U.clamp(Math.round((s.n - a) / Math.max(1, z - a) * 100), 0, 100);
      const rest = z - s.n;
      const occ = cur.occurrenceId ? S.occurrences.find(o => o.id === cur.occurrenceId) : null;
      main = `<div class="agr-now ${occ ? 'agr-occ' : ''}" style="--c:${D.cat(cur.category).color}">
        <span class="agr-l">${occ ? U.icon('alert', 14) + ' Imprevisto em andamento' : 'Agora'} · ${cur.start}–${cur.end}${rest > 0 ? ` · ${rest < 60 ? `faltam ${rest} min` : `falta ${U.fmtDur(rest)}`}` : ' · passou do horário'}</span>
        <h3>${U.esc(occ ? occ.title : cur.title)}</h3>
        ${H.bar(pct, rest > 0 ? 'var(--accent)' : 'var(--red)', 'agr-bar')}
        <div class="agr-acts">
          <button class="btn sm primary" data-act="agoraDone" data-id="${cur.id}">${U.icon('check', 15)} ${occ ? 'Resolvido' : 'Concluir'}</button>
          <button class="btn sm ghost" data-act="agoraMais" data-id="${cur.id}">${U.icon('clock', 15)} +15 min</button>
          ${occ ? '' : `<button class="btn sm ghost" data-act="agoraImprevisto">${U.icon('alert', 15)} Imprevisto</button>`}
        </div></div>`;
    } else if (s.next) {
      const wait = U.toMin(s.next.start) - s.n;
      main = `<div class="agr-now agr-free"><span class="agr-l">Livre agora</span><h3>Próximo: ${U.esc(s.next.title)}</h3>
        <p class="muted small">Às ${s.next.start} (${inMin(wait)}).</p>
        <div class="agr-acts"><button class="btn sm primary" data-act="agoraStart" data-id="${s.next.id}">${U.icon('play', 13)} Começar agora</button>
        <button class="btn sm ghost" data-act="agoraImprevisto">${U.icon('alert', 15)} Imprevisto</button></div></div>`;
    } else {
      main = `<div class="agr-now agr-free"><span class="agr-l">Agenda de hoje</span><h3>${s.total ? 'Tudo encerrado por hoje' : 'Nada na agenda de hoje'}</h3>
        <div class="agr-acts"><button class="btn sm ghost" data-act="agoraImprevisto">${U.icon('alert', 15)} Imprevisto</button></div></div>`;
    }
    const nxt = cur && s.next ? `<a class="agr-next" href="#agenda" data-act="goAgenda" data-d="${t}"><span class="agr-l">A seguir</span><span class="agr-nt"><strong>${s.next.start}</strong> ${U.esc(s.next.title)}</span><small>${inMin(U.toMin(s.next.start) - s.n)}</small></a>` : '';
    const late = s.behind.length ? `<div class="agr-late">${U.icon('alert', 15)}<span>${U.plural(s.behind.length, 'atividade ficou', 'atividades ficaram')} para trás.</span><button class="link" data-act="agoraReplan">Reorganizar meu dia</button></div>` : '';
    return `<section class="card agora">${main}${nxt}${late}</section>`;
  },

  /* Lista "Para resolver hoje": imprevistos abertos, tarefas atrasadas/de hoje e reuniões para registrar, com ✓ na linha */
  hoje() {
    const t = U.today();
    const occ = S.occurrences.filter(o => OPEN(o.status)).map(o => ({ k: 'occ', id: o.id, title: o.title, prio: o.priority, info: D.deadline(o.dueDate, o.dueTime, false), kind: 'Imprevisto', who: o.responsible, demo: o.demo }));
    const tasks = S.tasks.filter(x => OPEN(x.status) && (D.taskLate(x) || x.dueDate === t || x.priority === 'urgente' || (x.top && x.top === t)))
      .map(x => ({ k: 'task', id: x.id, title: x.title, prio: x.priority, info: D.deadline(x.dueDate, x.dueTime, false), kind: x.top === t ? 'Prioridade do dia' : 'Tarefa', who: x.responsible, demo: x.demo, top: x.top === t }));
    const mts = Meetings.toRegister().filter(e => e.date >= U.addDays(t, -7)).map(e => ({ k: 'ev', id: e.id, title: e.title, prio: 'media', info: null, kind: 'Registrar reunião', demo: e.demo }));
    const all = [...occ, ...tasks, ...mts].sort((a, b) => (!!b.top - !!a.top) || ((b.info?.level === 'late') - (a.info?.level === 'late')) || PRIORITY_RANK[a.prio] - PRIORITY_RANK[b.prio]);
    const row = i => {
      const btn = i.k === 'occ' ? `<button class="icon-btn ok" data-act="occStatus" data-id="${i.id}" data-s="concluida" title="Resolver" aria-label="Resolver">${U.icon('check', 16)}</button>`
        : i.k === 'task' ? `<button class="icon-btn ok" data-act="tkSet" data-id="${i.id}" data-s="concluida" title="Concluir" aria-label="Concluir">${U.icon('check', 16)}</button>`
          : `<button class="icon-btn" data-act="evView" data-id="${i.id}" title="Registrar" aria-label="Registrar">${U.icon('edit', 16)}</button>`;
      const href = i.k === 'occ' ? '#imprevistos' : i.k === 'task' ? '#tarefas' : '#reunioes';
      return `<li class="li hj-li ${i.top ? 'hj-top' : ''}"><a href="${href}" class="li-main" ${i.k === 'ev' ? `data-act="evView" data-id="${i.id}"` : ''}>${i.k === 'ev' ? H.chip('Reunião', '#9461f5') : i.top ? `<span class="hj-star">${U.icon('star', 14)}</span>` : H.prio(i.prio)} <span>${U.esc(i.title)}</span>${H.demo(i)}</a>
        <span class="li-side"><small class="muted">${i.kind}${i.who ? ' · ' + U.esc(i.who) : ''}</small>${H.deadline(i.info)}</span>${btn}</li>`;
    };
    const shown = all.slice(0, 8);
    return `<div class="card">
      <div class="card-h"><h3>${U.icon('alert')} Para resolver hoje</h3><a class="link" href="#tarefas">Tarefas</a></div>
      ${shown.length ? `<ul class="list">${shown.map(row).join('')}</ul>${all.length > shown.length ? `<p class="muted small">E mais ${all.length - shown.length}. <a class="link" href="#tarefas">Ver tudo</a></p>` : ''}`
        : H.empty('Nada urgente, atrasado ou com prazo hoje. Bom trabalho!')}
    </div>`;
  },
};

Object.assign(Actions, {
  agoraImprevisto() { Capture.open({ type: 'imprevisto' }); },
  agoraStart({ id }) {
    const t = U.today(), b = D.findBlock(t, id); if (!b) return;
    // Começar antes da hora: a atividade passa a começar agora e o resto acompanha
    const n = Math.round(U.nowMin() / 5) * 5, dur = U.toMin(b.end) - U.toMin(b.start);
    if (!b.fixed && U.toMin(b.start) > n) { b.start = U.fromMin(n); b.end = U.fromMin(n + dur); }
    D.ensureDay(t).forEach(x => { if (x !== b && x.status === 'andamento' && !D.isBreak(x)) x.status = 'pendente'; });
    b.status = 'andamento';
    commit(); UI.toast(`Começou: ${b.title}.`);
  },
  agoraMais({ id }) {
    const t = U.today(), b = D.findBlock(t, id); if (!b) return;
    const base = Math.max(U.toMin(b.end), U.nowMin());
    b.end = U.fromMin(Math.min(1439, base + 15));
    const moved = D.reflow(t, b.id); commit();
    UI.toast(`Mais 15 minutos (até ${b.end}).${moved ? ` ${U.plural(moved, 'atividade empurrada', 'atividades empurradas')}.` : ''}`);
  },
  agoraDone({ id }) {
    const t = U.today(), b = D.findBlock(t, id); if (!b) return;
    b.status = 'concluida';
    const nowR = Math.ceil(U.nowMin() / 5) * 5;
    if (U.toMin(b.start) < nowR && U.toMin(b.end) > nowR) b.end = U.fromMin(nowR);
    if (b.occurrenceId) { const o = S.occurrences.find(x => x.id === b.occurrenceId); if (o && OPEN(o.status)) { o.status = 'concluida'; o.resolvedAt = new Date().toISOString(); } }
    const nx = D.dayBlocks(t).find(x => !D.blockDone(x) && !x.fixed && !D.isBreak(x) && U.toMin(x.start) >= nowR);
    const gap = nx ? U.toMin(nx.start) - nowR : 0;
    commit();
    if (gap >= 10) UI.toast(`Concluído. Sobraram ${U.fmtDur(gap)} até a próxima.`, 'ok', { label: 'Adiantar o resto', onClick: () => Replan.fromNow({ quiet: false }) });
    else UI.toast('Concluído.');
  },
  agoraReplan() { if (typeof Replan !== 'undefined') Replan.open(); else location.hash = '#agenda'; },
});
