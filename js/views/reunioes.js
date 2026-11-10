'use strict';
/* Reuniões — marcar com pauta, registrar o que foi tratado e combinado (com IA, se quiser) */
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
  title: 'Reuniões', icon: 'users', nav: 'Reuniões',
  render() {
    const reg = Meetings.toRegister(), up = Meetings.upcoming(), done = Meetings.registered();
    const empty = !reg.length && !up.length && !done.length;
    const iaHint = IA.supported() && !IA.ready() ? `<p class="muted small">Dica: com a <a class="link" href="#config" data-act="cfgJump" data-id="ia">IA ativada</a>, ela preenche o registro a partir da gravação ou das suas anotações.</p>` : '';
    return `
    <div class="toolbar">
      <p class="plan-intro-p">Marque a reunião com a <strong>pauta</strong>. Na hora, toque em <strong>Iniciar</strong> para gravar com transcrição ao vivo; no fim, a IA preenche o que foi combinado.</p>
      <button class="btn primary" data-act="mtNew">${U.icon('plus')} Nova reunião</button>
    </div>
    ${empty ? `<div class="card mt-empty">
        <h3>Como funciona</h3>
        <ol class="mt-steps">
          <li><strong>Nova reunião</strong>: dia, horário e a pauta, um assunto por linha.</li>
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
});
