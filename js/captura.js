'use strict';
/* Anotação rápida (botão "+" de todas as telas: Calendário, Agenda, Tarefas e Imprevistos).
   Um campo só: a pessoa escreve (ou dita pelo microfone do teclado) e escolhe o tipo.
   O texto é lido aqui mesmo, sem internet: datas ("amanhã", "sexta", "20/11"), horário ("às 15h"),
   duração ("30 min", "1h") e nomes da equipe. Imprevisto com tempo é encaixado AGORA na agenda
   e empurra o resto do dia (a atividade que estava em andamento continua depois). */
const Capture = {
  /* Tarefa e "Na agenda" viraram uma coisa só (pedido do usuário): a tarefa tem dia, horário e duração opcionais
     e aparece na Agenda e no Calendário. Tipo 'agenda' antigo é tratado como tarefa. */
  TYPES: [['tarefa', 'Tarefa', 'tasks'], ['imprevisto', 'Imprevisto', 'alert'], ['reuniao', 'Reunião', 'users'], ['compromisso', 'Compromisso', 'calendar'], ['feedback', 'Feedback', 'chat']],
  /* Tudo pelo "+" (pedido do usuário: escolhe o dia no calendário e adiciona o que quiser, num lugar só).
     Tarefa e Imprevisto são preenchidos aqui; Reunião, Compromisso e Feedback abrem o formulário próprio, já no dia escolhido
     e com o texto digitado. */
  OUTROS: {
    reuniao: (k, txt, p) => Events.form(null, p.date || k, { reuniao: true, title: txt, time: p.time }),
    compromisso: (k, txt, p) => Events.form(null, p.date || k, { title: txt, time: p.time }),
    feedback: (k, txt, p) => FB.form(null, p.who || '', { date: k, notas: txt }),
  },
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

  /* Abre a anotação rápida. type: tarefa (padrão) | imprevisto (reunião, compromisso e feedback abrem o próprio formulário). k: dia escolhido no Calendário/Agenda (a tarefa já vai para ele) */
  open({ type, k } = {}) {
    const t = U.today(); k = k || t;
    const st = { type: type === 'imprevisto' ? 'imprevisto' : 'tarefa', dur: 0, due: k >= t ? k : t, time: '', tdur: 30, who: '', repeat: '', prio: 'media', oprio: 'urgente', odue: '', obs: '', touched: {} };
    const nowStart = () => U.fromMin(Math.round(U.nowMin() / 5) * 5);
    const techs = D.techNames();
    const btn = (attr, v, label, on) => `<button type="button" class="cap-chip ${on ? 'on' : ''}" data-${attr}="${v}" aria-pressed="${on}">${label}</button>`;
    const whoField = label => `<label class="cap-l" for="cap-who">${label}</label><input id="cap-who" class="cap-in" value="${U.esc(st.who)}" placeholder="Você ou alguém da equipe" list="cap-dl" autocomplete="off"><datalist id="cap-dl">${techs.map(n => `<option value="${U.esc(n)}">`).join('')}</datalist>`;

    const optsHtml = () => {
      const sel = (id, name, opts, v, dis) => `<select id="${id}" name="${name}" class="cap-sel" ${dis ? 'disabled' : ''}>${opts.map(([a, l]) => `<option value="${a}" ${String(v) === String(a) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      const obsField = `<label class="cap-l" for="cap-obs">Observação</label><textarea id="cap-obs" class="cap-obs" rows="1" placeholder="Opcional">${U.esc(st.obs)}</textarea>`;
      if (st.type === 'imprevisto') {
        // Imprevisto: tudo numa tela só também (pedido do usuário), sem "Mais detalhes"
        const resto = `${whoField('Quem resolve?')}
          <label><span class="cap-l">Prioridade</span>${sel('cap-oprio', 'priority', H.prioOptions(), st.oprio)}</label>
          ${obsField}`;
        if (k !== t) return `<p class="muted small">O imprevisto fica registrado com a data de hoje. Para reservar um horário em ${U.fmtShort(k)}, use <strong>Encaixar na agenda</strong> na tela de Imprevistos.</p>${resto}`;
        const cur = Capture.current();
        const s = nowStart(), e = U.fromMin(U.toMin(s) + st.dur);
        return `<span class="cap-l">Vai tomar quanto tempo agora?</span>
          <div class="cap-chips">${btn('dur', 0, 'Só registrar', !st.dur)}${Capture.DURS.map(([v, l]) => btn('dur', v, l, st.dur === v)).join('')}</div>
          ${st.dur ? `<p class="cap-prev">${U.icon('clock', 14)} <span>Entra na agenda agora, das <strong>${s}</strong> às <strong>${e}</strong>, e o resto do dia é empurrado.${cur ? ` “${U.esc(cur.title)}” continua depois.` : ''}</span></p>` : ''}
          ${resto}`;
      }
      // Tarefa: tudo numa tela só (pedido do usuário), sem "Mais detalhes"
      const tm = U.addDays(t, 1);
      const other = st.due && st.due !== t && st.due !== tm;
      // Toda tarefa entra na agenda (pedido do usuário): dia e horário obrigatórios, com sugestões de horários livres
      const livres = Agenda.livres(st.due, st.tdur || 30, { prio: st.prio });
      return `<span class="cap-l">Quando? <em class="cap-obr">obrigatório</em></span>
        <div class="cap-chips">${btn('due', t, 'Hoje', st.due === t)}${btn('due', tm, 'Amanhã', st.due === tm)}
        <span class="cap-date-w"><button type="button" class="cap-chip cap-date ${other ? 'on' : ''}" data-outra-data aria-pressed="${!!other}">${U.icon('calendar', 14)}${other ? U.fmtShort(st.due) : 'Outra data'}</button><input type="date" id="cap-date" class="cap-date-in" min="${t}" value="${other ? st.due : ''}" aria-label="Outra data" tabindex="-1"></span></div>
        <div class="cap-2"><label><span class="cap-l">Prioridade</span>${sel('cap-prio', 'priority', H.prioOptions(), st.prio)}</label>
          <label><span class="cap-l">Duração</span>${sel('cap-dur', 'dur', Tasks.DURS.filter(([v]) => v), st.tdur || 30)}</label></div>
        <span class="cap-l">Horários livres ${st.due === t ? 'hoje' : st.due === tm ? 'amanhã' : 'em ' + U.fmtShort(st.due)}${Tasks.livresDica(st.prio)}</span>
        <div class="cap-chips cap-livres">${livres.length ? livres.map(l => `<button type="button" class="cap-chip ${st.time === l.h ? 'on' : ''} ${l.sobre ? 'sobre' : ''}" data-livre="${l.h}" title="${l.sobre ? 'No horário de: ' + U.esc(l.sobre) : 'Horário livre'}">${l.h}${l.sobre ? '<i>•</i>' : ''}</button>`).join('') : '<span class="muted small">Nada livre neste dia no expediente. Escolha outro dia ou digite um horário.</span>'}</div>
        ${livres.some(l => l.sobre) ? '<p class="muted small cap-nota"><i class="cap-ponto">•</i> cai sobre uma atividade da rotina: depois é só tocar em Reorganizar na Agenda.</p>' : ''}
        ${st.repeat ? `<p class="cap-prev">${U.icon('undo', 14)} <span>Repete: <strong>${Tasks.repeatLabel(st.repeat).toLowerCase()}</strong>.</span></p>` : ''}
        <div class="cap-2"><label><span class="cap-l">Horário <em class="cap-obr">obrigatório</em></span><input type="time" id="cap-time" class="cap-in" value="${st.time}" required></label>
          <label><span class="cap-l">Repetir</span>${sel('cap-rep', 'repeat', Tasks.REPEAT, st.repeat)}</label></div>
        ${whoField('Quem faz?')}
        ${obsField}`;
    };
    const saveLabel = () => st.type === 'imprevisto' ? (st.dur && k === t ? 'Registrar e encaixar' : 'Registrar') : 'Criar tarefa';
    const ph = () => st.type === 'imprevisto' ? 'O que aconteceu? Ex.: câmeras offline no cliente X' : 'O que precisa fazer? Ex.: ligar para o cliente amanhã às 10h';

    const m = UI.modal({
      title: k === t ? 'Adicionar' : `Adicionar em ${U.fmtShort(k)}`,
      body: `<div class="cap">
        <div class="cap-types" role="tablist" aria-label="O que você quer adicionar?">${Capture.TYPES.map(([v, l, ic]) => `<button type="button" class="cap-tipo ${st.type === v ? 'active' : ''} ct-${v}" data-type="${v}" role="tab" aria-selected="${st.type === v}">${U.icon(ic, 18)}<span>${l}</span></button>`).join('')}</div>
        <textarea id="cap-t" class="cap-text" rows="2" placeholder="${ph()}" aria-label="Descreva em poucas palavras"></textarea>
        <p class="hint cap-tip">${U.icon('chat', 13)} Dica: toque no microfone do teclado para falar em vez de digitar.</p>
        <div class="cap-opts"></div>
        <div class="form-error" hidden></div>
      </div>`,
      footer: `<span class="grow"></span><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn primary" data-save>${saveLabel()}</button>`,
    });
    const $ = s => m.el.querySelector(s);
    const ta = $('#cap-t');
    const paint = () => {
      $('.cap-opts').innerHTML = optsHtml();
      $('[data-save]').textContent = saveLabel();
      ta.placeholder = ph();
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
      if (p.dur) { set('dur', p.dur); set('tdur', p.dur); }
      if (ch) { const f = document.activeElement; paint(); if (f === ta) ta.focus(); }
    });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.type && Capture.OUTROS[b.dataset.type]) { const txt = ta.value.trim(), p = Capture.parse(txt, t); if (st.who) p.who = st.who; m.close(); Capture.OUTROS[b.dataset.type](k, txt, p); return; }
      if (b.dataset.type) { st.type = b.dataset.type; st.touched.type = true; err(''); paint(); return; }
      if (b.dataset.dur !== undefined) { st.dur = +b.dataset.dur; st.touched.dur = true; paint(); return; }
      if (b.dataset.due !== undefined) { st.due = b.dataset.due || t; st.touched.due = true; paint(); return; }
      // "Outra data": abre o calendário do aparelho direto (o campo invisível por cima do botão não abria em alguns Android).
      // Sem showPicker (navegador antigo), mostra o campo de data ao lado do botão.
      if (b.hasAttribute('data-outra-data')) { const i = $('#cap-date'); try { i.showPicker(); } catch (er) { i.classList.add('vis'); i.focus(); try { i.click(); } catch (e2) { /* ignora */ } } return; }
      if (b.dataset.livre) { st.time = b.dataset.livre; st.touched.time = true; err(''); paint(); return; }
      if (b.hasAttribute('data-cancel')) { m.close(); return; }
      if (b.hasAttribute('data-save')) { const msg = Capture.save(st, ta, k); if (msg) { err(msg); ta.focus(); } else m.close(); return; }
    });
    m.el.addEventListener('input', e => {
      const id = e.target.id;
      if (id === 'cap-who') { st.who = e.target.value.trim(); st.touched.who = true; }
      if (id === 'cap-time') { st.time = e.target.value; st.touched.time = true; m.el.querySelectorAll('[data-livre]').forEach(c => c.classList.toggle('on', c.dataset.livre === st.time)); }
      if (id === 'cap-obs') st.obs = e.target.value;
    });
    m.el.addEventListener('change', e => {
      const id = e.target.id, v = e.target.value;
      if (id === 'cap-date' && v) { st.due = v; st.touched.due = true; paint(); }
      if (id === 'cap-dur') { st.tdur = +v || 30; st.touched.tdur = true; paint(); }
      if (id === 'cap-prio') { st.prio = v; paint(); }
      if (id === 'cap-oprio') st.oprio = v;
      if (id === 'cap-odue') st.odue = v;
      if (id === 'cap-rep') { st.repeat = v; st.touched.repeat = true; }
    });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('[data-save]').click(); } });
    setTimeout(() => ta.focus(), 80);
    return m;
  },

  read(st, ta) {
    const who = (document.getElementById('cap-who') || {}).value;
    if (who !== undefined) st.who = who.trim();
    return { title: ta.value.trim().replace(/\s+/g, ' '), who: st.who, due: st.due, time: st.due ? st.time : '', dur: st.due && st.time ? st.tdur : 0, repeat: st.repeat };
  },

  /* Grava. Devolve uma mensagem de erro (string) ou nada */
  save(st, ta, k) {
    const d = Capture.read(st, ta);
    if (!d.title) return 'Escreva em poucas palavras o que é.';
    if (st.type === 'tarefa' && !st.time) return 'Escolha o horário: toque num horário livre ou digite a hora.';
    const t = U.today();
    if (st.type === 'imprevisto') {
      const now = !!st.dur && k === t;
      const o = { id: U.uid(), createdAt: new Date().toISOString(), scheduled: null, title: d.title, description: (st.obs || '').trim(), priority: st.oprio || 'urgente', status: now ? 'andamento' : 'pendente', date: t, time: U.nowTime(), dueDate: '', dueTime: '', responsible: d.who, notes: '' };
      S.occurrences.push(o);
      if (!now) { commit(); UI.toast('Imprevisto registrado.', 'ok', { label: 'Encaixar na agenda', onClick: () => Agenda.scheduleDialog(o) }); return; }
      const tk = Tasks.emExecucao(); if (tk) tk.status = 'pendente';   // imprevisto vem antes de tudo: pausa a tarefa em execução
      const r = Capture.encaixarAgora(o, st.dur);
      commit();
      const over = D.overflowCount(t);
      UI.toast(`Encaixado das ${r.start} às ${r.end}.${r.moved ? ` ${U.plural(r.moved, 'atividade empurrada', 'atividades empurradas')}.` : ''}${over ? ` ${U.plural(over, 'atividade passou', 'atividades passaram')} do fim do expediente.` : ''}`, over ? 'warn' : 'ok', { label: 'Desfazer', onClick: () => { r.undo(); commit(); UI.toast('Desfeito.'); } });
      return;
    }
    const due = d.due || (st.repeat ? t : '');
    S.tasks.push({ id: U.uid(), createdAt: new Date().toISOString(), completedAt: null, title: d.title, category: 'administrativo', responsible: d.who, priority: st.prio || 'media', status: 'pendente', startDate: t, dueDate: due, dueTime: due ? d.time || '' : '', dur: due && d.time ? d.dur || 0 : 0, notes: '', repeat: st.repeat || '', description: (st.obs || '').trim() });
    commit();
    const quando = !due ? 'sem data (aparece hoje na Agenda)' : `${due === t ? 'hoje' : due === U.addDays(t, 1) ? 'amanhã' : U.fmtShort(due)}${d.time ? ' às ' + d.time : ''}`;
    // Tarefa com horário e duração ocupa o horário: avisa se bate com a rotina e oferece reorganizar
    const nb = due && d.time && d.dur && due >= t ? Cal.batem(due, { start: d.time, end: U.fromMin(Math.min(1439, U.toMin(d.time) + d.dur)) }).length : 0;
    if (nb) { UI.toast(`Tarefa criada: ${quando}. Bate com ${U.plural(nb, 'atividade', 'atividades')} da rotina.`, 'warn', { label: 'Reorganizar', onClick: () => { App.ui.agendaDate = due; if (App.route !== 'agenda') App.go('agenda'); setTimeout(() => Replan.open(due), 200); } }); return; }
    UI.toast(st.repeat ? `Tarefa criada, ${Tasks.repeatLabel(st.repeat).toLowerCase()}.` : `Tarefa criada: ${quando}.`, 'ok', App.route === 'agenda' && App.ui.agendaDate === (due || t) ? undefined : { label: 'Ver na agenda', onClick: () => Actions.goAgenda({ d: due || t }) });
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
