'use strict';
/* Início: calendário do mês, com o relatório do dia e as gravações que pedem atenção */
Views.dashboard = {
  title: 'Início', icon: 'dashboard', nav: 'Início',
  fab: () => ({ act: 'quickAdd', label: 'Adicionar', data: { k: Cal.st('home').sel, from: 'home' } }),
  /* Topo da tela inicial: saudação e data no lugar do título (o relógio fica à direita) */
  /* Bom dia das 5h às 11h59, boa tarde do meio-dia às 17h59 e boa noite das 18h às 4h59 (madrugada é noite) */
  saudacao(h = new Date().getHours()) { return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'; },
  hero() {
    const t = U.today(), d = U.parse(t);
    const greet = this.saudacao();
    const eu = (S.settings.usuario || '').trim().split(' ')[0];
    return `<span class="th-greet">${greet}${eu ? ', ' + U.esc(eu) : ''}</span>`;
  },
  /* Sugestão de design 2: a data como protagonista + resumo de três números (tocar leva para a lista certa) */
  diaHero() {
    const t = U.today(), d = U.parse(t), agora = U.nowTime();
    const hoje = S.tasks.filter(x => OPEN(x.status) && x.dueDate === t).length;
    const atr = S.tasks.filter(x => OPEN(x.status) && D.taskLate(x)).length;
    const prox = Cal.itemsOn(t).filter(i => i.time && i.time >= agora && !i.done && !i.semData)[0]
      || D.dayBlocks(t).filter(b => !D.isBreak(b) && !D.blockDone(b) && b.status !== 'cancelada' && b.start >= agora)[0];
    const pNome = prox ? (prox.label || prox.title) : '';
    return `<section class="dia-hero">
      <div class="dh-data"><span class="dh-n">${d.getDate()}</span><span class="dh-sub"><b>${U.WD[U.weekday(t)].replace('-feira', '').toLowerCase()}</b><span>${U.MONTHS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}</span></span></div>
      <div class="dh-resumo">
        <button data-act="goTasks" data-status="abertas"><b>${hoje}</b><small>${hoje === 1 ? 'tarefa hoje' : 'tarefas hoje'}</small></button>
        <button data-act="goTasks" data-status="atrasadas"><b class="${atr ? 'r' : ''}">${atr}</b><small>${atr === 1 ? 'atrasada' : 'atrasadas'}</small></button>
        <button data-act="goAgenda" data-d="${t}"><b>${prox ? (prox.time || prox.start) : '—'}</b><small>${prox ? 'próxima: ' + U.esc(pNome) : 'nada com horário'}</small></button>
      </div></section>`;
  },
  renderEnxuto() {
    const rec = Gravador.recording();
    const atencao = Gravador.list().filter(g => g.status !== 'gravando' && (!g.tipo || g.status === 'pendente')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
    return `
    ${Updater.banner()}
    ${Views.dashboard.diaHero()}
    ${Occ.painel()}
    ${Tasks.focoHtml()}
    ${Views.dashboard.iphoneCard()}
    ${Reminders.webCard()}
    ${(S.settings.usuario || '').trim() ? '' : `<form class="card eu-card" data-submit="euNome">
      <div><strong>Como você se chama?</strong><small>Seu nome vai no relatório do dia, nas atas e na saudação. O que você disser que vai fazer entra na sua agenda.</small></div>
      <div class="eu-row"><input name="nome" placeholder="Seu nome" maxlength="40" autocomplete="name" required><button class="btn primary">Salvar</button></div></form>`}
    <button class="gv-rec-big ${rec ? 'on' : ''}" data-act="${rec ? 'gvTela' : 'gvRec'}">
      <span class="gv-rec-ic">${U.icon(rec ? 'stop' : 'mic', 26)}</span>
      <span><strong>${rec ? 'Gravando… toque para abrir' : 'Gravar reunião ou feedback'}</strong><small>${rec ? 'A gravação continua enquanto você usa o app' : 'Um toque para começar. Você descreve depois.'}</small></span>
    </button>
    ${!rec && D.isWorkday(U.today()) && U.nowMin() >= U.toMin(S.settings.workEnd) - 90 && !Gravador.list().some(g => g.tipo === 'relatorio' && g.date === U.today())
      ? `<button class="gv-rel-btn" data-act="gvRec" data-tipo="relatorio">${U.icon('spark', 20)}<span><strong>Gravar o relatório do dia</strong><small>Fim do expediente: fale o que fez e o que vem amanhã.</small></span>${U.icon('right', 16)}</button>` : ''}
    ${atencao.length ? `<div class="card gv-att"><div class="card-h"><h2 class="h3">${U.icon('mic')} Gravações para ver</h2><a class="link" href="#gravacoes">Todas</a></div>
      ${atencao.map(g => `<button class="gv-att-it" data-act="gvOpen" data-id="${g.id}"><span><strong>${U.esc(Gravador.nome(g))}</strong><small>${U.fmtShort(g.date)} ${g.time} · ${Gravador.fmt(g.dur)}</small></span>${!g.tipo ? '<span class="badge b-blue">Descrever</span>' : Views.gravacoes.chip(g)}</button>`).join('')}</div>` : ''}
    <section class="card cal-card cal-home">${Cal.render('home')}${Cal.day('home')}</section>`;
  },
  render() { return this.renderEnxuto(); },
  /* iPhone no Safari (ainda não instalado): ensina a pôr na Tela de Início. Some ao tocar em "Entendi" (vale por aparelho). */
  ehIphone() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  instalado() { return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); },
  iphoneCard() {
    if (!this.ehIphone() || this.instalado() || Native.available() || Cloud.available()) return '';
    try { if (localStorage.getItem('ff-iphone-ok')) return ''; } catch (e) { /* sem LocalStorage: mostra */ }
    return `<div class="card eu-card ios-card"><div><strong>Use como app no iPhone</strong>
      <small>No Safari, toque em ${U.icon('upload', 14)} <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. O FlowFire abre em tela cheia, com ícone próprio, e seus dados ficam guardados.</small></div>
      <div><button class="btn sm ghost" data-act="iosOk">Entendi</button></div></div>`;
  },
};
Object.assign(Views.dashboard, { nav: 'Calendário', bnav: 'Calendário', icon: 'calendar' });
Object.assign(Actions, {
  iosOk() { try { localStorage.setItem('ff-iphone-ok', '1'); } catch (e) { /* ignora */ } App.render(); },
  euNome(_, form) { const v = form.elements.nome.value.trim().replace(/\s+/g, ' '); if (!v) return; S.settings.usuario = v; commit(); UI.toast(`Prazer, ${v.split(' ')[0]}! Dá para mudar em Configurações → Você.`); },
});
