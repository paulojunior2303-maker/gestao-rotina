'use strict';
/* Tutorial de boas-vindas (primeiro acesso) e tela "Guia de uso" */

const Guide = {
  /* Onde os dados ficam, conforme o modo em que o app está rodando */
  whereData() {
    if (Native.available()) return 'neste celular';
    if (Cloud.state === 'on') return 'na sua conta Claude (área privada), iguais no celular e no computador';
    return 'neste navegador';
  },
  /* Ilustrações: miniaturas dos componentes reais do app (não clicáveis) */
  mock: {
    nav: () => `<div class="tour-mock tm-nav">${[['dashboard', 'Início'], ['clock', 'Agenda'], ['tasks', 'Tarefas'], ['alert', 'Imprevistos'], ['menu', 'Menu']].map(([i, l], n) => `<span class="${n === 0 ? 'on' : ''}">${U.icon(i, 18)}<small>${l}</small></span>`).join('')}</div>`,
    agenda: () => `<div class="tour-mock"><div class="blk" style="--c:#0284c7"><div class="blk-time"><strong>09:00</strong><span>10:30</span></div>
      <div class="blk-body"><div class="blk-head"><span class="blk-title">Acompanhamento operacional</span></div><div class="blk-meta">${H.chip('Operacional', '#0284c7')} ${H.status('pendente')}</div></div>
      <div class="blk-actions"><span class="icon-btn ok">${U.icon('check', 16)}</span><span class="icon-btn info">${U.icon('play', 14)}</span><span class="icon-btn">${U.icon('more', 16)}</span></div></div>
      <div class="tm-legend"><span>${U.icon('check', 13)} Concluir</span><span>${U.icon('play', 11)} Iniciar</span><span>${U.icon('more', 13)} Adiar, mover, excluir</span></div></div>`,
    task: () => `<div class="tour-mock"><div class="task dl-row-soon" style="--c:#d97706"><label class="tk-check"><span></span></label><div class="tk-body"><div class="tk-title">Cobrar relatório da equipe</div>
      <div class="tk-meta">${H.prio('alta')} <span class="muted">${U.icon('user', 13)} Carlos</span> <span class="dl dl-today">${U.icon('clock', 13)} Vence hoje</span></div></div></div>
      <div class="tm-legend"><span>Toque no quadrado para concluir</span><span>Toque no texto para editar</span></div></div>`,
    occ: () => `<div class="tour-mock"><div class="occ card prio-border-urgente"><div class="occ-h"><h3>Câmeras offline no cliente</h3><span class="grow"></span>${H.prio('urgente')}</div>
      <div class="occ-actions"><span class="btn sm">${U.icon('calendar', 15)} Encaixar na agenda</span><span class="btn sm ghost ok-text">${U.icon('check', 15)} Resolver</span></div></div></div>`,
    dash: () => `<div class="tour-mock tm-kpis"><div class="kpi k-green"><span class="kpi-l">Progresso do dia</span><strong class="kpi-v">45%</strong></div><div class="kpi k-red"><span class="kpi-l">Atrasadas</span><strong class="kpi-v">2</strong></div><div class="kpi k-yellow"><span class="kpi-l">Imprevistos</span><strong class="kpi-v">1</strong></div></div>`,
    plan: () => `<div class="tour-mock tm-grid">${[['week', 'Semanal', 'Checklist por dia'], ['calendar', 'Mensal', '4 ciclos + calendário'], ['kanban', 'Projetos', 'Etapas e Kanban'], ['chart', 'Indicadores', 'Gráficos, Excel, PDF']].map(([i, t, d]) => `<div>${U.icon(i, 20)}<strong>${t}</strong><small>${d}</small></div>`).join('')}</div>`,
    data: () => `<div class="tour-mock tm-data"><span class="btn sm primary">${U.icon('arrow', 15)} Enviar meus dados</span><span class="btn sm">${U.icon('download', 15)} Receber dados</span></div>`,
  },

  slides() {
    const m = this.mock;
    return [
      { icon: 'dashboard', color: '#2563eb', title: 'Bem-vindo ao seu centro de controle',
        text: 'Em poucos toques você vê o que fazer hoje, o que está atrasado, o que cobrar da equipe e quais projetos precisam de atenção.',
        mock: m.nav(),
        points: ['Use a <strong>barra inferior</strong> para as telas do dia a dia.', '<strong>Menu</strong> abre o planejamento, projetos, indicadores, configurações e este guia.', Native.available() ? 'O botão <strong>voltar</strong> do Android fecha janelas e retorna ao Início.' : 'O botão <strong>?</strong> no topo abre o guia completo a qualquer momento.'] },
      { icon: 'dashboard', color: '#0f1b2d', title: 'Início: o resumo do seu dia',
        text: 'A primeira tela mostra a situação geral, atualizada automaticamente.',
        mock: m.dash(),
        points: ['<strong>O que fazer hoje</strong>: próximas atividades da agenda.', '<strong>O que resolver</strong>: urgentes, alta prioridade e atrasados.', '<strong>O que cobrar da equipe</strong>: itens com responsável definido.', 'Toque nos cartões para abrir a lista correspondente.'] },
      { icon: 'clock', color: '#0284c7', title: 'Agenda: seu dia por horário',
        text: 'Sua rotina já vem montada (08:00–18:00). Marque o andamento ao longo do dia.',
        mock: m.agenda(),
        points: ['Toque na atividade para mudar horário, prioridade ou observações.', 'Use <strong>‹ ›</strong> no topo para ver outros dias.', '<strong>Reorganizar</strong> move as atrasadas para o próximo dia útil.', '<strong>Horário fixo</strong> só impede que a atividade seja empurrada; ela continua contando no progresso.'] },
      { icon: 'alert', color: '#dc2626', title: 'Imprevistos: o urgente sem bagunçar o dia',
        text: 'Registre demandas que exigem atenção imediata pelo botão <strong>Imprevisto</strong>.',
        mock: m.occ(),
        points: ['<strong>Encaixar na agenda</strong> reserva um horário e empurra as atividades seguintes, sem mexer no intervalo.', 'Defina um <strong>responsável</strong> para acompanhar em “O que cobrar”.', '<strong>Resolver</strong> encerra o imprevisto e conclui o horário reservado.'] },
      { icon: 'tasks', color: '#d97706', title: 'Tarefas com prazo e alertas',
        text: 'Cadastre pendências com prazo, prioridade e, se delegar, o responsável.',
        mock: m.task(),
        points: ['<span class="c-yellow"><strong>Amarelo</strong></span>: vence hoje ou em breve. <span class="c-red"><strong>Vermelho</strong></span>: atrasada.', 'Os contadores no topo funcionam como filtros (Abertas, Atrasadas, Concluídas…).'] },
      { icon: 'week', color: '#7c3aed', title: 'Planejamento, projetos e resultados',
        text: 'No <strong>Menu</strong> ficam as visões de médio prazo.',
        mock: m.plan(),
        points: ['<strong>Semanal</strong>: foco de cada dia (segunda = planejamento… sexta = resultados).', '<strong>Projetos</strong>: marque as etapas e o percentual é calculado sozinho.', '<strong>Indicadores</strong>: toque em <strong>Lançar dados</strong>. Campo vazio aparece como “sem dados”, nunca como zero.'] },
      { icon: 'download', color: '#16a34a', title: 'Seus dados', final: true,
        text: `Tudo o que você cadastra fica salvo ${this.whereData()}.`,
        mock: m.data(),
        points: ['Para passar os dados entre o app, o site e o link do Claude: Configurações → Dados → <strong>Enviar meus dados</strong> / <strong>Receber dados</strong>.', 'Faça um <strong>backup</strong> de vez em quando: Configurações → Exportar backup.', Native.available() ? 'Desinstalar o app apaga os dados; o backup permite restaurá-los.' : 'O backup também serve para levar os dados a outro aparelho.', 'Em <strong>Configurações</strong> você ajusta jornada, rotina, categorias, técnicos e metas.'] },
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
  render() {
    const sec = (id, icon, title, html, open) => `<details class="guide-sec card" ${open ? 'open' : ''} id="g-${id}"><summary>${U.icon(icon)}<span>${title}</span>${U.icon('right', 16)}</summary><div class="guide-body">${html}</div></details>`;
    const li = arr => `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `
    <div class="card guide-hero">
      <div><h2>Como usar o Gestão de Rotina</h2><p class="muted">Toque em um tema para abrir. As instruções valem para o celular e para o computador.</p></div>
      <button class="btn primary" data-act="tourOpen">${U.icon('play', 14)} Rever tutorial</button>
    </div>

    ${sec('inicio', 'flag', 'Primeiros passos (5 minutos)', `<ol>
      <li><strong>Configurações → Jornada</strong>: confira entrada, saída, intervalo e dias de trabalho.</li>
      <li><strong>Configurações → Rotina padrão</strong>: ajuste os blocos de horário do seu dia. Eles montam a agenda de cada dia útil.</li>
      <li><strong>Configurações → Técnicos</strong>: cadastre a equipe para usar como responsáveis e na produtividade individual.</li>
      <li><strong>Tarefas</strong> e <strong>Projetos</strong>: cadastre as pendências e obras em andamento.</li>
      <li>Opcional: <strong>Configurações → Dados → Carregar dados de demonstração</strong> para ver o app preenchido. Remova depois com um toque.</li></ol>`, true)}

    ${sec('nav', 'menu', 'Navegação no celular', li([
      '<strong>Barra inferior</strong>: Início, Agenda, Tarefas, Imprevistos e Menu.',
      '<strong>Menu</strong> (ou ☰ no topo): Planejamento semanal e mensal, Projetos, Indicadores, Configurações e este Guia.',
      'Os <strong>números em vermelho</strong> no menu indicam imprevistos abertos e tarefas atrasadas.',
      'Formulários abrem por baixo da tela; <strong>Salvar</strong> fica no rodapé. Toque fora ou no X para fechar sem salvar.',
      'Botão <strong>voltar do Android</strong>: fecha a janela aberta → volta ao Início → sai do app.',
      'O menu <strong>⋯</strong> reúne as ações menos usadas (adiar, mover, duplicar, excluir).',
    ]))}

    ${sec('dash', 'dashboard', 'Início (Dashboard)', li([
      '<strong>Progresso do dia</strong>: atividades da agenda concluídas (o intervalo e as canceladas não contam).',
      '<strong>Tarefas concluídas / pendentes / atrasadas</strong>: toque no cartão para abrir a lista filtrada.',
      '<strong>O que fazer hoje</strong>: a atividade atual (marcada “Agora”) e as próximas.',
      '<strong>O que resolver</strong>: imprevistos abertos, tarefas urgentes, de alta prioridade ou atrasadas.',
      '<strong>O que cobrar da equipe</strong>: tarefas, imprevistos e pendências de projeto com responsável definido.',
      '<strong>Resumo da semana</strong>, <strong>Metas</strong> e <strong>Próximos 7 dias</strong> (prazos e compromissos).',
    ]))}

    ${sec('agenda', 'clock', 'Cronograma diário (Agenda)', `${li([
      '<strong>✓</strong> conclui, <strong>▶</strong> marca “em andamento” (só uma por vez), <strong>↶</strong> reabre.',
      '<strong>Toque na atividade</strong> para editar título, horário, categoria, prioridade, status e observações.',
      'Ao mudar um horário, deixe marcado <strong>“deslocar as atividades seguintes”</strong>: o resto do dia é empurrado na mesma ordem, e o intervalo fica no lugar.',
      '<strong>⋯</strong> → Adiar 15/30 min, Mover para o próximo dia útil, Mover para outra data, Duplicar, Cancelar ou Excluir.',
      '<strong>Reorganizar</strong> → mover todas as atrasadas de uma vez, encaixar imprevisto ou restaurar a rotina padrão do dia.',
      '<strong>‹ ›</strong> e o campo de data trocam o dia; <strong>Hoje</strong> volta para o dia atual.',
    ])}<p class="guide-note"><strong>Horário fixo</strong> significa só que a atividade não é empurrada quando o dia é reorganizado. Ela continua contando no progresso normalmente.</p>
    <p class="guide-note"><strong>Rotina padrão × dia:</strong> cada dia começa com a rotina padrão. Mudanças feitas em um dia valem só para ele. Para mudar todos os dias, edite em Configurações → Rotina padrão, ou marque “Aplicar também à rotina padrão” ao editar.</p>`)}

    ${sec('imprevistos', 'alert', 'Imprevistos', li([
      'Registre pelo botão <strong>Imprevisto</strong> (na Agenda) ou em <strong>Imprevistos → Registrar</strong>.',
      'Preencha título, prioridade, prazo e <strong>responsável</strong> (aparece em “O que cobrar”).',
      '<strong>Encaixar na agenda</strong>: escolha data, horário e duração. “Deslocar” empurra as atividades seguintes; “Apenas encaixar” mantém tudo como está.',
      '<strong>Iniciar</strong> e <strong>Resolver</strong> atualizam o status. Ao resolver, o horário reservado na agenda é concluído.',
      'Use as abas <strong>Abertos / Encerrados / Todos</strong> para consultar o histórico.',
    ]))}

    ${sec('tarefas', 'tasks', 'Tarefas', li([
      '<strong>+ Nova tarefa</strong>: nome, descrição, categoria, prioridade, status, início, prazo, horário e observações.',
      'Toque no <strong>quadrado</strong> à esquerda para concluir (aparece “Desfazer” por alguns segundos).',
      'O seletor de status à direita muda para Pendente, Em andamento, Concluída ou Cancelada.',
      'Os <strong>contadores do topo</strong> filtram a lista. Abaixo, há busca e filtros por categoria, prioridade e prazo.',
      'Alertas: <span class="c-yellow"><strong>amarelo</strong></span> = vence hoje ou nos próximos dias (ajustável em Configurações); <span class="c-red"><strong>vermelho</strong></span> = atrasada.',
    ]))}

    ${sec('semanal', 'week', 'Planejamento semanal e mensal', li([
      '<strong>Semanal</strong>: cada dia útil tem um foco de gestão e um checklist. Marque os itens ao longo da semana.',
      'O lápis edita o foco ou o item. <strong>+ Adicionar item</strong> inclui novos. O modelo vale para todas as semanas; as marcações são de cada semana.',
      '<strong>Mensal</strong>: 4 ciclos (Diagnóstico, Equipe, Projetos, Consolidação) com checklist por mês. O ciclo atual fica destacado.',
      'No <strong>calendário</strong>, os pontos coloridos indicam compromissos, prazos de tarefas, projetos e imprevistos. Toque no dia para ver detalhes ou criar um compromisso.',
    ]))}

    ${sec('projetos', 'kanban', 'Projetos', li([
      '<strong>+ Novo projeto</strong>: cliente, responsável, datas, status e etapas (uma por linha).',
      'Toque no cartão para abrir: marque as <strong>etapas</strong> (o % é calculado sozinho), registre <strong>pendências</strong> e mude o status.',
      '<strong>Kanban</strong>: no computador, arraste entre colunas. No celular, mude o status dentro do projeto.',
      '<strong>Linha do tempo</strong>: barras do início ao prazo, com a linha vermelha marcando hoje.',
    ]))}

    ${sec('indicadores', 'chart', 'Indicadores e relatórios', li([
      '<strong>Lançar dados</strong>: informe por dia, para a equipe ou por técnico. Preencha só o que tiver.',
      'Indicadores: <strong>pontos de câmera instalados, manutenções e retrabalhos</strong>, somados no período. Campo vazio = <strong>“sem dados”</strong> (nunca vira zero).',
      'Troque o período (Semana, Mês, Ano, Personalizado) e o gráfico (Diário, Semanal, Mensal).',
      Native.available() ? '<strong>Excel</strong> e <strong>backup</strong> abrem o menu Compartilhar (Drive, Arquivos, WhatsApp…). <strong>PDF</strong> abre a impressão: escolha “Salvar como PDF”.' : '<strong>Excel</strong> gera a planilha; <strong>PDF</strong> gera o relatório para imprimir ou “Salvar como PDF”.',
    ]))}

    ${sec('config', 'settings', 'Configurações', li([
      '<strong>Aparência</strong>: modo <strong>claro</strong>, <strong>escuro</strong> ou <strong>automático</strong> (segue o tema do celular).',
      '<strong>Jornada</strong>: horários, intervalo, dias de trabalho e antecedência dos alertas de prazo.',
      '<strong>Rotina padrão</strong>: blocos de horário recorrentes (dias da semana ou um dia do mês).',
      '<strong>Categorias</strong>, <strong>Prioridades e status</strong>: nomes e cores.',
      '<strong>Técnicos</strong> e <strong>Metas</strong> (ex.: pontos de câmera por semana, retrabalhos no máximo X).',
    ]))}

    ${sec('dados', 'download', 'Seus dados e backup', li([
      `Os dados ficam salvos ${Guide.whereData()}.`,
      '<strong>Passar dados do celular para a web (ou o contrário):</strong> em Configurações → Dados, toque em <strong>Enviar meus dados</strong> → Copiar ou Enviar código. Mande o código para você mesmo (WhatsApp na conversa “Você”, e-mail ou Keep). Na outra versão, abra <strong>Receber dados</strong>, cole e confirme.',
      '<strong>Exportar backup (arquivo)</strong> gera um arquivo com tudo. Guarde no Drive ou envie para você mesmo. <strong>Importar backup</strong> restaura o arquivo (substitui os dados atuais).',
      Native.available() ? '<strong>Atualizar o app</strong>: instale o novo APK por cima, sem desinstalar, e os dados são mantidos. Desinstalar apaga os dados.' : 'Para usar em outro aparelho, exporte aqui e importe lá.',
      'Os <strong>dados de exemplo</strong> têm o selo EXEMPLO e podem ser removidos sem afetar os seus.',
    ]))}

    ${sec('faq', 'info', 'Dúvidas frequentes', `<dl class="faq">
      <dt>Concluí uma atividade, mas o progresso não mudou.</dt><dd>Só o <strong>Intervalo</strong> e atividades <strong>canceladas</strong> ficam fora do progresso. Confira se a atividade não está com status Cancelada.</dd>
      <dt>Por que um indicador aparece como “sem dados”?</dt><dd>Porque nada foi lançado para ele no período escolhido. O app não inventa nem assume zero.</dd>
      <dt>Uma atividade aparece “Fora do expediente”.</dt><dd>Ela termina depois do horário de saída (geralmente após deslocar o dia). Use ⋯ → Mover para o próximo dia útil.</dd>
      <dt>Como faço para que uma mudança valha para todos os dias?</dt><dd>Edite em Configurações → Rotina padrão, ou marque “Aplicar também à rotina padrão” ao editar uma atividade da agenda.</dd>
      <dt>Como levo meus dados do app para a web (ou para outro celular)?</dt><dd>Configurações → Dados → <strong>Enviar meus dados</strong>, copie o código e mande para você mesmo. Na outra versão: Configurações → Dados → <strong>Receber dados</strong>, cole e confirme. Os dados da versão de destino são substituídos.</dd>
    </dl>`)}`;
  },
};

Object.assign(Actions, {
  tourOpen() { Tutorial.open(0); },
});
