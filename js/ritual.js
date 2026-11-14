'use strict';
/* Abrir e fechar o dia (2 minutos cada).
   Abrir: o que ficou do último dia útil (hoje / outro dia / cancelar) e as 3 prioridades de hoje (task.top = data).
   Fechar: o que foi feito, o que não deu tempo (amanhã / outro dia / feito / cancelar) e uma nota opcional.
   Fica em S.diario[data] = { abertoEm, fechadoEm, nota }. Nada é inventado: os números vêm da agenda e das tarefas. */
const Ritual = {
  dia(k = U.today()) { S.diario = S.diario || {}; return S.diario[k] || {}; },
  marca(k, campo, valor) {
    S.diario = S.diario || {};
    S.diario[k] = { ...(S.diario[k] || {}), [campo]: valor };
    // guarda só os últimos 120 dias
    const lim = U.addDays(U.today(), -120);
    Object.keys(S.diario).forEach(d => { if (d < lim) delete S.diario[d]; });
  },
  prevWorkday(k) { let d = U.addDays(k, -1); for (let i = 0; i < 10 && !D.isWorkday(d); i++) d = U.addDays(d, -1); return d; },

  /* Qual convite mostrar agora no Início: 'abrir' | 'fechar' | null */
  convite() {
    const t = U.today(); if (!D.isWorkday(t)) return null;
    const d = Ritual.dia(t), n = U.nowMin();
    const ws = U.toMin(S.settings.workStart), we = U.toMin(S.settings.workEnd);
    if (!d.abertoEm && !d.fechadoEm && n < Math.max(ws + 240, 12 * 60)) return 'abrir';
    if (!d.fechadoEm && n >= we - 45) return 'fechar';
    return null;
  },
  bannerHtml() {
    const c = Ritual.convite();
    if (c === 'abrir') return `<button class="rt-banner" data-act="ritualAbrir">${U.icon('spark', 18)}<span><strong>Abrir o dia</strong><small>1 minuto: o que ficou de ontem e as 3 prioridades de hoje</small></span>${U.icon('right', 16)}</button>`;
    if (c === 'fechar') return `<button class="rt-banner rt-night" data-act="ritualFechar">${U.icon('check', 18)}<span><strong>Fechar o dia</strong><small>O que ficou para depois vai para o lugar certo</small></span>${U.icon('right', 16)}</button>`;
    return '';
  },

  /* ---------- Pendências ---------- */
  pendAbrir(t) {
    const prev = Ritual.prevWorkday(t);
    const blocks = D.dayBlocks(prev).filter(b => !D.blockDone(b) && !D.isBreak(b) && !b.occurrenceId).map(b => ({ k: 'blk', id: b.id, day: prev, title: b.title, sub: `Agenda de ${U.fmtShort(prev)}, ${b.start}` }));
    const tasks = S.tasks.filter(x => OPEN(x.status) && x.dueDate && x.dueDate < t).map(x => ({ k: 'task', id: x.id, title: x.title, sub: `Tarefa, prazo ${U.fmtShort(x.dueDate)}` }));
    return [...blocks, ...tasks];
  },
  pendFechar(t) {
    const blocks = D.dayBlocks(t).filter(b => !D.blockDone(b) && !D.isBreak(b)).map(b => ({ k: 'blk', id: b.id, day: t, title: b.title, sub: `Agenda, ${b.start}–${b.end}` }));
    const tasks = S.tasks.filter(x => OPEN(x.status) && (x.dueDate === t || x.top === t)).map(x => ({ k: 'task', id: x.id, title: x.title, sub: x.top === t ? 'Prioridade do dia' : 'Tarefa com prazo hoje' }));
    return [...blocks, ...tasks];
  },
  /* Ação em um item pendente: hoje | amanha | data (YYYY-MM-DD) | feito | cancelar */
  acao(it, a, base) {
    const alvo = a === 'hoje' ? base : a === 'amanha' ? D.nextWorkday(base) : /^\d{4}-/.test(a) ? a : null;
    if (it.k === 'task') {
      const x = S.tasks.find(y => y.id === it.id); if (!x) return;
      if (a === 'feito') Tasks.setStatus(x, 'concluida');
      else if (a === 'cancelar') Tasks.setStatus(x, 'cancelada');
      else if (alvo) { x.dueDate = alvo; if (x.top && x.top < alvo) x.top = null; }
    } else {
      const b = D.findBlock(it.day, it.id); if (!b) return;
      if (a === 'feito') b.status = 'concluida';
      else if (a === 'cancelar') b.status = 'cancelada';
      else if (alvo && alvo !== it.day) D.moveBlock(it.day, it.id, alvo);
    }
  },
  rowHtml(it, i, opts) {
    const b = (a, l, cls = '') => `<button type="button" class="rt-b ${cls}" data-i="${i}" data-a="${a}">${l}</button>`;
    return `<li class="rt-li"><div class="rt-tt"><strong>${U.esc(it.title)}</strong><small>${it.sub}</small></div>
      <div class="rt-acts">${opts.map(o => o === 'data' ? `<label class="rt-b rt-date">${U.icon('calendar', 13)} Outro dia<input type="date" data-i="${i}" aria-label="Outro dia"></label>` : b(...o)).join('')}</div></li>`;
  },

  /* ---------- Abrir o dia ---------- */
  abrir() {
    const t = U.today();
    const m = UI.modal({ title: 'Abrir o dia', body: '', footer: '<span class="grow"></span><button class="btn primary" data-go>Começar o dia</button>' });
    let pend = Ritual.pendAbrir(t);
    const render = () => {
      const open = S.tasks.filter(x => OPEN(x.status));
      const tops = open.filter(x => x.top === t);
      const sugest = open.filter(x => x.top !== t).sort((a, b) => ((b.dueDate === t) - (a.dueDate === t)) || (D.taskLate(b) - D.taskLate(a)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueDate || '9').localeCompare(b.dueDate || '9')).slice(0, 6);
      const bl = D.dayBlocks(t).filter(b => b.status !== 'cancelada' && !D.isBreak(b));
      const evs = S.events.filter(e => e.date === t);
      m.setBody(`<div class="rt">
        <p class="rt-hello">${U.icon('spark', 16)}<span>${bl.length ? `Hoje você tem <strong>${U.plural(bl.length, 'atividade')}</strong> na agenda${evs.length ? ` e <strong>${U.plural(evs.length, 'compromisso')}</strong>` : ''}${bl[0] ? `, a primeira às ${bl[0].start}` : ''}.` : 'Sua agenda de hoje está livre.'}</span></p>
        ${pend.length ? `<h4>Ficou do último dia (${U.plural(pend.length, 'item', 'itens')})</h4><ul class="rt-list">${pend.map((it, i) => Ritual.rowHtml(it, i, [['hoje', 'Hoje', 'pri'], 'data', ['cancelar', 'Cancelar', 'dan']])).join('')}</ul>` : ''}
        <h4>3 prioridades de hoje</h4>
        <p class="muted small">O que, se for feito, faz o dia valer. Elas aparecem no topo de "Para resolver hoje".</p>
        <ul class="rt-tops">${tops.map(x => `<li><span class="hj-star">${U.icon('star', 14)}</span><span>${U.esc(x.title)}</span><button type="button" class="icon-btn" data-untop="${x.id}" aria-label="Tirar das prioridades">${U.icon('x', 14)}</button></li>`).join('')}
        ${tops.length < 3 ? `<li class="rt-add"><input id="rt-new" placeholder="${tops.length ? 'Mais uma prioridade…' : 'Escreva uma prioridade…'}" autocomplete="off"><button type="button" class="btn sm" data-addtop>${U.icon('plus', 14)}</button></li>` : ''}</ul>
        ${tops.length < 3 && sugest.length ? `<span class="cap-l">Ou escolha entre as tarefas abertas</span><div class="rt-sug">${sugest.map(x => `<button type="button" class="cap-chip" data-top="${x.id}">${U.icon('plus', 13)} ${U.esc(x.title)}</button>`).join('')}</div>` : ''}
      </div>`);
    };
    render();
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a) { Ritual.acao(pend[+b.dataset.i], b.dataset.a, t); pend.splice(+b.dataset.i, 1); commit(); render(); return; }
      if (b.dataset.top) { const x = S.tasks.find(y => y.id === b.dataset.top); if (x && S.tasks.filter(y => y.top === t && OPEN(y.status)).length < 3) { x.top = t; commit(); } render(); return; }
      if (b.dataset.untop) { const x = S.tasks.find(y => y.id === b.dataset.untop); if (x) { x.top = null; commit(); } render(); return; }
      if (b.hasAttribute('data-addtop')) { Ritual.novaTop(m, t); render(); const i = m.el.querySelector('#rt-new'); if (i) i.focus(); return; }
      if (b.hasAttribute('data-go')) { Ritual.marca(t, 'abertoEm', new Date().toISOString()); commit(); m.close(); UI.toast('Bom trabalho hoje!'); }
    });
    m.el.addEventListener('keydown', e => { if (e.target.id === 'rt-new' && e.key === 'Enter') { e.preventDefault(); Ritual.novaTop(m, t); render(); const i = m.el.querySelector('#rt-new'); if (i) i.focus(); } });
    m.el.addEventListener('change', e => { if (e.target.type === 'date' && e.target.value) { Ritual.acao(pend[+e.target.dataset.i], e.target.value, t); pend.splice(+e.target.dataset.i, 1); commit(); render(); } });
  },
  novaTop(m, t) {
    const i = m.el.querySelector('#rt-new'); const v = i && i.value.trim(); if (!v) return;
    S.tasks.push({ id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, title: v, description: '', category: 'administrativo', responsible: '', priority: 'alta', status: 'pendente', startDate: t, dueDate: t, dueTime: '', notes: '', top: t });
    commit();
  },

  /* ---------- Fechar o dia ---------- */
  fechar() {
    const t = U.today();
    const m = UI.modal({ title: 'Fechar o dia', body: '', footer: '<span class="grow"></span><button class="btn primary" data-go>Encerrar o dia</button>' });
    let pend = Ritual.pendFechar(t);
    const render = () => {
      const blocks = D.dayBlocks(t).filter(b => !D.isBreak(b));
      const doneB = blocks.filter(b => b.status === 'concluida').length;
      const doneT = S.tasks.filter(x => x.completedAt && x.completedAt.slice(0, 10) === t).length;
      const occ = S.occurrences.filter(o => o.date === t).length;
      const occMin = Capture.minutesOn(t);
      const nota = (Ritual.dia(t).nota || '');
      m.setBody(`<div class="rt">
        <div class="rt-stats">
          <div><strong>${doneB}<small>/${blocks.filter(b => b.status !== 'cancelada').length}</small></strong><span>da agenda</span></div>
          <div><strong>${doneT}</strong><span>${doneT === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</span></div>
          <div><strong>${occ}</strong><span>${occ === 1 ? 'imprevisto' : 'imprevistos'}${occMin ? ` · ${U.fmtDur(occMin)}` : ''}</span></div>
        </div>
        ${pend.length ? `<div class="rt-h4"><h4>Não deu tempo (${pend.length})</h4><button type="button" class="link" data-all>Tudo para ${U.fmtShort(D.nextWorkday(t))}</button></div>
          <ul class="rt-list">${pend.map((it, i) => Ritual.rowHtml(it, i, [['feito', '✓ Feito', 'ok'], ['amanha', U.fmtShort(D.nextWorkday(t)), 'pri'], 'data', ['cancelar', 'Cancelar', 'dan']])).join('')}</ul>`
          : `<p class="rt-hello">${U.icon('check', 16)}<span>Nada pendente. Dia fechado com tudo no lugar.</span></p>`}
        <label class="cap-l" for="rt-nota">Como foi o dia? (opcional)</label>
        <textarea id="rt-nota" class="cap-in" rows="2" placeholder="Ex.: muito imprevisto no cliente X; amanhã começar pelo relatório">${U.esc(nota)}</textarea>
      </div>`);
    };
    render();
    const saveNota = () => { const n = m.el.querySelector('#rt-nota'); if (n && n.value.trim() !== (Ritual.dia(t).nota || '')) Ritual.marca(t, 'nota', n.value.trim()); };
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a) { saveNota(); Ritual.acao(pend[+b.dataset.i], b.dataset.a, t); pend.splice(+b.dataset.i, 1); commit(); render(); return; }
      if (b.hasAttribute('data-all')) { saveNota(); pend.forEach(it => Ritual.acao(it, 'amanha', t)); pend = []; commit(); render(); return; }
      if (b.hasAttribute('data-go')) { saveNota(); Ritual.marca(t, 'fechadoEm', new Date().toISOString()); commit(); m.close(); UI.toast('Dia encerrado. Bom descanso!'); }
    });
    m.el.addEventListener('change', e => { if (e.target.type === 'date' && e.target.value) { saveNota(); Ritual.acao(pend[+e.target.dataset.i], e.target.value, t); pend.splice(+e.target.dataset.i, 1); commit(); render(); } });
  },
};

Object.assign(Actions, {
  ritualAbrir() { Ritual.abrir(); },
  ritualFechar() { Ritual.fechar(); },
});
