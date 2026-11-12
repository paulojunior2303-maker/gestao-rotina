'use strict';
/* Feedbacks individuais da equipe: gravar a conversa (transcrição ao vivo), a IA escreve o registro no padrão
   do agente (/feedback), acordos viram tarefas com o colaborador como responsável. Histórico por pessoa. */
const FB = {
  TOM_COLOR: { positivo: '#3dbe8b', neutro: '#8e87a3', melhorar: '#e3a043' },
  TIPO_COLOR: { feedback: '#9461f5', orientacao: '#e3a043', advertencia: '#ee5a6f' },
  list() { return S.feedbacks || (S.feedbacks = []); },
  initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); },
  chips(f) { return `${H.chip(IA.TONS[f.tom] || 'Neutro', this.TOM_COLOR[f.tom] || '#8e87a3')}${f.tipo && f.tipo !== 'feedback' ? H.chip(IA.TIPOS[f.tipo], this.TIPO_COLOR[f.tipo]) : ''}${f.transcricao ? `<span class="muted" title="Conversa gravada">${U.icon('mic', 13)}</span>` : ''}`; },
  card(f, showName) {
    const first = (f.resumo || f.notas || '').split('\n').find(l => l.trim()) || 'Sem texto';
    return `<div class="fb-card" role="button" tabindex="0" data-act="fbView" data-id="${f.id}">
      <div class="fb-card-h">${showName ? `<strong>${U.esc(f.pessoa)}</strong>` : ''}<span class="muted small">${U.fmtDate(f.date)}</span>${this.chips(f)}</div>
      <p class="fb-card-t">${U.esc(first)}</p></div>`;
  },
};

Object.assign(FB, {
  form(f, pessoa) {
    const isNew = !f;
    const r = f || { pessoa: pessoa || '', date: U.today(), tipo: 'feedback', tom: 'neutro', notas: '', resumo: '', acordos: '' };
    let dirty = false, warned = false;
    Recorder.reset();
    const iaBox = !IA.supported() ? '' : `<div class="ia-box">
        <div class="ia-h">${U.icon('spark', 17)}<strong>Gravar e transcrever ao vivo</strong></div>
        ${IAUI.keyRow()}${IAUI.recHtml()}
        <textarea name="iaNotas" rows="2" placeholder="Anotações suas (opcional). Dá para ditar pelo microfone do teclado.">${U.esc(r.notas || '')}</textarea>
        <div class="ia-actions"><span class="muted small grow">Avise o colaborador antes de gravar.</span><button type="button" class="btn sm" data-ia>${U.icon('spark', 15)} Gerar registro com IA</button></div>
        <p class="ia-msg small" hidden></p>
      </div>`;
    const m = UI.form({
      title: isNew ? 'Novo feedback' : 'Editar feedback',
      submitLabel: 'Salvar feedback',
      canClose: () => {
        if (Recorder.recording()) { UI.toast('A gravação está em andamento. Toque em “Encerrar gravação” antes de sair.', 'warn'); return false; }
        if ((Recorder.text() || dirty) && !warned) { warned = true; UI.toast('O feedback ainda não foi salvo. Toque de novo para sair sem salvar.', 'warn'); return false; }
        return true;
      },
      onClose: () => { if (Recorder.recording()) Recorder.stop(); Recorder.reset(); },
      fields: [
        { name: 'pessoa', label: 'Colaborador', required: true, value: r.pessoa, list: D.techNames(), placeholder: 'Nome do colaborador' },
        { name: 'date', label: 'Data', type: 'date', required: true, value: r.date, half: true },
        { name: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(IA.TIPOS), value: r.tipo, half: true },
        { name: 'tom', label: 'Tom', type: 'radio', options: Object.entries(IA.TONS), value: r.tom },
        { type: 'html', html: iaBox },
        { name: 'resumo', label: 'Registro do feedback', type: 'textarea', rows: 9, value: r.resumo, placeholder: 'A IA escreve aqui no padrão do seu agente ao encerrar a gravação. Você também pode escrever.' },
        ...(IA.supported() ? [{ type: 'html', html: IAUI.toolsHtml() }] : []),
        { name: 'acordos', label: 'Acordos e próximos passos', type: 'textarea', rows: 3, value: r.acordos, placeholder: 'Um por linha' },
        { name: 'mkTasks', label: 'Criar uma tarefa para cada acordo (responsável: o colaborador)', type: 'checkbox', value: false },
      ],
      onSubmit(v) {
        if (Recorder.recording()) return 'Encerre a gravação antes de salvar.';
        const tx = Recorder.text() || (f && f.transcricao) || '';
        const data = { pessoa: v.pessoa, date: v.date, tipo: v.tipo || 'feedback', tom: v.tom || 'neutro', notas: m.el.querySelector('[name=iaNotas]') ? m.el.querySelector('[name=iaNotas]').value.trim() : (r.notas || ''), resumo: v.resumo, acordos: v.acordos, ...(tx ? { transcricao: tx.slice(0, 30000) } : {}) };
        if (isNew) FB.list().push({ id: U.uid(), createdAt: new Date().toISOString(), ...data }); else Object.assign(f, data);
        if (!S.settings.technicians.some(t => t.name.toLowerCase() === v.pessoa.toLowerCase())) S.settings.technicians.push({ id: U.uid(), name: v.pessoa });
        let n = 0;
        if (v.mkTasks) v.acordos.split('\n').map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).forEach(title => {
          n++;
          S.tasks.push({ id: U.uid(), title, description: `Acordo do feedback com ${v.pessoa} (${U.fmtShort(v.date)}).`, category: 'equipe', priority: 'media', status: 'pendente', responsible: v.pessoa, createdAt: new Date().toISOString(), startDate: U.today(), dueDate: '', dueTime: '', notes: '', completedAt: null });
        });
        warned = true;
        if (App.route === 'equipe' && !App.ui.pessoa) App.ui.pessoa = v.pessoa;
        commit();
        UI.toast(n ? `Feedback salvo e ${U.plural(n, 'tarefa criada', 'tarefas criadas')}.` : 'Feedback salvo.');
      },
    });
    const el = m.el, fm = el.querySelector('form');
    fm.addEventListener('input', () => { dirty = true; });
    fm.addEventListener('change', () => { dirty = true; });
    const btnIA = el.querySelector('[data-ia]'); if (!btnIA) return;
    const fill = async () => {
      const notes = fm.elements.iaNotas.value, transcript = Recorder.text() || (f && f.transcricao) || '';
      if (needKey()) return;
      if (!fm.elements.pessoa.value.trim()) { say('Escreva o nome do colaborador primeiro.', 'err'); fm.elements.pessoa.focus(); return; }
      if (!notes.trim() && !transcript.trim()) { say('Grave a conversa ou escreva algumas anotações primeiro.', 'err'); return; }
      btnIA.disabled = true; btnIA.innerHTML = '<span class="spinner"></span> Escrevendo…';
      say('A IA está escrevendo o registro no padrão do seu agente…');
      const tom = (fm.querySelector('[name=tom]:checked') || {}).value || 'neutro';
      try {
        const res = await IA.feedback({ nome: fm.elements.pessoa.value.trim(), tipo: fm.elements.tipo.value, tom, date: fm.elements.date.value, notes, transcript });
        fm.elements.resumo.value = res.resumo;
        const cur = fm.elements.acordos.value.trim();
        fm.elements.acordos.value = [cur, ...res.acordos.filter(a => !cur.includes(a))].filter(Boolean).join('\n');
        dirty = true;
        say(`Pronto: registro escrito${res.acordos.length ? ` e ${U.plural(res.acordos.length, 'acordo')}` : ''}. Confira e toque em <strong>Salvar feedback</strong>.`, 'ok');
        fm.elements.resumo.scrollIntoView({ block: 'start', behavior: 'smooth' });
      } catch (err) { say(U.esc(err.message), 'err'); }
      btnIA.disabled = false; btnIA.innerHTML = `${U.icon('spark', 15)} Gerar registro com IA`;
    };
    const { say, needKey } = IAUI.wire(el, { onStop: fill });
    btnIA.onclick = fill;
    IAUI.wireTools(el, 'resumo', () => `Feedback: ${fm.elements.pessoa.value}`, { say, needKey, onChange: () => { dirty = true; }, source: () => Recorder.text() || (f && f.transcricao) || '' });
  },

  view(f) {
    const m = UI.modal({
      title: f.pessoa,
      body: `<p class="muted">${U.fmtLong(f.date)}</p><div class="fb-chips">${FB.chips(f)}</div>
        ${f.resumo ? `<div class="ata-doc"><p class="ata pre">${U.esc(f.resumo)}</p><div class="row-actions wrap"><button class="btn sm" data-copy>${U.icon('check', 14)} Copiar</button><button class="btn sm" data-share>${U.icon('upload', 14)} Compartilhar</button></div></div>` : '<p class="muted">Sem registro escrito.</p>'}
        ${f.acordos ? `<h4>Acordos</h4><p class="ata pre">${U.esc(f.acordos)}</p>` : ''}
        ${f.notas ? `<h4>Anotações</h4><p class="pre small">${U.esc(f.notas)}</p>` : ''}
        ${f.transcricao ? `<details class="tx"><summary>Ver transcrição</summary><p class="ata pre small">${U.esc(f.transcricao)}</p></details>` : ''}`,
      footer: `<button class="btn ghost danger-text" data-del>${U.icon('trash', 15)} Excluir</button><span class="grow"></span><button class="btn primary" data-ed>${U.icon('edit', 15)} Editar</button>`,
    });
    m.el.querySelector('[data-ed]').onclick = () => { m.close(); FB.form(f); };
    m.el.querySelector('[data-del]').onclick = () => { m.close(); UI.confirm(`Excluir o feedback de <strong>${U.esc(f.pessoa)}</strong> (${U.fmtShort(f.date)})?`, () => { S.feedbacks = FB.list().filter(x => x.id !== f.id); commit(); UI.toast('Feedback excluído.'); }, { danger: true, okLabel: 'Excluir' }); };
    const cp = m.el.querySelector('[data-copy]'); if (cp) cp.onclick = () => Events.copy(f.resumo);
    const sh = m.el.querySelector('[data-share]'); if (sh) sh.onclick = () => Events.share(f.resumo, `Feedback: ${f.pessoa}`);
  },
});

Object.assign(Actions, {
  fbNew({ n }) { FB.form(null, n || App.ui.pessoa || ''); },
  fbView({ id }) { const f = FB.list().find(x => x.id === id); if (f) FB.view(f); },
});
