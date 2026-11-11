'use strict';
/* Tutorial de boas-vindas (primeiro acesso) e tela "Guia de uso" */

const Guide = {
  /* Onde os dados ficam, conforme o modo em que o app está rodando */
  whereData() {
    if (typeof Drive !== 'undefined' && Drive.connected()) return `${Native.available() ? 'neste celular' : 'neste navegador'} e no seu Google Drive (iguais no app e no site)`;
    if (Native.available()) return 'neste celular';
    if (Cloud.state === 'on') return 'na sua conta Claude (área privada), iguais no celular e no computador';
    return 'neste navegador';
  },
  /* Ilustrações: miniaturas dos componentes reais do app (não clicáveis) */
  mock: {
    nav: () => `<div class="tour-mock tm-side"><div class="tm-top">${U.icon('menu', 20)}<strong>Início</strong></div><div class="tm-menu">${[['dashboard', 'Início'], ['clock', 'Agenda'], ['tasks', 'Tarefas'], ['users', 'Reuniões e feedbacks'], ['alert', 'Imprevistos']].map(([i, l], n) => `<span class="${n === 0 ? 'on' : ''}">${U.icon(i, 16)}${l}</span>`).join('')}</div></div>`,
    agenda: () => `<div class="tour-mock"><div class="blk" style="--c:#7b3fe4"><div class="blk-time"><strong>09:00</strong><span>10:30</span></div>
      <div class="blk-body"><div class="blk-head"><span class="blk-title">Acompanhamento operacional</span></div><small class="blk-kind">Rotina do dia</small></div>
      <div class="blk-actions"><span class="icon-btn ok">${U.icon('check', 16)}</span><span class="icon-btn info">${U.icon('play', 14)}</span><span class="icon-btn">${U.icon('more', 16)}</span></div></div>
      <div class="tm-legend"><span>${U.icon('check', 13)} Concluir</span><span>${U.icon('play', 11)} Iniciar</span><span>${U.icon('more', 13)} Adiar, mover, excluir</span></div></div>`,
    task: () => `<div class="tour-mock"><div class="task dl-row-soon" style="--c:#e3a043"><label class="tk-check"><span></span></label><div class="tk-body"><div class="tk-title">Cobrar relatório da equipe</div>
      <div class="tk-meta">${H.prio('alta')} <span class="muted">${U.icon('user', 13)} Carlos</span> <span class="dl dl-today">${U.icon('clock', 13)} Vence hoje</span></div></div></div>
      <div class="tm-legend"><span>Toque no quadrado para concluir</span><span>Toque no texto para editar</span></div></div>`,
    occ: () => `<div class="tour-mock"><div class="occ card prio-border-urgente"><div class="occ-h"><h3>Sistema fora do ar no cliente</h3><span class="grow"></span>${H.prio('urgente')}</div>
      <div class="occ-actions"><span class="btn sm">${U.icon('calendar', 15)} Encaixar na agenda</span><span class="btn sm ghost ok-text">${U.icon('check', 15)} Resolver</span></div></div></div>`,
    dash: () => `<div class="tour-mock tm-kpis"><div class="kpi k-green"><span class="kpi-l">Progresso do dia</span><strong class="kpi-v">45%</strong></div><div class="kpi k-red"><span class="kpi-l">Atrasadas</span><strong class="kpi-v">2</strong></div><div class="kpi k-yellow"><span class="kpi-l">Imprevistos</span><strong class="kpi-v">1</strong></div></div>`,
    plan: () => `<div class="tour-mock tm-grid">${[['calendar', 'Calendário', 'No Início e na Agenda'], ['users', 'Reuniões', 'Pauta, gravação e ata'], ['chat', 'Feedbacks', 'Registro com IA'], ['plus', 'Botão +', 'Cria o item da tela']].map(([i, t, d]) => `<div>${U.icon(i, 20)}<strong>${t}</strong><small>${d}</small></div>`).join('')}</div>`,
    data: () => `<div class="tour-mock tm-data"><span class="btn sm primary">${U.icon('arrow', 15)} Enviar meus dados</span><span class="btn sm">${U.icon('download', 15)} Receber dados</span></div>`,
  },

  slides() {
    const m = this.mock;
    return [
      { icon: 'dashboard', color: 'var(--primary)', title: 'Bem-vindo ao seu centro de controle',
        text: 'Em poucos toques você vê o que fazer hoje, o que está atrasado e o que cobrar da equipe.',
        mock: m.nav(),
        points: ['No celular, a <strong>barra de baixo</strong> leva às telas do dia a dia: Início, Agenda, Tarefas e Imprevistos.', 'O botão redondo <strong>+</strong>, no canto de baixo, cria o item da tela em que você está (tarefa, reunião, imprevisto…). No Início e na Agenda ele pergunta o que criar.', 'Toque em <strong>☰</strong>, no canto superior esquerdo, para abrir o menu com todas as telas. Também dá para arrastar o dedo a partir da borda esquerda.', 'Um <strong>ponto vermelho</strong> no ☰ avisa que há tarefas atrasadas ou imprevistos abertos.', Native.available() ? 'O botão <strong>voltar</strong> do Android fecha janelas e retorna ao Início.' : 'O botão <strong>?</strong> no topo abre o guia completo a qualquer momento.'] },
      { icon: 'dashboard', color: 'var(--primary)', title: 'Início: o resumo do seu dia',
        text: 'A primeira tela mostra a situação geral, atualizada automaticamente.',
        mock: m.dash(),
        points: ['<strong>Calendário</strong>: bata o olho nos compromissos do mês. Toque num dia para ver a lista dele.', '<strong>O que fazer hoje</strong>: próximas atividades da agenda.', '<strong>O que resolver</strong>: urgentes, alta prioridade e atrasados.', '<strong>O que cobrar da equipe</strong>: itens com responsável definido.', 'Toque nos cartões para abrir a lista correspondente.'] },
      { icon: 'clock', color: 'var(--primary)', title: 'Agenda: o seu dia numa lista só',
        text: 'Em cima, a semana (ou o mês inteiro, em <strong>Ver o mês inteiro</strong>). Embaixo, o dia escolhido por horário: rotina, reuniões, compromissos e prazos juntos.',
        mock: m.agenda(),
        points: ['Toque na atividade para mudar horário, prioridade ou observações.', 'Toque num dia do calendário para ver a lista dele. Arraste para os lados para trocar de semana.', '<strong>+</strong> → <strong>Intervalo agora</strong> marca o almoço na hora em que você for e empurra o resto do dia.', '<strong>Reorganizar</strong> move as atrasadas para o próximo dia útil.', '<strong>Horário fixo</strong> só impede que a atividade seja empurrada; ela continua contando no progresso.'] },
      { icon: 'alert', color: 'var(--primary)', title: 'Imprevistos: o urgente sem bagunçar o dia',
        text: 'Registre demandas que exigem atenção imediata pelo botão <strong>+</strong> da tela Imprevistos (ou da Agenda).',
        mock: m.occ(),
        points: ['<strong>Encaixar na agenda</strong> reserva um horário e empurra as atividades seguintes, sem mexer no intervalo.', 'Defina um <strong>responsável</strong> para acompanhar em “O que cobrar”.', '<strong>Resolver</strong> encerra o imprevisto e conclui o horário reservado.'] },
      { icon: 'tasks', color: 'var(--primary)', title: 'Tarefas com prazo e alertas',
        text: 'Cadastre pendências com prazo, prioridade e, se delegar, o responsável.',
        mock: m.task(),
        points: ['<span class="c-yellow"><strong>Amarelo</strong></span>: vence hoje ou em breve. <span class="c-red"><strong>Vermelho</strong></span>: atrasada.', 'Os contadores no topo funcionam como filtros (Abertas, Atrasadas, Concluídas…).', 'Com <strong>horário de prazo</strong>, o app pode te avisar na hora: ligue em Configurações → <strong>Lembretes</strong>.'] },
      { icon: 'users', color: 'var(--primary)', title: 'Reuniões e feedbacks',
        text: 'As conversas com a equipe ficam numa tela só, com duas abas. Abra pelo menu ☰.',
        mock: m.plan(),
        points: ['<strong>Reuniões</strong>: pauta antes; durante, gravação com transcrição ao vivo; depois, a IA escreve a ata.', '<strong>Feedbacks</strong>: grave a conversa com o colaborador e a IA escreve o registro no padrão do seu agente.'] },
      { icon: 'download', color: 'var(--primary)', title: 'Seus dados', final: true,
        text: `Tudo o que você cadastra fica salvo ${this.whereData()}.`,
        mock: m.data(),
        points: ['Para passar os dados entre o app do celular e o site: Configurações → Dados → <strong>Enviar meus dados</strong> / <strong>Receber dados</strong>.', 'Faça um <strong>backup</strong> de vez em quando: Configurações → Exportar backup.', Native.available() ? 'Desinstalar o app apaga os dados; o backup permite restaurá-los.' : 'O backup também serve para levar os dados a outro aparelho.', 'Em <strong>Configurações</strong> você ajusta jornada, rotina, categorias, a equipe e o nome da sua empresa.'] },
    ];
  },
};

const Tutorial = {
  el: null, i: 0,
  open(start = 0) {
    if (this.el) return;
    this.i = start;
    const el = document.createElement('div');
    el.className = 'modal-wrap tour-wrap';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Tutorial');
    document.getElementById('modal-root').appendChild(el);
    this.el = el;
    this.draw();
    requestAnimationFrame(() => el.classList.add('open'));
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-tour]'); if (!a) return;
      const act = a.dataset.tour;
      if (act === 'next') this.go(this.i + 1);
      else if (act === 'prev') this.go(this.i - 1);
      else if (act === 'dot') this.go(Number(a.dataset.n));
      else if (act === 'skip' || act === 'done') this.close(act === 'done');
    });
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(this.i + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
    this.onKey = e => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); this.close(false); }
      else if (e.key === 'ArrowRight') this.go(this.i + 1);
      else if (e.key === 'ArrowLeft') this.go(this.i - 1);
    };
    document.addEventListener('keydown', this.onKey, true);
  },
  go(n) {
    const total = Guide.slides().length;
    if (n < 0 || n >= total) return;
    this.i = n; this.draw();
  },
  draw() {
    const slides = Guide.slides(), s = slides[this.i], last = this.i === slides.length - 1;
    this.el.innerHTML = `<div class="tour" style="--tc:${s.color}">
      <div class="tour-top"><span class="muted small">${this.i + 1} de ${slides.length}</span>${last ? '' : '<button class="btn sm ghost" data-tour="skip">Pular</button>'}</div>
      <div class="tour-body" aria-live="polite">
        <div class="tour-icon">${U.icon(s.icon, 26)}</div>
        <h2>${s.title}</h2>
        <p class="tour-text">${s.text}</p>
        ${s.mock}
        <ul class="tour-points">${s.points.map(p => `<li>${p}</li>`).join('')}</ul>
        ${last && !Store.hasDemo() && !S.tasks.length && !S.projects.length ? '<label class="check tour-demo"><input type="checkbox" id="tour-demo"> <span>Carregar <strong>dados de exemplo</strong> para explorar (marcados como EXEMPLO; dá para remover depois)</span></label>' : ''}
      </div>
      <div class="tour-foot">
        <div class="tour-dots">${slides.map((_, n) => `<button class="${n === this.i ? 'on' : ''}" data-tour="dot" data-n="${n}" aria-label="Etapa ${n + 1}"></button>`).join('')}</div>
        <div class="tour-btns">
          ${this.i ? '<button class="btn ghost" data-tour="prev">Voltar</button>' : ''}
          ${last ? '<button class="btn primary" data-tour="done">Começar a usar</button>' : `<button class="btn primary" data-tour="next">Próximo ${U.icon('right', 16)}</button>`}
        </div>
      </div>
    </div>`;
  },
  close(finished) {
    if (!this.el) return;
    const demo = finished && this.el.querySelector('#tour-demo') && this.el.querySelector('#tour-demo').checked;
    document.removeEventListener('keydown', this.onKey, true);
    const el = this.el; this.el = null;
    el.classList.remove('open'); setTimeout(() => el.remove(), 150);
    S.meta = S.meta || {};
    S.meta.tutorialSeen = true;
    if (demo) Store.loadDemo();
    commit();
    if (demo) UI.toast('Dados de exemplo carregados. Remova quando quiser em Configurações.');
    else if (!finished) UI.toast('Você pode rever o tutorial no Guia de uso (botão ? no topo).');
  },
  /* Primeiro acesso: abre automaticamente uma única vez */
  maybeShow() { if (!(S.meta && S.meta.tutorialSeen)) setTimeout(() => this.open(), 300); },
};

Views.guia = {
  title: 'Guia de uso', icon: 'info', nav: 'Guia de uso',
  mount(root) {
    const id = App.ui.guideSec; if (!id) return;
    App.ui.guideSec = null;
    const el = root.querySelector('#g-' + id);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  },
  render() {
    const want = App.ui.guideSec;
    const sec = (id, icon, title, html, open) => `<details class="guide-sec card" ${(want ? want === id : open) ? 'open' : ''} id="g-${id}"><summary>${U.icon(icon)}<span>${title}</span>${U.icon('right', 16)}</summary><div class="guide-body">${html}</div></details>`;
    const li = arr => `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `
    <div class="card guide-hero">
      <div><h2>Como usar o Gestão de Rotina</h2><p class="muted">Toque em um tema para abrir. As instruções valem para o celular e para o computador.</p></div>
      <button class="btn primary" data-act="tourOpen">${U.icon('play', 14)} Rever tutorial</button>
    </div>

    ${sec('inicio', 'flag', 'Primeiros passos (5 minutos)', `<ol>
      <li><strong>Configurações → Jornada</strong>: confira entrada, saída, intervalo e dias de trabalho.</li>
      <li><strong>Configurações → Rotina padrão</strong>: cadastre as atividades que se repetem no seu dia (ou toque em <strong>Usar modelo de exemplo</strong> e ajuste). Elas montam a agenda de cada dia útil.</li>
      <li><strong>Configurações → Equipe</strong>: cadastre as pessoas da equipe para usar como responsáveis e nos feedbacks.</li>
      <li>Opcional: <strong>Configurações → Aparência</strong>: escreva o nome da sua empresa ou equipe (aparece no menu).</li>
      <li><strong>Tarefas</strong>: cadastre as pendências pelo botão <strong>+</strong>.</li>
      <li>Opcional: <strong>Configurações → Dados → Carregar dados de demonstração</strong> para ver o app preenchido. Remova depois com um toque.</li></ol>`, true)}

    ${sec('nav', 'menu', 'Navegação', li([
      'No celular, a <strong>barra de baixo</strong> tem os atalhos do dia a dia: Início, Agenda, Tarefas e Imprevistos.',
      'Toque em <strong>☰</strong> (canto superior esquerdo) para abrir o menu com todas as telas. No celular, também dá para <strong>arrastar o dedo a partir da borda esquerda</strong>; para fechar, arraste para a esquerda ou toque fora.',
      'O botão redondo <strong>+</strong> (canto de baixo) cria o item da tela atual. No Início e na Agenda ele mostra a lista do que dá para criar: atividade, intervalo, tarefa, reunião, feedback, imprevisto ou compromisso.',
      'O menu é dividido em <strong>Dia a dia</strong> (Início, Agenda, Tarefas, Reuniões e feedbacks, Imprevistos) e <strong>Ajustes</strong>. As telas <strong>Projetos</strong> e <strong>Indicadores</strong> ficam ocultas até você ligar em Configurações → Aparência (aí aparecem em Planejamento).',
      'Um <strong>ponto vermelho</strong> no ☰ e os <strong>números</strong> no menu indicam imprevistos abertos e tarefas atrasadas.',
      'Formulários abrem por baixo da tela; <strong>Salvar</strong> fica no rodapé. Toque fora ou no X para fechar sem salvar.',
      'Botão <strong>voltar do Android</strong>: fecha a janela aberta → volta ao Início → sai do app.',
      'O menu <strong>⋯</strong> reúne as ações menos usadas (adiar, mover, duplicar, excluir).',
    ]))}

    ${sec('calendario', 'calendar', 'Calendário', li([
      'Fica no <strong>Início</strong> e no topo da <strong>Agenda</strong>. Mostra reuniões, compromissos e prazos de tarefas e imprevistos, cada tipo com uma cor (veja a legenda embaixo).',
      'No celular, cada dia mostra <strong>bolinhas coloridas</strong>; no computador, os títulos aparecem dentro dos dias.',
      'Toque num dia para ver a <strong>lista dele</strong> ao lado (ou embaixo). Toque num item para abri-lo.',
      '<strong>Semana / Mês</strong> (no Início) e <strong>Ver o mês inteiro</strong> (na Agenda) trocam o tamanho do calendário. <strong>‹ ›</strong> ou <strong>arrastar o dedo</strong> para os lados troca de mês ou semana. <strong>Hoje</strong> volta para o dia atual.',
      'O botão <strong>+</strong> cria algo no dia escolhido: reunião, compromisso, tarefa ou atividade na agenda.',
      '<strong>Agenda do dia</strong>, no fim da lista, abre o cronograma por horário daquele dia.',
    ]))}

    ${sec('dash', 'dashboard', 'Início (Dashboard)', li([
      '<strong>Progresso do dia</strong>: atividades da agenda concluídas (o intervalo e as canceladas não contam).',
      '<strong>Tarefas concluídas / pendentes / atrasadas</strong>: toque no cartão para abrir a lista filtrada.',
      '<strong>O que fazer hoje</strong>: a atividade atual (marcada “Agora”) e as próximas.',
      '<strong>O que resolver</strong>: imprevistos abertos, tarefas urgentes, de alta prioridade ou atrasadas.',
      '<strong>O que cobrar da equipe</strong>: tarefas e imprevistos com responsável definido.',
      'A <strong>linha do tempo</strong> abaixo da data mostra o dia inteiro: blocos roxos estão concluídos, o claro é o que acontece agora e os vermelhos estão atrasados. Toque nela para abrir a agenda.',
      'Logo abaixo, o <strong>calendário</strong> (veja o tema Calendário).',
      `<strong>Resumo da semana</strong>${S.settings.showIndicadores ? ' e <strong>Metas</strong>' : ''}.`,
    ]))}

    ${sec('agenda', 'clock', 'Agenda', `<p>O seu dia numa tela só. Em cima, o <strong>calendário da semana</strong>; toque num dia para abri-lo, ou em <strong>Ver o mês inteiro</strong>. Embaixo, a <strong>lista do dia por horário</strong>: as atividades da rotina e, no meio delas, reuniões, compromissos e prazos.</p>${li([
      'Toque num dia do calendário (ou arraste para os lados para trocar de semana). <strong>Hoje</strong> volta para o dia atual.',
      '<strong>✓</strong> conclui e <strong>↶</strong> reabre. Toque na atividade para editar título, horário, categoria, prioridade, status e observações.',
      'Reuniões, compromissos e prazos aparecem com a cor do tipo. Toque neles para abrir.',
      'Botão <strong>+</strong>: nova atividade, <strong>Intervalo agora</strong> (marca o almoço na hora em que você for e empurra o que vem depois), tarefa, reunião, feedback, imprevisto ou compromisso, tudo no dia escolhido.',
      'Ao mudar um horário, deixe marcado <strong>“deslocar as atividades seguintes”</strong>: o resto do dia é empurrado na mesma ordem, e o intervalo fica no lugar.',
      '<strong>⋯</strong> da atividade → Começar agora, Adiar 15/30 min, Mover para o próximo dia útil, Mover para outra data, Duplicar, Cancelar ou Excluir.',
      '<strong>Reorganizar</strong> → mover todas as atrasadas de uma vez, encaixar imprevisto ou restaurar a rotina padrão do dia.',
      'O intervalo pode ser flexível, em horário fixo ou desligado: Configurações → Jornada.',
    ])}<p class="guide-note"><strong>Horário fixo</strong> significa só que a atividade não é empurrada quando o dia é reorganizado. Ela continua contando no progresso normalmente.</p>
    <p class="guide-note"><strong>Rotina padrão × dia:</strong> cada dia começa com a rotina padrão. Mudanças feitas em um dia valem só para ele. Para mudar todos os dias, edite em Configurações → Rotina padrão, ou marque “Aplicar também à rotina padrão” ao editar.</p>`)}

    ${sec('imprevistos', 'alert', 'Imprevistos', li([
      'Registre pelo botão <strong>+</strong> na tela Imprevistos, ou pelo <strong>+</strong> da Agenda (aí ele já é encaixado no dia).',
      'Preencha título, prioridade, prazo e <strong>responsável</strong> (aparece em “O que cobrar”).',
      '<strong>Encaixar na agenda</strong>: escolha data, horário e duração. “Deslocar” empurra as atividades seguintes; “Apenas encaixar” mantém tudo como está.',
      '<strong>Iniciar</strong> e <strong>Resolver</strong> atualizam o status. Ao resolver, o horário reservado na agenda é concluído.',
      'Use as abas <strong>Abertos / Encerrados / Todos</strong> para consultar o histórico.',
    ]))}

    ${sec('tarefas', 'tasks', 'Tarefas', li([
      'Botão <strong>+</strong>: nome, descrição, categoria, prioridade, status, início, prazo, horário e observações.',
      'Toque no <strong>quadrado</strong> à esquerda para concluir (aparece “Desfazer” por alguns segundos).',
      'O seletor de status à direita muda para Pendente, Em andamento, Concluída ou Cancelada.',
      'Os <strong>contadores do topo</strong> filtram a lista. Abaixo, há busca e filtros por categoria, prioridade e prazo.',
      'Alertas: <span class="c-yellow"><strong>amarelo</strong></span> = vence hoje ou nos próximos dias (ajustável em Configurações); <span class="c-red"><strong>vermelho</strong></span> = atrasada.',
    ]))}

    ${sec('reunioes', 'users', 'Reuniões (pauta, registro e IA)', `
      <p>Fica em <strong>Menu → Reuniões e feedbacks</strong>, aba <strong>Reuniões</strong>. Serve para chegar na reunião com a pauta pronta, gravar com transcrição ao vivo e sair com os combinados registrados.</p>
      <ol>
        <li><strong>Antes:</strong> toque em <strong>+</strong> e preencha título, dia, horário e a <strong>pauta</strong>, um assunto por linha. Ou descreva o tema em <strong>Gerar pauta com IA</strong>: ela monta a pauta e pode incluir os assuntos que ficaram pendentes nas últimas reuniões.</li>
        <li><strong>Na hora:</strong> toque em <strong>Iniciar</strong> no cartão da reunião (ou abra a reunião e toque em <strong>Iniciar reunião</strong>). Dá para iniciar a qualquer momento, antes ou depois do horário marcado.</li>
        <li>Toque em <strong>Iniciar gravação</strong>. A transcrição aparece na tela a cada ~40 segundos, enquanto a conversa acontece. Marque os assuntos da pauta conforme forem tratados.</li>
        <li>No fim, toque em <strong>Encerrar gravação</strong>: a IA escreve a <strong>ata</strong> no padrão do seu agente, marca a pauta e lista os combinados. Use <strong>Natural</strong>, <strong>Compactar</strong> ou <strong>Detalhar</strong> para ajustar a ata, e <strong>Copiar</strong> ou <strong>Compartilhar</strong> para enviar.</li>
        <li>Confira, marque <strong>Criar uma tarefa para cada combinado</strong> se quiser, e toque em <strong>Salvar registro</strong>. A transcrição fica guardada junto.</li>
      </ol>
      <p class="guide-note">Durante a gravação, mantenha o app aberto: a tela fica acesa sozinha e o app não deixa fechar a janela sem encerrar a gravação. Precisa de internet para transcrever; trechos que falharem são tentados de novo ao encerrar. O áudio não fica guardado, só o texto. Avise os participantes antes de gravar.</p>
      <p class="guide-note">Sem gravar também funciona: escreva ou dite (microfone do teclado) suas anotações e toque em <strong>Preencher com IA</strong>. A chave da IA fica em <strong>Configurações → IA</strong> (ou cole direto na tela da reunião).</p>`)}

    ${sec('feedbacks', 'chat', 'Feedbacks da equipe', `
      <p>Fica em <strong>Menu → Reuniões e feedbacks</strong>, aba <strong>Feedbacks</strong>. Registra as conversas individuais com cada colaborador, com histórico por pessoa.</p>
      <ol>
        <li>Toque em <strong>+</strong>, escreva o nome do colaborador (ele entra na lista da equipe), o tipo (feedback, orientação verbal ou advertência formal) e o tom.</li>
        <li>Na conversa, toque em <strong>Iniciar gravação</strong>. A transcrição aparece na tela enquanto vocês conversam. Também dá para só escrever ou ditar anotações.</li>
        <li>Toque em <strong>Encerrar gravação</strong>: a IA escreve o registro no padrão do seu agente (2 ou 3 parágrafos) e separa os <strong>acordos</strong>.</li>
        <li>Ajuste com <strong>Natural</strong>, <strong>Compactar</strong> ou <strong>Detalhar</strong>, marque se quer criar tarefas para os acordos (com o colaborador como responsável) e toque em <strong>Salvar feedback</strong>.</li>
      </ol>
      <p class="guide-note">Avise o colaborador antes de gravar. O áudio não fica guardado, só o texto. Toque no nome de uma pessoa para ver todo o histórico dela.</p>`)}

    ${sec('lembretes', 'clock', 'Lembretes (avisos)', `
      <p>O app avisa na hora certa, ${Native.available() ? 'mesmo com o app fechado' : 'enquanto o site estiver aberto em alguma aba'}. Ligue em <strong>Configurações → Lembretes</strong>.</p>
      ${li([
        '<strong>Tarefas e imprevistos</strong> com horário de prazo: aviso antes do prazo (você escolhe quanto) e, se quiser, repetição a cada 30 min depois que vencer, por até 2 h.',
        '<strong>Compromissos</strong> com horário: aviso antes de começar, com a quantidade de assuntos da pauta.',
        '<strong>Resumo do dia</strong>: no início do expediente, quantos prazos, compromissos e atrasos há no dia.',
        'No aviso de tarefa, <strong>Feito</strong> conclui a tarefa sem abrir o app. <strong>Ciente</strong> ou <strong>Parar de avisar</strong> encerra as repetições daquele item.',
        'Use <strong>Enviar aviso de teste</strong> para conferir se está funcionando.',
      ])}
      ${Native.available() ? '<p class="guide-note"><strong>Xiaomi / Redmi:</strong> para os avisos tocarem com o app fechado, deixe tudo verde em Configurações → Lembretes: notificações, alarmes exatos, bateria sem restrição e <strong>inicialização automática</strong> ligada.</p>' : ''}`)}

    ${!S.settings.showProjetos ? '' : sec('projetos', 'kanban', 'Projetos', li([
      'Botão <strong>+</strong>: cliente, responsável, datas, status e etapas (uma por linha).',
      'Toque no cartão para abrir: marque as <strong>etapas</strong> (o % é calculado sozinho), registre <strong>pendências</strong> e mude o status.',
      '<strong>Kanban</strong>: no computador, arraste entre colunas. No celular, mude o status dentro do projeto.',
      '<strong>Linha do tempo</strong>: barras do início ao prazo, com a linha vermelha marcando hoje.',
    ]))}

    ${S.settings.showIndicadores ? sec('indicadores', 'chart', 'Indicadores e relatórios', li([
      '<strong>Lançar dados</strong>: informe por dia, para a equipe ou por pessoa. Preencha só o que tiver.',
      `Indicadores: <strong>${METRICS.map(m => U.esc(m.label).toLowerCase()).join(', ')}</strong>, somados no período (os nomes podem ser trocados em Configurações → Indicadores e metas).`+' Campo vazio = <strong>“sem dados”</strong> (nunca vira zero).',
      'Troque o período (Semana, Mês, Ano, Personalizado) e o gráfico (Diário, Semanal, Mensal).',
      Native.available() ? '<strong>Excel</strong> e <strong>backup</strong> abrem o menu Compartilhar (Drive, Arquivos, WhatsApp…). <strong>PDF</strong> abre a impressão: escolha “Salvar como PDF”.' : '<strong>Excel</strong> gera a planilha; <strong>PDF</strong> gera o relatório para imprimir ou “Salvar como PDF”.',
    ])) : ''}

    ${sec('config', 'settings', 'Configurações', li([
      '<strong>IA</strong>: a chave do Google (AI Studio), as <strong>instruções do seu agente</strong> (o padrão das atas e pautas) e o nível da ata (detalhada, compacta ou resumida).',
      '<strong>Aparência</strong>: modo <strong>escuro</strong>, <strong>claro</strong> ou <strong>automático</strong> (segue o tema do celular). Ali também dá para <strong>mostrar ou ocultar a tela Indicadores</strong> no menu.',
      '<strong>Jornada</strong>: horários, intervalo de almoço (flexível, fixo ou sem intervalo), dias de trabalho e antecedência dos alertas de prazo.',
      '<strong>Rotina padrão</strong>: blocos de horário recorrentes (dias da semana ou um dia do mês).',
      '<strong>Categorias</strong>, <strong>Prioridades e status</strong>: nomes e cores.',
      S.settings.showIndicadores ? '<strong>Equipe</strong> e <strong>Indicadores e metas</strong> (ex.: serviços concluídos por semana, retrabalhos no máximo X).' : '<strong>Equipe</strong>: a equipe, usada como responsável em tarefas, imprevistos e projetos.',
    ]))}

    ${sec('dados', 'download', 'Seus dados e backup', li([
      `Os dados ficam salvos ${Guide.whereData()}.`,
      '<strong>Google Drive</strong> (recomendado): em Configurações → Google Drive, toque em <strong>Conectar com o Google</strong> no app e no site, com a mesma conta. A partir daí os dados ficam iguais nos dois e com cópia no seu Drive (pasta “Gestão de Rotina”). Vale sempre a alteração mais recente.',
      '<strong>Passar dados do celular para a web (ou o contrário):</strong> em Configurações → Dados, toque em <strong>Enviar meus dados</strong> → Copiar ou Enviar código. Mande o código para você mesmo (WhatsApp na conversa “Você”, e-mail ou Keep). Na outra versão, abra <strong>Receber dados</strong>, cole e confirme.',
      '<strong>Exportar backup (arquivo)</strong> gera um arquivo com tudo. Guarde no Drive ou envie para você mesmo. <strong>Importar backup</strong> restaura o arquivo (substitui os dados atuais).',
      Native.available() ? '<strong>Atualizar o app</strong>: quando houver versão nova, aparece um aviso no Início com o botão <strong>Baixar</strong>. Instale por cima, sem desinstalar: os dados são mantidos. Desinstalar apaga os dados.' : 'Para usar em outro aparelho, exporte aqui e importe lá.',
      'Os <strong>dados de exemplo</strong> têm o selo EXEMPLO e podem ser removidos sem afetar os seus.',
    ]))}

    ${sec('faq', 'info', 'Dúvidas frequentes', `<dl class="faq">
      <dt>Concluí uma atividade, mas o progresso não mudou.</dt><dd>Só o <strong>Intervalo</strong> e atividades <strong>canceladas</strong> ficam fora do progresso. Confira se a atividade não está com status Cancelada.</dd>
      <dt>Não tenho horário fixo de almoço. Como faço?</dt><dd>Em Configurações → Jornada, deixe o intervalo como <strong>Flexível</strong>. Quando for almoçar, toque em <strong>+</strong> → <strong>Intervalo agora</strong> na Agenda: o resto do dia é empurrado.</dd>
      ${S.settings.showIndicadores ? '<dt>Por que um indicador aparece como “sem dados”?</dt><dd>Porque nada foi lançado para ele no período escolhido. O app não inventa nem assume zero.</dd>' : ''}
      <dt>Como faço para que uma mudança valha para todos os dias?</dt><dd>Edite em Configurações → Rotina padrão, ou marque “Aplicar também à rotina padrão” ao editar uma atividade da agenda.</dd>
      <dt>Como levo meus dados do app para a web (ou para outro celular)?</dt><dd>Configurações → Dados → <strong>Enviar meus dados</strong>, copie o código e mande para você mesmo. Na outra versão: Configurações → Dados → <strong>Receber dados</strong>, cole e confirme. Os dados da versão de destino são substituídos.</dd>
    </dl>`)}`;
  },
};

Object.assign(Actions, {
  tourOpen() { Tutorial.open(0); },
  guideOpen({ id }) { App.ui.guideSec = id; App.go('guia'); },
});
