'use strict';
/* Tela "Guia de uso" */

const Guide = {
  /* Onde os dados ficam, conforme o modo em que o app está rodando */
  whereData() {
    if (typeof Drive !== 'undefined' && Drive.connected()) return `${Native.available() ? 'neste celular' : 'neste navegador'} e no seu Google Drive (iguais no app e no site)`;
    if (Native.available()) return 'neste celular';
    if (Cloud.state === 'on') return 'na sua conta Claude (área privada), iguais no celular e no computador';
    return 'neste navegador';
  },
};


Views.guia = {
  title: 'Guia de uso', icon: 'info', nav: 'Guia de uso',
  mount(root) {
    const id = App.ui.guideSec; if (!id) return;
    App.ui.guideSec = null;
    const el = root.querySelector('#g-' + id);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  },
  renderEnxuto() {
    const sec = (id, icon, title, html, open) => `<details class="guide-sec card" ${open ? 'open' : ''} id="g-${id}"><summary>${U.icon(icon)}<span>${title}</span>${U.icon('right', 16)}</summary><div class="guide-body">${html}</div></details>`;
    const li = arr => `<ul>${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `<div class="card guide-hero"><div><h2>${CANAL_ENXUTO ? 'FlowFire Enxuto' : 'FlowFire'}</h2><p class="muted">Você grava ou cola o que aconteceu, e o app põe na agenda: tarefas, compromissos e imprevistos do seu dia.</p></div></div>
    ${sec('gravar', 'mic', 'Gravar uma reunião ou feedback', li([
      'Toque em <strong>Gravar</strong>, no meio da barra de baixo, e escolha <strong>Reunião</strong>, <strong>Feedback</strong> ou <strong>Relatório do dia</strong>. A gravação começa na hora, sem você criar a reunião antes.',
      'Pode deixar o celular na mesa. A tela fica acesa e você grava por horas.',
      'Para usar o app enquanto grava, toque em <strong>Continuar gravando e usar o app</strong>. A barra vermelha mostra o tempo; toque nela para voltar à gravação.',
      'No fim, toque em <strong>Encerrar gravação</strong> e diga o assunto da reunião ou com quem foi o feedback. Se estiver com pressa, complete depois.',
    ]), true)}
    ${sec('audio', 'upload', 'Áudio ou texto do WhatsApp', li([
      'Em <strong>Gravar → Áudio ou texto</strong>, escolha um ou vários áudios, cole um texto, ou os dois.',
      'A IA transcreve, resume e separa o que é tarefa, compromisso ou imprevisto. Você confere e toca em <strong>Anotar no app</strong>.',
      'No app instalado, você manda direto do WhatsApp: segure o áudio, toque em <strong>Compartilhar</strong> e escolha <strong>FlowFire</strong>.',
    ]))}
    ${sec('transcricao', 'spark', 'Transcrição e resumo', li([
      'O app corta a gravação em <strong>partes de 10 minutos</strong> e transcreve cada parte assim que ela fecha.',
      'Com todas as partes prontas, a IA escreve o <strong>resumo</strong> (ata ou registro do feedback, no padrão do seu agente) e lista os <strong>combinados</strong>. Um toque transforma cada combinado em tarefa.',
      'A IA precisa da sua chave em <strong>Configurações → IA</strong>. Enquanto você não cadastra, o app guarda as gravações.',
      'Cadastre <strong>o seu nome</strong> em <strong>Configurações → Você</strong>. Quando você disser "eu vou…", o item entra na <strong>sua agenda</strong>; quando falar de alguém da equipe, o item vai com essa pessoa de responsável.',
    ]))}
    ${sec('seguro', 'check', 'Se o app fechar no meio', li([
      'O app salva o áudio no celular a cada 5 segundos. Se o app fechar, a bateria acabar ou o celular travar, você abre o app de novo e recupera a gravação.',
      'Sem internet, o app guarda as partes e transcreve quando a conexão voltar.',
      'O áudio fica no celular até você apagar: abra a gravação e toque em <strong>Apagar o áudio</strong>. O resumo e a transcrição continuam.',
      'Você pode ouvir e baixar cada parte.',
    ]))}
    ${sec('calendario', 'calendar', 'Calendário', li([
      'A tela inicial mostra o mês inteiro. Toque num dia para ver gravações, reuniões, compromissos e prazos.',
      'O <strong>+</strong> anota uma tarefa, um compromisso ou uma atividade no dia que você escolheu.',
      CANAL_ENXUTO ? 'Esta cópia guarda os dados só neste aparelho, separados do FlowFire.' : 'Entre com a <strong>conta FlowFire</strong> (Configurações → Conta) para guardar os dados na nuvem. O áudio e a transcrição completa ficam no aparelho.',
    ]))}
    ${sec('agenda', 'clock', 'Agenda e imprevistos', li([
      'A Agenda mostra a semana em cima e, embaixo, o dia escolhido por horário.',
      'Para registrar um imprevisto, toque no <strong>+</strong>, escreva em poucas palavras e diga quanto tempo vai levar. O app encaixa o imprevisto agora e empurra o resto do dia. Se errar, toque em <strong>Desfazer</strong>.',
      'Se o dia atrasou, toque em <strong>Reorganizar</strong>: o app mostra como fica antes de mudar.',
    ]))}
    ${sec('tarefas', 'tasks', 'Tarefas', li([
      'Use ▶ para começar, ✓ para concluir e ✕ para cancelar. O ⋯ edita ou exclui.',
      'Os botões de cima filtram Abertas, Atrasadas e Concluídas. Em <strong>Filtros</strong> você escolhe categoria, prioridade e prazo.',
      'Uma tarefa que se repete (todo dia, toda semana, todo mês) cria a próxima quando você conclui.',
    ]))}`;
  },
  render() { return this.renderEnxuto(); },
};

Object.assign(Actions, {
  guideOpen({ id }) { App.ui.guideSec = id; App.go('guia'); },
});
