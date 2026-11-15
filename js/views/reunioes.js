'use strict';
/* Reuniões: ajudas usadas pelo calendário e pelos formulários (Events, em mensal.js).
   As reuniões gravadas ficam em Gravações (js/gravador.js). */
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


Object.assign(Actions, {
  mtStart({ id }) { const e = S.events.find(x => x.id === id); if (e) Events.register(e); },
  mtNew() { Events.form(null, U.today(), { reuniao: true }); },
});
