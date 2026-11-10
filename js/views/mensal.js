'use strict';
/* Planejamento mensal — 4 ciclos + calendário com prazos e compromissos */
const cycleOf = k => { const d = U.parse(k).getDate(); return d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : 4; };
const CYCLE_COLORS = ['var(--cy1)', 'var(--cy2)', 'var(--cy3)', 'var(--cy4)'];

const Month = {
  itemsOn(k) {
    const out = [];
    S.events.filter(e => e.date === k).forEach(e => out.push({ type: 'evento', label: e.title, time: e.time, id: e.id, demo: e.demo, done: !!e.registro }));
    S.tasks.filter(x => x.dueDate === k && x.status !== 'cancelada').forEach(x => out.push({ type: 'tarefa', label: x.title, time: x.dueTime, done: x.status === 'concluida', late: D.taskLate(x), id: x.id, demo: x.demo }));
    S.projects.filter(p => p.dueDate === k && p.status !== 'cancelado').forEach(p => out.push({ type: 'projeto', label: p.name, done: p.status === 'concluido', late: D.projectLate(p), id: p.id, demo: p.demo }));
    S.occurrences.filter(o => o.dueDate === k && o.status !== 'cancelada').forEach(o => out.push({ type: 'imprevisto', label: o.title, time: o.dueTime, done: o.status === 'concluida', late: D.occLate(o), id: o.id, demo: o.demo }));
    return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  },
  TYPE: { evento: 'Compromisso', tarefa: 'Prazo de tarefa', projeto: 'Prazo de projeto', imprevisto: 'Prazo de imprevisto' },
};

Views.mensal = {
  title: 'Planejamento mensal', icon: 'calendar', nav: 'Planejamento mensal',
  render() {
    const mk = App.ui.month || U.monthKey(U.today());
    const t = U.today();
    const chk = S.monthly.checks[mk] || {};
    const curCycle = U.monthKey(t) === mk ? cycleOf(t) : null;

    const cycles = S.monthly.cycles.map((c, i) => {
      const dn = c.items.filter(x => chk[x.id]).length;
      const p = c.items.length ? Math.round(dn / c.items.length * 100) : null;
      const range = [[1, 7], [8, 14], [15, 21], [22, Number(U.monthEnd(mk).slice(8))]][i];
      return `<div class="cycle card ${curCycle === c.n ? 'is-current' : ''} ${!c.title && !c.items.length ? 'is-empty' : ''}" style="--cc:${CYCLE_COLORS[i]}">
        <div class="wk-h"><div><small>Semana ${c.n}, dias ${range[0]} a ${range[1]}${curCycle === c.n ? ' · agora' : ''}</small><h3>${c.title ? U.esc(c.title) : '<span class="muted">Sem foco definido</span>'}</h3></div>
        <button class="icon-btn" data-act="mcEdit" data-n="${c.n}" title="${c.title ? 'Editar foco' : 'Definir foco'}" aria-label="${c.title ? 'Editar foco' : 'Definir foco'}">${U.icon('edit', 15)}</button></div>
        ${c.items.length ? `${H.bar(p, 'var(--cc)')}<small class="muted">${dn}/${c.items.length} concluídos</small>` : ''}
        <ul class="checklist">${c.items.map(x => `<li><label class="check"><input type="checkbox" data-change="mcCheck" data-id="${x.id}" ${chk[x.id] ? 'checked' : ''}><span>${U.esc(x.text)}</span></label><button class="icon-btn xs" data-act="mcItemEdit" data-n="${c.n}" data-id="${x.id}" title="Editar item">${U.icon('edit', 13)}</button></li>`).join('')}</ul>
        <button class="btn sm ghost add-item" data-act="mcItemAdd" data-n="${c.n}">${U.icon('plus', 15)} Adicionar item</button>
      </div>`;
    }).join('');

    // Calendário (semana começando no domingo)
    const first = U.monthStart(mk), last = U.monthEnd(mk);
    const gridStart = U.addDays(first, -U.weekday(first));
    const cells = [];
    for (let k = gridStart; cells.length < 42; k = U.addDays(k, 1)) { cells.push(k); if (cells.length >= 35 && k >= last && U.weekday(k) === 6) break; }
    const cal = cells.map(k => {
      const inMonth = U.monthKey(k) === mk;
      const items = inMonth ? Month.itemsOn(k) : [];
      const hasAgenda = !!(S.days[k] && S.days[k].length);
      const cyc = inMonth ? cycleOf(k) : 0;
      return `<button class="cal-cell ${inMonth ? '' : 'out'} ${k === t ? 'today' : ''} ${D.isWorkday(k) ? '' : 'off'}" data-act="calDay" data-k="${k}" ${inMonth ? `style="--cc:${CYCLE_COLORS[cyc - 1]}"` : ''}>
        <span class="cal-n">${U.parse(k).getDate()}</span>
        ${hasAgenda ? `<span class="cal-ag" title="Agenda do dia com alterações">${D.progress(k).pct ?? 0}%</span>` : ''}
        <span class="cal-items">${items.slice(0, 3).map(i => `<span class="cal-it t-${i.type} ${i.done ? 'done' : ''} ${i.late ? 'late' : ''}">${i.time ? i.time + ' ' : ''}${U.esc(i.label)}</span>`).join('')}${items.length > 3 ? `<span class="cal-more">+${items.length - 3}</span>` : ''}</span>
        ${items.length ? `<span class="cal-dots">${items.slice(0, 4).map(i => `<i class="t-${i.type} ${i.late ? 'late' : ''}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('');

    return `
    <div class="plan-intro">
      <p>O mês é dividido em <strong>4 semanas</strong>. Dê um foco a cada uma e liste as entregas do período. A lista se repete todo mês; as marcações valem só para o mês exibido. Abaixo, o calendário reúne prazos e compromissos.</p>
      <button class="link" data-act="guideOpen" data-id="mensal">Como funciona</button>
    </div>
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" data-act="mShift" data-n="-1" aria-label="Mês anterior">${U.icon('left')}</button>
        <strong class="range-lbl">${U.fmtMonth(mk)}</strong>
        <button class="icon-btn" data-act="mShift" data-n="1" aria-label="Próximo mês">${U.icon('right')}</button>
        ${mk !== U.monthKey(t) ? '<button class="btn sm ghost" data-act="mShift" data-n="0">Mês atual</button>' : ''}
      </div>
      <span class="grow"></span>
      <button class="btn primary" data-act="evNew">${U.icon('plus')} Novo compromisso</button>
    </div>
    <div class="cycles">${cycles}</div>
    <div class="card">
      <div class="card-h"><h3>${U.icon('calendar')} Calendário</h3>
        <div class="legend"><span><i class="t-evento"></i>Compromisso</span><span><i class="t-tarefa"></i>Tarefa</span><span><i class="t-projeto"></i>Projeto</span><span><i class="t-imprevisto"></i>Imprevisto</span></div></div>
      <div class="cal">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="cal-wd">${d}</div>`).join('')}${cal}</div>
      <p class="muted small mt">A faixa no topo de cada dia indica a semana do mês. Toque em um dia para ver detalhes, criar um compromisso ou abrir a agenda.</p>
    </div>`;
  },
};

const Events = {
  /* Pauta guardada como lista; no formulário, um assunto por linha (mantém os ids dos que já existiam) */
  pautaFromText(txt, old = []) {
    return txt.split('\n').map(l => l.trim()).filter(Boolean).map(text => { const o = old.find(x => x.text === text); return { id: o ? o.id : U.uid(), text }; });
  },
  form(e, date, opts = {}) {
    const isNew = !e;
    e = e || { date: date || U.today(), reuniao: !!opts.reuniao };
    const meet = Meetings.isMeeting(e);
    const noun = meet ? 'reunião' : 'compromisso';
    UI.form({
      title: isNew ? (meet ? 'Nova reunião' : 'Novo compromisso') : `Editar ${noun}`,
      fields: [
        { name: 'title', label: meet ? 'Reunião' : 'Compromisso', required: true, value: e.title, placeholder: meet ? 'Ex.: Alinhamento semanal da equipe' : 'Ex.: Visita ao cliente' },
        { name: 'date', label: 'Data', type: 'date', required: true, value: e.date, half: true },
        { name: 'time', label: 'Horário', type: 'time', value: e.time, half: true },
        { name: 'pauta', label: meet ? 'Pauta' : 'Pauta (se for reunião)', type: 'textarea', rows: meet ? 4 : 2, value: (e.pautas || []).map(x => x.text).join('\n'), placeholder: 'Um assunto por linha', hint: 'Depois da reunião, abra-a e toque em “Registrar reunião” para marcar o que foi tratado e anotar os combinados.' },
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: e.notes },
        ...(isNew ? [{ name: 'toAgenda', label: 'Adicionar também na agenda do dia (30 min)', type: 'checkbox', value: false }] : []),
      ],
      extra: isNew ? [] : [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); S.events = S.events.filter(x => x.id !== e.id); commit(); UI.toast(meet ? 'Reunião excluída.' : 'Compromisso excluído.'); } }],
      validate: v => v.toAgenda && !v.time ? 'Informe o horário para adicionar à agenda.' : null,
      onSubmit(v) {
        const { toAgenda, pauta, ...data } = v;
        data.pautas = Events.pautaFromText(pauta, e.pautas || []);
        if (e.reuniao || data.pautas.length) data.reuniao = true;
        if (isNew) S.events.push({ id: U.uid(), ...data }); else Object.assign(e, data);
        if (toAgenda) D.ensureDay(v.date).push({ id: U.uid(), title: v.title, start: v.time, end: U.fromMin(U.toMin(v.time) + 30), category: data.reuniao ? 'equipe' : 'administrativo', priority: 'media', status: 'pendente', notes: v.notes, fixed: true });
        commit(); UI.toast(data.reuniao ? 'Reunião salva.' : 'Compromisso salvo.');
      },
    });
  },

  /* Detalhes: pauta, registro da reunião e ações */
  view(e) {
    const r = e.registro, pautas = e.pautas || [];
    const done = id => r && r.tratadas.includes(id);
    const meet = Meetings.isMeeting(e);
    const m = UI.modal({
      title: e.title,
      body: `
        <p class="muted">${U.fmtLong(e.date)}${e.time ? `, às ${e.time}` : ''}${H.demo(e)}</p>
        ${e.notes ? `<p class="pre">${U.esc(e.notes)}</p>` : ''}
        ${pautas.length ? `<h4>Pauta</h4><ul class="pauta">${pautas.map(x => `<li class="${r ? (done(x.id) ? 'ok' : 'no') : ''}">${r ? U.icon(done(x.id) ? 'check' : 'x', 15) : '<i></i>'}<span>${U.esc(x.text)}</span></li>`).join('')}</ul>` : ''}
        ${r ? `<h4>Registro da reunião</h4><p class="muted small">Registrada em ${U.fmtDateTime(r.at)}${pautas.length ? `. ${r.tratadas.length} de ${U.plural(pautas.length, 'assunto')} tratados.` : '.'}</p>
          ${r.resumo ? `<p class="ata pre">${U.esc(r.resumo)}</p>` : ''}
          <h4>Combinados</h4>${r.combinados ? `<p class="ata pre">${U.esc(r.combinados)}</p>` : '<p class="muted">Nada anotado como combinado.</p>'}
          ${r.transcricao ? `<details class="tx"><summary>Ver transcrição</summary><p class="ata pre small">${U.esc(r.transcricao)}</p></details>` : ''}`
          : `<p class="muted small mt">${Meetings.passed(e) ? 'Toque em <strong>Registrar reunião</strong> para marcar o que foi tratado e anotar os combinados.' : 'Na hora da reunião, toque em <strong>Iniciar reunião</strong>: grave e acompanhe a transcrição ao vivo, marque a pauta e, no fim, a IA preenche os combinados.'}</p>`}`,
      footer: `<button class="btn ghost" data-ed>${U.icon('edit', 15)} Editar</button><span class="grow"></span><button class="btn ${meet || r ? 'primary' : ''}" data-reg>${r ? `${U.icon('edit', 15)} Editar registro` : Meetings.passed(e) ? `${U.icon('check', 15)} Registrar reunião` : `${U.icon('mic', 15)} Iniciar reunião`}</button>`,
    });
    m.el.querySelector('[data-ed]').onclick = () => { m.close(); Events.form(e); };
    const reg = m.el.querySelector('[data-reg]'); if (reg) reg.onclick = () => { m.close(); Events.register(e); };
  },

  /* Reunião: antes/durante (gravar e transcrever ao vivo, marcar a pauta) e depois (registro).
     A IA preenche combinados e resumo a partir da transcrição e das anotações. */
  register(e) {
    const r = e.registro || { tratadas: [], combinados: '', resumo: '' };
    const pautas = e.pautas || [];
    const live = !e.registro;
    let dirty = false, warned = false;
    Recorder.reset();
    const iaBox = !IA.supported() ? '' : `<div class="ia-box">
        <div class="ia-h">${U.icon('spark', 17)}<strong>${live ? 'Gravar e transcrever ao vivo' : 'Preencher com IA'}</strong></div>
        ${IA.key() ? '' : `<div class="ia-keyrow"><label for="ia-inline">Primeiro, cole a sua chave da IA (só uma vez ${Native.available() ? 'neste celular' : 'neste navegador'})</label>
          <div class="inline-add"><input id="ia-inline" name="iaKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Chave do AI Studio"><button type="button" class="btn sm primary" data-ia-save>Salvar chave</button></div></div>`}
        ${Recorder.supported() ? `<div class="ia-actions"><button type="button" class="btn primary rec-btn" data-rec>${U.icon('mic', 16)} Iniciar gravação</button><span class="rec-st small"></span></div>
        <div class="live" hidden><div class="live-h"><span class="rec-dot"></span><strong>Transcrição</strong><small class="live-st muted"></small></div><div class="live-txt" aria-live="polite"></div></div>` : ''}
        <textarea name="iaNotas" rows="2" placeholder="Anotações suas (opcional). Dá para ditar pelo microfone do teclado."></textarea>
        <div class="ia-actions"><span class="muted small grow">${Recorder.supported() ? 'Ao encerrar a gravação, a IA preenche tudo sozinha.' : ''}</span><button type="button" class="btn sm" data-ia>${U.icon('spark', 15)} Preencher com IA</button></div>
        <p class="ia-msg small" hidden></p>
      </div>`;
    const m = UI.form({
      title: e.title,
      submitLabel: 'Salvar registro',
      canClose: () => {
        if (Recorder.recording()) { UI.toast('A gravação está em andamento. Toque em “Encerrar gravação” antes de sair.', 'warn'); return false; }
        if ((Recorder.text() || dirty) && !warned) { warned = true; UI.toast('O registro ainda não foi salvo. Toque de novo para sair sem salvar.', 'warn'); return false; }
        return true;
      },
      onClose: () => { if (Recorder.recording()) Recorder.stop(); Recorder.reset(); },
      fields: [
        { type: 'html', html: `<p class="muted small">${U.fmtLong(e.date)}${e.time ? `, às ${e.time}` : ''}${live && pautas.length ? '. Marque os assuntos conforme forem tratados.' : ''}</p>${iaBox}` },
        ...(pautas.length ? [{ type: 'html', html: '<span class="lbl">Pauta: assuntos tratados</span>' }, ...pautas.map(x => ({ name: 'p_' + x.id, label: U.esc(x.text), type: 'checkbox', value: r.tratadas.includes(x.id) }))] : []),
        { name: 'combinados', label: 'O que foi combinado', type: 'textarea', rows: 4, value: r.combinados, placeholder: 'Um combinado por linha. Ex.: Carlos envia o relatório até sexta' },
        { name: 'resumo', label: 'Resumo (opcional)', type: 'textarea', rows: 3, value: r.resumo || '', placeholder: 'O que foi conversado, em poucas frases' },
        { name: 'mkTasks', label: 'Criar uma tarefa para cada combinado', type: 'checkbox', value: false, hint: 'As tarefas entram em Tarefas, com o nome da reunião na descrição. Ajuste prazo e responsável depois.' },
      ],
      onSubmit(v) {
        if (Recorder.recording()) return 'Encerre a gravação antes de salvar.';
        const tx = Recorder.text() || r.transcricao || '';
        e.registro = { at: new Date().toISOString(), tratadas: pautas.filter(x => v['p_' + x.id]).map(x => x.id), combinados: v.combinados, resumo: v.resumo, ...(tx ? { transcricao: tx.slice(0, 30000) } : {}) };
        e.reuniao = true;
        warned = true;
        let n = 0;
        if (v.mkTasks) v.combinados.split('\n').map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).forEach(title => {
          n++;
          S.tasks.push({ id: U.uid(), title, description: `Combinado na reunião “${e.title}” (${U.fmtShort(e.date)}).`, category: 'equipe', priority: 'media', status: 'pendente', createdAt: new Date().toISOString(), startDate: U.today(), dueDate: '', dueTime: '', notes: '', completedAt: null });
        });
        commit();
        UI.toast(n ? `Reunião registrada e ${U.plural(n, 'tarefa criada', 'tarefas criadas')}.` : 'Reunião registrada.');
      },
    });
    m.el.querySelector('form').addEventListener('input', () => { dirty = true; });
    m.el.querySelector('form').addEventListener('change', () => { dirty = true; });
    Events.wireIA(m, e);
  },

  wireIA(m, e) {
    const el = m.el, f = el.querySelector('form');
    const btnIA = el.querySelector('[data-ia]'); if (!btnIA) return;
    const msg = el.querySelector('.ia-msg'), st = el.querySelector('.rec-st'), btnRec = el.querySelector('[data-rec]');
    const liveBox = el.querySelector('.live'), liveTxt = el.querySelector('.live-txt'), liveSt = el.querySelector('.live-st');
    const say = (t, cls = '') => { msg.hidden = !t; msg.className = 'ia-msg small ' + cls; msg.innerHTML = t; };
    const keySave = el.querySelector('[data-ia-save]');
    if (keySave) keySave.onclick = async () => {
      const k = f.elements.iaKey.value.trim();
      if (!k) { say('Cole a chave no campo acima.', 'err'); return; }
      S.settings.ia = { ...(S.settings.ia || {}), key: k }; commit();
      keySave.disabled = true; say('Testando a chave…');
      try { await IA.test(); el.querySelector('.ia-keyrow').remove(); say('Chave salva e funcionando.', 'ok'); }
      catch (err) { S.settings.ia.key = ''; commit(); keySave.disabled = false; say(U.esc(err.message), 'err'); }
    };
    const needKey = () => { if (IA.key()) return false; say('Cole e salve a sua chave da IA no campo acima primeiro.', 'err'); if (f.elements.iaKey) f.elements.iaKey.focus(); return true; };

    // Atualização ao vivo: tempo, transcrição e trechos na fila
    const update = ({ elapsed, text, pending, failed }) => {
      if (elapsed !== null) st.textContent = Recorder.fmt(elapsed);
      liveBox.hidden = false;
      const atEnd = liveTxt.scrollTop + liveTxt.clientHeight >= liveTxt.scrollHeight - 30;
      liveTxt.textContent = text || (Recorder.recording() ? 'A transcrição aparece aqui a cada ~40 segundos.' : '');
      liveTxt.classList.toggle('muted', !text);
      if (atEnd) liveTxt.scrollTop = liveTxt.scrollHeight;
      liveSt.textContent = [pending ? `transcrevendo ${U.plural(pending, 'trecho')}…` : '', failed ? `${U.plural(failed, 'trecho')} sem transcrição (tenta de novo ao encerrar)` : ''].filter(Boolean).join(' · ');
    };

    const fill = async () => {
      const notes = f.elements.iaNotas.value, transcript = Recorder.text();
      if (needKey()) return;
      if (!notes.trim() && !transcript.trim()) { say('Grave a reunião ou escreva algumas anotações primeiro.', 'err'); return; }
      btnIA.disabled = true; btnIA.innerHTML = `<span class="spinner"></span> Preenchendo…`;
      say('A IA está organizando o registro…');
      try {
        const res = await IA.ata(e, { notes, transcript });
        (e.pautas || []).forEach(x => { const c = f.elements['p_' + x.id]; if (c && res.tratadas.includes(x.id)) c.checked = true; });
        const cur = f.elements.combinados.value.trim();
        f.elements.combinados.value = [cur, ...res.combinados.filter(c => !cur.includes(c))].filter(Boolean).join('\n');
        if (res.resumo) f.elements.resumo.value = res.resumo;
        say(`Pronto: ${(e.pautas || []).length ? `${res.tratadas.length} de ${U.plural(e.pautas.length, 'assunto')} da pauta, ` : ''}${U.plural(res.combinados.length, 'combinado')}. Confira e toque em <strong>Salvar registro</strong>.`, 'ok');
        f.elements.combinados.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch (err) { say(U.esc(err.message), 'err'); }
      btnIA.disabled = false; btnIA.innerHTML = `${U.icon('spark', 15)} Preencher com IA`;
    };
    btnIA.onclick = fill;

    if (btnRec) btnRec.onclick = async () => {
      if (Recorder.recording()) {
        btnRec.disabled = true;
        await Recorder.stop();
        btnRec.classList.remove('rec-on'); btnRec.innerHTML = `${U.icon('mic', 16)} Gravar mais`;
        say('Gravação encerrada. Terminando a transcrição…');
        await Recorder.finish();
        btnRec.disabled = false;
        if (Recorder.failed()) say(`${U.plural(Recorder.failed(), 'trecho não pôde', 'trechos não puderam')} ser transcritos (sem internet ou IA sobrecarregada). O restante será usado.`, 'err');
        await fill();
        return;
      }
      if (needKey()) return;
      try {
        await Recorder.start(update);
        btnRec.classList.add('rec-on'); btnRec.innerHTML = `${U.icon('stop', 16)} Encerrar gravação`;
        say(`Gravando. Deixe o celular perto da conversa e ${Native.available() ? 'o app aberto (a tela fica acesa)' : 'esta aba aberta'}. Avise os participantes. Limite: ${Recorder.MAX_MIN} min.`);
      } catch (err) { say('Não foi possível usar o microfone. Permita o acesso ao microfone e tente de novo.', 'err'); }
    };
  },
};

Object.assign(Actions, {
  mShift({ n }) { n = Number(n); App.ui.month = n === 0 ? U.monthKey(U.today()) : U.addMonths(App.ui.month || U.monthKey(U.today()), n); App.render(); },
  mcCheck({ id }, el) {
    const mk = App.ui.month || U.monthKey(U.today());
    const c = S.monthly.checks[mk] = S.monthly.checks[mk] || {};
    if (el.checked) c[id] = true; else delete c[id];
    commit();
  },
  mcEdit({ n }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n));
    UI.form({ title: `Foco da semana ${n} do mês`, fields: [{ name: 'title', label: 'Foco', value: c.title, placeholder: 'Ex.: Diagnóstico, Equipe, Fechamento…', hint: 'Um tema para essa parte do mês. Pode deixar em branco.' }], onSubmit(v) { c.title = v.title; commit(); } });
  },
  mcItemAdd({ n }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n));
    UI.form({ title: `Novo item da semana ${n}`, fields: [{ name: 'text', label: 'Item', required: true, placeholder: 'Ex.: Fechar relatório do mês' }], onSubmit(v) { c.items.push({ id: U.uid(), text: v.text }); commit(); } });
  },
  mcItemEdit({ n, id }) {
    const c = S.monthly.cycles.find(x => x.n === Number(n)); const it = c.items.find(i => i.id === id);
    UI.form({
      title: 'Editar item', fields: [{ name: 'text', label: 'Item', required: true, value: it.text }],
      extra: [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); c.items = c.items.filter(i => i.id !== id); commit(); } }],
      onSubmit(v) { it.text = v.text; commit(); },
    });
  },
  evNew() { Events.form(null); },
  calDay({ k }) {
    const items = Month.itemsOn(k);
    const ag = D.dayBlocks(k);
    const prog = D.progress(k);
    const m = UI.modal({
      title: U.fmtLong(k),
      body: `
        <p class="muted">${D.isWorkday(k) ? `Dia útil, semana ${cycleOf(k)} do mês${S.monthly.cycles[cycleOf(k) - 1]?.title ? ': ' + U.esc(S.monthly.cycles[cycleOf(k) - 1].title) : ''}` : 'Dia não útil'}</p>
        <h4>Prazos e compromissos</h4>
        ${items.length ? `<ul class="list">${items.map(i => `<li class="li"><span class="li-time">${i.time || '—'}</span><span class="li-main"><span class="cal-it-dot t-${i.type}"></span>${U.esc(i.label)}${H.demo(i)}</span><small class="muted">${Month.TYPE[i.type]}${i.done ? (i.type === 'evento' ? ' · registrado' : ' · concluído') : i.late ? ' · <span class="c-red">atrasado</span>' : ''}</small>${i.type === 'evento' ? `<button class="btn sm" data-act="evView" data-id="${i.id}">Abrir</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nada programado.</p>'}
        <h4>Agenda</h4>
        <p>${ag.length ? `${ag.length} atividades · ${prog.pct === null ? '—' : prog.pct + '% concluído'}` : 'Sem atividades na agenda.'}</p>`,
      footer: `<button class="btn ghost" data-go>Abrir agenda do dia</button><span class="grow"></span><button class="btn primary" data-new>${U.icon('plus', 15)} Compromisso</button>`,
    });
    m.el.querySelector('[data-go]').onclick = () => { m.close(); App.ui.agendaDate = k; location.hash = '#agenda'; };
    m.el.querySelector('[data-new]').onclick = () => { m.close(); Events.form(null, k); };
    m.el.addEventListener('click', ev => { if (ev.target.closest('[data-act="evView"]')) m.close(); });
  },
  evEdit({ id }) { Events.form(S.events.find(e => e.id === id)); },
  evView({ id }) { const e = S.events.find(e => e.id === id); if (e) Events.view(e); },
});
