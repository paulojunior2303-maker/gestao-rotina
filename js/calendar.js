'use strict';
/* Calendário — recurso principal do app (Início e Agenda).
   Padrão mobile: mês compacto em cima (bolinhas coloridas por tipo; no computador, títulos dentro dos dias)
   e a lista do dia escolhido embaixo. Encolhe para uma semana, arrasta para trocar de mês/semana e tem "Hoje".
   Na Agenda começa na semana; "Ver mês" abre o mês inteiro. O dia escolhido é o dia da agenda. */
const Cal = {
  TYPES: { reuniao: 'Reunião', evento: 'Compromisso', tarefa: 'Prazo de tarefa', projeto: 'Prazo de projeto', imprevisto: 'Imprevisto' },
  WD: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],

  /* Tudo o que acontece num dia (sem as atividades da rotina, que ficam na Agenda) */
  itemsOn(k) {
    const out = [];
    S.events.filter(e => e.date === k).forEach(e => out.push({ type: Meetings.isMeeting(e) ? 'reuniao' : 'evento', label: e.title, time: e.time, id: e.id, demo: e.demo, done: !!e.registro, act: 'evView' }));
    S.tasks.filter(x => x.dueDate === k && x.status !== 'cancelada').forEach(x => out.push({ type: 'tarefa', label: x.title, time: x.dueTime, done: x.status === 'concluida', late: D.taskLate(x), id: x.id, demo: x.demo, act: 'tkEdit' }));
    if (S.settings.showProjetos) S.projects.filter(p => p.dueDate === k && p.status !== 'cancelado').forEach(p => out.push({ type: 'projeto', label: p.name, done: p.status === 'concluido', late: D.projectLate(p), id: p.id, demo: p.demo, act: 'pjOpen' }));
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
  mondayOf(k) { return U.weekStart(k); },
  range(s) {
    if (s.mode === 'week') { const a = this.mondayOf(s.anchor); return { from: a, to: U.addDays(a, 6), cells: [0, 1, 2, 3, 4, 5, 6].map(i => U.addDays(a, i)) }; }
    const mk = U.monthKey(s.anchor), first = U.monthStart(mk), last = U.monthEnd(mk);
    const cells = []; for (let k = this.mondayOf(first); cells.length < 42; k = U.addDays(k, 1)) { cells.push(k); if (cells.length % 7 === 0 && k >= last) break; }
    return { from: first, to: last, cells, mk };
  },
  title(s) {
    if (s.mode === 'month') return U.fmtMonth(U.monthKey(s.anchor));
    const a = this.mondayOf(s.anchor), z = U.addDays(a, 6), da = U.parse(a), dz = U.parse(z);
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
        ${inMonth && items.length ? `<span class="calx-chips">${items.slice(0, max).map(i => `<span class="calx-chip t-${i.type} ${i.done ? 'done' : ''} ${i.late ? 'late' : ''}">${i.time ? `<b>${i.time}</b> ` : ''}${U.esc(i.label)}</span>`).join('')}${items.length > max ? `<span class="calx-more">+${items.length - max}</span>` : ''}</span>
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
        ${id === 'agenda' ? '' : `<div class="tabs calx-mode" role="tablist"><button class="tab ${s.mode === 'week' ? 'active' : ''}" data-act="calMode" data-cal="${id}" data-v="week">Semana</button><button class="tab ${s.mode === 'month' ? 'active' : ''}" data-act="calMode" data-cal="${id}" data-v="month">Mês</button></div>`}
      </div>
      <div class="calx-wd">${this.WD.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="calx-grid" data-swipe="${id}">${r.cells.map(cell).join('')}</div>
      ${id === 'agenda' && s.mode === 'week' ? '' : `<div class="legend calx-legend">${Object.entries({ reuniao: 'Reunião', evento: 'Compromisso', tarefa: 'Tarefa', ...(S.settings.showProjetos ? { projeto: 'Projeto' } : {}), imprevisto: 'Imprevisto' }).map(([k, l]) => `<span><i class="t-${k}"></i>${l}</span>`).join('')}</div>`}
      ${id === 'agenda' ? `<button class="calx-exp" data-act="calMode" data-cal="${id}" data-v="${s.mode === 'week' ? 'month' : 'week'}" aria-expanded="${s.mode === 'month'}">${s.mode === 'week' ? `${U.icon('down', 16)} Ver o mês inteiro` : `${U.icon('up', 16)} Mostrar só a semana`}</button>` : ''}
    </div>`;
  },

  /* Lista do dia escolhido */
  day(id) {
    const s = this.st(id), k = s.sel, t = U.today();
    const items = this.itemsOn(k);
    const ag = D.dayBlocks(k), prog = D.progress(k);
    const d = U.parse(k), wd = U.WD[d.getDay()].replace('-feira', '');
    const when = k === t ? 'Hoje' : k === U.addDays(t, 1) ? 'Amanhã' : k === U.addDays(t, -1) ? 'Ontem' : wd;
    return `<div class="calx-day">
      <div class="calx-day-h">
        <div><small class="muted">${when}</small><h3>${d.getDate()} de ${U.MONTHS[d.getMonth()].toLowerCase()}</h3></div>
      </div>
      ${items.length ? `<div class="calx-list">${items.map(i => `<div class="calx-it t-${i.type} ${i.done ? 'done' : ''} ${i.late ? 'late' : ''}" role="button" tabindex="0" data-act="${i.act}" data-id="${i.id}">
          <span class="calx-it-time">${i.time || '—'}</span>
          <span class="calx-it-main"><span class="calx-it-title">${U.esc(i.label)}${H.demo(i)}</span><small>${this.TYPES[i.type]}${i.done ? (i.type === 'reuniao' ? ' · registrada' : ' · concluído') : i.late ? ' · <span class="c-red">atrasado</span>' : ''}</small></span>
          ${U.icon('right', 15)}</div>`).join('')}</div>`
        : `<p class="calx-empty muted small">Nada marcado para este dia.</p>`}
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
      s.anchor = U.addDays(Cal.mondayOf(s.anchor), Number(n) * 7);
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
  /* Botão flutuante "+" no Início e na Agenda: escolhe o que criar (no dia escolhido) */
  quickAdd({ k, from }) {
    const t = U.today(); k = k || t;
    const onAgenda = from === 'agenda';
    const dated = onAgenda || k !== t;   // prazo da tarefa: só se o dia foi escolhido
    const breakOk = onAgenda && (S.settings.breakMode || 'fixo') === 'flexivel' && !D.dayBlocks(k).some(b => D.isBreak(b) && b.status !== 'cancelada');
    const activity = { label: 'Atividade na agenda', hint: 'Um horário no cronograma do dia', icon: 'clock', onClick: () => { App.ui.agendaDate = k; if (onAgenda) Actions.agNew(); else { App.go('agenda'); setTimeout(() => Actions.agNew(), 150); } } };
    const items = [
      { label: dated ? 'Tarefa com prazo neste dia' : 'Tarefa', icon: 'tasks', onClick: () => Tasks.form(null, dated ? { dueDate: k } : {}) },
      { label: 'Reunião', hint: 'Com pauta, gravação e ata', icon: 'users', onClick: () => Events.form(null, k, { reuniao: true }) },
      { label: 'Feedback', hint: 'Conversa individual com o colaborador', icon: 'chat', onClick: () => FB.form(null) },
      { label: 'Imprevisto', hint: onAgenda ? 'E já encaixa na agenda' : 'Demanda urgente', icon: 'alert', onClick: () => onAgenda ? Actions.agImprevisto() : Occ.form(null) },
      { label: 'Compromisso', hint: 'Visita, consulta, entrega…', icon: 'calendar', onClick: () => Events.form(null, k) },
    ];
    if (onAgenda) items.unshift(activity); else items.push(activity);
    if (breakOk) items.splice(1, 0, { label: k === t ? 'Intervalo agora' : 'Intervalo', hint: 'Marca o almoço e empurra o que vem depois', icon: 'pause', onClick: () => Actions.agBreak() });
    UI.sheet(k === t ? 'Adicionar' : `Adicionar em ${U.fmtShort(k)}`, items);
  },
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
