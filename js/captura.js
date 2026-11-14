'use strict';
/* Anotação rápida (botão "+" do Início, da Agenda e dos Imprevistos).
   Um campo só: a pessoa escreve (ou dita pelo microfone do teclado) e escolhe o tipo.
   O texto é lido aqui mesmo, sem internet: datas ("amanhã", "sexta", "20/11"), horário ("às 15h"),
   duração ("30 min", "1h") e nomes da equipe. Imprevisto com tempo é encaixado AGORA na agenda
   e empurra o resto do dia (a atividade que estava em andamento continua depois). */
const Capture = {
  TYPES: [['imprevisto', 'Imprevisto', 'alert'], ['tarefa', 'Tarefa', 'tasks'], ['agenda', 'Na agenda', 'clock']],
  DURS: [[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']],
  WD: ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],

  norm: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),

  /* Lê o texto e devolve o que conseguiu entender: { date, time, dur, who } (cada um pode faltar) */
  parse(text, base = U.today()) {
    const t = ' ' + Capture.norm(text).replace(/\s+/g, ' ') + ' ';
    const out = {};
    // Data
    let m;
    if (/\bdepois de amanha\b/.test(t)) out.date = U.addDays(base, 2);
    else if (/\bamanha\b/.test(t)) out.date = U.addDays(base, 1);
    else if (/\bhoje\b/.test(t)) out.date = base;
    else if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const d = +m[1], mo = +m[2]; let y = m[3] ? +m[3] : +base.slice(0, 4);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        let k = `${y}-${U.pad(mo)}-${U.pad(d)}`;
        if (!m[3] && k < base) k = `${y + 1}-${U.pad(mo)}-${U.pad(d)}`;
        out.date = k;
      }
    } else if ((m = t.match(/\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/))) {
      const wd = Capture.WD.indexOf(m[1]);
      let k = base; for (let i = 0; i < 7 && U.weekday(k) !== wd; i++) k = U.addDays(k, 1);
      out.date = k;
    } else if ((m = t.match(/\bdia (\d{1,2})\b/))) {
      const d = +m[1];
      if (d >= 1 && d <= 31) {
        let mk = base.slice(0, 7); if (d < +base.slice(8, 10)) mk = U.addMonths(mk, 1);
        if (d <= +U.monthEnd(mk).slice(8, 10)) out.date = `${mk}-${U.pad(d)}`;
      }
    }
    // Repetição ("toda segunda", "todo dia", "todo mês", "todo dia 5")
    if (/\btodo dia \d{1,2}\b|\btodo mes\b|\bmensalmente\b|\btodos os meses\b/.test(t)) out.repeat = 'mensal';
    else if (/\btodo dia\b|\btodos os dias\b|\bdiariamente\b/.test(t)) out.repeat = 'diaria';
    else if (/\ba cada (?:2|duas) semanas\b|\bquinzenal/.test(t)) out.repeat = 'quinzenal';
    else if (/\btoda (?:segunda|terca|quarta|quinta|sexta|sabado)\b|\btodo (?:sabado|domingo)\b|\btoda semana\b|\btodas as semanas\b|\bsemanalmente\b/.test(t)) out.repeat = 'semanal';
    if (out.repeat === 'diaria' && !out.date) out.date = D.isWorkday(base) ? base : D.nextWorkday(base);
    // Duração ("30 min", "meia hora", "levar 2h", "1 hora")
    if (/\bmeia hora\b/.test(t)) out.dur = 30;
    else if ((m = t.match(/\b(\d{1,3}) ?(?:min|mins|minutos?)\b/))) out.dur = +m[1];
    else if ((m = t.match(/\b(?:por|leva|levar|vai levar|durante|uns|umas|cerca de) (\d{1,2}) ?(?:h|hs|horas?)\b/)) || (m = t.match(/\b(\d{1,2}) horas?\b/))) out.dur = +m[1] * 60;
    // Horário ("às 15h", "as 9h30", "15:30", "14h")
    const hm = (h, mi) => (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) ? `${U.pad(h)}:${U.pad(mi)}` : null;
    if ((m = t.match(/\b(?:as|a partir das|ate as|ate|para as|pras) (\d{1,2})(?:(?::|h) ?(\d{2}))? ?h?\b/))) out.time = hm(+m[1], +(m[2] || 0)) || undefined;
    else if ((m = t.match(/\b(\d{1,2}):(\d{2})\b/))) out.time = hm(+m[1], +m[2]) || undefined;
    else if (!out.dur && (m = t.match(/\b(\d{1,2})h(\d{2})?\b/)) && +m[1] >= 6) out.time = hm(+m[1], +(m[2] || 0)) || undefined;
    if (!out.time) delete out.time;
    // Pessoa da equipe citada no texto (nome completo primeiro, depois o primeiro nome)
    const names = D.techNames();
    const has = n => n && new RegExp(`\\b${Capture.norm(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t);
    out.who = names.find(has) || names.find(n => has(n.split(' ')[0]));
    if (!out.who) delete out.who;
    return out;
  },

  /* Abre a anotação rápida. type: imprevisto | tarefa | agenda. k: dia (Agenda). others: outras opções (lista do "+") */
  open({ type, k, others = [] } = {}) {
    const t = U.today(); k = k || t;
    const st = { type: type || (k > t ? 'tarefa' : 'imprevisto'), dur: 0, due: k > t ? k : '', time: '', who: '', start: '', agDur: 30, repeat: '', touched: {} };
    const nowStart = () => U.fromMin(Math.round(U.nowMin() / 5) * 5);
    st.start = k === t ? U.fromMin(Math.ceil(U.nowMin() / 15) * 15) : S.settings.workStart;
    const techs = D.techNames();
    const btn = (attr, v, label, on) => `<button type="button" class="cap-chip ${on ? 'on' : ''}" data-${attr}="${v}" aria-pressed="${on}">${label}</button>`;
    const whoField = label => `<label class="cap-l" for="cap-who">${label}</label><input id="cap-who" class="cap-in" value="${U.esc(st.who)}" placeholder="Você ou alguém da equipe" list="cap-dl" autocomplete="off"><datalist id="cap-dl">${techs.map(n => `<option value="${U.esc(n)}">`).join('')}</datalist>`;

    const optsHtml = () => {
      if (st.type === 'imprevisto') {
        if (k !== t) return `<p class="muted small">O imprevisto fica registrado com a data de hoje. Para reservar um horário em ${U.fmtShort(k)}, use <strong>Encaixar na agenda</strong> na tela de Imprevistos.</p>${whoField('Quem resolve?')}`;
        const cur = Capture.current();
        const s = nowStart(), e = U.fromMin(U.toMin(s) + st.dur);
        return `<span class="cap-l">Vai tomar quanto tempo agora?</span>
          <div class="cap-chips">${btn('dur', 0, 'Só registrar', !st.dur)}${Capture.DURS.map(([v, l]) => btn('dur', v, l, st.dur === v)).join('')}</div>
          ${st.dur ? `<p class="cap-prev">${U.icon('clock', 14)} <span>Entra na agenda agora, das <strong>${s}</strong> às <strong>${e}</strong>, e o resto do dia é empurrado.${cur ? ` “${U.esc(cur.title)}” continua depois.` : ''}</span></p>` : ''}
          ${whoField('Quem resolve?')}`;
      }
      if (st.type === 'tarefa') {
        const tm = U.addDays(t, 1);
        const other = st.due && st.due !== t && st.due !== tm;
        return `<span class="cap-l">Prazo</span>
          <div class="cap-chips">${btn('due', '', 'Sem prazo', !st.due)}${btn('due', t, 'Hoje', st.due === t)}${btn('due', tm, 'Amanhã', st.due === tm)}
          <label class="cap-chip cap-date ${other ? 'on' : ''}">${U.icon('calendar', 14)}<input type="date" id="cap-date" value="${other ? st.due : ''}" aria-label="Outra data">${other ? U.fmtShort(st.due) : 'Outra data'}</label></div>
          ${st.repeat ? `<p class="cap-prev">${U.icon('undo', 14)} <span>Repete: <strong>${Tasks.repeatLabel(st.repeat).toLowerCase()}</strong>. Ao concluir, a próxima é criada sozinha.</span><button type="button" class="link" data-norep>tirar</button></p>` : ''}
          ${st.due ? `<div class="cap-row"><label class="cap-l" for="cap-time">Horário (opcional)</label><input type="time" id="cap-time" class="cap-in" value="${st.time}"></div>` : ''}
          ${whoField('Quem faz?')}`;
      }
      return `<div class="cap-row"><label class="cap-l" for="cap-start">${k === t ? 'Hoje' : U.fmtShort(k)}, começa às</label><input type="time" id="cap-start" class="cap-in" value="${st.start}"></div>
        <span class="cap-l">Duração</span>
        <div class="cap-chips">${Capture.DURS.map(([v, l]) => btn('agdur', v, l, st.agDur === v)).join('')}</div>`;
    };
    const saveLabel = () => st.type === 'imprevisto' ? (st.dur && k === t ? 'Registrar e encaixar' : 'Registrar') : st.type === 'tarefa' ? 'Criar tarefa' : 'Pôr na agenda';

    const m = UI.modal({
      title: k === t ? 'Adicionar' : `Adicionar em ${U.fmtShort(k)}`,
      body: `<div class="cap">
        <textarea id="cap-t" class="cap-text" rows="2" placeholder="O que aconteceu? Ex.: câmeras offline no cliente X" aria-label="Descreva em poucas palavras"></textarea>
        <p class="hint cap-tip">${U.icon('chat', 13)} Dica: toque no microfone do teclado para falar em vez de digitar.</p>
        <div class="cap-types tabs" role="tablist">${Capture.TYPES.map(([v, l, ic]) => `<button type="button" class="tab ${st.type === v ? 'active' : ''}" data-type="${v}" role="tab" aria-selected="${st.type === v}">${U.icon(ic, 14)} ${l}</button>`).join('')}</div>
        <div class="cap-opts"></div>
        <div class="form-error" hidden></div>
        <button type="button" class="link cap-more" data-more>Mais detalhes…</button>
        ${others.length ? `<div class="cap-others"><span class="cap-l">Ou escolha</span><div class="sheet">${others.map((a, i) => `<button type="button" class="sheet-item" data-i="${i}">${a.icon ? U.icon(a.icon) : ''}<span>${a.label}${a.hint ? `<small>${a.hint}</small>` : ''}</span></button>`).join('')}</div></div>` : ''}
      </div>`,
      footer: `<span class="grow"></span><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn primary" data-save>${saveLabel()}</button>`,
    });
    const $ = s => m.el.querySelector(s);
    const ta = $('#cap-t');
    const paint = () => {
      $('.cap-opts').innerHTML = optsHtml();
      $('[data-save]').textContent = saveLabel();
      m.el.querySelectorAll('[data-type]').forEach(b => { const on = b.dataset.type === st.type; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    };
    const err = msg => { const e = $('.form-error'); e.textContent = msg || ''; e.hidden = !msg; };
    paint();

    // O texto preenche sozinho o que não foi mexido à mão
    ta.addEventListener('input', () => {
      err('');
      const p = Capture.parse(ta.value, t);
      const T = st.touched; let ch = false;
      const set = (key, v) => { if (!T[key] && v !== undefined && st[key] !== v) { st[key] = v; ch = true; } };
      if ((p.repeat || (p.date && p.date !== t)) && !T.type && st.type === 'imprevisto') { st.type = 'tarefa'; ch = true; }
      if (!T.repeat && (p.repeat || '') !== st.repeat) { st.repeat = p.repeat || ''; ch = true; }
      set('due', p.date); set('time', p.time); set('who', p.who);
      if (p.time) set('start', p.time);
      if (p.dur) { set('dur', p.dur); set('agDur', p.dur); }
      if (ch) { const f = document.activeElement; paint(); if (f === ta) ta.focus(); }
    });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.type) { st.type = b.dataset.type; st.touched.type = true; err(''); paint(); return; }
      if (b.dataset.dur !== undefined) { st.dur = +b.dataset.dur; st.touched.dur = true; paint(); return; }
      if (b.dataset.agdur !== undefined) { st.agDur = +b.dataset.agdur; st.touched.agDur = true; paint(); return; }
      if (b.hasAttribute('data-norep')) { st.repeat = ''; st.touched.repeat = true; paint(); return; }
      if (b.dataset.due !== undefined) { st.due = b.dataset.due; st.touched.due = true; paint(); return; }
      if (b.hasAttribute('data-cancel')) { m.close(); return; }
      if (b.hasAttribute('data-more')) { const d = Capture.read(st, ta); m.close(); setTimeout(() => Capture.details(st.type, d, k), 160); return; }
      if (b.hasAttribute('data-save')) { const msg = Capture.save(st, ta, k); if (msg) { err(msg); ta.focus(); } else m.close(); return; }
      if (b.dataset.i !== undefined) { m.close(); others[+b.dataset.i].onClick(); }
    });
    m.el.addEventListener('input', e => {
      const id = e.target.id;
      if (id === 'cap-who') { st.who = e.target.value.trim(); st.touched.who = true; }
      if (id === 'cap-time') { st.time = e.target.value; st.touched.time = true; }
      if (id === 'cap-start') { st.start = e.target.value; st.touched.start = true; }
    });
    m.el.addEventListener('change', e => { if (e.target.id === 'cap-date' && e.target.value) { st.due = e.target.value; st.touched.due = true; paint(); } });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('[data-save]').click(); } });
    setTimeout(() => ta.focus(), 80);
    return m;
  },

  read(st, ta) {
    const who = (document.getElementById('cap-who') || {}).value;
    if (who !== undefined) st.who = who.trim();
    return { title: ta.value.trim().replace(/\s+/g, ' '), who: st.who, due: st.due };
  },

  /* Abre o formulário completo de cada tipo, já com o que foi escrito */
  details(type, d, k) {
    if (type === 'imprevisto') Occ.form(null, { defaults: { title: d.title, responsible: d.who } });
    else if (type === 'tarefa') Tasks.form(null, { title: d.title, responsible: d.who, dueDate: d.due || undefined });
    else { App.ui.agendaDate = k; const go = () => Actions.agNew({ title: d.title }); if (App.route === 'agenda') go(); else { App.go('agenda'); setTimeout(go, 150); } }
  },

  /* Grava. Devolve uma mensagem de erro (string) ou nada */
  save(st, ta, k) {
    const d = Capture.read(st, ta);
    if (!d.title) return 'Escreva em poucas palavras o que é.';
    const t = U.today();
    if (st.type === 'imprevisto') {
      const now = !!st.dur && k === t;
      const o = { id: U.uid(), createdAt: new Date().toISOString(), scheduled: null, title: d.title, description: '', priority: 'urgente', status: now ? 'andamento' : 'pendente', date: t, time: U.nowTime(), dueDate: '', dueTime: '', responsible: d.who, notes: '' };
      S.occurrences.push(o);
      if (!now) { commit(); UI.toast('Imprevisto registrado.', 'ok', { label: 'Encaixar na agenda', onClick: () => Agenda.scheduleDialog(o) }); return; }
      const r = Capture.encaixarAgora(o, st.dur);
      commit();
      const over = D.overflowCount(t);
      UI.toast(`Encaixado das ${r.start} às ${r.end}.${r.moved ? ` ${U.plural(r.moved, 'atividade empurrada', 'atividades empurradas')}.` : ''}${over ? ` ${U.plural(over, 'atividade passou', 'atividades passaram')} do fim do expediente.` : ''}`, over ? 'warn' : 'ok', { label: 'Desfazer', onClick: () => { r.undo(); commit(); UI.toast('Desfeito.'); } });
      return;
    }
    if (st.type === 'tarefa') {
      S.tasks.push({ id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, title: d.title, description: '', category: 'administrativo', responsible: d.who, priority: 'media', status: 'pendente', startDate: t, dueDate: st.due || (st.repeat ? t : ''), dueTime: st.due ? st.time || '' : '', notes: '', repeat: st.repeat || '' });
      commit();
      UI.toast(st.repeat ? `Tarefa criada, ${Tasks.repeatLabel(st.repeat).toLowerCase()}.` : st.due ? `Tarefa criada, prazo ${st.due === t ? 'hoje' : U.fmtShort(st.due)}${st.due && st.time ? ' às ' + st.time : ''}.` : 'Tarefa criada.');
      return;
    }
    if (!st.start) return 'Informe o horário de início.';
    const s = U.toMin(st.start), e = Math.min(1439, s + (st.agDur || 30));
    if (e <= s) return 'Esse horário passa do fim do dia.';
    const day = D.ensureDay(k);
    const b = { id: U.uid(), title: d.title, start: st.start, end: U.fromMin(e), category: 'administrativo', priority: 'media', status: 'pendente', fixed: false, notes: '' };
    day.push(b);
    const moved = D.reflow(k, b.id);
    commit();
    UI.toast(`Na agenda: ${k === t ? 'hoje' : U.fmtShort(k)}, ${b.start}–${b.end}.${moved ? ` ${U.plural(moved, 'atividade empurrada', 'atividades empurradas')}.` : ''}`);
  },

  /* Atividade em andamento agora (a que o imprevisto interrompe) */
  current() {
    const k = U.today(), n = Math.round(U.nowMin() / 5) * 5;
    return D.dayBlocks(k).find(b => !b.fixed && !D.isBreak(b) && !D.blockDone(b) && U.toMin(b.start) < n && U.toMin(b.end) > n) || null;
  },

  /* Põe o imprevisto na agenda de hoje, a partir de agora, e empurra o resto.
     A atividade que estava em andamento é pausada e continua depois (com o tempo que faltava). */
  encaixarAgora(o, dur) {
    const k = U.today();
    const day = D.ensureDay(k);
    const snap = JSON.stringify(day);
    const s = Math.round(U.nowMin() / 5) * 5, e = Math.min(1439, s + dur);
    const cur = Capture.current();
    if (cur) {
      const rest = U.toMin(cur.end) - s;
      cur.start = U.fromMin(e); cur.end = U.fromMin(e + rest); cur.status = 'pendente';
      cur.notes = [cur.notes, `Pausada às ${U.fromMin(s)} por um imprevisto`].filter(Boolean).join(' · ');
    }
    day.forEach(b => { if (b.status === 'andamento' && !D.isBreak(b)) b.status = 'pendente'; });
    const b = { id: U.uid(), start: U.fromMin(s), end: U.fromMin(e), title: 'Imprevisto: ' + o.title, category: 'imprevistos', priority: o.priority, status: 'andamento', notes: '', fixed: false, occurrenceId: o.id };
    day.push(b);
    o.scheduled = { date: k, blockId: b.id };
    const moved = D.reflow(k, b.id) + (cur ? 1 : 0);
    return {
      start: b.start, end: b.end, moved,
      undo() { S.days[k] = JSON.parse(snap); S.occurrences = S.occurrences.filter(x => x.id !== o.id); },
    };
  },

  /* Tempo que os imprevistos tomaram da agenda num dia (minutos) */
  minutesOn(k) {
    return D.dayBlocks(k).filter(b => b.occurrenceId && b.status !== 'cancelada').reduce((a, b) => a + (U.toMin(b.end) - U.toMin(b.start)), 0);
  },
};

Object.assign(Actions, {
  capture({ type, k }) { Capture.open({ type, k }); },
});
