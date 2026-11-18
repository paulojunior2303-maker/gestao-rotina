'use strict';
/* Calendário — recurso principal do app (Início e Agenda).
   Padrão mobile: mês compacto em cima (bolinhas coloridas por tipo; no computador, títulos dentro dos dias)
   e a lista do dia escolhido embaixo. Encolhe para uma semana, arrasta para trocar de mês/semana e tem "Hoje".
   Na Agenda começa na semana; "Ver mês" abre o mês inteiro. O dia escolhido é o dia da agenda. */
const Cal = {
  TYPES: { gravacao: 'Gravação', reuniao: 'Reunião', evento: 'Compromisso', tarefa: 'Tarefa', imprevisto: 'Imprevisto' },
  /* Gravação pronta e reunião registrada deram certo: não aparecem riscadas (riscado = concluído/cancelado) */
  feito(i) { return i.done ? (i.type === 'gravacao' || i.type === 'reuniao' ? 'ok' : 'done') : ''; },
  WD: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],

  /* Fim de uma tarefa com horário e duração ("14:00" + 30 min → "14:30") */
  fimTarefa(x) { return x.dueTime && x.dur ? U.fromMin(Math.min(1439, U.toMin(x.dueTime) + Number(x.dur))) : ''; },
  /* Tarefas abertas com horário e duração num dia: ocupam aquele horário de verdade (a rotina desvia delas ao reorganizar) */
  ocupados(k) {
    return S.tasks.filter(x => OPEN(x.status) && x.dueDate === k && x.dueTime && Number(x.dur) > 0)
      .map(x => ({ id: x.id, title: x.title, start: x.dueTime, end: this.fimTarefa(x) }));
  },
  /* Atividades da rotina (ainda por fazer) que batem com um horário ocupado */
  batem(k, o) { return D.dayBlocks(k).filter(b => !D.isBreak(b) && !D.blockDone(b) && b.status !== 'cancelada' && U.toMin(b.start) < U.toMin(o.end) && U.toMin(b.end) > U.toMin(o.start)); },
  /* Tudo o que acontece num dia (sem as atividades da rotina, que ficam na Agenda).
     Hoje também mostra as tarefas abertas sem data e as atrasadas, para nada ficar esquecido fora do calendário. */
  itemsOn(k) {
    const out = [];
    // Gravações (reunião/feedback gravado): a reunião ligada a ela não aparece de novo
    (S.gravacoes || []).filter(g => g.date === k).forEach(g => out.push({ type: 'gravacao', label: Gravador.nome(g), time: g.time, id: g.id, done: g.status === 'pronta', act: 'gvOpen', sub: g.status === 'pronta' ? (g.tipo === 'feedback' ? 'Feedback · resumo pronto' : g.tipo === 'relatorio' ? 'Relatório do dia · pronto' : g.tipo === 'audio' ? (g.origem === 'texto' ? 'Mensagem recebida · analisada' : 'Áudio recebido · transcrito') : 'Reunião · resumo pronto') : g.status === 'gravando' ? 'Gravando agora' : 'Gravação · transcrevendo' }));
    S.events.filter(e => e.date === k && !e.gravacaoId).forEach(e => out.push({ type: Meetings.isMeeting(e) ? 'reuniao' : 'evento', label: e.title, time: e.time, id: e.id, demo: e.demo, done: !!e.registro, act: 'evView' }));
    const tk = (x, extra) => out.push({ type: 'tarefa', label: x.title, time: extra ? '' : x.dueTime, end: extra ? '' : this.fimTarefa(x), done: x.status === 'concluida', late: D.taskLate(x), id: x.id, demo: x.demo, act: 'tkEdit', task: true, who: x.responsible || '', ...extra });
    S.tasks.filter(x => x.dueDate === k && x.status !== 'cancelada').forEach(x => tk(x));
    if (k === U.today()) {
      S.tasks.filter(x => OPEN(x.status) && x.dueDate && x.dueDate < k).forEach(x => tk(x, { semData: 'atrasada', era: U.fmtShort(x.dueDate), sub: `Tarefa atrasada · era para ${U.fmtShort(x.dueDate)}` }));
      S.tasks.filter(x => OPEN(x.status) && !x.dueDate).forEach(x => tk(x, { semData: 'sem', sub: 'Tarefa sem data' }));
    }
    S.occurrences.filter(o => o.dueDate === k && o.status !== 'cancelada').forEach(o => out.push({ type: 'imprevisto', label: o.title, time: o.dueTime, done: o.status === 'concluida', late: D.occLate(o), id: o.id, demo: o.demo, act: 'occEdit' }));
    return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  },

  st(id) {
    App.ui.cal = App.ui.cal || {};
    return App.ui.cal[id] = App.ui.cal[id] || { mode: id === 'agenda' ? 'week' : 'month', sel: U.today(), anchor: U.today() };
  },
  /* Mantém o calendário mostrando o dia escolhido (Agenda) */
  sync(id, k) {
    const s = this.st(id); s.sel = k;
    const r = this.range(s);
    if (k < r.cells[0] || k > r.cells[r.cells.length - 1] || (s.mode === 'month' && U.monthKey(k) !== r.mk)) s.anchor = k;
  },
  /* A semana do calendário começa no domingo (pedido do usuário) */
  inicioSemana(k) { return U.addDays(k, -U.weekday(k)); },
  range(s) {
    if (s.mode === 'week') { const a = this.inicioSemana(s.anchor); return { from: a, to: U.addDays(a, 6), cells: [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(a, i)) }; }
    const mk = U.monthKey(s.anchor), first = U.monthStart(mk), last = U.monthEnd(mk);
    const cells = []; for (let k = this.inicioSemana(first); cells.length < 42; k = U.addDays(k, 1)) { cells.push(k); if (cells.length % 7 === 0 && k >= last) break; }
    return { from: first, to: last, cells, mk };
  },
  title(s) {
    if (s.mode === 'month') return U.fmtMonth(U.monthKey(s.anchor));
    const a = this.inicioSemana(s.anchor), z = U.addDays(a, 6), da = U.parse(a), dz = U.parse(z);
    return da.getMonth() === dz.getMonth() ? `${da.getDate()} a ${dz.getDate()} de ${U.MONTHS[dz.getMonth()].toLowerCase()}` : `${da.getDate()}/${U.pad(da.getMonth() + 1)} a ${dz.getDate()}/${U.pad(dz.getMonth() + 1)}`;
  },

  /* Grade do calendário */
  render(id) {
    const s = this.st(id), t = U.today(), r = this.range(s);
    const showsToday = t >= r.cells[0] && t <= r.cells[r.cells.length - 1] && (s.mode === 'week' || U.monthKey(t) === r.mk);
    const cell = k => {
      const items = this.itemsOn(k), inMonth = s.mode === 'week' || U.monthKey(k) === r.mk;
      const ag = S.days[k] || (D.isWorkday(k) && k >= t) ? D.progress(k) : null;
      const cls = ['calx-d', inMonth ? '' : 'out', k === t ? 'today' : '', k === s.sel ? 'sel' : '', D.isWorkday(k) ? '' : 'off', items.some(i => i.late) ? 'has-late' : ''].join(' ');
      const max = s.mode === 'week' ? 5 : 3;
      return `<button class="${cls}" data-act="calSel" data-cal="${id}" data-k="${k}" aria-label="${U.fmtLong(k)}${items.length ? `, ${U.plural(items.length, 'item', 'itens')}` : ''}" ${k === s.sel ? 'aria-pressed="true"' : ''}>
        <span class="calx-n">${U.parse(k).getDate()}</span>
        ${inMonth && items.length ? `<span class="calx-chips">${items.slice(0, max).map(i => `<span class="calx-chip t-${i.type} ${this.feito(i)} ${i.late ? 'late' : ''}">${i.time ? `<b>${i.time}</b> ` : ''}${U.esc(i.label)}</span>`).join('')}${items.length > max ? `<span class="calx-more">+${items.length - max}</span>` : ''}</span>
        <span class="calx-dots">${items.slice(0, 4).map(i => `<i class="t-${i.type} ${i.late ? 'late' : ''}"></i>`).join('')}${items.length > 4 ? '<i class="more"></i>' : ''}</span>` : ''}
        ${inMonth && ag && ag.total && s.mode === 'week' ? `<span class="calx-ag" title="Agenda do dia">${ag.pct}%</span>` : ''}
      </button>`;
    };
    return `<div class="calx calx-${s.mode}" data-cal-root="${id}">
      <div class="calx-h">
        <div class="calx-nav">
          <button class="icon-btn" data-act="calNav" data-cal="${id}" data-n="-1" aria-label="${s.mode === 'week' ? 'Semana anterior' : 'Mês anterior'}">${U.icon('left')}</button>
          <strong class="calx-t">${this.title(s)}</strong>
          <button class="icon-btn" data-act="calNav" data-cal="${id}" data-n="1" aria-label="${s.mode === 'week' ? 'Próxima semana' : 'Próximo mês'}">${U.icon('right')}</button>
        </div>
        <span class="grow"></span>
        ${showsToday && s.sel === t ? '' : `<button class="btn sm ghost" data-act="calToday" data-cal="${id}">Hoje</button>`}
        ${id === 'agenda' ? '' : `<div class="tabs calx-mode" role="tablist"><button class="tab ${s.mode === 'week' ? 'active' : ''}" role="tab" aria-selected="${s.mode === 'week'}" data-act="calMode" data-cal="${id}" data-v="week">Semana</button><button class="tab ${s.mode === 'month' ? 'active' : ''}" role="tab" aria-selected="${s.mode === 'month'}" data-act="calMode" data-cal="${id}" data-v="month">Mês</button></div>`}
      </div>
      <div class="calx-wd">${this.WD.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="calx-grid" data-swipe="${id}">${r.cells.map(cell).join('')}</div>
      ${id === 'agenda' && s.mode === 'week' ? '' : `<div class="legend calx-legend">${Object.entries({ gravacao: 'Gravação', reuniao: 'Reunião', evento: 'Compromisso', tarefa: 'Tarefa', imprevisto: 'Imprevisto' }).map(([k, l]) => `<span><i class="t-${k}"></i>${l}</span>`).join('')}</div>`}
      ${id === 'agenda' ? `<button class="calx-exp" data-act="calMode" data-cal="${id}" data-v="${s.mode === 'week' ? 'month' : 'week'}" aria-expanded="${s.mode === 'month'}">${s.mode === 'week' ? `${U.icon('down', 16)} Ver o mês inteiro` : `${U.icon('up', 16)} Mostrar só a semana`}</button>` : ''}
    </div>`;
  },

  /* Linha de baixo de um item (tipo, situação e responsável). Na Agenda, gravação mostra só "Gravação · pronta" */
  sub(i, agenda) {
    const base = i.sub && (!agenda || i.semData) ? (i.late && i.semData === 'atrasada' ? `<span class="c-red">${i.sub}</span>` : i.sub)
      : `${this.TYPES[i.type]}${i.done ? (i.type === 'reuniao' ? ' · registrada' : i.type === 'gravacao' ? ' · pronta' : ' · concluída') : i.late ? ' · <span class="c-red">atrasada</span>' : ''}`;
    return base + (i.who ? ` · ${U.esc(i.who)}` : '');
  },
  /* Botão de concluir/reabrir tarefa direto no calendário e na agenda */
  check(i) {   // círculo, igual ao da lista de Tarefas (sugestão de design 1)
    return i.done
      ? `<button class="tk-ck feito" data-act="tkSet" data-id="${i.id}" data-s="pendente" title="Reabrir" aria-label="Reabrir tarefa">${U.icon('check', 13)}</button>`
      : `<button class="tk-ck ${i.late ? 'late' : ''}" data-act="tkSet" data-id="${i.id}" data-s="concluida" title="Concluir" aria-label="Concluir tarefa"></button>`;
  },

  /* Lista do dia escolhido */
  day(id) {
    const s = this.st(id), k = s.sel, t = U.today();
    // Sugestão 3: o que está acontecendo agora (atividade da rotina) entra em destaque no topo; o que já foi feito vai para o fim
    const todos = this.itemsOn(k), items = [...todos.filter(i => !i.done), ...todos.filter(i => i.done)];
    const ag = D.dayBlocks(k), prog = D.progress(k);
    const agora = k === t ? ag.find(b => D.blockNow(b, k) && !D.isBreak(b) && !D.blockDone(b)) : null;
    const d = U.parse(k), wd = U.WD[d.getDay()].replace('-feira', '');
    const when = k === t ? 'Hoje' : k === U.addDays(t, 1) ? 'Amanhã' : k === U.addDays(t, -1) ? 'Ontem' : wd;
    return `<div class="calx-day">
      <div class="calx-day-h">
        <div><small class="muted">${when}</small><h2>${d.getDate()} de ${U.MONTHS[d.getMonth()].toLowerCase()}</h2></div>
      </div>
      ${agora ? `<div class="calx-it calx-agora" role="button" tabindex="0" data-act="goAgenda" data-d="${k}"><span class="calx-it-time">${agora.start}<small>${agora.end}</small></span>
          <span class="calx-it-main"><span class="calx-tag">Agora</span><span class="calx-it-title">${U.esc(agora.title)}</span><small>rotina · termina em ${U.fmtDur(Math.max(1, U.toMin(agora.end) - U.nowMin()))}</small></span>${U.icon('right', 15)}</div>` : ''}
      ${items.length ? `<div class="calx-list">${items.map(i => `<div class="calx-it t-${i.type} ${this.feito(i)} ${i.late ? 'late' : ''}" role="button" tabindex="0" data-act="${i.act}" data-id="${i.id}">
          <span class="calx-it-time">${i.time || '—'}${i.end ? `<small>${i.end}</small>` : ''}</span>
          <span class="calx-it-main"><span class="calx-it-title">${U.esc(i.label)}${H.demo(i)}</span><small>${this.sub(i)}</small></span>
          ${i.task ? this.check(i) : U.icon('right', 15)}</div>`).join('')}</div>`
        : agora ? '' : `<p class="calx-empty muted small">${D.isWorkday(k) ? 'Nada marcado para este dia.' : 'Dia livre. Nada marcado.'}</p>`}
      <button class="calx-agenda" data-act="goAgenda" data-d="${k}">
        ${U.icon('clock', 16)}<span><strong>Agenda do dia</strong><small class="muted">${ag.length ? `${U.plural(prog.total, 'atividade')}${prog.pct !== null ? ` · ${prog.pct}% concluído` : ''}` : D.isWorkday(k) ? 'Sem atividades' : 'Dia de folga'}</small></span>
        ${ag.length && prog.pct !== null ? H.bar(prog.pct) : ''}${U.icon('right', 15)}
      </button>
    </div>`;
  },

};

Object.assign(Actions, {
  calSel({ cal, k }) {
    const s = Cal.st(cal);
    s.sel = k;
    if (s.mode === 'month' && U.monthKey(k) !== U.monthKey(s.anchor)) s.anchor = k;
    if (cal === 'agenda') App.ui.agendaDate = k;
    App.render();
  },
  calNav({ cal, n }) {
    const s = Cal.st(cal), t = U.today();
    if (s.mode === 'week') {
      s.anchor = U.addDays(Cal.inicioSemana(s.anchor), Number(n) * 7);
      // Na Agenda, mantém o mesmo dia da semana (ou hoje, se a semana for a atual)
      const r = Cal.range(s);
      s.sel = t >= r.from && t <= r.to ? t : cal === 'agenda' ? U.addDays(s.sel, Number(n) * 7) : r.from;
    } else {
      s.anchor = U.addMonths(U.monthKey(s.anchor), Number(n)) + '-01';
      const r = Cal.range(s);
      s.sel = t >= r.from && t <= r.to ? t : U.monthStart(r.mk);
    }
    if (cal === 'agenda') App.ui.agendaDate = s.sel;
    App.render();
  },
  calToday({ cal }) { const s = Cal.st(cal); s.anchor = s.sel = U.today(); if (cal === 'agenda') App.ui.agendaDate = s.sel; App.render(); },
  calMode({ cal, v }) { const s = Cal.st(cal); s.mode = v; s.anchor = s.sel; App.render(); },
  /* Botão flutuante "+" no Início e na Agenda: anotação rápida no dia escolhido (tarefa ou imprevisto).
     Reunião, feedback e relatório ficam em Gravações; o intervalo, no topo da Agenda. */
  quickAdd({ k }) { Capture.open({ k: k || U.today() }); },
});

/* Arrastar o dedo no calendário troca de mês/semana */
(() => {
  let sx = null, sy = 0, el = null;
  document.addEventListener('touchstart', e => {
    el = e.target && e.target.closest ? e.target.closest('[data-swipe]') : null; const t = e.touches[0];
    sx = el && t.clientX > 28 ? t.clientX : null; sy = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (sx === null || !el) return;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy); sx = null;
    if (Math.abs(dx) < 50 || dy > Math.abs(dx) * 0.7) return;
    const id = el.dataset.swipe, n = dx < 0 ? 1 : -1;
    Actions.calNav({ cal: id, n });
  }, { passive: true });
})();
