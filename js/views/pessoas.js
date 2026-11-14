'use strict';
/* Pessoas: uma ficha por pessoa da equipe com tudo o que está com ela (tarefas e imprevistos),
   quando foi o último feedback, e um botão para cobrar pelo WhatsApp com a lista pronta.
   Tudo calculado dos dados que já existem; o telefone (opcional) fica em settings.technicians[].phone. */
const Pessoas = {
  FB_DIAS: 30,   // depois disso, avisa que está sem feedback
  of(name) {
    const t = U.today();
    const tasks = S.tasks.filter(x => OPEN(x.status) && x.responsible === name)
      .sort((a, b) => (D.taskLate(b) - D.taskLate(a)) || (a.dueDate || '9').localeCompare(b.dueDate || '9'));
    const occ = S.occurrences.filter(o => OPEN(o.status) && o.responsible === name);
    const fbs = FB.list().filter(f => f.pessoa === name).sort((a, b) => b.date.localeCompare(a.date));
    const last = fbs[0] || null;
    const fbDias = last ? U.diffDays(last.date, t) : null;
    const late = tasks.filter(D.taskLate).length + occ.filter(D.occLate).length;
    const doneWeek = S.tasks.filter(x => x.responsible === name && x.completedAt && U.diffDays(x.completedAt.slice(0, 10), t) <= 7).length;
    return { name, tasks, occ, last, fbDias, late, doneWeek, semFb: fbDias === null || fbDias > Pessoas.FB_DIAS };
  },
  tech(name) { return S.settings.technicians.find(x => x.name === name); },
  /* Mensagem de cobrança pronta (texto simples, para WhatsApp) */
  mensagem(name) {
    const p = Pessoas.of(name), first = name.split(' ')[0];
    const linha = (title, due, time) => `• ${title}${due ? ` (prazo ${U.fmtShort(due)}${time ? ' ' + time : ''}${due < U.today() ? ', atrasada' : ''})` : ''}`;
    const itens = [...p.occ.map(o => linha(o.title, o.dueDate, o.dueTime)), ...p.tasks.map(x => linha(x.title, x.dueDate, x.dueTime))];
    if (!itens.length) return `Oi, ${first}! Tudo certo por aí? Nada pendente comigo no momento.`;
    return `Oi, ${first}! Tudo bem? Passando para ver como estão:\n${itens.join('\n')}\n\nMe dá um retorno de cada um quando puder. Obrigado!`;
  },
  waLink(name, txt) {
    const ph = ((Pessoas.tech(name) || {}).phone || '').replace(/\D/g, '');
    const num = ph ? (ph.length <= 11 ? '55' + ph : ph) : '';
    return `https://wa.me/${num}?text=${encodeURIComponent(txt)}`;
  },
  fbTxt(p) { return p.fbDias === null ? 'Nunca teve feedback registrado' : p.fbDias === 0 ? 'Feedback hoje' : `Último feedback há ${U.plural(p.fbDias, 'dia')}`; },
};

Views.pessoas = {
  title: 'Pessoas', icon: 'user', nav: 'Pessoas',
  fab: () => App.ui.pWho ? { act: 'pTask', label: 'Passar tarefa', data: { n: App.ui.pWho } } : null,
  render() {
    const who = App.ui.pWho;
    if (who && D.techNames().includes(who)) return this.ficha(who);
    App.ui.pWho = null;
    const people = D.techNames().map(Pessoas.of)
      .sort((a, b) => (b.late - a.late) || ((b.tasks.length + b.occ.length) - (a.tasks.length + a.occ.length)) || a.name.localeCompare(b.name));
    if (!people.length) return H.empty('Ninguém da equipe cadastrado ainda.', '<a class="btn sm" href="#config">Cadastrar a equipe</a>');
    const semFb = people.filter(p => p.semFb).length;
    return `
      <p class="muted small">Tudo o que está com cada pessoa: tarefas e imprevistos em que ela é a responsável, e o último feedback.</p>
      ${semFb ? `<div class="alert a-yellow">${U.icon('chat')} <span>${U.plural(semFb, 'pessoa está', 'pessoas estão')} há mais de ${Pessoas.FB_DIAS} dias sem feedback.</span></div>` : ''}
      <div class="ps-grid">${people.map(p => `
        <button class="ps-card card" data-act="pOpen" data-n="${U.esc(p.name)}">
          <span class="ps-av">${FB.initials(p.name)}</span>
          <span class="ps-main"><strong>${U.esc(p.name)}</strong>
            <small>${p.tasks.length + p.occ.length ? `${U.plural(p.tasks.length + p.occ.length, 'pendência', 'pendências')}` : 'Nada pendente'}${p.late ? ` · <span class="c-red">${p.late} atrasada${p.late > 1 ? 's' : ''}</span>` : ''}</small>
            <small class="${p.semFb ? 'c-yellow' : 'muted'}">${Pessoas.fbTxt(p)}</small></span>
          ${U.icon('right', 16)}
        </button>`).join('')}</div>`;
  },
  ficha(name) {
    const p = Pessoas.of(name), tech = Pessoas.tech(name) || {};
    const txt = Pessoas.mensagem(name);
    const row = (k, x) => {
      const dl = D.deadline(x.dueDate, x.dueTime, false);
      return `<li class="li hj-li"><span class="li-main">${k === 'occ' ? H.chip('Imprevisto', '#ee5a6f') : H.prio(x.priority)} <span>${U.esc(x.title)}</span></span>
        <span class="li-side">${H.deadline(dl)}</span>
        ${k === 'occ' ? `<button class="icon-btn ok" data-act="occStatus" data-id="${x.id}" data-s="concluida" title="Resolvido" aria-label="Resolvido">${U.icon('check', 16)}</button>`
          : `<button class="icon-btn ok" data-act="tkSet" data-id="${x.id}" data-s="concluida" title="Concluída" aria-label="Concluída">${U.icon('check', 16)}</button>`}</li>`;
    };
    return `
      <div class="ps-head">
        <button class="icon-btn" data-act="pBack" aria-label="Voltar">${U.icon('left', 18)}</button>
        <span class="ps-av lg">${FB.initials(name)}</span>
        <div><h2>${U.esc(name)}</h2><small class="muted">${p.doneWeek ? `${U.plural(p.doneWeek, 'tarefa concluída', 'tarefas concluídas')} nos últimos 7 dias` : 'Nenhuma tarefa concluída nos últimos 7 dias'}</small></div>
      </div>
      <div class="ps-acts">
        <a class="btn primary" target="_blank" rel="noopener" href="${Pessoas.waLink(name, txt)}" data-wa>${U.icon('chat', 16)} Cobrar no WhatsApp</a>
        <button class="btn ghost" data-act="pCopy" data-n="${U.esc(name)}">${U.icon('download', 15)} Copiar</button>
        <button class="btn ghost" data-act="pFeedback" data-n="${U.esc(name)}">${U.icon('chat', 15)} Feedback</button>
      </div>
      <div class="card">
        <div class="card-h"><h3>${U.icon('tasks')} Com ${U.esc(name.split(' ')[0])} (${p.tasks.length + p.occ.length})</h3></div>
        ${p.tasks.length + p.occ.length ? `<ul class="list">${p.occ.map(o => row('occ', o)).join('')}${p.tasks.map(x => row('task', x)).join('')}</ul>` : H.empty('Nada pendente com essa pessoa.')}
      </div>
      <div class="card">
        <div class="card-h"><h3>${U.icon('chat')} Feedback</h3><button class="link" data-act="pHist" data-n="${U.esc(name)}">Histórico</button></div>
        <p class="${p.semFb ? 'c-yellow' : ''}">${Pessoas.fbTxt(p)}${p.last ? ` (${U.fmtDate(p.last.date)})` : ''}.</p>
        ${p.semFb ? `<p class="muted small">Uma conversa curta já ajuda. Toque em <strong>Feedback</strong> acima.</p>` : ''}
      </div>
      <div class="card">
        <div class="card-h"><h3>${U.icon('chat')} Mensagem de cobrança</h3></div>
        <pre class="ps-msg">${U.esc(txt)}</pre>
        <label class="cap-l" for="ps-phone">WhatsApp de ${U.esc(name.split(' ')[0])} (opcional, com DDD)</label>
        <input id="ps-phone" class="cap-in" inputmode="tel" value="${U.esc(tech.phone || '')}" placeholder="Ex.: 11 98765-4321" data-change="pPhone" data-n="${U.esc(name)}">
        <small class="hint">Sem número, o WhatsApp pede para você escolher o contato.</small>
      </div>`;
  },
};

Object.assign(Actions, {
  pOpen({ n }) { App.ui.pWho = n; App.render(); window.scrollTo(0, 0); },
  pBack() { App.ui.pWho = null; App.render(); },
  pTask({ n }) { Tasks.form(null, { responsible: n }); },
  pFeedback({ n }) { FB.form(null, n); },
  pHist({ n }) { App.ui.mtTab = 'feedbacks'; App.ui.fbWho = n; location.hash = '#reunioes'; },
  pPhone({ n }, el) { const t = Pessoas.tech(n); if (!t) return; t.phone = el.value.trim(); commit(); UI.toast('Número salvo.'); },
  async pCopy({ n }) {
    const txt = Pessoas.mensagem(n);
    try { await navigator.clipboard.writeText(txt); UI.toast('Mensagem copiada.'); } catch (e) { UI.toast('Não foi possível copiar. Selecione o texto da mensagem.', 'warn'); }
  },
});
