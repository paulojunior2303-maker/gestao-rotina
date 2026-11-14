'use strict';
/* Revisão da semana (5 minutos, de preferência na sexta à tarde).
   Tudo calculado dos dados: agenda, tarefas, imprevistos, checklists, reuniões, feedbacks e notas do "Fechar o dia".
   Sem dado = "sem dados", nunca zero inventado. A revisão feita fica marcada em S.diario[dia].revisaoEm. */
const Semana = {
  dias(ws) {
    const t = U.today();
    return [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(ws, i)).filter(k => D.isWorkday(k) && k <= t);
  },
  calc(ws) {
    const we = U.addDays(ws, 6), t = U.today();
    const inW = d => d && d >= ws && d <= we;
    const dias = Semana.dias(ws);
    let done = 0, total = 0;
    const porDia = dias.map(k => { const pr = D.progress(k); done += pr.done; total += pr.total; return { k, pct: pr.pct, occMin: Capture.minutesOn(k) }; });
    const tasksDone = S.tasks.filter(x => x.completedAt && inW(x.completedAt.slice(0, 10)));
    const occ = S.occurrences.filter(o => inW(o.date));
    const occMin = porDia.reduce((a, d) => a + d.occMin, 0);
    const checks = (S.checks || []).filter(c => c.fim && inW(c.fim.slice(0, 10)));
    const ckProb = checks.reduce((a, c) => a + c.itens.filter(i => i.r === 'prob').length, 0);
    const reunioes = S.events.filter(e => e.registro && inW(e.date)).length;
    const fbs = FB.list().filter(f => inW(f.date)).length;
    const lateNow = S.tasks.filter(D.taskLate);
    const semFb = D.techNames().map(Pessoas.of).filter(p => p.semFb);
    const notas = Object.entries(S.diario || {}).filter(([k, v]) => inW(k) && v.nota).sort(([a], [b]) => a.localeCompare(b));
    const nws = U.addDays(ws, 7), nwe = U.addDays(ws, 13);
    const proxima = [
      ...S.tasks.filter(x => OPEN(x.status) && x.dueDate >= nws && x.dueDate <= nwe).map(x => ({ k: x.dueDate, t: x.title, tipo: 'Prazo' })),
      ...S.events.filter(e => e.date >= nws && e.date <= nwe).map(e => ({ k: e.date, t: e.title, tipo: Meetings.isMeeting(e) ? 'Reunião' : 'Compromisso' })),
    ].sort((a, b) => a.k.localeCompare(b.k));
    const occTop = Object.entries(occ.reduce((m, o) => { const k = o.title.trim().toLowerCase(); m[k] = m[k] || { t: o.title, n: 0 }; m[k].n++; return m; }, {})).map(([, v]) => v).sort((a, b) => b.n - a.n).slice(0, 5);
    return { ws, we, dias, porDia, agendaPct: total ? Math.round(done / total * 100) : null, done, total, tasksDone, occ, occMin, checks, ckProb, reunioes, fbs, lateNow, semFb, notas, proxima, occTop, atual: ws === U.weekStart(t) };
  },
  /* Convite no Início: no último dia útil da semana, depois das 14h, se a revisão ainda não foi feita */
  convite() {
    const t = U.today(); if (!D.isWorkday(t) || U.nowMin() < 14 * 60) return false;
    let next = U.addDays(t, 1), last = true;
    for (let i = 0; i < 7 && U.weekStart(next) === U.weekStart(t); i++, next = U.addDays(next, 1)) if (D.isWorkday(next)) { last = false; break; }
    if (!last) return false;
    const ws = U.weekStart(t);
    return !Object.entries(S.diario || {}).some(([k, v]) => k >= ws && v.revisaoEm);
  },
  bannerHtml() { return Semana.convite() ? `<button class="rt-banner" data-act="goSemana">${U.icon('week', 18)}<span><strong>Revisão da semana</strong><small>5 minutos: o que foi feito, o que atrasou e o que vem aí</small></span>${U.icon('right', 16)}</button>` : ''; },
};

Views.semana = {
  title: 'Revisão da semana', icon: 'week', nav: 'Revisão da semana',
  render() {
    const t = U.today();
    const ws = App.ui.semWs || U.weekStart(t);
    const c = Semana.calc(ws);
    const num = (v, l, sub = '', cls = '') => `<div class="sm-n ${cls}"><strong>${v === null ? '—' : v}</strong><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const feita = Object.entries(S.diario || {}).find(([k, v]) => k >= ws && k <= c.we && v.revisaoEm);
    return `
      <div class="sm-nav">
        <button class="icon-btn" data-act="semNav" data-n="-7" aria-label="Semana anterior">${U.icon('left', 18)}</button>
        <div><strong>${c.atual ? 'Esta semana' : 'Semana'}</strong><small class="muted">${U.fmtShort(ws)} a ${U.fmtShort(c.we)}</small></div>
        <button class="icon-btn" data-act="semNav" data-n="7" ${c.atual ? 'disabled' : ''} aria-label="Próxima semana">${U.icon('right', 18)}</button>
      </div>
      ${!c.dias.length ? H.empty('Esta semana ainda não teve dia útil.') : `
      <div class="sm-grid">
        ${num(c.agendaPct === null ? null : c.agendaPct + '%', 'da agenda feita', c.total ? `${c.done} de ${c.total}` : 'sem dados')}
        ${num(c.tasksDone.length, c.tasksDone.length === 1 ? 'tarefa concluída' : 'tarefas concluídas')}
        ${num(c.occ.length, c.occ.length === 1 ? 'imprevisto' : 'imprevistos', c.occMin ? `${U.fmtDur(c.occMin)} da agenda` : '', c.occ.length ? 'warn' : '')}
        ${num(c.lateNow.length, 'atrasadas agora', '', c.lateNow.length ? 'bad' : '')}
        ${num(c.checks.length, c.checks.length === 1 ? 'checklist' : 'checklists', c.ckProb ? U.plural(c.ckProb, 'problema') : '')}
        ${num(c.reunioes + c.fbs, 'reuniões e feedbacks', `${c.reunioes} · ${c.fbs}`)}
      </div>
      <div class="card"><div class="card-h"><h3>${U.icon('chart')} Agenda feita por dia</h3></div>
        ${c.porDia.some(d => d.pct !== null) ? Charts.bars({ labels: c.porDia.map(d => U.WD_SHORT[U.weekday(d.k)]), series: [{ name: 'Agenda feita', color: 'var(--accent)', values: c.porDia.map(d => d.pct) }], height: 150, unit: '%', maxValue: 100 }) : '<div class="chart-empty"><span>Sem dados nesta semana</span></div>'}
        ${c.occMin ? `<p class="muted small">Imprevistos tomaram ${U.fmtDur(c.occMin)} da agenda: ${c.porDia.filter(d => d.occMin).map(d => `${U.WD_SHORT[U.weekday(d.k)]} ${U.fmtDur(d.occMin)}`).join(', ')}.</p>` : ''}
      </div>
      ${c.occTop.length ? `<div class="card"><div class="card-h"><h3>${U.icon('alert')} Imprevistos da semana</h3><a class="link" href="#imprevistos">Ver</a></div>
        <ul class="list">${c.occTop.map(o => `<li class="li"><span class="li-main"><span>${U.esc(o.t)}</span></span>${o.n > 1 ? `<span class="badge b-yellow">${o.n}×</span>` : ''}</li>`).join('')}</ul>
        ${c.occTop.some(o => o.n > 1) ? '<p class="muted small">O que se repete merece uma solução definitiva (ou um checklist).</p>' : ''}</div>` : ''}
      ${c.lateNow.length || c.semFb.length ? `<div class="card"><div class="card-h"><h3>${U.icon('flag')} Pede atenção</h3></div>
        <ul class="list">${c.lateNow.slice(0, 6).map(x => `<li class="li hj-li"><span class="li-main">${H.prio(x.priority)} <span>${U.esc(x.title)}</span></span><span class="li-side"><small class="muted">${x.responsible ? U.esc(x.responsible) : 'Você'}</small>${H.deadline(D.deadline(x.dueDate, x.dueTime, false))}</span><button class="icon-btn ok" data-act="tkSet" data-id="${x.id}" data-s="concluida" aria-label="Concluir">${U.icon('check', 16)}</button></li>`).join('')}
        ${c.semFb.map(p => `<li class="li"><a class="li-main" href="#pessoas" data-act="pOpenGo" data-n="${U.esc(p.name)}">${U.icon('chat', 15)} <span>${U.esc(p.name)}: ${Pessoas.fbTxt(p).toLowerCase()}</span></a></li>`).join('')}</ul></div>` : ''}
      ${c.notas.length ? `<div class="card"><div class="card-h"><h3>${U.icon('edit')} Suas notas do fim do dia</h3></div>
        <ul class="list">${c.notas.map(([k, v]) => `<li class="li li-stack"><small class="muted">${U.WD[U.weekday(k)].replace('-feira', '')}, ${U.fmtShort(k)}</small><div>${U.esc(v.nota)}</div></li>`).join('')}</ul></div>` : ''}
      <div class="card"><div class="card-h"><h3>${U.icon('calendar')} Próxima semana</h3></div>
        ${c.proxima.length ? `<ul class="list">${c.proxima.slice(0, 10).map(x => `<li class="li"><span class="li-time">${U.WD_SHORT[U.weekday(x.k)]} ${U.fmtShort(x.k)}</span><span class="li-main"><span>${U.esc(x.t)}</span></span><small class="muted">${x.tipo}</small></li>`).join('')}</ul>${c.proxima.length > 10 ? `<p class="muted small">E mais ${c.proxima.length - 10}.</p>` : ''}` : H.empty('Nenhum prazo ou compromisso marcado para a próxima semana.')}
      </div>
      ${c.atual ? `<div class="row-actions">${feita ? `<span class="badge b-green">Revisão feita em ${U.fmtShort(feita[0])}</span>` : `<button class="btn primary" data-act="semDone">${U.icon('check', 15)} Concluir revisão</button>`}</div>` : ''}`}`;
  },
};

Object.assign(Actions, {
  goSemana() { App.ui.semWs = null; App.go('semana'); },
  semNav({ n }) { const ws = App.ui.semWs || U.weekStart(U.today()); const nx = U.addDays(ws, +n); if (nx > U.weekStart(U.today())) return; App.ui.semWs = nx; App.render(); },
  semDone() { Ritual.marca(U.today(), 'revisaoEm', new Date().toISOString()); commit(); UI.toast('Revisão da semana feita. Bom fim de semana!'); },
  pOpenGo({ n }) { App.ui.pWhoNext = n; location.hash = '#pessoas'; },
});
