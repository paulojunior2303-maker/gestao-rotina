'use strict';
/* Reuniões e feedbacks — conversas com pessoas num lugar só.
   Aba Reuniões: marcar com pauta, gravar, registrar o que foi combinado (com IA, se quiser).
   Aba Feedbacks: conversas individuais com cada colaborador (FBPage, em feedbacks.js). */
const Meetings = {
  isMeeting: e => !!(e.reuniao || (e.pautas || []).length),
  passed(e) { const t = U.today(); return e.date < t || (e.date === t && (!e.time || U.toMin(e.time) <= U.nowMin())); },
  toRegister() { const from = U.addDays(U.today(), -30); return S.events.filter(e => Meetings.isMeeting(e) && !e.registro && e.date >= from && Meetings.passed(e)).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))); },
  upcoming() { return S.events.filter(e => !Meetings.passed(e)).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'))); },
  registered() { return S.events.filter(e => e.registro).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).slice(0, 20); },
  card(e, side) {
    const d = U.parse(e.date), n = (e.pautas || []).length;
    const when = e.date === U.today() ? 'Hoje' : e.date === U.addDays(U.today(), 1) ? 'Amanhã' : U.WD_SHORT[d.getDay()];
    return `<div class="mt-card" role="button" tabindex="0" data-act="evView" data-id="${e.id}">
      <span class="mt-date"><strong>${d.getDate()}</strong><small>${U.MONTHS[d.getMonth()].slice(0, 3).toLowerCase()}</small></span>
      <span class="mt-body"><span class="mt-title">${U.esc(e.title)}${H.demo(e)}</span>
        <span class="mt-meta">${when}${e.time ? `, ${e.time}` : ''}${n ? ` · ${U.plural(n, 'assunto')} na pauta` : Meetings.isMeeting(e) ? ' · sem pauta' : ' · compromisso'}</span></span>
      ${side || U.icon('right', 16)}</div>`;
  },
};

Views.reunioes = {
  title: 'Reuniões e feedbacks', icon: 'users', nav: 'Reuniões e feedbacks',
  fab: () => App.ui.mtTab === 'feedbacks'
    ? { act: 'fbNew', label: 'Novo feedback', data: App.ui.fbWho ? { n: App.ui.fbWho } : {} }
    : { act: 'mtNew', label: 'Nova reunião' },
  render() {
    const tab = App.ui.mtTab === 'feedbacks' ? 'feedbacks' : 'reunioes';
    const nMt = Meetings.toRegister().length + Meetings.upcoming().filter(Meetings.isMeeting).length, nFb = FB.list().length;
    const tabs = `<div class="tabs mt-tabs" role="tablist">${[['reunioes', 'Reuniões', nMt], ['feedbacks', 'Feedbacks', nFb]].map(([v, l, n]) => `<button class="tab ${tab === v ? 'active' : ''}" role="tab" aria-selected="${tab === v}" data-act="mtTab" data-v="${v}">${l}${n ? ` <span class="tab-n">${n}</span>` : ''}</button>`).join('')}</div>`;
    return tabs + (tab === 'feedbacks' ? FBPage.render() : this.meetings());
  },
  meetings() {
    const reg = Meetings.toRegister(), up = Meetings.upcoming(), done = Meetings.registered();
    const empty = !reg.length && !up.length && !done.length;
    const iaHint = IA.supported() && !IA.ready() ? `<p class="muted small">Dica: com a <a class="link" href="#config" data-act="cfgJump" data-id="ia">IA ativada</a>, ela preenche o registro a partir da gravação ou das suas anotações.</p>` : '';
    return `
    ${empty ? `<div class="card mt-empty">
        <h3>Como funciona</h3>
        <ol class="mt-steps">
          <li>Toque em <strong>+</strong>: dia, horário e a pauta, um assunto por linha.</li>
          <li>Na hora, ${Reminders.on() ? 'o app avisa e ' : ''}você toca em <strong>Iniciar</strong> e depois em <strong>Iniciar gravação</strong>. A transcrição aparece na tela enquanto a reunião acontece, e você marca a pauta conforme os assuntos são tratados.</li>
          <li>No fim, toque em <strong>Encerrar gravação</strong>: a IA preenche os combinados e um resumo. Confira e salve. Cada combinado pode virar uma tarefa.</li>
        </ol>
        ${iaHint}
      </div>` : ''}
    ${reg.length ? `<section class="mt-sec"><h3 class="mt-h">Para registrar <span class="badge b-yellow">${reg.length}</span></h3>
      <div class="mt-list">${reg.map(e => Meetings.card(e, '<span class="btn sm primary">Registrar</span>')).join('')}</div>${empty ? '' : iaHint}</section>` : ''}
    ${up.length ? `<section class="mt-sec"><h3 class="mt-h">Próximas</h3><div class="mt-list">${up.slice(0, 30).map(e => Meetings.card(e, e.date === U.today() ? `<button class="btn sm primary" data-act="mtStart" data-id="${e.id}">${U.icon('mic', 14)} Iniciar</button>` : '')).join('')}</div></section>` : ''}
    ${done.length ? `<section class="mt-sec"><h3 class="mt-h">Registradas</h3><div class="mt-list">${done.map(e => Meetings.card(e, `<span class="badge b-green">${(e.pautas || []).length ? `${e.registro.tratadas.length}/${e.pautas.length} tratados` : 'Registrada'}</span>`)).join('')}</div></section>` : ''}`;
  },
};

Object.assign(Actions, {
  mtStart({ id }) { const e = S.events.find(x => x.id === id); if (e) Events.register(e); },
  mtNew() { Events.form(null, U.today(), { reuniao: true }); },
  mtTab({ v }) { App.ui.mtTab = v; if (v !== 'feedbacks') App.ui.fbWho = null; App.render({ resetScroll: true }); },
});
