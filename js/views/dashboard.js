'use strict';
/* Início: calendário do mês, com o relatório do dia e as gravações que pedem atenção */
Views.dashboard = {
  title: 'Início', icon: 'dashboard', nav: 'Início',
  fab: () => ({ act: 'quickAdd', label: 'Adicionar', data: { k: Cal.st('home').sel, from: 'home' } }),
  /* Topo da tela inicial: saudação e data no lugar do título (o relógio fica à direita) */
  hero() {
    const h = new Date().getHours(), t = U.today(), d = U.parse(t);
    const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return `<span class="th-greet">${greet}</span><span class="th-date">${U.WD[U.weekday(t)].replace('-feira', '')}, ${d.getDate()} de ${U.MONTHS[d.getMonth()].toLowerCase()}</span>`;
  },
  renderEnxuto() {
    const rec = Gravador.recording();
    const atencao = Gravador.list().filter(g => g.status !== 'gravando' && (!g.tipo || g.status === 'pendente')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
    return `
    ${Updater.banner()}
    <button class="gv-rec-big ${rec ? 'on' : ''}" data-act="${rec ? 'gvTela' : 'gvRec'}">
      <span class="gv-rec-ic">${U.icon(rec ? 'stop' : 'mic', 26)}</span>
      <span><strong>${rec ? 'Gravando… toque para abrir' : 'Gravar reunião ou feedback'}</strong><small>${rec ? 'A gravação continua enquanto você usa o app' : 'Um toque para começar. Você descreve depois.'}</small></span>
    </button>
    ${!rec && D.isWorkday(U.today()) && U.nowMin() >= U.toMin(S.settings.workEnd) - 90 && !Gravador.list().some(g => g.tipo === 'relatorio' && g.date === U.today())
      ? `<button class="gv-rel-btn" data-act="gvRec" data-tipo="relatorio">${U.icon('spark', 20)}<span><strong>Gravar o relatório do dia</strong><small>Fim do expediente: fale o que fez e o que vem amanhã.</small></span>${U.icon('right', 16)}</button>` : ''}
    ${atencao.length ? `<div class="card gv-att"><div class="card-h"><h3>${U.icon('mic')} Gravações para ver</h3><a class="link" href="#gravacoes">Todas</a></div>
      ${atencao.map(g => `<button class="gv-att-it" data-act="gvOpen" data-id="${g.id}"><span><strong>${U.esc(Gravador.nome(g))}</strong><small>${U.fmtShort(g.date)} ${g.time} · ${Gravador.fmt(g.dur)}</small></span>${!g.tipo ? '<span class="badge b-blue">Descrever</span>' : Views.gravacoes.chip(g)}</button>`).join('')}</div>` : ''}
    <section class="card cal-card cal-home">${Cal.render('home')}${Cal.day('home')}</section>`;
  },
  render() { return this.renderEnxuto(); },
};
Object.assign(Views.dashboard, { nav: 'Calendário', bnav: 'Calendário', icon: 'calendar' });
