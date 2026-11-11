'use strict';
/* Compromissos e reuniões (S.events): formulário, visualização, registro com IA */
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
    const pend = Events.pendencias(e.id);
    const pautaIA = IA.supported() ? `<div class="pauta-ia"><span class="lbl">${U.icon('spark', 15)} Gerar pauta com IA</span>
      <div class="inline-add"><input name="pautaTema" placeholder="Sobre o que é a reunião? Ex.: escala de fim de ano, metas do mês, novo colaborador"><button type="button" class="btn sm primary" data-pauta-ia>Gerar</button></div>
      ${pend.length ? `<label class="check small"><input type="checkbox" name="pautaPend" checked> <span>Incluir ${U.plural(pend.length, 'assunto pendente', 'assuntos pendentes')} das últimas reuniões</span></label>` : ''}</div>` : '';
    const m = UI.form({
      title: isNew ? (meet ? 'Nova reunião' : 'Novo compromisso') : `Editar ${noun}`,
      fields: [
        { name: 'title', label: meet ? 'Reunião' : 'Compromisso', required: true, value: e.title, placeholder: meet ? 'Ex.: Alinhamento semanal da equipe' : 'Ex.: Visita ao cliente' },
        { name: 'date', label: 'Data', type: 'date', required: true, value: e.date, half: true },
        { name: 'time', label: 'Horário', type: 'time', value: e.time, half: true },
        ...(meet && pautaIA ? [{ type: 'html', html: pautaIA }] : []),
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
    const gen = m.el.querySelector('[data-pauta-ia]');
    if (gen) gen.onclick = async () => {
      const f = m.el.querySelector('form'), tema = f.elements.pautaTema.value.trim();
      const usePend = f.elements.pautaPend ? f.elements.pautaPend.checked : false;
      if (!tema && !usePend) { UI.toast('Escreva o tema da reunião.', 'warn'); f.elements.pautaTema.focus(); return; }
      if (!IA.key()) { UI.toast('Cole a sua chave da IA em Configurações → IA.', 'warn'); return; }
      gen.disabled = true; gen.innerHTML = '<span class="spinner"></span>';
      try {
        const itens = await IA.pauta({ title: f.elements.title.value, tema: tema || 'Retomar os assuntos pendentes.', pendencias: usePend ? pend : [] });
        const cur = f.elements.pauta.value.split('\n').map(x => x.trim()).filter(Boolean);
        f.elements.pauta.value = [...cur, ...itens.filter(i => !cur.includes(i))].join('\n');
        UI.toast(`Pauta com ${U.plural(itens.length, 'assunto')}. Ajuste à vontade.`);
      } catch (err) { UI.toast(U.esc(err.message), 'error'); }
      gen.disabled = false; gen.textContent = 'Gerar';
    };
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
          ${r.ata || r.resumo ? `<div class="ata-doc"><p class="ata pre">${U.esc(r.ata || r.resumo)}</p><div class="row-actions wrap"><button class="btn sm" data-copy>${U.icon('check', 14)} Copiar ata</button><button class="btn sm" data-share>${U.icon('upload', 14)} Compartilhar</button></div></div>` : ''}
          <h4>Combinados</h4>${r.combinados ? `<p class="ata pre">${U.esc(r.combinados)}</p>` : '<p class="muted">Nada anotado como combinado.</p>'}
          ${r.transcricao ? `<details class="tx"><summary>Ver transcrição</summary><p class="ata pre small">${U.esc(r.transcricao)}</p></details>` : ''}`
          : `<p class="muted small mt">${Meetings.passed(e) ? 'Toque em <strong>Registrar reunião</strong> para marcar o que foi tratado e anotar os combinados.' : 'Na hora da reunião, toque em <strong>Iniciar reunião</strong>: grave e acompanhe a transcrição ao vivo, marque a pauta e, no fim, a IA preenche os combinados.'}</p>`}`,
      footer: `<button class="btn ghost" data-ed>${U.icon('edit', 15)} Editar</button><span class="grow"></span><button class="btn ${meet || r ? 'primary' : ''}" data-reg>${r ? `${U.icon('edit', 15)} Editar registro` : Meetings.passed(e) ? `${U.icon('check', 15)} Registrar reunião` : `${U.icon('mic', 15)} Iniciar reunião`}</button>`,
    });
    m.el.querySelector('[data-ed]').onclick = () => { m.close(); Events.form(e); };
    const reg = m.el.querySelector('[data-reg]'); if (reg) reg.onclick = () => { m.close(); Events.register(e); };
    const txt = r && (r.ata || r.resumo);
    const cp = m.el.querySelector('[data-copy]'); if (cp) cp.onclick = () => Events.copy(txt);
    const sh = m.el.querySelector('[data-share]'); if (sh) sh.onclick = () => Events.share(txt, `Ata: ${e.title}`);
  },

  async copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (err) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    UI.toast('Ata copiada.');
  },
  async share(text, title) {
    try {
      if (Native.available()) { await Native.P().Share.share({ title, text, dialogTitle: 'Compartilhar ata' }); return; }
      if (navigator.share) { await navigator.share({ title, text }); return; }
    } catch (err) { if (/cancel|abort/i.test(String(err && (err.message || err.name)))) return; }
    Events.copy(text);
  },

  /* Assuntos pendentes: itens de pauta não tratados nas últimas reuniões registradas */
  pendencias(exceptId) {
    return S.events.filter(x => x.registro && x.id !== exceptId && x.date >= U.addDays(U.today(), -60))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2)
      .flatMap(x => (x.pautas || []).filter(p => !x.registro.tratadas.includes(p.id)).map(p => p.text));
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
        { name: 'ata', label: 'Ata da reunião', type: 'textarea', rows: 10, value: r.ata || r.resumo || '', placeholder: 'A IA escreve a ata no padrão do seu agente ao encerrar a gravação. Você também pode escrever aqui.' },
        ...(IA.supported() ? [{ type: 'html', html: `<div class="ata-tools"><span class="muted small">Ajustar a ata:</span><button type="button" class="btn sm" data-rw="natural">Natural</button><button type="button" class="btn sm" data-rw="compact">Compactar</button><button type="button" class="btn sm" data-rw="detalhado">Detalhar</button><button type="button" class="btn sm ghost" data-rw-copy>${U.icon('check', 14)} Copiar</button><button type="button" class="btn sm ghost" data-rw-share>${U.icon('upload', 14)} Compartilhar</button></div>` }] : []),
        { name: 'combinados', label: 'Combinados (viram tarefas, se quiser)', type: 'textarea', rows: 4, value: r.combinados, placeholder: 'Um combinado por linha. Ex.: Carlos envia o relatório até sexta' },
        { name: 'mkTasks', label: 'Criar uma tarefa para cada combinado', type: 'checkbox', value: false, hint: 'As tarefas entram em Tarefas, com o nome da reunião na descrição. Ajuste prazo e responsável depois.' },
      ],
      onSubmit(v) {
        if (Recorder.recording()) return 'Encerre a gravação antes de salvar.';
        const tx = Recorder.text() || r.transcricao || '';
        e.registro = { at: new Date().toISOString(), tratadas: pautas.filter(x => v['p_' + x.id]).map(x => x.id), combinados: v.combinados, ata: v.ata, ...(tx ? { transcricao: tx.slice(0, 30000) } : {}) };
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
    Events.wireIA(m, e, () => { dirty = true; });
  },

  wireIA(m, e, markDirty = () => {}) {
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
        const res = await IA.ata(e, { notes, transcript }); markDirty();
        (e.pautas || []).forEach(x => { const c = f.elements['p_' + x.id]; if (c && res.tratadas.includes(x.id)) c.checked = true; });
        const cur = f.elements.combinados.value.trim();
        f.elements.combinados.value = [cur, ...res.combinados.filter(c => !cur.includes(c))].filter(Boolean).join('\n');
        if (res.ata) f.elements.ata.value = res.ata;
        say(`Pronto: ${(e.pautas || []).length ? `${res.tratadas.length} de ${U.plural(e.pautas.length, 'assunto')} da pauta, ` : ''}${U.plural(res.combinados.length, 'combinado')}. Confira e toque em <strong>Salvar registro</strong>.`, 'ok');
        f.elements.ata.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (err) { say(U.esc(err.message), 'err'); }
      btnIA.disabled = false; btnIA.innerHTML = `${U.icon('spark', 15)} Preencher com IA`;
    };
    btnIA.onclick = fill;

    // Comandos rápidos do agente sobre a ata (/natural, /compact, /detalhado)
    el.querySelectorAll('[data-rw]').forEach(b => b.onclick = async () => {
      const text = f.elements.ata.value.trim();
      if (!text) { say('Gere ou escreva a ata primeiro.', 'err'); return; }
      if (needKey()) return;
      const lbl = b.innerHTML; el.querySelectorAll('[data-rw]').forEach(x => { x.disabled = true; });
      b.innerHTML = '<span class="spinner"></span>';
      try { f.elements.ata.value = (await IA.rewrite(text, b.dataset.rw, Recorder.text() || (e.registro && e.registro.transcricao) || '')).trim(); markDirty(); UI.toast('Ata ajustada.'); }
      catch (err) { UI.toast(U.esc(err.message), 'error'); }
      b.innerHTML = lbl; el.querySelectorAll('[data-rw]').forEach(x => { x.disabled = false; });
    });
    const rc = el.querySelector('[data-rw-copy]'); if (rc) rc.onclick = () => { const t = f.elements.ata.value.trim(); if (t) Events.copy(t); };
    const rs = el.querySelector('[data-rw-share]'); if (rs) rs.onclick = () => { const t = f.elements.ata.value.trim(); if (t) Events.share(t, `Ata: ${e.title}`); };

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
  evNew() { Events.form(null); },
  evEdit({ id }) { Events.form(S.events.find(e => e.id === id)); },
  evView({ id }) { const e = S.events.find(e => e.id === id); if (e) Events.view(e); },
});
